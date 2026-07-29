// services/application — use-cases. Depends only on the ServiceRepository port.

import type { ServiceRepository, PublishServiceInput } from '../domain'
import { isServicePublishable } from '../domain'

export function createServiceUseCases(repo: ServiceRepository) {
  return {
    browseStore: (subcategoryId?: number | null) => repo.browseStore({ subcategoryId }),
    viewService: (id: string) => repo.storeService(id),
    servicesByProvider: (providerId: string) => repo.servicesByProvider(providerId),

    publish: (input: PublishServiceInput) => {
      const tierDrafts = input.tiers.map((t) => ({
        name: t.name,
        price: t.price_usd,
        description: t.description ?? '',
        delivery_minutes: t.delivery_minutes,
      }))
      if (!isServicePublishable(input.title, tierDrafts)) {
        throw new Error('A title and at least one named, priced tier are required.')
      }
      return repo.publish(input)
    },

    removeOwn: (serviceId: string) => repo.removeOwn(serviceId),
    myServices: () => repo.myServices(),
    pendingForAdmin: () => repo.pendingForAdmin(),
  }
}

export type ServiceUseCases = ReturnType<typeof createServiceUseCases>
