// royalties/domain — pure types, rules, and ports for the royalty store.
// NO imports of Nuxt, Supabase, Cloudinary, or any other layer.
//
// A royalty item is a finished work (novel, research, journal) a provider
// publishes once and sells for a fixed price. Buying is an instant one-time
// sale — no escrow, no deliver/review — so the money model is far simpler
// than a project's.

export type WorkType = 'novel' | 'research' | 'journal'
export type RoyaltyItemStatus = 'pending' | 'approved' | 'rejected' | 'removed'

// --- Business rules --------------------------------------------------------

/** Platform commission on a royalty sale — 85% (the owner keeps 15%), per §16A. */
export const ROYALTY_COMMISSION_RATE = 0.85

export function royaltyCommission(priceUsd: number): number {
  return round2(priceUsd * ROYALTY_COMMISSION_RATE)
}

/** What the owner keeps — the price minus commission (15%, exact, no drift). */
export function creatorPayout(priceUsd: number): number {
  return round2(priceUsd - royaltyCommission(priceUsd))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function isPublishable(input: { title: string; price: number | null; hasProject: boolean }): boolean {
  return input.title.trim().length > 0 && !!input.price && input.price > 0 && input.hasProject
}

export const WORK_TYPES: { value: WorkType; label: string }[] = [
  { value: 'novel', label: 'Novel' },
  { value: 'research', label: 'Research' },
  { value: 'journal', label: 'Journal' },
]

export function workTypeLabel(t: string): string {
  return WORK_TYPES.find((w) => w.value === t)?.label ?? t
}

export function statusLabel(s: RoyaltyItemStatus): string {
  return (
    { pending: 'Awaiting approval', approved: 'Published', rejected: 'Rejected', removed: 'Removed' } as Record<
      string,
      string
    >
  )[s] ?? s
}

// --- Read models -----------------------------------------------------------

export interface CreatorRef {
  id: string
  member_id: string | null
  full_name: string | null
  profile_picture: string | null
}

/** A store listing. Note: never carries the downloadable file_url. */
export interface StoreItem {
  id: string
  creator_id: string
  work_type: WorkType
  title: string
  description: string | null
  price_usd: number
  cover_image: string | null
  file_type: string | null
  purchase_count: number
  created_at: string
  creator: CreatorRef | null
  /** Whether the current caller already owns it. False when signed out. */
  owned: boolean
}

/** A creator's own item, including moderation state (their dashboard). */
export interface MyItem {
  id: string
  work_type: WorkType
  title: string
  price_usd: number
  status: RoyaltyItemStatus
  reject_reason: string | null
  purchase_count: number
  created_at: string
}

/** A row in the buyer's library. */
export interface PurchasedItem {
  purchase_id: string
  item_id: string
  title: string
  work_type: WorkType
  amount_usd: number
  purchased_at: string
  creator: CreatorRef | null
}

/** An item awaiting admin approval, with its file so the admin can vet it. */
export interface PendingItem {
  id: string
  work_type: WorkType
  title: string
  description: string | null
  price_usd: number
  file_url: string
  file_type: string | null
  cover_image: string | null
  created_at: string
  creator: CreatorRef | null
}

// --- Ports -----------------------------------------------------------------

export interface PublishInput {
  project_id: string // the completed project whose deliverable is being listed
  work_type: WorkType
  title: string
  description: string | null
  price_usd: number
  cover_image: string | null
}

/** A completed project the owner can list for resale. */
export interface EligibleProject {
  id: string
  title: string
}

export interface RoyaltyRepository {
  browseStore(opts: { type?: WorkType | null }): Promise<StoreItem[]>
  storeItem(id: string): Promise<StoreItem | null>
  itemsByCreator(creatorId: string): Promise<StoreItem[]>
  publish(input: PublishInput): Promise<{ id: string }>
  eligibleProjects(): Promise<EligibleProject[]>
  removeOwn(itemId: string): Promise<void>
  myItems(): Promise<MyItem[]>
  myLibrary(): Promise<PurchasedItem[]>
  pendingForAdmin(): Promise<PendingItem[]>
}
