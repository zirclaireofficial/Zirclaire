// GET /api/ai/test   (Master)
// A one-off check that the DeepSeek key works. Master-gated so it can't be hit
// anonymously to burn credit. Returns the model's reply and the token usage.

import { requireMaster } from '../../utils/auth'
import { deepseekChat } from '../../utils/deepseek'

export default defineEventHandler(async (event) => {
  await requireMaster(event)
  const result = await deepseekChat(event, [
    { role: 'system', content: 'You are a terse assistant.' },
    { role: 'user', content: 'Reply with exactly: Zirclaire DeepSeek connection OK.' },
  ], { maxTokens: 40 })
  return { ok: true, reply: result.content, usage: result.usage }
})
