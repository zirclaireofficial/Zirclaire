// Payment provider selector (the "port"). One switch decides whether money
// operations run against the real Xendit gateway or the built-in simulator.
//
//   PAYMENTS_PROVIDER=toyyibpay  -> real ToyyibPay bills (pay-in gateway)
//   PAYMENTS_PROVIDER=xendit     -> real Xendit (kept for reference/fallback)
//   PAYMENTS_PROVIDER=simulator  -> fake/instant, no gateway (local dev default)
//
// The mode is also exposed to the client (runtimeConfig.public.paymentsMode)
// so the UI can show a clear "Sandbox / Simulated" badge — testers must never
// think real money moved when it didn't.

export type PaymentMode = 'toyyibpay' | 'xendit' | 'simulator'

export function paymentMode(): PaymentMode {
  const p = process.env.PAYMENTS_PROVIDER
  if (p === 'toyyibpay') return 'toyyibpay'
  if (p === 'xendit') return 'xendit'
  return 'simulator'
}

export function isToyyibpay(): boolean {
  return paymentMode() === 'toyyibpay'
}

export function isXendit(): boolean {
  return paymentMode() === 'xendit'
}

/** True when a real external gateway (not the simulator) handles pay-in. */
export function isGatewayMode(): boolean {
  return paymentMode() !== 'simulator'
}

// Map a provider's chosen payout method to a Xendit disbursement channel code.
// IMPORTANT: confirm the exact Malaysian channel codes with Xendit before live
// (bank vs e-wallet differ). For the sandbox/demo, set XENDIT_PAYOUT_CHANNEL to
// a Xendit test channel; this fallback is a placeholder, not a real channel.
export function payoutChannel(_provider?: string | null): string {
  return process.env.XENDIT_PAYOUT_CHANNEL || 'MY_TEST_CHANNEL'
}
