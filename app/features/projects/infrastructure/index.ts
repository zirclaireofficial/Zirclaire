// projects/infrastructure — the ONLY place that talks to Supabase for projects.
// Implements the domain's ProjectRepository port. Swap this out and the rest
// of the feature (application, ui) is untouched.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/shared/types/database'
import type {
  ProjectRepository,
  Project,
  Application,
  ProjectWithPayments,
  Applicant,
} from '../domain'

export function createSupabaseProjectRepository(
  supabase: SupabaseClient<Database>,
): ProjectRepository {
  return {
    async listLiveFeed(): Promise<Project[]> {
      // RLS ensures only approved SPs get rows here.
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'live')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },

    async getById(id: string): Promise<Project | null> {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },

    async listMine(): Promise<Project[]> {
      // RLS returns only the caller's own projects (SR) or involved ones (SP).
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },

    async listMineWithPayments(): Promise<ProjectWithPayments[]> {
      // Same RLS as listMine, plus the caller's own payment claims (payments
      // RLS only exposes rows where the caller is the payer).
      const { data, error } = await supabase
        .from('projects')
        .select('*, payments(status, method, amount_usd, reference, created_at)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((p) => ({ ...p, payments: p.payments ?? [] })) as ProjectWithPayments[]
    },

    async listApplicants(projectId: string): Promise<Applicant[]> {
      // RLS: the requester sees every applicant on a project they own; a
      // provider only ever sees their own row. Same query, different results.
      const { data, error } = await supabase
        .from('applications')
        .select('id, provider_id, cover_note, status, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
      if (error) throw error
      const rows = data ?? []
      if (!rows.length) return []

      // Identities come from the public view (safe columns, approved only).
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, member_id, full_name, profile_picture')
        .in('id', [...new Set(rows.map((r) => r.provider_id))])
      const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]))

      return rows.map((r) => {
        const p = byId.get(r.provider_id)
        return {
          application_id: r.id,
          provider_id: r.provider_id,
          member_id: (p?.member_id as string) ?? null,
          full_name: (p?.full_name as string) ?? null,
          profile_picture: (p?.profile_picture as string) ?? null,
          cover_note: r.cover_note,
          status: r.status,
          applied_at: r.created_at,
        }
      })
    },

    async applyToProject(projectId: string, coverNote?: string): Promise<Application> {
      const { data: userData } = await supabase.auth.getUser()
      const providerId = userData.user?.id
      if (!providerId) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('applications')
        .insert({ project_id: projectId, provider_id: providerId, cover_note: coverNote ?? null })
        .select()
        .single()
      if (error) throw error
      return data
    },
  }
}
