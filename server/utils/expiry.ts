// Unclosed-project sweep (Terms §11). Runs nightly from the maintenance cron.
// Two passes, both safe to re-run:
//   1. Awarded/in-progress projects whose deadline passed with NO deliverable
//      -> the provider submitted nothing (§11.3): auto-refund 95%, close.
//   2. Everything else past its deadline that still needs a human decision
//      (work submitted but never accepted, or a project no provider ever took)
//      -> notify staff ONCE, marked by projects.expiry_flagged_at.
// Money only moves in pass 1, and only for the clear-cut no-submission case.
import type { SupabaseClient } from '@supabase/supabase-js'
import { notify } from './notify'

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
        body: `"${p.title}" passed its deadline with no submission. 95% has been refunded to you.`,
        link: '/projects',
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
        ? `Your request to cancel "${title}" was approved. 95% has been refunded.`
        : `Your request to cancel "${title}" was declined; the project continues.`,
      link: '/projects',
    })
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
