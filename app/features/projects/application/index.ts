// projects/application — use-cases. Orchestrates work through the domain port.
// Knows nothing about Supabase; it only depends on the ProjectRepository interface.

import type { ProjectRepository } from '../domain'

export function createProjectUseCases(repo: ProjectRepository) {
  return {
    /** Browse the live project feed (Service Providers). */
    browseFeed: () => repo.listLiveFeed(),

    /** View a single project's details. */
    viewProject: (id: string) => repo.getById(id),

    /** Projects owned by / involving the current user. */
    myProjects: () => repo.listMine(),

    /** Same, but with each project's payment claims so funding state is known. */
    myProjectsWithPayments: () => repo.listMineWithPayments(),

    /** Everyone who applied to one of my projects (requester view). */
    applicantsFor: (projectId: string) => repo.listApplicants(projectId),

    /** Apply to a live project (Service Providers). */
    apply: (projectId: string, coverNote?: string) =>
      repo.applyToProject(projectId, coverNote),
  }
}

export type ProjectUseCases = ReturnType<typeof createProjectUseCases>
