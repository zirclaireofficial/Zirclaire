// Xendit connectivity test — creates a TEST invoice to prove the API key works.
// Gated by a key so it can't be triggered publicly:
//     /api/debug-xendit?key=YOUR_KEY
// Set XENDIT_TEST_KEY (any secret you choose) and XENDIT_SECRET_KEY (your
// Xendit TEST secret key) in env. Without the key it just returns { ok: true }.
// Safe to leave deployed. Delete once real payment routes exist if you prefer.
import { createInvoice } from '../utils/xendit'

export default defineEventHandler(async (event) => {
  const provided = getQuery(event).key
  const expected = process.env.XENDIT_TEST_KEY
  if (!expected || provided !== expected) {
    return { ok: true } // disabled / wrong key
  }

  try {
    const invoice = await createInvoice({
      externalId: `zc-test-${Date.now()}`,
      amount: 100, // RM100 test invoice
      description: 'Zirclaire — Xendit connectivity test',
      payerEmail: 'test@zirclaire.com',
    })
    return {
      ok: true,
      id: invoice.id,
      status: invoice.status,
      invoiceUrl: invoice.invoice_url, // open this to see the hosted test payment page
    }
  } catch (e) {
    const err = e as { data?: unknown; message?: string }
    return { ok: false, error: err?.data ?? err?.message ?? 'Xendit call failed' }
  }
})
