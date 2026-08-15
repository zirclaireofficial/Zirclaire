// Sentry connectivity test — SAFE TO LEAVE DEPLOYED.
// It only throws a test error when called with the correct key:
//     /api/debug-sentry?key=YOUR_KEY
// Set SENTRY_TEST_KEY in your env (local .env + Vercel) to whatever value you
// like. Without the key — or if SENTRY_TEST_KEY isn't set — it just returns
// { ok: true } and does nothing, so random/public hits can't spam errors or
// burn Sentry quota.
export default defineEventHandler((event) => {
  const provided = getQuery(event).key
  const expected = process.env.SENTRY_TEST_KEY

  if (!expected || provided !== expected) {
    return { ok: true } // disabled / wrong key — no error generated
  }

  throw new Error('Zirclaire Sentry test — server route (safe to ignore)')
})
