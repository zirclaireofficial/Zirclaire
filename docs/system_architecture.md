# Zirclaire — System Architecture

**Project:** Zirclaire.com
**Backed by:** MORATT INC (Modern operations, Research, Advanced Technology and trade incorporation)
**Type:** Escrow-backed service marketplace + regulated professional social community
**Status:** Foundation / v0 design
**Last updated:** 2026-07-14

---

## 1. Purpose

Zirclaire is a broker-model freelance marketplace. It connects **Service Requesters** (clients who need work done) with **Service Providers** (freelancers who do the work), with a human **Admin** sitting in the middle as an approving broker. Nothing reaches the public — no account, no project, no payout, no social post — without passing an explicit Admin approval gate. This "administrative bottleneck" is the core product differentiator and the central constraint the whole system is designed around.

---

## 2. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vue 3 (Vite) | SPA, role-aware routing and guards |
| Backend / Auth / Storage | Supabase (Postgres + Auth + Storage + Edge Functions) | Single source of truth; RLS enforces role rules |
| Hosting | Vercel Pro | Commercial tier for the frontend |
| Payments | **Deferred — rail-agnostic abstraction** | See §7. Spec mentions Stripe Connect, but payout targets are Binance / Touch 'n Go, which Connect cannot settle to. We isolate money movement behind an interface so the rail can be chosen later without schema or app rework. |

### Design principle: the database is the contract
All business rules that matter for money and trust are enforced in Postgres via Row-Level Security (RLS) and state constraints — not only in the Vue client. The client is treated as untrusted. If a rule matters (e.g. "an SP cannot approve their own application"), it is enforced server-side.

---

## 3. User Roles & Permissions

Three strictly segregated roles. A single auth user has exactly one role, set at signup and locked after Admin approval.

### 3.1 Admin (Middleman / Broker)
The central authority. Capabilities:
- Approve / reject KYC verifications and generate the localized member ID.
- Fund-gate projects: confirm escrow funding before a project goes live.
- Push approved projects to the live SP feed.
- Approve / reject social posts before they appear publicly.
- Release escrow: clear the payout after an SR marks a project "Finished".
- Full read visibility for moderation and dispute handling.

### 3.2 Service Requester (SR) — the client
- Create project requests (budget, timeline, requirements, attachments).
- Fund a project (via the Admin/escrow flow).
- View applicant list (SPs shown by system ID).
- Approve one SP to award the job.
- Review submitted deliverables → request revision **or** mark "Finished".
- Comment on public social posts and upload media within comments.
- **Cannot** create top-level social posts.

### 3.3 Service Provider (SP) — the freelancer
- Browse the live project feed.
- Apply to projects.
- Submit deliverables (PDF / video).
- Create top-level social posts (subject to Admin approval).
- Receive payout (80%) after clearance.

### 3.4 Permission matrix (summary)

| Action | SR | SP | Admin |
|---|:--:|:--:|:--:|
| Create project | ✅ | ❌ | — |
| Fund project | ✅ | ❌ | — |
| Approve KYC | ❌ | ❌ | ✅ |
| Approve project → live | ❌ | ❌ | ✅ |
| Apply to project | ❌ | ✅ | — |
| Approve applicant | ✅ (own project) | ❌ | — |
| Submit deliverable | ❌ | ✅ (awarded) | — |
| Mark "Finished" | ✅ (own project) | ❌ | — |
| Release escrow | ❌ | ❌ | ✅ |
| Create top-level post | ❌ | ✅ | — |
| Approve post | ❌ | ❌ | ✅ |
| Comment on post | ✅ | ✅ | ✅ |

---

## 4. Onboarding & KYC Workflow

1. **Role-specific signup** from the main page. A user chooses SR or SP and fills the matching form.
   - Required: Full name (as per national ID), email, phone (with country code), home address, ID/passport number, financial receiving account (Binance or Touch 'n Go).
   - Uploads: national ID/passport image + profile picture (Supabase Storage, private bucket).
2. **Pending state.** Account is created but inert — cannot transact, cannot post. `kyc_status = 'pending'`.
3. **Admin review.** Admin inspects submitted data and documents, then approves or rejects (with reason).
4. **ID generation on approval.** System assigns a localized, role-specific member ID.
   - Format: `[CC][ROLE][NNNNN]` — e.g. `MYRSR99999` = Malaysia (MY) · Service Requester (RSR)… (see §8 for the exact scheme and generation rule).
5. Approved users gain their role capabilities.

**Data sensitivity:** ID numbers and document images are PII/regulated data. They live in a private storage bucket and a restricted table readable only by the owner and Admin. Never exposed in public API responses or the social feed.

---

## 5. Project & Escrow Lifecycle

The heart of the platform. Precise state management in the DB; the client only requests transitions, the server validates them.

1. **Creation** — SR creates a request (budget in USD, timeline, requirements, optional PDFs). State: `draft` → `submitted`.
2. **Admin bottleneck / escrow** — Project routed to Admin. SR secures funds upfront through the Admin/escrow flow. State: `submitted` → `funded` (Admin-confirmed).
3. **Live / bidding** — Admin pushes it live. It appears on the SP feed with a live countdown. SPs apply. State: `funded` → `live`.
4. **Awarding** — SR views applicants (by system ID) and approves one. State: `live` → `awarded`.
5. **Submission & review** — SP submits deliverable (PDF/video). SR either requests revision (`in_review` → `revision_requested` → back to `in_progress`) or accepts. State path: `awarded` → `in_progress` → `submitted_work` → `in_review`.
6. **Finish & payout** — SR marks "Finished". Admin clears the transaction; 80% released to SP, 20% retained. State: `in_review` → `finished` → `closed`.

Full transition table and diagram: `docs/state_machine.md`.

---

## 6. Financial Model & Commission

- **Commission:** platform retains **20%** of the funded amount on every completed project.
- **Payout:** remaining **80%** released to the SP's linked account **only after** the SR marks "Finished" **and** the Admin clears the transaction.
- **Currency:** projects are funded and accounted in **USD**. Payout FX to the SP's local rail is handled at the payout step (rail-dependent).
- **Ledger, not balance-in-a-column:** every money event is an append-only row in `escrow_ledger` (fund, hold, commission, payout, refund). The "balance" of a project is derived by summing its ledger entries. This gives an auditable trail — essential for a broker handling other people's money.

### Worked example
SR funds a project at **$1,000**:
- `fund` +1000 (into platform hold)
- On finish/clear: `commission` −200 (platform revenue), `payout` −800 (to SP)
- Project nets to zero in the hold; ledger shows exactly where every dollar went.

---

## 7. Payments Abstraction (rail deferred)

The payment rail is intentionally **not chosen yet** (per project decision). To avoid rework, all money movement goes through a single conceptual interface with three operations:

- `collect(project, amount)` — pull funds from the SR into platform custody (funding step).
- `payout(provider_account, amount)` — send funds to the SP's linked rail (Binance / Touch 'n Go / other).
- `refund(project, amount)` — return funds to the SR (cancellation/dispute).

In v0 these are **manual, Admin-mediated** operations recorded in `escrow_ledger` — matching the broker model exactly. When a concrete rail is chosen, it becomes a Supabase Edge Function implementing the same three operations; the schema and app flow do not change.

> **Open decision (flagged for later):** Stripe Connect can collect card payments but cannot pay out to Binance or Touch 'n Go. Holding customer funds as a broker may trigger money-transmitter / e-money licensing depending on jurisdiction (notably Malaysia's BNM rules). This needs a compliance decision before going live. The architecture keeps the door open for: (a) fully manual admin payouts, (b) Stripe-for-funding + manual payout, or (c) a licensed PSP integration.

---

## 8. Localized Member ID Scheme

Format: `[CC][ROLE][NNNNN]`

- `CC` — ISO 3166-1 alpha-2 country code derived from the user's address/phone (e.g. `MY`).
- `ROLE` — role token: `RSR` (Service Requester) or `RSP` (Service Provider). (Admins are internal and not publicly ID'd.)
- `NNNNN` — zero-padded sequential member number, per (country, role) counter.

Example: `MYRSR99999` = 99,999th Service Requester registered in Malaysia.

Generation is atomic and server-side: on KYC approval, a Postgres function increments the per-(country, role) counter inside the same transaction that flips `kyc_status` to `approved`, guaranteeing no duplicates and no gaps from client retries.

---

## 9. Social Community (Main Page Feed)

A regulated timeline to keep users engaged between projects.

- **Authoring:** SPs write posts ("What's on your mind?") with up to **3** image/video attachments. State: `pending` → (Admin) → `approved` / `rejected`.
- **Moderation:** "Send" routes the post to the Admin. It appears publicly only after approval.
- **Engagement:** approved posts show favorites, comments, shares. SRs (and SPs) can comment and attach media in comments — enabling networking between clients and freelancers.
- Comments may also be moderated (config flag) but default to live-on-post for approved posts.

---

## 10. Repository Layout (planned)

```
Zirclaire/
├── docs/
│   ├── system_architecture.md      ← this file
│   └── state_machine.md            ← lifecycle diagrams + transition table
├── db/
│   ├── schema.sql                  ← tables, types, functions, triggers
│   ├── rls_policies.sql            ← Row-Level Security
│   └── seed.sql                    ← (later) reference data: countries, admin
├── app/                            ← (later) Vue 3 + Vite frontend
└── supabase/                       ← (later) config, migrations, edge functions
```

---

## 11. Security & Trust Principles

1. **Client is untrusted.** All authorization decisions enforced by RLS + SQL constraints, never by the Vue client alone.
2. **Admin bottleneck is a hard gate**, not a UI convention — enforced by `status` columns + RLS so an unapproved row is invisible/inert regardless of client behavior.
3. **PII isolation.** KYC documents and ID numbers in private storage + restricted tables; never joined into public views.
4. **Money is append-only.** `escrow_ledger` is insert-only; corrections are compensating entries, never edits/deletes. Full audit trail.
5. **No self-dealing.** Constraints prevent an SP approving their own application, an SR reviewing a project they don't own, etc.
6. **Least privilege.** Each role's RLS grants only what §3.4 allows.

---

## 12. What's built in this foundation vs. later

**Now (v0 foundation):** this architecture doc, the state machine reference, the full Postgres schema, and RLS policies.

**Next phases (not in this foundation):**
- Vue frontend scaffold + role-guarded routing.
- Supabase Edge Functions for ID generation trigger + escrow operations.
- Admin console (KYC queue, project approval, post moderation, payout clearing).
- Concrete payment rail integration (pending the §7 compliance decision).
- Notifications, disputes, ratings/reputation.
