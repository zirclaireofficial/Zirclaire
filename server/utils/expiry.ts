// Unclosed-project sweep (Terms §11). Runs nightly from the maintenance cron.
// Two passes, both safe to re-run:
//   1. Awarded/in-progress projects whose deadline passed with NO deliverable
//      -> the provider submitted nothing (§11.3): auto-refund 95%, close.
//   2. Everything else past its deadline that still needs a human decision
//      (work submitted but never accepted, or a project no provider ever took)
//      -> notify staff ONCE, marked by projects.expiry_flagged_at.
// Money only moves in pass 1, and only for the clear-cut no-submission case.
import type { SupabaseClient } from '@supabase/supabase-js'
import { notify, notifyRoles } from './notify'

// Iterative-review backstop: a provider submits, and if the requester neither
// accepts nor asks for changes within a grace period, the work is auto-accepted
// so the provider isn't left unpaid. A reminder is sent partway through. This is
// NOT a dispute — normal review (accept / request changes) is the requester's to
// drive; this only rescues a silent requester.
const GRACE_DAYS = 7
const REMIND_DAYS = 3

export async function runCompletionSweep(db: SupabaseClient) {
  const now = Date.now()
  const graceCut = new Date(now - GRACE_DAYS * 86_400_000).toISOString()
  const remindCut = new Date(now - REMIND_DAYS * 86_400_000).toISOString()
  let completed = 0
  let reminded = 0

  // --- Auto-accept submissions older than the grace period ---
  const { data: due } = await db
    .from('projects')
    .select('id, title, requester_id, awarded_provider_id, submitted_work_at')
    .eq('status', 'submitted_work')
    .not('submitted_work_at', 'is', null)
    .lt('submitted_work_at', graceCut)
    .limit(200)

  for (const p of (due ?? []) as Array<{ id: string; title: string; requester_id: string; awarded_provider_id: string | null }>) {
    // Never auto-accept while a cancellation/protest is open on this project.
    const { count: open } = await db
      .from('cancellation_requests').select('id', { count: 'exact', head: true })
      .eq('project_id', p.id).in('status', ['pending_provider', 'in_arbitration', 'awaiting_appeal', 'appealed'])
    if ((open ?? 0) > 0) continue

    const { error: aErr } = await db.rpc('accept_work', { p_project: p.id, p_reviewer: p.requester_id })
    if (aErr) continue
    const { error: cErr } = await db.rpc('clear_project', { p_project: p.id, p_actor: p.requester_id })
    if (cErr) continue // finished but not cleared (rare) — leave for a human

    if (p.awarded_provider_id) {
      await notify(db, p.awarded_provider_id, {
        type: 'work_accepted',
        title: 'Work auto-accepted',
        body: `"${p.title}" was auto-accepted after the review window. Your payout is being prepared.`,
        link: '/projects',
      })
    }
    await notify(db, p.requester_id, {
      type: 'work_accepted',
      title: 'Project auto-completed',
      body: `"${p.title}" completed automatically — you didn't respond within ${GRACE_DAYS} days of the submission.`,
      link: '/projects',
    })
    await notifyRoles(db, ['master'], {
      type: 'payout_due',
      title: 'Payout due',
      body: `"${p.title}" auto-completed — a provider payout is ready to send.`,
      link: '/master/payouts',
    })
    completed++
  }

  // --- Reminders: submissions past the remind mark, not yet reminded ---
  const { data: toRemind } = await db
    .from('projects')
    .select('id, title, requester_id, submitted_work_at, review_reminded_at')
    .eq('status', 'submitted_work')
    .not('submitted_work_at', 'is', null)
    .lt('submitted_work_at', remindCut)
    .gte('submitted_work_at', graceCut) // not already past the grace cutoff
    .limit(200)

  for (const p of (toRemind ?? []) as Array<{ id: string; title: string; requester_id: string; submitted_work_at: string; review_reminded_at: string | null }>) {
    if (p.review_reminded_at && new Date(p.review_reminded_at) >= new Date(p.submitted_work_at)) continue
    await notify(db, p.requester_id, {
      type: 'review_reminder',
      title: 'A submission is waiting for you',
      body: `"${p.title}" is awaiting your review. Accept it or request changes — it auto-accepts ${GRACE_DAYS} days after submission.`,
      link: '/projects',
    })
    await db.from('projects').update({ review_reminded_at: new Date().toISOString() }).eq('id', p.id)
    reminded++
  }

  return { completed, reminded }
}

export async function runExpirySweep(db: SupabaseClient) {
  const nowIso = new Date().toISOString()
  const summary = { autoRefunded: 0, flagged: 0, errors: 0 }

  // ---- Pass 1: no submission before deadline -> auto-refund 95% ----
  const { data: stale } = await db
    .from('projects')
    .select('id, requester_id, title, status, deadline_at')
    .in('status', ['awarded', 'in_progress'])
    .lt('deadline_at', nowIso)
    .limit(200)

  for (const p of (stale ?? []) as Array<{ id: string; requester_id: string; title: string }>) {
    // Defensive: skip if any deliverable exists (the SQL function also guards).
    const { count } = await db
      .from('deliverables')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', p.id)
    if ((count ?? 0) > 0) continue

    try {
      await db.rpc('expire_no_submission', { p_project: p.id, p_actor: p.requester_id })
      await notify(db, p.requester_id, {
        type: 'project_expired',
        title: 'Project expired',
        body: `"${p.title}" passed its deadline with no submission. A 95% refund is being processed.`,
        link: '/projects',
      })
      await notifyRoles(db, ['master'], {
        type: 'refund_due', title: 'Refund due',
        body: `"${p.title}" auto-expired — a 95% refund to the requester is ready to send.`,
        link: '/master/refunds',
      })
      summary.autoRefunded++
    } catch {
      // A concurrent submission or re-run — harmless, try again next night.
      summary.errors++
    }
  }

  // ---- Pass 2: past deadline, needs a human -> flag staff once ----
  const { data: needReview } = await db
    .from('projects')
    .select('id, title, status')
    .in('status', ['live', 'submitted_work', 'in_review', 'revision_requested'])
    .lt('deadline_at', nowIso)
    .is('expiry_flagged_at', null)
    .limit(200)

  if ((needReview ?? []).length) {
    const { data: staff } = await db.from('profiles').select('id').in('role', ['admin', 'master'])
    for (const p of (needReview ?? []) as Array<{ id: string; title: string; status: string }>) {
      for (const s of (staff ?? []) as Array<{ id: string }>) {
        await notify(db, s.id, {
          type: 'project_needs_review',
          title: 'Expired project needs review',
          body: `"${p.title}" passed its deadline (${p.status.replace(/_/g, ' ')}) and needs a decision.`,
          link: '/admin',
        })
      }
      await db.from('projects').update({ expiry_flagged_at: nowIso }).eq('id', p.id)
      summary.flagged++
    }
  }

  return summary
}

// Mature cancellation decisions whose 48h appeal window has closed with no
// appeal: the SQL function executes the refund (if approved) and returns the
// resolved request ids; we notify both parties of the final outcome. Users
// never see admin/master — just the Platform's decision.
export async function runCancellationFinalizer(db: SupabaseClient) {
  const { data: ids } = await db.rpc('finalize_matured_cancellations', { p_hours: 48 })
  const resolved = (ids ?? []) as string[]
  for (const id of resolved) {
    const { data: r } = await db
      .from('cancellation_requests')
      .select('status, requested_by, provider_id, projects(title)')
      .eq('id', id)
      .single()
    if (!r) continue
    const row = r as unknown as {
      status: string; requested_by: string; provider_id: string | null; projects: { title: string } | null
    }
    const title = row.projects?.title ?? 'your project'
    const approved = row.status === 'approved'
    await notify(db, row.requested_by, {
      type: 'cancellation_resolved',
      title: approved ? 'Cancellation approved' : 'Cancellation declined',
      body: approved
        ? `Your request to cancel "${title}" was approved. A 95% refund is being processed.`
        : `Your request to cancel "${title}" was declined; the project continues.`,
      link: '/projects',
    })
    if (approved) {
      await notifyRoles(db, ['master'], {
        type: 'refund_due', title: 'Refund due',
        body: `"${title}" was cancelled on review — a 95% refund to the requester is ready to send.`,
        link: '/master/refunds',
      })
    }
    if (row.provider_id) {
      await notify(db, row.provider_id, {
        type: 'cancellation_resolved',
        title: approved ? 'Project cancelled' : 'Project continues',
        body: approved
          ? `"${title}" has been cancelled by Zirclaire.`
          : `The cancellation request on "${title}" was declined; please continue the work.`,
        link: '/projects',
      })
    }
  }
  return { finalized: resolved.length }
}
