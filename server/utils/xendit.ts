// Xendit REST client — SERVER ONLY. Never import this into client code.
// Auth is HTTP Basic: the secret key is the username, password is empty.
// Set XENDIT_SECRET_KEY in env. Use the TEST key (xnd_development_...) until
// the business is verified and you switch to live (xnd_production_...).
import type { H3Event } from 'h3'

const BASE = 'https://api.xendit.co'

function authHeader(): string {
  const key = process.env.XENDIT_SECRET_KEY
  if (!key) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_SECRET_KEY is not set' })
  }
  // Basic base64("<secret>:")  — note the trailing colon (empty password).
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`
}

/** Low-level call to the Xendit API. Throws on non-2xx (ofetch behaviour). */
export function xenditFetch<T = unknown>(
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    'Content-Type': 'application/json',
  }
  // Idempotency-key makes a retried request safe — Xendit returns the original
  // result instead of creating a second invoice/payout.
  if (opts.idempotencyKey) headers['Idempotency-key'] = opts.idempotencyKey

  return $fetch<T>(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body,
  })
}

// ---- Invoices (money in / funding escrow) -----------------------------
export interface XenditInvoice {
  id: string
  external_id: string
  status: string          // PENDING | PAID | SETTLED | EXPIRED
  amount: number
  invoice_url: string
}

/** Create a hosted invoice. amount is in MYR whole units. */
export function createInvoice(params: {
  externalId: string
  amount: number
  description?: string
  payerEmail?: string
  successRedirectUrl?: string
}): Promise<XenditInvoice> {
  return xenditFetch<XenditInvoice>('/v2/invoices', {
    method: 'POST',
    body: {
      external_id: params.externalId,
      amount: params.amount,
      currency: 'MYR',
      description: params.description,
      payer_email: params.payerEmail,
      success_redirect_url: params.successRedirectUrl,
    },
  })
}

/** Fetch an invoice — used to re-check status before acting (retry safety). */
export function getInvoice(id: string): Promise<XenditInvoice> {
  return xenditFetch<XenditInvoice>(`/v2/invoices/${id}`)
}

// ---- Payouts (money out / paying the provider) ------------------------
// Used in Phase 2. Kept here so the client is complete.
export interface XenditPayout {
  id: string
  reference_id: string
  status: string          // ACCEPTED | PENDING | SUCCEEDED | FAILED
  amount: number
}

/** Create a payout (disbursement). Always pass an idempotencyKey. */
export function createPayout(params: {
  referenceId: string
  channelCode: string          // e.g. a Malaysian bank/e-wallet channel code
  accountHolder: string
  accountNumber: string
  amount: number
  description?: string
  idempotencyKey: string
}): Promise<XenditPayout> {
  return xenditFetch<XenditPayout>('/v2/payouts', {
    method: 'POST',
    idempotencyKey: params.idempotencyKey,
    body: {
      reference_id: params.referenceId,
      channel_code: params.channelCode,
      channel_properties: {
        account_holder_name: params.accountHolder,
        account_number: params.accountNumber,
      },
      amount: params.amount,
      currency: 'MYR',
      description: params.description ?? 'Zirclaire payout',
    },
  })
}

export function getPayout(id: string): Promise<XenditPayout> {
  return xenditFetch<XenditPayout>(`/v2/payouts/${id}`)
}

// ---- Webhook verification ---------------------------------------------
/**
 * Verify a webhook really came from Xendit by matching the x-callback-token
 * header against the token you set in Xendit → Webhook settings.
 * Set XENDIT_CALLBACK_TOKEN in env to that value.
 */
export function verifyCallbackToken(event: H3Event): boolean {
  const token = getHeader(event, 'x-callback-token')
  const expected = process.env.XENDIT_CALLBACK_TOKEN
  return !!expected && token === expected
}
