// royalties/infrastructure — the ONLY place that talks to Supabase for the
// store. Reads the `royalty_store` view for public browsing (approved items,
// no file_url) and the `royalty_items` table for a creator's own drafts.
//
// The downloadable file is never fetched here — access to it is a server
// route that verifies a purchase first.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/shared/types/database'
import { authedFetch } from '~/shared/lib/authedFetch'
import type {
  RoyaltyRepository,
  StoreItem,
  MyItem,
  PurchasedItem,
  PendingItem,
  CreatorRef,
  PublishInput,
  EligibleProject,
  WorkType,
} from '../domain'

// The royalty tables are newer than the last generated types; until types are
// regenerated, talk to Supabase through a loosely-typed handle. Confined to
// this swappable layer on purpose.
type Loose = SupabaseClient<Database> & {
  from: (t: string) => any
}

export function createSupabaseRoyaltyRepository(client: SupabaseClient<Database>): RoyaltyRepository {
  const supabase = client as Loose

  async function currentUserId(): Promise<string | null> {
    const { data } = await client.auth.getSession()
    return data.session?.user?.id ?? null
  }

  async function fetchCreators(ids: string[]): Promise<Map<string, CreatorRef>> {
    const unique = [...new Set(ids)].filter(Boolean)
    if (!unique.length) return new Map()
    const { data } = await supabase
      .from('public_profiles')
      .select('id, member_id, full_name, profile_picture')
      .in('id', unique)
    return new Map((data ?? []).map((c: any) => [c.id as string, c as CreatorRef]))
  }

  /** Which of these item ids has the current caller purchased? */
  async function ownedSet(itemIds: string[]): Promise<Set<string>> {
    const uid = await currentUserId()
    if (!uid || !itemIds.length) return new Set()
    const { data } = await supabase
      .from('royalty_purchases')
      .select('item_id')
      .eq('buyer_id', uid)
      .in('item_id', itemIds)
    return new Set((data ?? []).map((p: any) => p.item_id as string))
  }

  async function decorate(rows: any[]): Promise<StoreItem[]> {
    if (!rows.length) return []
    const [creators, owned] = await Promise.all([
      fetchCreators(rows.map((r) => r.creator_id)),
      ownedSet(rows.map((r) => r.id)),
    ])
    return rows.map((r) => ({
      id: r.id,
      creator_id: r.creator_id,
      work_type: r.work_type,
      title: r.title,
      description: r.description ?? null,
      price_myr: Number(r.price_myr),
      cover_image: r.cover_image ?? null,
      file_type: r.file_type ?? null,
      purchase_count: r.purchase_count ?? 0,
      created_at: r.created_at,
      creator: creators.get(r.creator_id) ?? null,
      owned: owned.has(r.id),
    }))
  }

  return {
    async browseStore({ type }): Promise<StoreItem[]> {
      let q = supabase.from('royalty_store').select('*').order('created_at', { ascending: false })
      if (type) q = q.eq('work_type', type)
      const { data, error } = await q
      if (error) throw error
      return decorate(data ?? [])
    },

    async storeItem(id: string): Promise<StoreItem | null> {
      const { data, error } = await supabase.from('royalty_store').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      if (!data) return null
      const [one] = await decorate([data])
      return one ?? null
    },

    async itemsByCreator(creatorId: string): Promise<StoreItem[]> {
      // Store view = approved only, so a public profile shows a creator's
      // published works and nothing in draft.
      const { data, error } = await supabase
        .from('royalty_store')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return decorate(data ?? [])
    },

    async publish(input: PublishInput): Promise<{ id: string }> {
      // Server verifies ownership + closed status and pulls the deliverable
      // file; the requester (owner) never handles the private file URL.
      return authedFetch<{ id: string }>('/api/royalties/publish', {
        method: 'POST',
        body: {
          projectId: input.project_id,
          workType: input.work_type,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          price: input.price_myr,
          coverImage: input.cover_image,
        },
      })
    },

    async eligibleProjects(): Promise<EligibleProject[]> {
      const uid = await currentUserId()
      if (!uid) return []
      // My completed projects, minus any already listed.
      const [{ data: closed }, { data: listed }] = await Promise.all([
        supabase.from('projects').select('id, title').eq('requester_id', uid).eq('status', 'closed'),
        supabase.from('royalty_items').select('project_id').eq('creator_id', uid),
      ])
      const taken = new Set((listed ?? []).map((r: any) => r.project_id).filter(Boolean))
      return (closed ?? [])
        .filter((p: any) => !taken.has(p.id))
        .map((p: any) => ({ id: p.id as string, title: p.title as string }))
    },

    async removeOwn(itemId: string): Promise<void> {
      const { error } = await supabase.from('royalty_items').delete().eq('id', itemId)
      if (error) throw error
    },

    async myItems(): Promise<MyItem[]> {
      const uid = await currentUserId()
      if (!uid) return []
      const { data, error } = await supabase
        .from('royalty_items')
        .select('id, work_type, title, price_myr, status, reject_reason, purchase_count, created_at')
        .eq('creator_id', uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r: any) => ({ ...r, price_myr: Number(r.price_myr) })) as MyItem[]
    },

    async myLibrary(): Promise<PurchasedItem[]> {
      const uid = await currentUserId()
      if (!uid) return []
      const { data, error } = await supabase
        .from('royalty_purchases')
        .select('id, item_id, amount_myr, purchased_at, royalty_items(title, work_type, creator_id)')
        .eq('buyer_id', uid)
        .order('purchased_at', { ascending: false })
      if (error) throw error
      const rows = data ?? []
      const creators = await fetchCreators(rows.map((r: any) => r.royalty_items?.creator_id))
      return rows.map((r: any) => ({
        purchase_id: r.id,
        item_id: r.item_id,
        title: r.royalty_items?.title ?? 'Untitled',
        work_type: r.royalty_items?.work_type as WorkType,
        amount_myr: Number(r.amount_myr),
        purchased_at: r.purchased_at,
        creator: creators.get(r.royalty_items?.creator_id) ?? null,
      }))
    },

    async pendingForAdmin(): Promise<PendingItem[]> {
      // RLS lets admins read all items; this filters to the ones awaiting a
      // decision, with the file so they can vet it before approving.
      const { data, error } = await supabase
        .from('royalty_items')
        .select('id, work_type, title, description, price_myr, file_url, file_type, cover_image, created_at, creator_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (error) throw error
      const rows = data ?? []
      const creators = await fetchCreators(rows.map((r: any) => r.creator_id))
      return rows.map((r: any) => ({
        id: r.id,
        work_type: r.work_type,
        title: r.title,
        description: r.description ?? null,
        price_myr: Number(r.price_myr),
        file_url: r.file_url,
        file_type: r.file_type ?? null,
        cover_image: r.cover_image ?? null,
        created_at: r.created_at,
        creator: creators.get(r.creator_id) ?? null,
      }))
    },
  }
}
