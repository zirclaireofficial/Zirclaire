// profiles/infrastructure — the ONLY place that talks to Supabase for profiles.
// Everything here reads the `public_profiles` view, never the `profiles` table.
// The view is a definer-rights window that exposes safe columns for approved
// members only; reading the table directly would risk leaking KYC data.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/shared/types/database'
import type { ProfileRepository, PublicProfile, MemberRow } from '../domain'

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

    async listAllMembers(): Promise<MemberRow[]> {
      // The one place here that reads the `profiles` TABLE, not the view —
      // an admin needs email and approval state. RLS returns rows to admins
      // only; anyone else gets just their own row back, so this can't leak.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, member_id, full_name, email, role, kyc_status, profile_picture, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as MemberRow[]
    },
  }
}
