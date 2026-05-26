import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, type Dispatcher } from 'undici'
import { httpJson, httpText } from '../src/apis/http.js'

const HOST = 'https://retry-test.example.com'

let agent: MockAgent
let prev: Dispatcher

beforeAll(() => { prev = getGlobalDispatcher() })
afterAll(() => setGlobalDispatcher(prev))
beforeEach(() => {
  agent = new MockAgent()
  agent.disableNetConnect()
  setGlobalDispatcher(agent)
})
afterEach(async () => { await agent.close() })

describe('httpJson retry/backoff', () => {
  it('429 → 429 → 200: retorna o sucesso e contabiliza 3 chamadas', async () => {
    let calls = 0
    agent.get(HOST).intercept({ path: '/x', method: 'GET' }).reply(() => {
      calls++
      if (calls < 3) return { statusCode: 429, data: 'rate limited' }
      return { statusCode: 200, data: JSON.stringify({ ok: true }) }
    }).times(3)

    const t0 = Date.now()
    const { status, data } = await httpJson<{ ok: boolean }>(`${HOST}/x`, {
      retries: 3,
      retryDelayMs: 100, // teste mais rápido
    })
    const elapsed = Date.now() - t0

    expect(status).toBe(200)
    expect(data).toEqual({ ok: true })
    expect(calls).toBe(3)
    // backoff aplicou pelo menos a primeira tentativa (≥2s para 429)
    expect(elapsed).toBeGreaterThanOrEqual(2_000)
  })

  it('500 → 500 → 500 (esgota retries): retorna último status sem throw', async () => {
    let calls = 0
    agent.get(HOST).intercept({ path: '/y', method: 'GET' }).reply(() => {
      calls++
      return { statusCode: 500, data: 'oops' }
    }).times(3)

    const { status } = await httpJson(`${HOST}/y`, { retries: 2, retryDelayMs: 50 })
    expect(status).toBe(500)
    expect(calls).toBe(3) // tentativa inicial + 2 retries
  })

  it('4xx (não-429) não dispara retry — retorna direto', async () => {
    let calls = 0
    agent.get(HOST).intercept({ path: '/z', method: 'GET' }).reply(() => {
      calls++
      return { statusCode: 404, data: 'not found' }
    })

    const { status } = await httpJson(`${HOST}/z`, { retries: 3, retryDelayMs: 50 })
    expect(status).toBe(404)
    expect(calls).toBe(1)
  })

  it('JSON inválido vira data=null sem throw', async () => {
    agent.get(HOST).intercept({ path: '/garbled', method: 'GET' }).reply(200, '<<not json>>')

    const { status, data, text } = await httpJson(`${HOST}/garbled`)
    expect(status).toBe(200)
    expect(data).toBeNull()
    expect(text).toBe('<<not json>>')
  })
})

describe('httpText retry/backoff', () => {
  it('5xx retry para httpText também', async () => {
    let calls = 0
    agent.get(HOST).intercept({ path: '/html', method: 'GET' }).reply(() => {
      calls++
      if (calls < 2) return { statusCode: 502, data: '' }
      return { statusCode: 200, data: '<html>ok</html>' }
    }).times(2)

    const { status, text } = await httpText(`${HOST}/html`, { retries: 2, retryDelayMs: 50 })
    expect(status).toBe(200)
    expect(text).toBe('<html>ok</html>')
    expect(calls).toBe(2)
  })
})
