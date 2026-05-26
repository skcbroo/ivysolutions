import { describe, expect, it } from 'vitest'
import { signToken, verifyToken } from '../src/auth/jwt.js'
import { hashPassword, verifyPassword } from '../src/auth/hash.js'

describe('JWT signing', () => {
  it('sign+verify roundtrip preserva payload', () => {
    const t = signToken({ userId: 42, email: 'a@b.com' })
    expect(t.split('.').length).toBe(3)
    const p = verifyToken(t)
    expect(p.userId).toBe(42)
    expect(p.email).toBe('a@b.com')
  })
  it('verify rejeita token alterado', () => {
    const t = signToken({ userId: 1, email: 'x@y.com' })
    const tampered = t.slice(0, -2) + 'aa'
    expect(() => verifyToken(tampered)).toThrow()
  })
  it('verify rejeita string lixo', () => {
    expect(() => verifyToken('lorem.ipsum.dolor')).toThrow()
  })
})

describe('bcrypt hash/verify', () => {
  it('hash não é igual à senha', async () => {
    const h = await hashPassword('s3nh@123')
    expect(h).not.toBe('s3nh@123')
    expect(h.startsWith('$2')).toBe(true)
  })
  it('verifyPassword true para senha correta', async () => {
    const h = await hashPassword('s3nh@123')
    expect(await verifyPassword('s3nh@123', h)).toBe(true)
  })
  it('verifyPassword false para senha errada', async () => {
    const h = await hashPassword('s3nh@123')
    expect(await verifyPassword('outra', h)).toBe(false)
  })
})
