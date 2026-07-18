// social/infrastructure — the ONLY place that talks to Supabase for the feed.
// Implements the domain's SocialRepository port.
//
// A note on the reads: posts are fetched from the `feed_posts` view, which is
// the single place that decides what is publicly visible (active posts only).
// Authors and media are then fetched by id and stitched on here, rather than
// using PostgREST embedding — embedding from a view to another view relies on
// inferred relationships, and this way visibility stays centralised in the
// view while the query shape stays obvious.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/shared/types/database'
import type {
  SocialRepository,
  FeedPage,
  FeedPost,
  FeedComment,
  PostAuthor,
  PostMediaItem,
  PendingReport,
  CreatePostInput,
  Post,
  Comment,
} from '../domain'

const PAGE_SIZE = 20

export function createSupabaseSocialRepository(
  supabase: SupabaseClient<Database>,
): SocialRepository {
  /** Current user id, or null when anonymous. Claims-based: the id is `sub`. */
  async function currentUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.id ?? null
  }

  async function fetchAuthors(ids: string[]): Promise<Map<string, PostAuthor>> {
    const unique = [...new Set(ids)].filter(Boolean)
    if (!unique.length) return new Map()
    const { data } = await supabase
      .from('public_profiles')
      .select('id, member_id, full_name, role, profile_picture')
      .in('id', unique)
    return new Map((data ?? []).map((a) => [a.id as string, a as PostAuthor]))
  }

  return {
    async listFeed({ before, limit = PAGE_SIZE }): Promise<FeedPage> {
      let q = supabase
        .from('feed_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (before) q = q.lt('created_at', before)

      const { data: rows, error } = await q
      if (error) throw error
      const posts = (rows ?? []) as Post[]
      if (!posts.length) return { posts: [], nextCursor: null }

      const ids = posts.map((p) => p.id)

      const [{ data: mediaRows }, authors, favorited] = await Promise.all([
        supabase
          .from('post_media')
          .select('id, post_id, media_url, media_type, position')
          .in('post_id', ids)
          .order('position'),
        fetchAuthors(posts.map((p) => p.author_id)),
        (async () => {
          // "Have I favorited this?" — RLS only returns the caller's own rows,
          // and nothing at all for anonymous visitors.
          const uid = await currentUserId()
          if (!uid) return new Set<string>()
          const { data } = await supabase
            .from('post_favorites')
            .select('post_id')
            .eq('user_id', uid)
            .in('post_id', ids)
          return new Set((data ?? []).map((f) => f.post_id as string))
        })(),
      ])

      const mediaByPost = new Map<string, PostMediaItem[]>()
      for (const m of mediaRows ?? []) {
        const list = mediaByPost.get(m.post_id as string) ?? []
        list.push(m as unknown as PostMediaItem)
        mediaByPost.set(m.post_id as string, list)
      }

      const feed: FeedPost[] = posts.map((p) => ({
        ...p,
        author: authors.get(p.author_id) ?? null,
        media: mediaByPost.get(p.id) ?? [],
        favorited: favorited.has(p.id),
      }))

      return {
        posts: feed,
        nextCursor: posts.length === limit ? posts[posts.length - 1]!.created_at : null,
      }
    },

    async listPostsByAuthor(authorId: string): Promise<FeedPost[]> {
      // feed_posts again, so profile pages honour the same visibility rule as
      // the feed — a removed post disappears from both without special-casing.
      const { data, error } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('author_id', authorId)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as Post[]
      if (!rows.length) return []

      const ids = rows.map((p) => p.id)
      const [{ data: mediaRows }, authors, favorited] = await Promise.all([
        supabase
          .from('post_media')
          .select('id, post_id, media_url, media_type, position')
          .in('post_id', ids)
          .order('position'),
        fetchAuthors([authorId]),
        (async () => {
          const uid = await currentUserId()
          if (!uid) return new Set<string>()
          const { data } = await supabase
            .from('post_favorites')
            .select('post_id')
            .eq('user_id', uid)
            .in('post_id', ids)
          return new Set((data ?? []).map((f) => f.post_id as string))
        })(),
      ])

      const mediaByPost = new Map<string, PostMediaItem[]>()
      for (const m of mediaRows ?? []) {
        const list = mediaByPost.get(m.post_id as string) ?? []
        list.push(m as unknown as PostMediaItem)
        mediaByPost.set(m.post_id as string, list)
      }

      return rows.map((p) => ({
        ...p,
        author: authors.get(authorId) ?? null,
        media: mediaByPost.get(p.id) ?? [],
        favorited: favorited.has(p.id),
      }))
    },

    async listCommentsByAuthor(authorId: string): Promise<FeedComment[]> {
      // RLS only returns comments on posts the caller may see, so a reply on a
      // removed post drops out on its own.
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('author_id', authorId)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as Comment[]
      if (!rows.length) return []
      const authors = await fetchAuthors([authorId])
      return rows.map((c) => ({ ...c, author: authors.get(authorId) ?? null }))
    },

    async createPost(input: CreatePostInput): Promise<Post> {
      const uid = await currentUserId()
      if (!uid) throw new Error('Not authenticated')

      // RLS enforces "approved service provider" on this insert.
      const { data: post, error } = await supabase
        .from('posts')
        .insert({ author_id: uid, body: input.body.trim() || null })
        .select()
        .single()
      if (error) throw error

      if (input.media.length) {
        const { error: mErr } = await supabase.from('post_media').insert(
          input.media.map((m, i) => ({
            post_id: post.id,
            media_url: m.media_url,
            media_type: m.media_type ?? 'image',
            position: i + 1,
          })),
        )
        // The post already exists; surface the media failure rather than
        // silently publishing a post with missing images.
        if (mErr) throw mErr
      }
      return post
    },

    async deletePost(postId: string): Promise<void> {
      const { error } = await supabase.from('posts').delete().eq('id', postId)
      if (error) throw error
    },

    async listComments(postId: string): Promise<FeedComment[]> {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as Comment[]
      const authors = await fetchAuthors(rows.map((c) => c.author_id))
      return rows.map((c) => ({ ...c, author: authors.get(c.author_id) ?? null }))
    },

    async addComment(postId: string, body: string): Promise<Comment> {
      const uid = await currentUserId()
      if (!uid) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: postId, author_id: uid, body: body.trim() })
        .select()
        .single()
      if (error) throw error
      return data
    },

    async deleteComment(commentId: string): Promise<void> {
      const { error } = await supabase.from('comments').delete().eq('id', commentId)
      if (error) throw error
    },

    async favorite(postId: string): Promise<void> {
      const uid = await currentUserId()
      if (!uid) throw new Error('Not authenticated')
      const { error } = await supabase.from('post_favorites').insert({ post_id: postId, user_id: uid })
      if (error) throw error
    },

    async unfavorite(postId: string): Promise<void> {
      const uid = await currentUserId()
      if (!uid) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('post_favorites')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', uid)
      if (error) throw error
    },

    async logShare(postId: string): Promise<void> {
      const uid = await currentUserId()
      if (!uid) return // anonymous shares aren't logged
      await supabase.from('post_shares').insert({ post_id: postId, user_id: uid })
    },

    async reportPost(postId: string, reason: string): Promise<void> {
      const uid = await currentUserId()
      if (!uid) throw new Error('Not authenticated')
      const { error } = await supabase.from('reports').insert({
        target_type: 'post',
        post_id: postId,
        reporter_id: uid,
        reason: reason.trim() || null,
      })
      if (error) throw error
    },

    async reportComment(commentId: string, reason: string): Promise<void> {
      const uid = await currentUserId()
      if (!uid) throw new Error('Not authenticated')
      const { error } = await supabase.from('reports').insert({
        target_type: 'comment',
        comment_id: commentId,
        reporter_id: uid,
        reason: reason.trim() || null,
      })
      if (error) throw error
    },

    async listOpenReports(): Promise<PendingReport[]> {
      // RLS restricts reports to the reporter and admins; in practice only an
      // admin ever calls this. Targets are fetched separately because a report
      // points at either a post or a comment, never both.
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: true })
      if (error) throw error
      const reports = data ?? []
      if (!reports.length) return []

      const postIds = reports.map((r) => r.post_id).filter(Boolean) as string[]
      const commentIds = reports.map((r) => r.comment_id).filter(Boolean) as string[]

      // Admins can read posts of any status, so a removed post still shows here.
      const [{ data: posts }, { data: comments }] = await Promise.all([
        postIds.length
          ? supabase.from('posts').select('*').in('id', postIds)
          : Promise.resolve({ data: [] as Post[] }),
        commentIds.length
          ? supabase.from('comments').select('*').in('id', commentIds)
          : Promise.resolve({ data: [] as Comment[] }),
      ])

      const authors = await fetchAuthors([
        ...reports.map((r) => r.reporter_id),
        ...(posts ?? []).map((p) => p.author_id),
        ...(comments ?? []).map((c) => c.author_id),
      ])

      const postById = new Map((posts ?? []).map((p) => [p.id, p as Post]))
      const commentById = new Map((comments ?? []).map((c) => [c.id, c as Comment]))

      return reports.map((r) => {
        const p = r.post_id ? postById.get(r.post_id) : undefined
        const c = r.comment_id ? commentById.get(r.comment_id) : undefined
        return {
          id: r.id,
          target_type: r.target_type as 'post' | 'comment',
          post_id: r.post_id,
          comment_id: r.comment_id,
          reason: r.reason,
          status: r.status,
          created_at: r.created_at,
          reporter: authors.get(r.reporter_id) ?? null,
          post: p ? { ...p, author: authors.get(p.author_id) ?? null } : null,
          comment: c ? { ...c, author: authors.get(c.author_id) ?? null } : null,
        }
      })
    },
  }
}
