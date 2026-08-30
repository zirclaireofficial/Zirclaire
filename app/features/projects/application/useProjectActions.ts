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

  /** Awarded provider begins work: awarded → in_progress. */
  function startWork(projectId: string) {
    return authedFetch<{ project: Project }>('/api/projects/start', { method: 'POST', body: { projectId } })
  }

  /** Awarded provider submits a deliverable (Cloudinary reference already
   *  uploaded): in_progress|revision_requested → submitted_work. */
  function submitDeliverable(projectId: string, mediaUrl: string, mediaType?: string | null, note?: string | null) {
    return authedFetch<{ project: Project }>('/api/projects/submit-deliverable', {
      method: 'POST', body: { projectId, mediaUrl, mediaType, note },
    })
  }

  /** Requester asks for changes on a submission (unlimited rounds). */
  function requestChanges(projectId: string, note: string) {
    return authedFetch<{ ok: boolean }>('/api/projects/request-changes', { method: 'POST', body: { projectId, note } })
  }

  /** Requester accepts the work — closes the project and releases the payout. */
  function acceptWork(projectId: string) {
    return authedFetch<{ ok: boolean }>('/api/projects/accept', { method: 'POST', body: { projectId } })
  }

  /** Signed URL to view the latest deliverable (project party / staff). */
  async function deliverableUrl(projectId: string): Promise<{ url: string; mediaType: string | null }> {
    return authedFetch('/api/projects/deliverable-url', { method: 'POST', body: { projectId } })
  }

  return {
    createProject, claimPayment, createInvoice, awardApplicant, fundAndLaunch, approveProject,
    startWork, submitDeliverable, requestChanges, acceptWork, deliverableUrl,
  }
}
