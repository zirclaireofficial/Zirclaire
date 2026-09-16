// Shared: once a bill is confirmed paid, fund the project it belongs to and
// settle the payment. Service orders (provider pre-assigned) go straight to
// 'awarded'; commissioned projects fund then open for applications. Idempotent
// and atomic (fund_project / fund_service_order act only on 'approved'), so a
// webhook, the return handler, and the reconcile cron can all call this safely.
import type { SupabaseClient } from '@supabase/supabase-js'
import { notify } from './notify'

/** Returns 'funded' | 'already' | 'gone'; throws if funding fails (so the caller
 *  leaves the payment 'claimed' for retry). Pass paymentId to settle it on success. */
export async function fundPaidProject(
  db: SupabaseClient, projectId: string, paymentId?: string,
): Promise<'funded' | 'already' | 'gone'> {
  const { data: project } = await db.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project) return 'gone'

  let result: 'funded' | 'already' = 'already'
  if (project.status === 'approved') {
    if (project.service_id) {
      const { error } = await db.rpc('fund_service_order', { p_project: project.id, p_actor: project.requester_id })
      if (error) { console.error('[funding] fund_service_order failed', { projectId, err: error }); throw createError({ statusCode: 500, statusMessage: 'funding failed, will retry' }) }
      await notify(db, project.requester_id, { type: 'payment_received', title: 'Order confirmed', body: `Your order "${project.title}" is paid — the provider will start the work.`, link: '/projects' })
      if (project.awarded_provider_id) {
        await notify(db, project.awarded_provider_id, { type: 'service_ordered', title: 'New order', body: `You have a new paid order: "${project.title}".`, link: '/projects' })
      }
    } else {
      const { error } = await db.rpc('fund_project', { p_project: project.id, p_amount: project.budget_myr, p_actor: project.requester_id })
      if (error) { console.error('[funding] fund_project failed', { projectId, err: error }); throw createError({ statusCode: 500, statusMessage: 'funding failed, will retry' }) }
      const mins = project.timeline_minutes ?? 2880
      const { error: lErr } = await db.rpc('push_project_live', { p_project: project.id, p_deadline: new Date(Date.now() + mins * 60_000).toISOString() })
      if (lErr) console.error('[funding] push_project_live failed (funded, not live)', { projectId, err: lErr })
      await notify(db, project.requester_id, { type: 'payment_received', title: 'Payment received', body: `"${project.title}" is funded and now live for providers to apply.`, link: '/projects' })
    }
    result = 'funded'
  }

  // Settle the payment only after funding succeeded (or it was already funded).
  if (paymentId) {
    await db.from('payments').update({ status: 'verified', paid_at: new Date().toISOString() })
      .eq('id', paymentId).eq('status', 'claimed')
  }
  return result
}
