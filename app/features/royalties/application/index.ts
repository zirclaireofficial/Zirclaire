// royalties/application — use-cases. Depends only on the RoyaltyRepository port.

import type { RoyaltyRepository, PublishInput, WorkType } from '../domain'
import { isPublishable } from '../domain'

export function createRoyaltyUseCases(repo: RoyaltyRepository) {
  return {
    browseStore: (type?: WorkType | null) => repo.browseStore({ type }),
    viewItem: (id: string) => repo.storeItem(id),
    itemsByCreator: (creatorId: string) => repo.itemsByCreator(creatorId),

    publish: (input: PublishInput) => {
      if (!isPublishable({ title: input.title, price: input.price_usd, hasProject: !!input.project_id })) {
        throw new Error('A completed project, a title and a price are all required.')
      }
      return repo.publish(input)
    },

    eligibleProjects: () => repo.eligibleProjects(),
    removeOwn: (itemId: string) => repo.removeOwn(itemId),
    myItems: () => repo.myItems(),
    myLibrary: () => repo.myLibrary(),
    pendingForAdmin: () => repo.pendingForAdmin(),
  }
}

export type RoyaltyUseCases = ReturnType<typeof createRoyaltyUseCases>
