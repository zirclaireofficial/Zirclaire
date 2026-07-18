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
  AdminProjectRow,
  AdminProjectDetail,
  PartyRef,
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

    async listAllForAdmin(status?: string | null): Promise<AdminProjectRow[]> {
      // No admin-only query needed: RLS already returns every project to an
      // admin and nothing extra to anyone else, so the same call is safe.
      let q = supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      const rows = (data ?? []) as Project[]
      if (!rows.length) return []

      const partyIds = rows.flatMap((p) => [p.requester_id, p.awarded_provider_id]).filter(Boolean) as string[]
      const [parties, counts] = await Promise.all([
        fetchParties(partyIds),
        (async () => {
          const { data: apps } = await supabase
            .from('applications')
            .select('project_id')
            .in('project_id', rows.map((p) => p.id))
          const map = new Map<string, number>()
          for (const a of apps ?? []) {
            map.set(a.project_id as string, (map.get(a.project_id as string) ?? 0) + 1)
          }
          return map
        })(),
      ])

      return rows.map((p) => ({
        ...p,
        requester: parties.get(p.requester_id) ?? null,
        provider: p.awarded_provider_id ? parties.get(p.awarded_provider_id) ?? null : null,
        applicant_count: counts.get(p.id) ?? 0,
      }))
    },

    async getAdminDetail(projectId: string): Promise<AdminProjectDetail | null> {
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle()
      if (error) throw error
      if (!project) return null

      const [
        { data: apps },
        { data: attachments },
        { data: deliverables },
        { data: reviews },
        { data: ledger },
        { data: payments },
      ] = await Promise.all([
        supabase
          .from('applications')
          .select('id, provider_id, cover_note, status, created_at')
          .eq('project_id', projectId)
          .order('created_at'),
        supabase.from('project_attachments').select('id, media_url, media_type, label').eq('project_id', projectId),
        supabase
          .from('deliverables')
          .select('id, version, media_url, media_type, note, submitted_at')
          .eq('project_id', projectId)
          .order('version'),
        supabase
          .from('reviews')
          .select('id, decision, reason, created_at')
          .eq('project_id', projectId)
          .order('created_at'),
        supabase
          .from('escrow_ledger')
          .select('id, entry_type, amount_usd, note, created_at')
          .eq('project_id', projectId)
          .order('created_at'),
        supabase
          .from('payments')
          .select('status, method, amount_usd, reference, created_at')
          .eq('project_id', projectId)
          .order('created_at'),
      ])

      const parties = await fetchParties([
        project.requester_id,
        project.awarded_provider_id,
        ...(apps ?? []).map((a) => a.provider_id),
      ].filter(Boolean) as string[])

      return {
        ...(project as Project),
        requester: parties.get(project.requester_id) ?? null,
        provider: project.awarded_provider_id ? parties.get(project.awarded_provider_id) ?? null : null,
        applicant_count: (apps ?? []).length,
        applicants: (apps ?? []).map((a) => {
          const p = parties.get(a.provider_id)
          return {
            application_id: a.id,
            provider_id: a.provider_id,
            member_id: p?.member_id ?? null,
            full_name: p?.full_name ?? null,
            profile_picture: p?.profile_picture ?? null,
            cover_note: a.cover_note,
            status: a.status,
            applied_at: a.created_at,
          }
        }),
        attachments: (attachments ?? []) as AdminProjectDetail['attachments'],
        deliverables: (deliverables ?? []) as AdminProjectDetail['deliverables'],
        reviews: (reviews ?? []) as AdminProjectDetail['reviews'],
        ledger: (ledger ?? []) as AdminProjectDetail['ledger'],
        payments: (payments ?? []) as AdminProjectDetail['payments'],
      }
    },
  }

  /** Member ID + name for a set of user ids, from the public view only. */
  async function fetchParties(ids: string[]): Promise<Map<string, PartyRef>> {
    const unique = [...new Set(ids)].filter(Boolean)
    if (!unique.length) return new Map()
    const { data } = await supabase
      .from('public_profiles')
      .select('id, member_id, full_name, profile_picture')
      .in('id', unique)
    return new Map((data ?? []).map((p) => [p.id as string, p as PartyRef]))
  }
}
