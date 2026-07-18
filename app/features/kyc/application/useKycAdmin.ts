// kyc/application — admin KYC review use-cases.
// Reading pending profiles goes directly through RLS (admins can read all);
// approve/reject/signed-media go through the privileged server routes.

import type { Database, Profile } from '~/shared/types/database'
import { authedFetch } from '~/shared/lib/authedFetch'

export function useKycAdmin() {
  const supabase = useSupabaseClient<Database>()
  const config = useRuntimeConfig()

  // Direct read — RLS lets admins read all profiles.
  async function listPending(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('kyc_status', 'pending')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  }

  function approve(profileId: string) {
    return authedFetch<{ profile: Profile }>('/api/kyc/approve', {
      method: 'POST',
      body: { profileId },
    })
  }

  function reject(profileId: string, reason: string) {
    return authedFetch<{ profile: Profile }>('/api/kyc/reject', {
      method: 'POST',
      body: { profileId, reason },
    })
  }

  async function signedMedia(publicId: string): Promise<string> {
    const res = await authedFetch<{ url: string }>('/api/admin/signed-media', {
      method: 'POST',
      body: { publicId },
    })
    return res.url
  }

  // Public delivery URL (e.g. profile pictures live in a public folder).
  function publicMedia(publicId: string): string {
    const cloud = (config.public as { cloudinary?: { cloudName?: string } }).cloudinary?.cloudName
    return `https://res.cloudinary.com/${cloud}/image/upload/${publicId}`
  }

  return { listPending, approve, reject, signedMedia, publicMedia }
}
