// projects/application — privileged project actions go through the server API
// (Bearer-authed). Reads use the repository/RLS; these are the writes.

import type { Project } from '~/shared/types/database'
import { authedFetch } from '~/shared/lib/authedFetch'

export interface CreateProjectInput {
  title: string
  description?: string | null
  subcategory_id?: number | null
  requirements?: string[] | null
  budget_myr: number
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

  /** Gateway funding: creates a Xendit invoice (returns a pay URL to open),
   *  or auto-funds in simulator mode. Funding is confirmed by the webhook. */
  function createInvoice(projectId: string, returnUrl?: string) {
    return authedFetch<{ mode: string; invoiceUrl?: string; funded?: boolean }>(
      '/api/payments/create-invoice',
      { method: 'POST', body: { projectId, returnUrl } },
    )
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

  /** Admin approves a submitted project (approve-before-pay). Notifies the
   *  requester, who can then pay. No money moves here. */
  function approveProject(projectId: string) {
    return authedFetch<{ project: Project }>('/api/projects/approve', {
      method: 'POST',
      body: { projectId },
    })
  }

  return { createProject, claimPayment, createInvoice, awardApplicant, fundAndLaunch, approveProject }
}
