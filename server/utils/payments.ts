// Payment provider selector (the "port"). One switch decides whether money
// operations run against the real Xendit gateway or the built-in simulator.
//
//   PAYMENTS_PROVIDER=xendit     -> real Xendit (use TEST keys for the demo)
//   PAYMENTS_PROVIDER=simulator  -> fake/instant, no gateway (local dev default)
//
// The mode is also exposed to the client (runtimeConfig.public.paymentsMode)
// so the UI can show a clear "Sandbox / Simulated" badge — testers must never
// think real money moved when it didn't.

export type PaymentMode = 'xendit' | 'simulator'

export function paymentMode(): PaymentMode {
  return process.env.PAYMENTS_PROVIDER === 'xendit' ? 'xendit' : 'simulator'
}

export function isXendit(): boolean {
  return paymentMode() === 'xendit'
}

// Map a provider's chosen payout method to a Xendit disbursement channel code.
// IMPORTANT: confirm the exact Malaysian channel codes with Xendit before live
// (bank vs e-wallet differ). For the sandbox/demo, set XENDIT_PAYOUT_CHANNEL to
// a Xendit test channel; this fallback is a placeholder, not a real channel.
export function payoutChannel(_provider?: string | null): string {
  return process.env.XENDIT_PAYOUT_CHANNEL || 'MY_TEST_CHANNEL'
}
