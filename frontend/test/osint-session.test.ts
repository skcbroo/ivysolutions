import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession, getToken, getUser, setSession, isAbortError } from '../src/lib/osint'

describe('osint session storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('inicia vazio', () => {
    expect(getToken()).toBeNull()
    expect(getUser()).toBeNull()
  })

  it('setSession persiste e recupera token + user', () => {
    setSession('jwt-tok', { id: 1, email: 'a@b.com' })
    expect(getToken()).toBe('jwt-tok')
    expect(getUser()).toEqual({ id: 1, email: 'a@b.com' })
  })

  it('clearSession remove tudo', () => {
    setSession('t', { id: 1, email: 'x@y.com' })
    clearSession()
    expect(getToken()).toBeNull()
    expect(getUser()).toBeNull()
  })

  it('getUser tolera JSON corrompido', () => {
    localStorage.setItem('ivy_osint_user', 'not-json{')
    expect(getUser()).toBeNull()
  })
})

describe('isAbortError', () => {
  it('reconhece AbortError', () => {
    const err = new DOMException('aborted', 'AbortError')
    expect(isAbortError(err)).toBe(true)
  })
  it('não confunde com outros DOMException', () => {
    expect(isAbortError(new DOMException('x', 'SyntaxError'))).toBe(false)
  })
  it('false para errors comuns', () => {
    expect(isAbortError(new Error('boom'))).toBe(false)
    expect(isAbortError(null)).toBe(false)
  })
})
