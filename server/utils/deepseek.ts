// DeepSeek client (server only). OpenAI-compatible chat completions.
// The API key lives in runtimeConfig and never reaches the browser — every
// call is made from a /server route.

import type { H3Event } from 'h3'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export interface DeepSeekResult {
  content: string
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null
}

interface DeepSeekResponse {
  choices: { message: { content: string } }[]
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export async function deepseekChat(
  event: H3Event,
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; maxTokens?: number; json?: boolean },
): Promise<DeepSeekResult> {
  const key = useRuntimeConfig(event).deepseekApiKey as string
  if (!key) throw createError({ statusCode: 500, statusMessage: 'DeepSeek is not configured' })

  const body: Record<string, unknown> = {
    model: opts?.model ?? 'deepseek-v4-flash',
    messages,
    temperature: opts?.temperature ?? 0.5,
    max_tokens: opts?.maxTokens ?? 800,
    stream: false,
  }
  // JSON mode — the model returns a strict JSON object (the prompt must also
  // mention JSON, per DeepSeek's requirement).
  if (opts?.json) body.response_format = { type: 'json_object' }

  const res = await $fetch<DeepSeekResponse>('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body,
  })

  return {
    content: res.choices[0]?.message.content ?? '',
    usage: res.usage ?? null,
  }
}
