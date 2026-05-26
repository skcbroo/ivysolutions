import { pool } from '../db.js'

export type UserRow = {
  id: number
  email: string
  nome: string | null
  role: 'admin' | 'analista'
  active: boolean
  must_change_password: boolean
  created_at: Date
}

export type UserRowWithHash = UserRow & { password_hash: string }

const PUBLIC_COLS = 'id, email, nome, role, active, must_change_password, created_at'

function normalize<T extends { id: unknown }>(row: T): T {
  return { ...row, id: Number(row.id) }
}

export async function findByEmail(email: string): Promise<UserRowWithHash | null> {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, nome, role, active, must_change_password, created_at
       FROM users WHERE email = $1`,
    [email],
  )
  return rows[0] ? normalize(rows[0] as UserRowWithHash) : null
}

export async function findById(id: number): Promise<UserRow | null> {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLS} FROM users WHERE id = $1`,
    [id],
  )
  return rows[0] ? normalize(rows[0] as UserRow) : null
}

export async function findPasswordHashById(id: number): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT password_hash FROM users WHERE id = $1`,
    [id],
  )
  return rows[0]?.password_hash ?? null
}

export async function listAll(): Promise<UserRow[]> {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLS} FROM users ORDER BY created_at ASC`,
  )
  return rows.map((r) => normalize(r as UserRow))
}

export type CreateUserInput = {
  email: string
  passwordHash: string
  nome: string | null
  role?: 'admin' | 'analista'
  mustChangePassword?: boolean
  active?: boolean
}

export async function create(input: CreateUserInput): Promise<UserRow> {
  const { email, passwordHash, nome, role, mustChangePassword, active } = input
  const cols: string[] = ['email', 'password_hash', 'nome']
  const vals: unknown[] = [email, passwordHash, nome]
  const placeholders: string[] = ['$1', '$2', '$3']
  let i = 4
  if (role !== undefined) {
    cols.push('role'); vals.push(role); placeholders.push(`$${i++}`)
  }
  if (active !== undefined) {
    cols.push('active'); vals.push(active); placeholders.push(`$${i++}`)
  }
  if (mustChangePassword !== undefined) {
    cols.push('must_change_password'); vals.push(mustChangePassword); placeholders.push(`$${i++}`)
  }
  const { rows } = await pool.query(
    `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders.join(', ')})
     RETURNING ${PUBLIC_COLS}`,
    vals,
  )
  return normalize(rows[0] as UserRow)
}

export type UpdatePartialInput = {
  email?: string
  nome?: string
  role?: 'admin' | 'analista'
  active?: boolean
}

/**
 * Atualiza somente os campos enviados (dynamic SET). Retorna null se id não existe.
 * Lança o erro original do pg quando há violação de unique (duplicate key).
 */
export async function updatePartial(
  id: number,
  patch: UpdatePartialInput,
): Promise<UserRow | null> {
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1
  if (patch.email !== undefined) { sets.push(`email = $${i++}`); params.push(patch.email) }
  if (patch.nome !== undefined) { sets.push(`nome = $${i++}`); params.push(patch.nome) }
  if (patch.role !== undefined) { sets.push(`role = $${i++}`); params.push(patch.role) }
  if (patch.active !== undefined) { sets.push(`active = $${i++}`); params.push(patch.active) }
  if (sets.length === 0) return null
  params.push(id)
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING ${PUBLIC_COLS}`,
    params,
  )
  return rows[0] ? normalize(rows[0] as UserRow) : null
}

export async function setPassword(
  id: number,
  passwordHash: string,
  mustChangePassword: boolean,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE users SET password_hash = $1, must_change_password = $2 WHERE id = $3`,
    [passwordHash, mustChangePassword, id],
  )
  return (rowCount ?? 0) > 0
}

/**
 * Quantidade de admins ativos no sistema. Se `excludeId` for passado, ignora
 * esse user — útil pra validar "haveria pelo menos 1 admin ATIVO se eu mudar X".
 */
export async function countActiveAdmins(excludeId?: number): Promise<number> {
  if (excludeId === undefined) {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND active = true`,
    )
    return rows[0].n
  }
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND active = true AND id <> $1`,
    [excludeId],
  )
  return rows[0].n
}

/** Pega só (role, active) — usado pelas checagens de last_admin_protected. */
export async function getRoleAndActive(
  id: number,
): Promise<{ role: 'admin' | 'analista'; active: boolean } | null> {
  const { rows } = await pool.query(
    `SELECT role, active FROM users WHERE id = $1`,
    [id],
  )
  return rows[0] ?? null
}

/** Promove user existente a admin ativo (bootstrap). */
export async function promoteAndActivate(id: number): Promise<void> {
  await pool.query(
    `UPDATE users SET role = 'admin', active = true WHERE id = $1`,
    [id],
  )
}
