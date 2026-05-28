import { request as undiciRequest } from 'undici'

export const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export type FetchOptions = {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * GET/POST com retry/backoff exponencial em 5xx/timeout.
 * Status 4xx é retornado direto (não retry).
 */
export async function httpJson<T = unknown>(
  url: string,
  opts: FetchOptions = {},
): Promise<{ status: number; data: T | null; text: string }> {
  const { method = 'GET', headers = {}, body, timeoutMs = 30_000, retries = 3, retryDelayMs = 1_000 } = opts
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await undiciRequest(url, {
        method,
        headers: { 'user-agent': DEFAULT_UA, accept: 'application/json', ...headers },
        body,
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
      })
      const text = await res.body.text()
      if ((res.statusCode >= 500 || res.statusCode === 429) && attempt < retries) {
        // Backoff exponencial com floor maior para 429
        const base = res.statusCode === 429 ? Math.max(retryDelayMs, 2_000) : retryDelayMs
        await sleep(base * Math.pow(2, attempt))
        continue
      }
      let data: T | null = null
      try {
        data = text ? (JSON.parse(text) as T) : null
      } catch {
        data = null
      }
      return { status: res.statusCode, data, text }
    } catch (err) {
      lastErr = err
      if (attempt < retries) {
        await sleep(retryDelayMs * Math.pow(2, attempt))
        continue
      }
    }
  }
  throw lastErr ?? new Error('http request failed')
}

export async function httpText(
  url: string,
  opts: FetchOptions = {},
): Promise<{ status: number; text: string }> {
  const { method = 'GET', headers = {}, body, timeoutMs = 30_000, retries = 2, retryDelayMs = 1_500 } = opts
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await undiciRequest(url, {
        method,
        headers: { 'user-agent': DEFAULT_UA, accept: 'text/html,application/xhtml+xml', ...headers },
        body,
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
      })
      const text = await res.body.text()
      if (res.statusCode >= 500 && attempt < retries) {
        await sleep(retryDelayMs * Math.pow(2, attempt))
        continue
      }
      return { status: res.statusCode, text }
    } catch (err) {
      lastErr = err
      if (attempt < retries) {
        await sleep(retryDelayMs * Math.pow(2, attempt))
        continue
      }
    }
  }
  throw lastErr ?? new Error('http request failed')
}
