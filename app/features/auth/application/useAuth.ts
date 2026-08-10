// auth/application — session use-cases. Wraps the Supabase auth client so
// the rest of the app calls intent-named methods, not raw SDK calls.

import type { Database } from '~/shared/types/database'

export function useAuth() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  // Wait until the session (and its cookie) is actually established, so that
  // subsequent server calls are authenticated. Avoids the race where signUp
  // resolves before the auth cookie is written.
  function waitForSession(timeout = 5000): Promise<void> {
    if (user.value?.id) return Promise.resolve()
    return new Promise((resolve) => {
      const stop = watch(
        user,
        (u) => {
          if (u?.id) {
            stop()
            resolve()
          }
        },
        { immediate: true },
      )
      setTimeout(() => {
        stop()
        resolve()
      }, timeout)
    })
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await waitForSession()
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    await waitForSession()
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    await navigateTo('/login')
  }

  // --- Email OTP verification (used at signup) ---------------------------
  /** Email a one-time code to verify the address (creating the auth user). */
  async function sendEmailOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    if (error) throw error
  }

  /** Verify the code. On success the email is confirmed and a session exists. */
  async function verifyEmailOtp(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) throw error
    await waitForSession()
  }

  /** Set (or change) the signed-in user's password. */
  async function setPassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  // --- Password recovery -------------------------------------------------
  /** Email a password-reset link that returns the user to /reset. */
  async function requestPasswordReset(email: string) {
    const redirectTo = `${window.location.origin}/reset`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }

  return {
    user,
    signIn,
    signUp,
    signOut,
    waitForSession,
    sendEmailOtp,
    verifyEmailOtp,
    setPassword,
    requestPasswordReset,
  }
}
