// projects/application — privileged project actions go through the server API
// (Bearer-authed). Reads use the repository/RLS; these are the writes.

import type { Project } from '~/shared/types/database'
import { authedFetch } from '~/shared/lib/authedFetch'

export interface CreateProjectInput {
  title: string
  description?: string | null
  subcategory_id?: number | null
  requirements?: string[] | null
  budget_usd: number
  timeline_minutes?: number | null
  attachments?: { media_url: string; media_type?: string | null; label?: string | null }[]
}

export function useProjectActions() {
  function createProject(input: CreateProjectInput) {
    return authedFetch<{ project: Project }>('/api/projects/create', {
      method: 'POST',
      body: input,
    })
  }

  function claimPayment(projectId: string, method: 'binance' | 'touch_n_go', reference: string) {
    return authedFetch('/api/payments/claim', {
      method: 'POST',
      body: { projectId, method, reference },
    })
  }

  /** Award the job to one applicant. The rest are rejected in the same
   *  transaction by the award_applicant function. */
  function awardApplicant(projectId: string, applicationId: string) {
    return authedFetch<{ project: Project }>('/api/projects/award', {
      method: 'POST',
      body: { projectId, applicationId },
    })
  }

  function fundAndLaunch(projectId: string) {
    return authedFetch<{ project: Project }>('/api/admin/projects/fund-and-launch', {
      method: 'POST',
      body: { projectId },
    })
  }

  return { createProject, claimPayment, awardApplicant, fundAndLaunch }
}
