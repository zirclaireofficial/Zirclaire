// POST /api/webhooks/xendit   (called by Xendit, not by users)
// The single trusted source for "money actually moved." Verifies the callback
// token, dedupes via xendit_events (so a replay is never processed twice), and:
//   - invoice PAID/SETTLED  -> fund_project + push_project_live (auto-fund)
//   - payout SUCCEEDED/FAILED -> update the payouts row
// Returns 200 on success/duplicate; 401 on a bad token; 500 to let Xendit
// retry (its retries run for 24h) if processing genuinely fails.
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from '../../utils/auth'
import { verifyCallbackToken } from '../../utils/xendit'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  if (!verifyCallbackToken(event)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid callback token' })
  }

  const body = await readBody<Record<string, any>>(event)
  const db = serviceClient(event)

  // Classify the event and build a stable dedupe id.
  let eventId: string
  let eventType: string
  if (typeof body?.event === 'string' && body.event.startsWith('payout')) {
    eventType = body.event
    eventId = `payout.${body?.data?.id}.${body?.data?.status ?? body.event}`
  } else if (body?.id && body?.status) {
    eventType = `invoice.${body.status}`
    eventId = `invoice.${body.id}.${body.status}`
  } else {
    return { received: true, ignored: true } // unknown shape — ack, do nothing
  }

  // Record the event. A duplicate event_id hits the unique index and is ignored.
  await db.from('xendit_events').insert({ event_id: eventId, event_type: eventType, payload: body })
  const { data: evt } = await db
    .from('xendit_events')
    .select('processed_at')
    .eq('event_id', eventId)
    .maybeSingle()
  if (evt?.processed_at) return { received: true, duplicate: true }

  try {
    if (eventType.startsWith('invoice.') && (body.status === 'PAID' || body.status === 'SETTLED')) {
      await handleInvoicePaid(db, body)
    } else if (eventType.startsWith('payout')) {
      await handlePayoutUpdate(db, body)
    }
    await db.from('xendit_events').update({ processed_at: new Date().toISOString() }).eq('event_id', eventId)
  } catch (err) {
    // Leave processed_at null so Xendit's retry re-attempts; surface to Sentry.
    console.error('[xendit webhook] processing failed', err)
    throw createError({ statusCode: 500, statusMessage: 'Webhook processing failed' })
  }

  return { received: true }
})

// invoice PAID -> mark payment verified, then fund + launch (idempotent).
async function handleInvoicePaid(db: SupabaseClient, body: Record<string, any>) {
  const { data: pay } = await db
    .from('payments')
    .select('id, project_id')
    .eq('xendit_invoice_id', body.id)
    .maybeSingle()
  if (!pay) return // invoice we don't recognise

  await db
    .from('payments')
    .update({ status: 'verified', xendit_status: body.status, paid_at: new Date().toISOString() })
    .eq('id', pay.id)

  // Only fund an approved project — guards against any double-processing.
  const { data: project } = await db.from('projects').select('*').eq('id', pay.project_id).maybeSingle()
  if (!project || project.status !== 'approved') return

  await db.rpc('fund_project', {
    p_project: project.id,
    p_amount: project.budget_myr,
    p_actor: project.requester_id,
  })
  const mins = project.timeline_minutes ?? 2880
  const deadline = new Date(Date.now() + mins * 60_000).toISOString()
  await db.rpc('push_project_live', { p_project: project.id, p_deadline: deadline })

  await notify(db, project.requester_id, {
    type: 'payment_received',
    title: 'Payment received',
    body: `"${project.title}" is funded and now live for providers to apply.`,
    link: '/projects',
  })
}

// payout SUCCEEDED/FAILED -> update the payouts row (used in Phase 2).
async function handlePayoutUpdate(db: SupabaseClient, body: Record<string, any>) {
  const d = body.data ?? {}
  const status = String(d.status ?? '').toUpperCase()
  const patch: Record<string, any> = {}
  if (status === 'SUCCEEDED') {
    patch.status = 'paid'
    patch.paid_at = new Date().toISOString()
  } else if (status === 'FAILED') {
    patch.status = 'failed'
    patch.failed_reason = d.failure_code ?? 'FAILED'
  } else {
    return
  }
  if (d.id) await db.from('payouts').update(patch).eq('xendit_payout_id', d.id)
}
