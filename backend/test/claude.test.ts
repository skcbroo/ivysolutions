import { describe, expect, it } from 'vitest'
import { extractText, ClaudeError, type ClaudeResponse } from '../src/apis/claude.js'

function mkResponse(blocks: Array<{ type: 'text'; text: string }>): ClaudeResponse {
  return {
    id: 'msg_1',
    model: 'claude-haiku-4-5',
    role: 'assistant',
    content: blocks,
    stop_reason: 'end_turn',
    usage: { input_tokens: 50, output_tokens: 10 },
  }
}

describe('extractText', () => {
  it('concatena múltiplos blocks de texto com \\n', () => {
    const r = mkResponse([
      { type: 'text', text: 'linha 1' },
      { type: 'text', text: 'linha 2' },
    ])
    expect(extractText(r)).toBe('linha 1\nlinha 2')
  })

  it('faz trim de espaços/newlines nas pontas', () => {
    const r = mkResponse([{ type: 'text', text: '  \n análise patrimonial  \n  ' }])
    expect(extractText(r)).toBe('análise patrimonial')
  })

  it('retorna string vazia quando content é vazio', () => {
    const r = mkResponse([])
    expect(extractText(r)).toBe('')
  })

  it('retorna string vazia quando único block é só whitespace', () => {
    const r = mkResponse([{ type: 'text', text: '   \n  ' }])
    expect(extractText(r)).toBe('')
  })
})

describe('ClaudeError', () => {
  it('preserva status, body e message', () => {
    const err = new ClaudeError(429, { error: { type: 'rate_limit' } }, 'rate limit hit')
    expect(err.status).toBe(429)
    expect(err.message).toBe('rate limit hit')
    expect(err.body).toEqual({ error: { type: 'rate_limit' } })
    expect(err).toBeInstanceOf(Error)
  })

  it('é capturável com instanceof Error', () => {
    try {
      throw new ClaudeError(402, null, 'insufficient credit')
    } catch (e) {
      expect(e).toBeInstanceOf(ClaudeError)
      expect(e).toBeInstanceOf(Error)
      expect((e as ClaudeError).status).toBe(402)
    }
  })
})
