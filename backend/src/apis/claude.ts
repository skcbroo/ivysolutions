import { httpJson } from './http.js'
import { config } from '../config.js'

/**
 * Cliente Anthropic Messages. Suporta prompt caching: blocks com
 * `cache_control: { type: 'ephemeral' }` reduzem custo em 90% (input cached).
 *
 * Doc: https://docs.anthropic.com/en/api/messages
 */

const BASE = 'https://api.anthropic.com/v1/messages'

export type ClaudeTextBlock = {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}

export type ClaudeContentBlock = ClaudeTextBlock

export type ClaudeMessage = {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

export type ClaudeRequest = {
  model: string
  max_tokens: number
  system?: string | ClaudeContentBlock[]
  messages: ClaudeMessage[]
  temperature?: number
}

export type ClaudeUsage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export type ClaudeResponse = {
  id: string
  model: string
  role: 'assistant'
  content: ClaudeTextBlock[]
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | string
  usage: ClaudeUsage
}

export class ClaudeError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

export async function callClaude(input: ClaudeRequest): Promise<ClaudeResponse> {
  if (!config.ANTHROPIC_API_KEY) {
    throw new ClaudeError(0, null, 'ANTHROPIC_API_KEY ausente — Block 3 não pode rodar')
  }
  const { status, data, text } = await httpJson<ClaudeResponse | { error?: { message?: string; type?: string } }>(
    BASE,
    {
      method: 'POST',
      headers: {
        'x-api-key': config.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
      retries: 3,
      retryDelayMs: 2_000,
      timeoutMs: 60_000,
    },
  )
  if (status !== 200 || !data || 'error' in data) {
    const msg = data && 'error' in data ? data.error?.message ?? text : `HTTP ${status}`
    throw new ClaudeError(status, data, msg ?? 'falha Claude')
  }
  return data as ClaudeResponse
}

export function extractText(res: ClaudeResponse): string {
  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}
