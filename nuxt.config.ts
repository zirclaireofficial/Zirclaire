// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/supabase', '@nuxtjs/cloudinary', '@nuxt/ui'],

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
      exclude: ['/', '/signup'],
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
  },
})