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
  | 'awaiting_approval' // submitted; an admin hasn't approved it yet (can't pay)
  | 'awaiting_payment' // approved — the requester must now pay (resumable)
  | 'awaiting_verification' // requester paid, confirmation in flight
  | 'rejected' // a payment was rejected — requester must pay again
  | 'funded' // money is in escrow; project has moved on

export interface PaymentClaim {
  status: 'claimed' | 'verified' | 'rejected'
  method: string
  amount_myr: number
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
  // Approve-before-pay: submitted = waiting on the admin; approved = pay now.
  if (p.status === 'submitted') return 'awaiting_approval'
  if (p.status !== 'approved') return 'funded'
  const claim = latestClaim(p)
  if (claim?.status === 'rejected') return 'rejected'
  if (claim?.status === 'verified') return 'awaiting_verification' // paid, funding in flight
  return 'awaiting_payment'
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

/**
 * Does this project have an applicant list worth showing? True from the moment
 * it goes live and stays true afterwards — once awarded, the requester still
 * needs to see who they picked, not have the list disappear on them.
 */
export function hasApplicantList(project: { status: string }): boolean {
  return [
    'live',
    'awarded',
    'in_progress',
    'submitted_work',
    'in_review',
    'revision_requested',
    'finished',
    'closed',
  ].includes(project.status)
}

/** The countdown is only meaningful while applications are actually open. */
export function showsCountdown(project: { status: string; deadline_at: string | null }): boolean {
  return project.status === 'live' && !!project.deadline_at
}

/**
 * Applications closed with nobody awarded — the requester's money is funded
 * but the project is going nowhere. Needs surfacing rather than sitting quiet.
 */
export function isStalled(project: { status: string; deadline_at: string | null }, now = Date.now()): boolean {
  if (project.status !== 'live' || !project.deadline_at) return false
  return new Date(project.deadline_at).getTime() <= now
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

// --- Admin oversight -------------------------------------------------------
// The broker needs to see any project end to end: who's involved, where the
// money is, and what's been delivered. Read-only — every action still happens
// through its own dedicated, deliberate route.

export interface PartyRef {
  id: string
  member_id: string | null
  full_name: string | null
  profile_picture: string | null
}

export interface AdminProjectRow extends Project {
  requester: PartyRef | null
  provider: PartyRef | null
  applicant_count: number
}

export interface LedgerEntry {
  id: string
  entry_type: string
  amount_myr: number
  note: string | null
  created_at: string
}

export interface DeliverableRef {
  id: string
  version: number
  media_url: string
  media_type: string | null
  note: string | null
  submitted_at: string
}

export interface ReviewRef {
  id: string
  decision: string
  reason: string | null
  created_at: string
}

export interface AttachmentRef {
  id: string
  media_url: string
  media_type: string | null
  label: string | null
}

export interface AdminProjectDetail extends AdminProjectRow {
  applicants: Applicant[]
  attachments: AttachmentRef[]
  deliverables: DeliverableRef[]
  reviews: ReviewRef[]
  ledger: LedgerEntry[]
  payments: PaymentClaim[]
}

/** Money currently held in escrow for a project — the ledger sums to it. */
export function heldBalance(ledger: LedgerEntry[]): number {
  return round2(ledger.reduce((sum, e) => sum + Number(e.amount_myr), 0))
}

/** Human label for a ledger entry type. */
export function ledgerLabel(type: string): string {
  return (
    { fund: 'Funded by requester', commission: 'Platform commission', payout: 'Paid to provider', refund: 'Refunded to requester' } as Record<string, string>
  )[type] ?? type
}

// --- Port: what infrastructure must provide. Defined here, implemented there. ---
export interface ProjectRepository {
  listLiveFeed(): Promise<Project[]>
  getById(id: string): Promise<Project | null>
  listMine(): Promise<Project[]>
  listMineWithPayments(): Promise<ProjectWithPayments[]>
  listApplicants(projectId: string): Promise<Applicant[]>
  applyToProject(projectId: string, coverNote?: string): Promise<Application>

  /** Admin oversight: every project, optionally filtered by status. */
  listAllForAdmin(status?: string | null): Promise<AdminProjectRow[]>
  /** Admin oversight: one project with everything attached to it. */
  getAdminDetail(projectId: string): Promise<AdminProjectDetail | null>
}
