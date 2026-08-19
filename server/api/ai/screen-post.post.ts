// POST /api/ai/screen-post   { postId }   (the author, after publishing)
// The AI moderation sweeper. Reads a post's text and, if it clearly involves
// sexual content, drugs, illegal activity, or abuse/harassment, files a SYSTEM
// report for an admin to review. It never blocks, hides, or deletes anything —
// flagging only. Fail-open: any AI/parse error just does nothing.

import { serviceClient, requireUser } from '../../utils/auth'
import { deepseekChat } from '../../utils/deepseek'

const DAILY_CALL_CAP = 1000

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { postId } = await readBody(event)
  if (!postId) throw createError({ statusCode: 400, statusMessage: 'postId is required' })

  const db = serviceClient(event)

  const { data: post } = await db
    .from('posts')
    .select('id, author_id, body, status')
    .eq('id', postId)
    .maybeSingle()
  if (!post || post.status !== 'active') return { skipped: true }

  // Screen once per post — don't re-run or let it be abused to burn credit.
  const { count: already } = await db
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId)
    .eq('source', 'system')
  if ((already ?? 0) > 0) return { skipped: true }

  const text = (post.body ?? '').trim()
  if (!text) return { skipped: true } // nothing to read (image-only post)

  // Spend guard.
  const today = new Date().toISOString().slice(0, 10)
  const { data: usage } = await db.from('ai_usage').select('calls').eq('day', today).maybeSingle()
  if ((usage?.calls ?? 0) >= DAILY_CALL_CAP) return { skipped: true }
  await db.from('ai_usage').upsert({ day: today, calls: (usage?.calls ?? 0) + 1 }, { onConflict: 'day' })

  const system = `You are a content-moderation classifier for a professional services platform (Zirclaire). All work and payment is meant to stay on-platform, held in escrow, with the platform taking a commission. Decide whether a post violates policy.

Flag ONLY content that clearly involves any of:
- sexual content
- drugs
- illegal activity
- abuse or harassment
- off-platform: soliciting to take the work or PAYMENT off the platform to avoid fees/escrow. Examples: "DM me and pay me directly", "I'll do it cheaper outside the platform", "contact me on WhatsApp and pay via my personal PayPal to skip the fees", sharing personal payment handles to transact off-site.

IMPORTANT for "off-platform": only flag a CLEAR attempt to move the transaction or payment off-platform. Normal professional behaviour is NOT a violation: showcasing work, sharing a portfolio/website link, inviting people to "message me to discuss", or linking social profiles are all fine unless they clearly propose paying/hiring OUTSIDE the platform to avoid fees.

Be conservative: if it's a normal professional post or you are unsure, do NOT flag it.

Respond as JSON: {"flag": boolean, "categories": string[], "reason": string}.
- flag: true only for a clear violation.
- categories: which of [sexual, drugs, illegal, abuse, off-platform] apply.
- reason: one short sentence.`

  let parsed: { flag?: boolean; categories?: string[]; reason?: string } = {}
  try {
    const res = await deepseekChat(
      event,
      [
        { role: 'system', content: system },
        { role: 'user', content: `Post:\n${text}` },
      ],
      { json: true, maxTokens: 200, temperature: 0 },
    )
    parsed = JSON.parse(res.content)
  } catch {
    return { skipped: true } // fail-open: never block on an AI error
  }

  if (!parsed.flag) return { flagged: false }

  const cats = (parsed.categories ?? []).join(', ')
  await db.from('reports').insert({
    target_type: 'post',
    post_id: postId,
    reporter_id: null,
    source: 'system',
    reason: `AI flag${cats ? ` (${cats})` : ''}: ${parsed.reason ?? 'possible policy violation'}`,
  })
  return { flagged: true }
})
