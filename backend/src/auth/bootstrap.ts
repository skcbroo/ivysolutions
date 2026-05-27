import { config } from '../config.js'
import { hashPassword } from './hash.js'
import * as usersRepo from '../repos/users.js'

/**
 * Cria o primeiro admin do sistema usando ADMIN_EMAIL/ADMIN_PASSWORD do env,
 * APENAS se ainda não houver nenhum admin ativo. Idempotente: rodadas posteriores
 * são no-op.
 *
 * Tem duas situações:
 *  - DB vazio (primeiro deploy): cria o admin com role='admin', active=true
 *  - DB já tem o email mas como analista: promove a admin + reativa
 *  - DB já tem o admin: faz nada
 */
export async function bootstrapAdmin(): Promise<{ created: boolean; promoted: boolean; skipped: boolean }> {
  if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) {
    return { created: false, promoted: false, skipped: true }
  }

  const email = config.ADMIN_EMAIL.toLowerCase().trim()
  const nome = config.ADMIN_NOME?.trim() || 'Administrador'

  // Há admin ativo? Se sim, no-op.
  const activeAdmins = await usersRepo.countActiveAdmins()
  if (activeAdmins > 0) {
    return { created: false, promoted: false, skipped: true }
  }

  // Usuário com esse email já existe? Promove. Senão, cria.
  const existing = await usersRepo.findByEmail(email)
  if (existing) {
    await usersRepo.promoteAndActivate(existing.id)
    console.log(`[bootstrap] usuário ${email} promovido a admin`)
    return { created: false, promoted: true, skipped: false }
  }

  const hash = await hashPassword(config.ADMIN_PASSWORD)
  await usersRepo.create({
    email,
    passwordHash: hash,
    nome,
    role: 'admin',
    active: true,
    mustChangePassword: true,
  })
  console.log(`[bootstrap] admin inicial criado: ${email} (must_change_password=true)`)
  return { created: true, promoted: false, skipped: false }
}
