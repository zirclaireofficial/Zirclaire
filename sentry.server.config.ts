// Sentry — server-side error + performance monitoring (Nitro / API routes).
// This file loads BEFORE Nuxt, so useRuntimeConfig() is unavailable here —
// read the DSN straight from the environment. Set NUXT_PUBLIC_SENTRY_DSN
// locally (.env) and on Vercel.
import * as Sentry from '@sentry/nuxt'

if (process.env.NUXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NUXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
  })
}
