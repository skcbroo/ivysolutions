import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export type JwtPayload = { userId: number; email: string; role: 'admin' | 'analista' }

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: config.JWT_TTL as jwt.SignOptions['expiresIn'],
  })
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] })
  if (typeof decoded === 'string') throw new Error('invalid token payload')
  const { userId, email, role } = decoded as jwt.JwtPayload & Partial<JwtPayload>
  if (typeof userId !== 'number' || typeof email !== 'string') {
    throw new Error('invalid token payload')
  }
  return { userId, email, role: role === 'admin' ? 'admin' : 'analista' }
}
