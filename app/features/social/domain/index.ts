// social/domain — pure types, rules, and ports for the community feed.
// NO imports of Nuxt, Supabase, Cloudinary, or any other layer.

import type { Post, Comment, PostStatus, ReportStatus } from '~/shared/types/database'

export type { Post, Comment, PostStatus, ReportStatus }

// --- Business rules --------------------------------------------------------

/** A post may carry at most three images/videos (also enforced by a DB check). */
export const MAX_POST_MEDIA = 3

/** A post must say something: text, media, or both. */
export function isPostPublishable(body: string, mediaCount: number): boolean {
  return body.trim().length > 0 || mediaCount > 0
}

/** A comment must have a body — comment media is not part of v1. */
export function isCommentPublishable(body: string): boolean {
  return body.trim().length > 0
}

/**
 * Who may delete what. Authors delete their own content; admins remove
 * anything, but through the server (a different lever), never from here.
 */
export function canDeletePost(post: { author_id: string }, userId: string | null): boolean {
  return !!userId && post.author_id === userId
}

export function canDeleteComment(comment: { author_id: string }, userId: string | null): boolean {
  return !!userId && comment.author_id === userId
}

/** Only approved service providers may author posts. */
export function canCreatePost(role: string | null, kycStatus: string | null): boolean {
  return role === 'service_provider' && kycStatus === 'approved'
}

/** Any approved member — requester or provider — may comment and report. */
export function canInteract(role: string | null, kycStatus: string | null): boolean {
  return (role === 'service_provider' || role === 'service_requester') && kycStatus === 'approved'
}

// --- Read models -----------------------------------------------------------
// The feed needs the author's public byline alongside each post. Profiles are
// locked down, so this comes from the `public_profiles` view (safe columns,
// approved members only) and is stitched on in infrastructure.

export interface PostAuthor {
  id: string
  member_id: string | null
  full_name: string | null
  role: string | null
  profile_picture: string | null
}

export interface PostMediaItem {
  id: string
  media_url: string
  media_type: string | null
  position: number
}

export interface FeedPost extends Post {
  author: PostAuthor | null
  media: PostMediaItem[]
  /** Whether the *current* caller has favorited it. False for anonymous. */
  favorited: boolean
}

export interface FeedComment extends Comment {
  author: PostAuthor | null
}

export type ReportTarget = 'post' | 'comment'

export interface PendingReport {
  id: string
  target_type: ReportTarget
  post_id: string | null
  comment_id: string | null
  reason: string | null
  status: ReportStatus
  created_at: string
  reporter: PostAuthor | null
  /** The reported content, so an admin can judge without hunting for it. */
  post: (Post & { author: PostAuthor | null }) | null
  comment: FeedComment | null
}

// --- Port: what infrastructure must provide --------------------------------

export interface FeedPage {
  posts: FeedPost[]
  /** Pass back as `before` to fetch the next page. Null when exhausted. */
  nextCursor: string | null
}

export interface CreatePostInput {
  body: string
  media: { media_url: string; media_type?: string | null }[]
}

export interface SocialRepository {
  listFeed(opts: { before?: string | null; limit?: number }): Promise<FeedPage>
  createPost(input: CreatePostInput): Promise<Post>
  deletePost(postId: string): Promise<void>

  listComments(postId: string): Promise<FeedComment[]>
  addComment(postId: string, body: string): Promise<Comment>
  deleteComment(commentId: string): Promise<void>

  favorite(postId: string): Promise<void>
  unfavorite(postId: string): Promise<void>
  logShare(postId: string): Promise<void>

  reportPost(postId: string, reason: string): Promise<void>
  reportComment(commentId: string, reason: string): Promise<void>

  /** Admin: open reports with their target content attached. */
  listOpenReports(): Promise<PendingReport[]>
}
