// social/application — use-cases. Orchestrates work through the domain port.
// Knows nothing about Supabase; it depends only on SocialRepository.

import type { SocialRepository, CreatePostInput } from '../domain'
import { isPostPublishable, isCommentPublishable, MAX_POST_MEDIA } from '../domain'

export function createSocialUseCases(repo: SocialRepository) {
  return {
    /** One page of the public feed, newest first. */
    browseFeed: (before?: string | null) => repo.listFeed({ before }),

    /** A member's own posts and comments — used by profile pages. */
    postsBy: (authorId: string) => repo.listPostsByAuthor(authorId),
    repliesBy: (authorId: string) => repo.listCommentsByAuthor(authorId),

    /** Publish a post. Domain rules are checked before we hit the network. */
    publishPost: (input: CreatePostInput) => {
      if (!isPostPublishable(input.body, input.media.length)) {
        throw new Error('Write something or add an image before posting.')
      }
      if (input.media.length > MAX_POST_MEDIA) {
        throw new Error(`A post can have at most ${MAX_POST_MEDIA} images.`)
      }
      return repo.createPost(input)
    },

    removeOwnPost: (postId: string) => repo.deletePost(postId),

    comments: (postId: string) => repo.listComments(postId),

    postComment: (postId: string, body: string) => {
      if (!isCommentPublishable(body)) throw new Error('Write something first.')
      return repo.addComment(postId, body)
    },

    removeOwnComment: (commentId: string) => repo.deleteComment(commentId),

    /** Flip favorite state. The caller passes the state it currently shows. */
    toggleFavorite: (postId: string, currentlyFavorited: boolean) =>
      currentlyFavorited ? repo.unfavorite(postId) : repo.favorite(postId),

    sharePost: (postId: string) => repo.logShare(postId),

    reportPost: (postId: string, reason: string) => repo.reportPost(postId, reason),
    reportComment: (commentId: string, reason: string) => repo.reportComment(commentId, reason),

    /** Admin: the open moderation queue. */
    openReports: () => repo.listOpenReports(),
  }
}

export type SocialUseCases = ReturnType<typeof createSocialUseCases>
