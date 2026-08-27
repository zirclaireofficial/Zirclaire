// services/infrastructure — the ONLY place that talks to Supabase for service
// listings. Reads `service_store` (approved, public) or `services` (a
// provider's own drafts), and stitches on the provider byline + tiers.
//
// Ordering a tier is NOT here — it's a server route (it creates a funded
// project), exposed through the application layer.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/shared/types/database'
import type {
  ServiceRepository,
  StoreService,
  MyService,
  PendingService,
  ProviderRef,
  ServiceTier,
  PublishServiceInput,
} from '../domain'

// Newer than the last generated types; talk to Supabase loosely until types
// are regenerated. Confined to this swappable layer.
type Loose = SupabaseClient<Database> & { from: (t: string) => any }

export function createSupabaseServiceRepository(client: SupabaseClient<Database>): ServiceRepository {
  const supabase = client as Loose

  async function currentUserId(): Promise<string | null> {
    const { data } = await client.auth.getSession()
    return data.session?.user?.id ?? null
  }

  async function fetchProviders(ids: string[]): Promise<Map<string, ProviderRef>> {
    const unique = [...new Set(ids)].filter(Boolean)
    if (!unique.length) return new Map()
    const { data } = await supabase
      .from('public_profiles')
      .select('id, member_id, full_name, profile_picture')
      .in('id', unique)
    return new Map((data ?? []).map((p: any) => [p.id as string, p as ProviderRef]))
  }

  async function fetchTiers(serviceIds: string[]): Promise<Map<string, ServiceTier[]>> {
    if (!serviceIds.length) return new Map()
    const { data } = await supabase
      .from('service_tiers')
      .select('id, service_id, position, name, price_myr, description, delivery_minutes')
      .in('service_id', serviceIds)
      .order('position')
    const byService = new Map<string, ServiceTier[]>()
    for (const t of data ?? []) {
      const list = byService.get(t.service_id as string) ?? []
      list.push({
        id: t.id,
        position: t.position,
        name: t.name,
        price_myr: Number(t.price_myr),
        description: t.description ?? null,
        delivery_minutes: t.delivery_minutes ?? null,
      })
      byService.set(t.service_id as string, list)
    }
    return byService
  }

  async function decorate(rows: any[]): Promise<StoreService[]> {
    if (!rows.length) return []
    const [providers, tiers] = await Promise.all([
      fetchProviders(rows.map((r) => r.provider_id)),
      fetchTiers(rows.map((r) => r.id)),
    ])
    return rows.map((r) => ({
      id: r.id,
      provider_id: r.provider_id,
      subcategory_id: r.subcategory_id ?? null,
      title: r.title,
      description: r.description ?? null,
      cover_image: r.cover_image ?? null,
      order_count: r.order_count ?? 0,
      created_at: r.created_at,
      provider: providers.get(r.provider_id) ?? null,
      tiers: tiers.get(r.id) ?? [],
    }))
  }

  return {
    async browseStore({ subcategoryId }): Promise<StoreService[]> {
      let q = supabase.from('service_store').select('*').order('created_at', { ascending: false })
      if (subcategoryId) q = q.eq('subcategory_id', subcategoryId)
      const { data, error } = await q
      if (error) throw error
      return decorate(data ?? [])
    },

    async storeService(id: string): Promise<StoreService | null> {
      const { data, error } = await supabase.from('service_store').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      if (!data) return null
      const [one] = await decorate([data])
      return one ?? null
    },

    async servicesByProvider(providerId: string): Promise<StoreService[]> {
      const { data, error } = await supabase
        .from('service_store')
        .select('*')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return decorate(data ?? [])
    },

    async publish(input: PublishServiceInput): Promise<{ id: string }> {
      const uid = await currentUserId()
      if (!uid) throw new Error('Not authenticated')

      // RLS enforces approved-provider + status 'pending'.
      const { data: svc, error } = await supabase
        .from('services')
        .insert({
          provider_id: uid,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          subcategory_id: input.subcategory_id,
          cover_image: input.cover_image,
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw error

      const tierRows = input.tiers.map((t, i) => ({
        service_id: svc.id,
        position: i + 1,
        name: t.name.trim(),
        price_myr: t.price_myr,
        description: t.description?.trim() || null,
        delivery_minutes: t.delivery_minutes,
      }))
      const { error: tErr } = await supabase.from('service_tiers').insert(tierRows)
      if (tErr) throw tErr
      return { id: svc.id }
    },

    async removeOwn(serviceId: string): Promise<void> {
      const { error } = await supabase.from('services').delete().eq('id', serviceId)
      if (error) throw error
    },

    async myServices(): Promise<MyService[]> {
      const uid = await currentUserId()
      if (!uid) return []
      const { data, error } = await supabase
        .from('services')
        .select('id, title, status, reject_reason, order_count, created_at')
        .eq('provider_id', uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = data ?? []
      const tiers = await fetchTiers(rows.map((r: any) => r.id))
      return rows.map((r: any) => ({ ...r, tiers: tiers.get(r.id) ?? [] })) as MyService[]
    },

    async pendingForAdmin(): Promise<PendingService[]> {
      const { data, error } = await supabase
        .from('services')
        .select('id, title, description, cover_image, created_at, provider_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (error) throw error
      const rows = data ?? []
      const [providers, tiers] = await Promise.all([
        fetchProviders(rows.map((r: any) => r.provider_id)),
        fetchTiers(rows.map((r: any) => r.id)),
      ])
      return rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        cover_image: r.cover_image ?? null,
        created_at: r.created_at,
        provider: providers.get(r.provider_id) ?? null,
        tiers: tiers.get(r.id) ?? [],
      }))
    },
  }
}
