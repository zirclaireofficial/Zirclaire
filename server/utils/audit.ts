// Audit logging. Every privileged route calls logAction after it succeeds, so
// the Master has a complete, append-only trail of staff activity. Best-effort:
// a logging failure must never break the actual operation, so it's swallowed.

import type { H3Event } from 'h3'
import { serviceClient } from './auth'

export interface AuditEntry {
  action: string // machine key, e.g. 'kyc.approve'
  target_type?: string
  target_id?: string
  summary?: string
  detail?: Record<string, unknown>
}

export async function logAction(
  event: H3Event,
  actor: { id: string; role: string },
  entry: AuditEntry,
) {
  try {
    await serviceClient(event)
      .from('audit_log')
      .insert({
        actor_id: actor.id,
        actor_role: actor.role,
        action: entry.action,
        target_type: entry.target_type ?? null,
        target_id: entry.target_id ?? null,
        summary: entry.summary ?? null,
        detail: entry.detail ?? null,
      })
  } catch {
    // Never let audit logging break the operation it's recording.
  }
}
