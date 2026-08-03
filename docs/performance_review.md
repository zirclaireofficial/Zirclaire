# Zirclaire — Performance & Scalability Review

A pass over the data layer for speed and behaviour under load. Verdict first,
then findings ranked by how much they'll matter as the platform grows.

## Verdict

The foundations are sound. Nothing here is broken or will fall over at launch
or with early traffic. The issues below are the kind that bite at **growth**
(tens of thousands of rows / concurrent users), not on day one — so they're
worth doing before scale, not in a panic.

**Already good:**
- **No N+1 loops.** Every list that needs related data batches it with a single
  `.in(...)` (authors, media, tiers, parties). Loading the feed, the store, the
  member list, etc. is a fixed 2–4 queries regardless of row count.
- **57 indexes** across the schema — foreign keys and the columns used in
  filters/sorts (status, created_at, author_id, project_id, conversation_id…)
  are covered.
- **The public feed is cursor-paginated** (`created_at < before`, `limit 20`) —
  the one truly high-traffic list is done right.
- **Money integrity is enforced in the DB** (atomic functions, append-only
  ledgers), so correctness doesn't depend on app-layer discipline.

---

## Findings (ranked)

### 1. RLS re-evaluates `auth.uid()` and helper functions per row — HIGH
Every row-level policy calls `auth.uid()` directly, and many call
`SECURITY DEFINER` helpers per row: `can_view_project(id)`,
`is_project_party(...)`, `is_admin(auth.uid())`, `post_is_visible(...)`,
`author_not_suspended(...)`. On a big table (posts, messages, projects) Postgres
runs these **once per candidate row**, which is the single biggest drag as
tables grow.

**Fix (standard Supabase pattern):** wrap the auth call so it's evaluated once
per query, not per row — `(select auth.uid())` instead of `auth.uid()`. Postgres
caches the scalar subquery. This alone is a large win on the hot tables. Where a
helper is used, the same applies inside the helper.

Example — change:
```sql
using ( author_id = auth.uid() or is_admin(auth.uid()) )
```
to:
```sql
using ( author_id = (select auth.uid()) or (select is_admin((select auth.uid()))) )
```

Impact: big on posts/messages/projects reads. Effort: mechanical edit across the
RLS files. No behaviour change.

### 2. Admin/master list endpoints have no pagination — MEDIUM
These pull **every** matching row into memory:
- `listAllForAdmin` / all-projects (`projects` + all applications)
- `listAllMembers` (every profile)
- `oversight` (every conversation) and `supportQueue` / ticket log
- `myProjectsWithPayments`, `listMine`

Fine at hundreds of rows; slow and memory-heavy at tens of thousands. The public
feed already paginates; these staff views don't.

**Fix:** add `.range()`/cursor pagination + a search/filter server-side, and
default to a page (e.g. 50) with "load more". The ticket log and members list
are the first that'll feel it.

### 3. `latestPreviews` reads *all* messages for the listed threads — MEDIUM
In messaging infra, the inbox/queue previews fetch every message for every
listed conversation, then keep the newest per thread in JS. That's a growing
scan on the busiest table (`messages`).

**Fix:** denormalise a `last_message_preview` (and we already have
`last_message_at`) onto `conversations`, updated by the same trigger that bumps
`last_message_at`. Then the list needs zero message reads. Cheap and removes the
scan entirely.

### 4. Master stats pulls whole tables to aggregate in JS — MEDIUM
`/api/master/stats` selects the **entire** `escrow_ledger`, `royalty_ledger`,
and all `projects`, then sums/counts in JavaScript. Every console load reads
those tables end to end.

**Fix:** do the aggregation in SQL — `sum(amount_usd) ... group by entry_type`,
`count(*) ... group by status` — via a small `rpc` or a reporting view. Returns a
handful of rows instead of the whole ledger. Optionally cache for 30–60s.

### 5. Minor
- **`select('*')`** in several reads pulls columns the UI ignores. Low impact;
  worth tightening to explicit columns on the hot paths (feed, messages) so less
  data crosses the wire.
- **Composite index for the feed:** `posts(status, created_at desc)` (partial,
  `where status='active'`) serves the feed query in one index rather than
  combining two. Same for `royalty_items`/`services` store views.
- **`ai_usage` spend guard** does a read-then-upsert (not atomic). Under heavy
  concurrency the daily count could undercount slightly — harmless for a guard,
  but a single `insert ... on conflict do update set calls = calls + 1` would be
  exact.

---

## Recommended order

1. RLS `(select auth.uid())` rewrite — biggest lever, no behaviour change.
2. `last_message_preview` on conversations — removes the messages scan.
3. Master stats → SQL aggregate.
4. Pagination on the staff lists (members, tickets, all-projects).
5. The minor items as cleanup.

None are urgent for launch. 1 and 2 give the most return for the least risk.
