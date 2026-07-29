// services/domain — pure types, rules, and ports for "My Services".
// NO imports of Nuxt, Supabase, Cloudinary, or any other layer.
//
// A service is a provider's fixed-price offering with 1–3 tiers the provider
// names and describes themselves. Ordering a tier creates a project (server
// side), so nothing about the money lives here — that's the project engine.

export type ServiceStatus = 'pending' | 'approved' | 'rejected' | 'removed'

// A MyService always has exactly three tiers — low, middle and high — per the
// client spec. Not one-to-three; three, always.
export const REQUIRED_TIERS = 3

// --- Business rules --------------------------------------------------------

export interface TierDraft {
  name: string
  price: number | null
  description: string
  delivery_minutes: number | null
}

/** A tier is complete when it has a name and a positive price. */
export function isTierComplete(t: TierDraft): boolean {
  return t.name.trim().length > 0 && !!t.price && t.price > 0
}

/** Publishable only with a title and all three tiers filled in. */
export function isServicePublishable(title: string, tiers: TierDraft[]): boolean {
  const complete = tiers.filter(isTierComplete)
  return title.trim().length > 0 && complete.length === REQUIRED_TIERS
}

export function statusLabel(s: ServiceStatus): string {
  return (
    { pending: 'Awaiting approval', approved: 'Published', rejected: 'Rejected', removed: 'Removed' } as Record<
      string,
      string
    >
  )[s] ?? s
}

/** "$50" style, and "From $50" when a listing has several tiers. */
export function lowestPrice(tiers: { price_usd: number }[]): number | null {
  if (!tiers.length) return null
  return Math.min(...tiers.map((t) => t.price_usd))
}

// --- Read models -----------------------------------------------------------

export interface ProviderRef {
  id: string
  member_id: string | null
  full_name: string | null
  profile_picture: string | null
}

export interface ServiceTier {
  id: string
  position: number
  name: string
  price_usd: number
  description: string | null
  delivery_minutes: number | null
}

/** A store listing with its tiers. */
export interface StoreService {
  id: string
  provider_id: string
  subcategory_id: number | null
  title: string
  description: string | null
  cover_image: string | null
  order_count: number
  created_at: string
  provider: ProviderRef | null
  tiers: ServiceTier[]
}

/** A provider's own listing, with moderation state (their dashboard). */
export interface MyService {
  id: string
  title: string
  status: ServiceStatus
  reject_reason: string | null
  order_count: number
  created_at: string
  tiers: ServiceTier[]
}

/** A listing awaiting admin approval. */
export interface PendingService {
  id: string
  title: string
  description: string | null
  cover_image: string | null
  created_at: string
  provider: ProviderRef | null
  tiers: ServiceTier[]
}

// --- Ports -----------------------------------------------------------------

export interface PublishServiceInput {
  title: string
  description: string | null
  subcategory_id: number | null
  cover_image: string | null
  tiers: { name: string; price_usd: number; description: string | null; delivery_minutes: number | null }[]
}

export interface ServiceRepository {
  browseStore(opts: { subcategoryId?: number | null }): Promise<StoreService[]>
  storeService(id: string): Promise<StoreService | null>
  servicesByProvider(providerId: string): Promise<StoreService[]>
  publish(input: PublishServiceInput): Promise<{ id: string }>
  removeOwn(serviceId: string): Promise<void>
  myServices(): Promise<MyService[]>
  pendingForAdmin(): Promise<PendingService[]>
}
