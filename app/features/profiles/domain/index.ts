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

export type ProfileTab = 'posts' | 'replies' | 'services' | 'royalties'

/**
 * Which tabs a profile shows. Only providers can post, offer services and
 * publish royalty works, so a requester only ever gets Replies — we don't
 * render a tab that would be permanently empty for them.
 */
export function tabsFor(role: string | null): ProfileTab[] {
  return role === 'service_provider' ? ['posts', 'services', 'royalties', 'replies'] : ['replies']
}

export function tabLabel(tab: ProfileTab): string {
  if (tab === 'posts') return 'Posts'
  if (tab === 'services') return 'Services'
  if (tab === 'royalties') return 'Royalties'
  return 'Replies'
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

// --- Admin directory -------------------------------------------------------
// The broker's view of everyone on the platform. This reads the `profiles`
// table rather than the public view, because an admin legitimately needs the
// email and approval state. RLS restricts it to admins.

export interface MemberRow {
  id: string
  member_id: string | null
  full_name: string
  email: string
  role: string
  kyc_status: string
  profile_picture: string | null
  created_at: string
}

export function kycLabel(status: string): string {
  return (
    { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' } as Record<string, string>
  )[status] ?? status
}

/** Group counts for the directory header. */
export function countByRole(members: MemberRow[]): Record<string, number> {
  return members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1
    return acc
  }, {})
}

// --- Port: what infrastructure must provide --------------------------------

export interface ProfileRepository {
  /** Look up by the public handle (member ID), e.g. from /u/MYRSP00007. */
  getByMemberId(memberId: string): Promise<PublicProfile | null>
  /** Look up by user id, e.g. for the signed-in member's own page. */
  getById(id: string): Promise<PublicProfile | null>
  /** Admin only: every member on the platform, newest first. */
  listAllMembers(): Promise<MemberRow[]>
}
