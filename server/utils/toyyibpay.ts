// ToyyibPay client (pay-in gateway). Server-only — the secret key never
// reaches the browser. Two env values are all that's needed:
//   TOYYIBPAY_SECRET_KEY    — your userSecretKey (sensitive)
//   TOYYIBPAY_CATEGORY_CODE — the category bills are filed under (not secret)
//   TOYYIBPAY_ENV           — 'sandbox' (dev.toyyibpay.com) or 'production'
//
// Flow: createBill -> redirect payer to the bill URL -> ToyyibPay calls our
// callback. We NEVER trust the callback alone (it's unsigned) — we re-verify
// server-side with getBillTransactions before funding anything.

function base(): string {
  return process.env.TOYYIBPAY_ENV === 'production'
    ? 'https://toyyibpay.com'
    : 'https://dev.toyyibpay.com'
}

function secretKey(): string {
  const k = process.env.TOYYIBPAY_SECRET_KEY
  if (!k) throw createError({ statusCode: 500, statusMessage: 'TOYYIBPAY_SECRET_KEY is not set' })
  return k
}

function categoryCode(): string {
  const c = process.env.TOYYIBPAY_CATEGORY_CODE
  if (!c) throw createError({ statusCode: 500, statusMessage: 'TOYYIBPAY_CATEGORY_CODE is not set' })
  return c
}

async function form(path: string, fields: Record<string, string>): Promise<any> {
  const body = new URLSearchParams(fields)
  const res = await fetch(`${base()}/index.php/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw createError({ statusCode: 502, statusMessage: `ToyyibPay ${path} returned non-JSON: ${text.slice(0, 200)}` })
  }
}

export interface CreateBillInput {
  name: string          // billName (max ~30 chars, alnum + space)
  description: string   // billDescription
  amountMYR: number     // will be converted to cents
  externalRef: string   // billExternalReferenceNo (our reference)
  returnUrl: string     // where the browser lands after paying
  callbackUrl: string   // server-to-server POST
  payerName?: string
  payerEmail?: string
  payerPhone?: string
}

/** Create a bill. Returns the bill code + the hosted URL to redirect to. */
export async function createBill(input: CreateBillInput): Promise<{ billCode: string; payUrl: string }> {
  const cents = Math.round(input.amountMYR * 100)
  const out = await form('createBill', {
    userSecretKey: secretKey(),
    categoryCode: categoryCode(),
    billName: input.name.slice(0, 30),
    billDescription: input.description.slice(0, 100),
    billPriceSetting: '1',              // fixed price
    billPayorInfo: '1',                 // collect payer info
    billAmount: String(cents),          // in cents
    billReturnUrl: input.returnUrl,
    billCallbackUrl: input.callbackUrl,
    billExternalReferenceNo: input.externalRef,
    billTo: input.payerName ?? '',
    billEmail: input.payerEmail ?? '',
    billPhone: input.payerPhone ?? '',
    billPaymentChannel: '2',            // FPX + card
    billDisplayMerchant: '1',
  })
  // Success shape: [{ "BillCode": "xxxx" }]. Error shape carries status/msg.
  const first = Array.isArray(out) ? out[0] : out
  const billCode = first?.BillCode
  if (!billCode) {
    throw createError({ statusCode: 400, statusMessage: `ToyyibPay createBill failed: ${JSON.stringify(out).slice(0, 200)}` })
  }
  return { billCode, payUrl: `${base()}/${billCode}` }
}

export interface BillStatus {
  paid: boolean
  status: '1' | '2' | '3' | 'unknown' // 1 success, 2 pending, 3 fail
  amountMYR: number | null
}

/** The trusted check: ask ToyyibPay the real status of a bill's transactions. */
export async function getBillStatus(billCode: string): Promise<BillStatus> {
  const out = await form('getBillTransactions', {
    userSecretKey: secretKey(),
    billCode,
  })
  const txns = Array.isArray(out) ? out : []
  // A bill is paid if any transaction reports success (status '1').
  const success = txns.find((t: any) => String(t.billpaymentStatus) === '1')
  if (success) {
    return { paid: true, status: '1', amountMYR: Number(success.billpaymentAmount ?? 0) || null }
  }
  const latest = txns[0]
  const s = latest ? String(latest.billpaymentStatus) : 'unknown'
  return { paid: false, status: (['1', '2', '3'].includes(s) ? s : 'unknown') as BillStatus['status'], amountMYR: null }
}

/** The hosted URL to redirect a payer to for a given bill code. */
export function billPayUrl(billCode: string): string {
  return `${base()}/${billCode}`
}

export function isToyyibpayConfigured(): boolean {
  return !!process.env.TOYYIBPAY_SECRET_KEY && !!process.env.TOYYIBPAY_CATEGORY_CODE
}
