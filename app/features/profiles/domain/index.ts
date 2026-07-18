// profiles/domain — pure types, rules, and ports for member profiles.
// NO imports of Nuxt, Supabase, Cloudinary, or any other layer.

/**
 * What the world may see about a member. This mirrors the `public_profiles`
 * view exactly — the view is the security boundary, this is its shape. KYC
 * data, payout accounts and documents are deliberately absent and must never
 * be added here.
 */
export interface PublicProfile {
  id: string
  member_id: string | null
  full_name: string | null
  role: string | null
  profile_picture: string | null
  country_id: number | null
  created_at: string
}

export type ProfileTab = 'posts' | 'replies'

/**
 * Which tabs a profile shows. Only providers can author posts, so a
 * requester's Posts tab would be permanently empty — we don't render it
 * rather than showing a dead tab.
 */
export function tabsFor(role: string | null): ProfileTab[] {
  return role === 'service_provider' ? ['posts', 'replies'] : ['replies']
}

export function tabLabel(tab: ProfileTab): string {
  return tab === 'posts' ? 'Posts' : 'Replies'
}

export function roleLabel(role: string | null): string {
  if (role === 'service_provider') return 'Provider'
  if (role === 'service_requester') return 'Requester'
  if (role === 'admin') return 'Admin'
  return 'Member'
}

/** "Member since March 2026" */
export function memberSince(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function initialsOf(fullName: string | null): string {
  if (!fullName) return '?'
  return fullName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

/** The shareable URL path for a member. Member ID is the public handle. */
export function profilePath(memberId: string | null): string | null {
  return memberId ? `/u/${memberId}` : null
}

// --- Port: what infrastructure must provide --------------------------------

export interface ProfileRepository {
  /** Look up by the public handle (member ID), e.g. from /u/MYRSP00007. */
  getByMemberId(memberId: string): Promise<PublicProfile | null>
  /** Look up by user id, e.g. for the signed-in member's own page. */
  getById(id: string): Promise<PublicProfile | null>
}
