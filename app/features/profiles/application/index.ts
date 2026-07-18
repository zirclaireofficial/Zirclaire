// profiles/application — use-cases. Depends only on the ProfileRepository port.

import type { ProfileRepository } from '../domain'

export function createProfileUseCases(repo: ProfileRepository) {
  return {
    /** Open a member's public page from their handle, e.g. /u/MYRSP00007. */
    viewByHandle: (memberId: string) => repo.getByMemberId(memberId),

    /** The signed-in member's own public-facing card. */
    viewById: (id: string) => repo.getById(id),

    /** Admin directory — everyone on the platform and their role. */
    allMembers: () => repo.listAllMembers(),
  }
}

export type ProfileUseCases = ReturnType<typeof createProfileUseCases>
