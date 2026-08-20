// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/supabase', '@nuxtjs/cloudinary', '@nuxt/ui', '@sentry/nuxt/module', '@vercel/speed-insights/nuxt'],

  css: ['~/assets/css/main.css'],

  // Default to light; user can toggle to dark (choice is remembered).
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },

  supabase: {
    // Unauthenticated users are redirected to /login, EXCEPT on public pages
    // (the feed and signup). The login/callback routes are auto-excluded.
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/', '/signup', '/forgot', '/reset', '/legal'],
    },
    // Dev runs on http://localhost, where `Secure` cookies are unreliable —
    // that breaks the auth session (server can't read it, client can't attach
    // it to DB reads). Non-secure in dev, secure in production.
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
    },
  },

  cloudinary: {
    // Public: used in the browser to build optimized delivery URLs.
    cloudName: process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  },

  runtimeConfig: {
    // Server-only secrets — never sent to the browser.
    // Used later by the Cloudinary Node SDK to sign uploads in /server routes.
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
    // DeepSeek — called only from /server routes, never exposed to the client.
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,

    public: {
      // Sentry DSN is a public (client-safe) value; the browser needs it to
      // report errors. Set NUXT_PUBLIC_SENTRY_DSN locally (.env) and on Vercel.
      sentry: {
        dsn: process.env.NUXT_PUBLIC_SENTRY_DSN,
      },
      // Payment mode, surfaced to the UI so it can show a Sandbox/Simulated
      // badge (testers must never think real money moved when it didn't).
      //   'simulator' -> no gateway; 'sandbox' -> Xendit test keys;
      //   'live'      -> Xendit production keys (real money).
      paymentsMode:
        process.env.PAYMENTS_PROVIDER !== 'xendit'
          ? 'simulator'
          : process.env.XENDIT_SECRET_KEY?.startsWith('xnd_production')
            ? 'live'
            : 'sandbox',
    },
  },

  // Sentry module options. On Vercel's serverless functions the default
  // `--import` bootstrap isn't applied, so server-side errors go uncaptured.
  // 'top-level-import' injects the Sentry server config at the top of the
  // server entry instead — this works on Vercel and captures server errors
  // (native Node instrumentation only; DB/ORM tracing isn't included).
  sentry: {
    autoInjectServerSentry: 'top-level-import',
  },

  // Sentry uploads source maps at build time (optional). Left minimal for now;
  // add org/project/authToken here later if you want readable stack traces.
  sourcemap: { client: 'hidden' },
})