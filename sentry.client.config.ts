// Sentry — browser-side error + performance monitoring.
// Runs in the user's browser. The DSN comes from runtime config (public), set
// via NUXT_PUBLIC_SENTRY_DSN. If the DSN is empty, Sentry stays inactive.
import { useRuntimeConfig } from '#imports'
import * as Sentry from '@sentry/nuxt'

const dsn = useRuntimeConfig().public.sentry?.dsn

if (dsn) {
  Sentry.init({
    dsn,
    // Fraction of transactions traced for performance. 1.0 = all (fine at low
    // traffic); lower it (e.g. 0.2) later if you approach Sentry's free quota.
    tracesSampleRate: 1.0,
  })
}
