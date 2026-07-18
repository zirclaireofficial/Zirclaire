// projects/domain — pure business types, rules, and ports.
// NO imports of Nuxt, Supabase, Cloudinary, or any other layer.
// This is the exemplar for how every feature's domain layer looks.

import type { Project, Application, ProjectStatus } from '~/shared/types/database'

export type { Project, Application, ProjectStatus }

// --- Business rules live in the domain (single source of truth) ---
export const PLATFORM_COMMISSION_RATE = 0.20 // 20% broker commission

export function commissionFor(amountUsd: number): number {
  return round2(amountUsd * PLATFORM_COMMISSION_RATE)
}

export function payoutFor(amountUsd: number): number {
  return round2(amountUsd * (1 - PLATFORM_COMMISSION_RATE))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// --- Funding state ---------------------------------------------------------
// A project sits in `submitted` from creation until an admin verifies payment.
// From the requester's point of view that single status hides two very
// different situations: "you still owe us money" vs "we're checking it".
// This derives that distinction so the UI can let a requester resume a payment
// they abandoned. Pure rule — no DB, no framework.

export type FundingState =
  | 'awaiting_payment' // created, but the requester never paid (resumable)
  | 'awaiting_verification' // requester paid, admin hasn't verified yet
  | 'rejected' // admin rejected the claim — requester must pay again
  | 'funded' // money is in escrow; project has moved on

export interface PaymentClaim {
  status: 'claimed' | 'verified' | 'rejected'
  method: string
  amount_usd: number
  reference: string | null
  created_at: string
}

export interface ProjectWithPayments extends Project {
  payments: PaymentClaim[]
}

/** Most recent payment claim on a project, or null. */
export function latestClaim(p: ProjectWithPayments): PaymentClaim | null {
  const sorted = [...(p.payments ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  return sorted[0] ?? null
}

export function fundingStateOf(p: ProjectWithPayments): FundingState {
  if (p.status !== 'submitted') return 'funded'
  const claim = latestClaim(p)
  if (!claim) return 'awaiting_payment'
  if (claim.status === 'rejected') return 'rejected'
  if (claim.status === 'verified') return 'awaiting_verification'
  return 'awaiting_verification'
}

/** Can the requester (re)open the payment step for this project? */
export function canResumePayment(p: ProjectWithPayments): boolean {
  const s = fundingStateOf(p)
  return s === 'awaiting_payment' || s === 'rejected'
}

// --- Applicants ------------------------------------------------------------
// Blind bidding: a provider only ever sees their own application, while the
// requester sees every applicant on their own project. That asymmetry is
// enforced by RLS; this is just the shape the requester's screen needs.

export interface Applicant {
  application_id: string
  provider_id: string
  member_id: string | null
  full_name: string | null
  profile_picture: string | null
  cover_note: string | null
  status: ApplicationStatus
  applied_at: string
}

export type ApplicationStatus = Application['status']

/** Applicants can only be chosen while the project is live. */
export function canAward(project: { status: string }): boolean {
  return project.status === 'live'
}

/** Time left before applications close, in ms. Null when there's no deadline. */
export function msRemaining(project: { deadline_at: string | null }, now = Date.now()): number | null {
  if (!project.deadline_at) return null
  return new Date(project.deadline_at).getTime() - now
}

/** "52 hours 32 minutes", as the wireframe shows it. Null when no deadline. */
export function formatRemaining(project: { deadline_at: string | null }, now = Date.now()): string | null {
  const ms = msRemaining(project, now)
  if (ms === null) return null
  if (ms <= 0) return 'Ended'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours} hours ${minutes} minutes`
}

// --- Port: what infrastructure must provide. Defined here, implemented there. ---
export interface ProjectRepository {
  listLiveFeed(): Promise<Project[]>
  getById(id: string): Promise<Project | null>
  listMine(): Promise<Project[]>
  listMineWithPayments(): Promise<ProjectWithPayments[]>
  listApplicants(projectId: string): Promise<Applicant[]>
  applyToProject(projectId: string, coverNote?: string): Promise<Application>
}
