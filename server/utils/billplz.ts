// Billplz client (pay-in gateway). Server-only — the API key never reaches the
// browser. Env values needed:
//   BILLPLZ_API_KEY        — your secret API key (sensitive)
//   BILLPLZ_COLLECTION_ID  — the collection bills are filed under
//   BILLPLZ_ENV            — 'sandbox' (billplz-sandbox.com) or 'production'
//
// Flow: createBill -> redirect payer to bill.url -> Billplz calls our callback
// AND redirects the payer back with billplz[id]. We NEVER trust those blindly —
// we re-verify with getBillStatus (an authenticated GET) before funding.

function base(): string {
  return process.env.BILLPLZ_ENV === 'production'
    ? 'https://www.billplz.com'
    : 'https://www.billplz-sandbox.com'
}

function apiKey(): string {
  const k = process.env.BILLPLZ_API_KEY
  if (!k) throw createError({ statusCode: 500, statusMessage: 'BILLPLZ_API_KEY is not set' })
  return k
}

function collectionId(): string {
  const c = process.env.BILLPLZ_COLLECTION_ID
  if (!c) throw createError({ statusCode: 500, statusMessage: 'BILLPLZ_COLLECTION_ID is not set' })
  return c
}

// Billplz uses HTTP Basic auth: API key as username, blank password.
function authHeader(): string {
  return 'Basic ' + Buffer.from(`${apiKey()}:`).toString('base64')
}

async function api(method: 'GET' | 'POST', path: string, form?: Record<string, string>): Promise<any> {
  const opts: RequestInit = { method, headers: { authorization: authHeader() } }
  if (form) {
    opts.body = new URLSearchParams(form)
    ;(opts.headers as Record<string, string>)['content-type'] = 'application/x-www-form-urlencoded'
  }
  const res = await fetch(`${base()}/api/${path}`, opts)
  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch {
    throw createError({ statusCode: 502, statusMessage: `Billplz ${path} returned non-JSON: ${text.slice(0, 200)}` })
  }
  if (!res.ok) {
    throw createError({ statusCode: 400, statusMessage: `Billplz ${path} failed: ${JSON.stringify(json).slice(0, 200)}` })
  }
  return json
}

export interface CreateBillInput {
  name: string
  email?: string | null
  mobile?: string | null
  amountMYR: number      // converted to cents
  description: string
  externalRef: string    // stored in reference_1
  redirectUrl: string    // where the payer lands after paying
  callbackUrl: string    // server-to-server POST
}

/** Create a bill. Returns the bill id + the hosted URL to redirect the payer to. */
export async function createBill(input: CreateBillInput): Promise<{ billId: string; payUrl: string }> {
  const cents = Math.round(input.amountMYR * 100)
  const bill = await api('POST', 'v3/bills', {
    collection_id: collectionId(),
    email: (input.email && input.email.trim()) || 'noreply@zirclaire.com',
    mobile: (input.mobile ?? '').replace(/\D/g, ''),
    name: input.name.slice(0, 200),
    amount: String(cents),
    callback_url: input.callbackUrl,
    redirect_url: input.redirectUrl,
    description: input.description.slice(0, 200),
    reference_1_label: 'Ref',
    reference_1: input.externalRef,
  })
  if (!bill?.id || !bill?.url) {
    throw createError({ statusCode: 400, statusMessage: `Billplz createBill: unexpected response ${JSON.stringify(bill).slice(0, 200)}` })
  }
  return { billId: bill.id, payUrl: bill.url }
}

export interface BillStatus {
  paid: boolean
  status: '1' | '2' | '3' | 'unknown' // normalised: 1 paid, 2 pending/due, 3 deleted/failed
  amountMYR: number | null
}

/** The trusted check: ask Billplz the real state of a bill (authenticated GET). */
export async function getBillStatus(billId: string): Promise<BillStatus> {
  const bill = await api('GET', `v3/bills/${encodeURIComponent(billId)}`)
  console.log('[billplz getBillStatus]', billId, JSON.stringify({ paid: bill?.paid, state: bill?.state, paid_amount: bill?.paid_amount }))
  const paid = bill?.paid === true || bill?.paid === 'true'
  const state = String(bill?.state ?? '')
  const status: BillStatus['status'] = paid ? '1' : state === 'due' ? '2' : state === 'deleted' ? '3' : 'unknown'
  const amt = bill?.paid_amount != null ? Number(bill.paid_amount) / 100 : null
  return { paid, status, amountMYR: amt }
}

/** The hosted URL for a given bill id. */
export function billPayUrl(billId: string): string {
  return `${base()}/bills/${billId}`
}

export function isBillplzConfigured(): boolean {
  return !!process.env.BILLPLZ_API_KEY && !!process.env.BILLPLZ_COLLECTION_ID
}
