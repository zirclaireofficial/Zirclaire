// Payment-gateway abstraction. The funding routes call these and don't care
// whether Billplz or ToyyibPay is active — the active provider is chosen by
// PAYMENTS_PROVIDER. The returned bill id is stored generically (in the
// payments.toyyibpay_billcode column) and used to re-verify later.
import { isBillplz } from './payments'
import * as billplz from './billplz'
import * as toyyibpay from './toyyibpay'

export interface GatewayBillInput {
  name: string
  email?: string | null
  phone?: string | null
  amountMYR: number
  description: string
  externalRef: string
  returnUrl: string   // where the payer lands after paying
  callbackUrl: string // server-to-server POST
}

/** Create a hosted bill on the active gateway. Returns a generic bill id + pay URL. */
export async function createGatewayBill(input: GatewayBillInput): Promise<{ billId: string; payUrl: string }> {
  if (isBillplz()) {
    return billplz.createBill({
      name: input.name,
      email: input.email,
      mobile: input.phone,
      amountMYR: input.amountMYR,
      description: input.description,
      externalRef: input.externalRef,
      redirectUrl: input.returnUrl,
      callbackUrl: input.callbackUrl,
    })
  }
  const b = await toyyibpay.createBill({
    name: input.name,
    description: input.description,
    amountMYR: input.amountMYR,
    externalRef: input.externalRef,
    returnUrl: input.returnUrl,
    callbackUrl: input.callbackUrl,
    payerName: input.name,
    payerEmail: input.email ?? undefined,
    payerPhone: input.phone ?? undefined,
  })
  return { billId: b.billCode, payUrl: b.payUrl }
}

export interface GatewayBillStatus { paid: boolean; status: '1' | '2' | '3' | 'unknown'; amountMYR: number | null }

/** Re-verify a bill on the active gateway (the trusted, server-to-server check). */
export async function getGatewayBillStatus(billId: string): Promise<GatewayBillStatus> {
  return isBillplz() ? billplz.getBillStatus(billId) : toyyibpay.getBillStatus(billId)
}

/** The server-to-server callback path for the active gateway's webhook. */
export function gatewayCallbackPath(): string {
  return isBillplz() ? '/api/webhooks/billplz' : '/api/webhooks/toyyibpay'
}

/** Reconstruct the hosted pay URL for an existing bill id (reuse case). */
export function gatewayPayUrl(billId: string): string {
  return isBillplz() ? billplz.billPayUrl(billId) : toyyibpay.billPayUrl(billId)
}
