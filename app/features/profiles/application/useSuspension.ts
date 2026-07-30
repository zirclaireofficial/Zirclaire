// profiles/application — suspension (and the safe reversals that ride the
// same staff routes). All privileged, so they go through the server with the
// service_role key. Admins may suspend members; masters may also suspend admins
// — the server enforces the reach.

import { authedFetch } from '~/shared/lib/authedFetch'

export function useSuspension() {
  function suspend(userId: string, reason: string) {
    return authedFetch('/api/moderation/suspend', { method: 'POST', body: { userId, reason } })
  }
  function unsuspend(userId: string) {
    return authedFetch('/api/moderation/unsuspend', { method: 'POST', body: { userId } })
  }
  return { suspend, unsuspend }
}
