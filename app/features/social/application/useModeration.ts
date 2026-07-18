// social/application — privileged moderation actions. Removing content is an
// admin power, so it goes through the server (Bearer-authed) with the
// service_role key. Reading the queue is a plain RLS-gated read.

import { authedFetch } from '~/shared/lib/authedFetch'

export type ResolveStatus = 'reviewed' | 'actioned' | 'dismissed'

export function useModeration() {
  /** Take a post down — flips status to 'removed', dropping it from the feed. */
  function removePost(postId: string) {
    return authedFetch('/api/moderation/remove-post', { method: 'POST', body: { postId } })
  }

  /** Delete a comment outright (comments have no removed state). */
  function removeComment(commentId: string) {
    return authedFetch('/api/moderation/remove-comment', { method: 'POST', body: { commentId } })
  }

  /** Close a report: actioned (content removed), dismissed, or just reviewed. */
  function resolveReport(reportId: string, status: ResolveStatus) {
    return authedFetch('/api/moderation/resolve-report', {
      method: 'POST',
      body: { reportId, status },
    })
  }

  return { removePost, removeComment, resolveReport }
}
