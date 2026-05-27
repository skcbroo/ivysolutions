import bcrypt from 'bcryptjs'

const COST = 10

/**
 * Senha padrão atribuída quando admin cria um usuário ou faz reset.
 * O usuário é obrigado a trocar no primeiro login (must_change_password=true).
 */
export const DEFAULT_PASSWORD = 'ivy@2026'

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST)
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash)
