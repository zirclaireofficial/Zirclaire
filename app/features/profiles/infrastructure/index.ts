// profiles/infrastructure — the ONLY place that talks to Supabase for profiles.
// Everything here reads the `public_profiles` view, never the `profiles` table.
// The view is a definer-rights window that exposes safe columns for approved
// members only; reading the table directly would risk leaking KYC data.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/shared/types/database'
import type { ProfileRepository, PublicProfile } from '../domain'

const COLUMNS = 'id, member_id, full_name, role, profile_picture, country_id, created_at'

export function createSupabaseProfileRepository(
  supabase: SupabaseClient<Database>,
): ProfileRepository {
  return {
    async getByMemberId(memberId: string): Promise<PublicProfile | null> {
      const { data, error } = await supabase
        .from('public_profiles')
        .select(COLUMNS)
        .eq('member_id', memberId.toUpperCase())
        .maybeSingle()
      if (error) throw error
      return (data as PublicProfile) ?? null
    },

    async getById(id: string): Promise<PublicProfile | null> {
      const { data, error } = await supabase
        .from('public_profiles')
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return (data as PublicProfile) ?? null
    },
  }
}
