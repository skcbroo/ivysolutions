import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/osint/Button'
import { ConfirmInline } from '../../components/osint/ConfirmInline'
import { OsintLayout } from '../../components/osint/Layout'
import { Field } from '../../components/osint/Field'
import { type AdminUser, type OsintRole, isAbortError, osintApi, getUser } from '../../lib/osint'

export function AdminUsuarios() {
  const me = getUser()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [tempPwd, setTempPwd] = useState<{ email: string; password: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await osintApi.listUsers()
      setUsers(list)
      setError(null)
    } catch (err) {
      if (isAbortError(err)) return
      setError(err instanceof Error ? err.message : 'erro')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OsintLayout
      protocol="Protocolo · Administração"
      title="Usuários da plataforma"
      subtitle="Crie, edite, redefina senha e ative/desative analistas. Apenas administradores enxergam essa página."
      rightSlot={
        <Button size="md" onClick={() => setCreating(true)}>
          + Novo usuário
        </Button>
      }
    >
      <div className="ivy-page pb-[clamp(64px,8vw,120px)]">
        <hr className="ivy-rule-olive mb-10" />

        {tempPwd && (
          <DefaultPasswordCard
            email={tempPwd.email}
            password={tempPwd.password}
            onDismiss={() => setTempPwd(null)}
          />
        )}

        {creating && (
          <CreateUserForm
            onCreated={(u, defaultPassword) => {
              setTempPwd({ email: u.email, password: defaultPassword })
              setCreating(false)
              void load()
            }}
            onCancel={() => setCreating(false)}
          />
        )}

        {error && (
          <div role="alert" className="mb-8 p-5" style={{ border: '1px solid var(--color-ivy-blood)' }}>
            <p className="ivy-meta" style={{ color: 'var(--color-ivy-blood)' }}>
              Falha: {error}
            </p>
          </div>
        )}

        {!users && !error && <UsersSkeleton />}

        {users && users.length > 0 && (
          <ul className="flex flex-col" style={{ borderTop: '1px solid var(--color-ivy-tan)' }}>
            {users.map((u) => (
              <UserRow key={u.id} u={u} isSelf={me?.id === u.id} onChanged={load} onPasswordReset={setTempPwd} />
            ))}
          </ul>
        )}
      </div>
    </OsintLayout>
  )
}

/* ───────────────────────────── Default password card ────────────────────── */

function DefaultPasswordCard({
  email,
  password,
  onDismiss,
}: {
  email: string
  password: string
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-8 p-6"
      style={{ border: '2px solid var(--color-ivy-olive)', background: 'var(--color-ivy-paper-soft)' }}
    >
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-olive)' }}>
        Senha padrão atribuída
      </p>
      <p className="mt-2" style={{ color: 'var(--color-ivy-near)', fontSize: 'clamp(14px,1vw,16px)' }}>
        Repasse ao usuário <strong>{email}</strong>. Ele será obrigado a trocar no primeiro acesso.
      </p>
      <p
        className="mt-4"
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 'clamp(24px,2.6vw,32px)',
          color: 'var(--color-ivy-olive)',
          letterSpacing: '0.08em',
          fontWeight: 600,
          userSelect: 'all',
        }}
      >
        {password}
      </p>
      <div className="mt-5 flex gap-4">
        <Button size="sm" onClick={() => navigator.clipboard.writeText(password)}>
          Copiar
        </Button>
        <Button size="sm" variant="secondary" onClick={onDismiss}>
          Fechar
        </Button>
      </div>
    </div>
  )
}

/* ───────────────────────────── Create user form ─────────────────────────── */

function CreateUserForm({
  onCreated,
  onCancel,
}: {
  onCreated: (u: AdminUser, defaultPassword: string) => void
  onCancel: () => void
}) {
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [role, setRole] = useState<OsintRole>('analista')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const errors = {
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ? 'E-mail inválido.' : null,
    nome: nome.trim().length < 2 ? 'Nome muito curto.' : null,
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ email: true, nome: true })
    if (errors.email || errors.nome) return
    setStatus('sending')
    setErrMsg(null)
    try {
      const u = await osintApi.createUser(email.trim().toLowerCase(), nome.trim(), role)
      onCreated(u, u.default_password)
    } catch (err) {
      setStatus('error')
      const m = err instanceof Error ? err.message : 'erro'
      setErrMsg(m === 'email_already_registered' ? 'E-mail já cadastrado.' : m)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mb-10 p-6" style={{ border: '1px solid var(--color-ivy-tan)' }}>
      <p className="ivy-meta mb-4" style={{ color: 'var(--color-ivy-mid)' }}>
        Novo usuário
      </p>
      <div className="grid grid-cols-12 gap-x-6 gap-y-6">
        <Field
          name="nome"
          label="Nome completo"
          colSpan={6}
          required
          value={nome}
          onChange={setNome}
          onBlur={() => setTouched((t) => ({ ...t, nome: true }))}
          error={touched.nome ? errors.nome : null}
          maxLength={120}
        />
        <Field
          name="email"
          label="E-mail"
          type="email"
          colSpan={6}
          required
          value={email}
          onChange={setEmail}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={touched.email ? errors.email : null}
          autoComplete="off"
        />
        <RoleSelect id="create-role" value={role} onChange={setRole} colSpan="md:col-span-6" />
      </div>

      <p className="ivy-foot mt-4" style={{ color: 'var(--color-ivy-mid)' }}>
        Será criado com senha padrão. O usuário troca no primeiro acesso.
      </p>

      <div className="mt-6 flex items-center gap-4 flex-wrap">
        <Button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Criando...' : 'Criar usuário'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      {status === 'error' && errMsg && (
        <p role="alert" className="mt-4 ivy-meta" style={{ color: 'var(--color-ivy-blood)' }}>
          {errMsg}
        </p>
      )}
    </form>
  )
}

/* ───────────────────────────── User row ─────────────────────────────────── */

function UserRow({
  u,
  isSelf,
  onChanged,
  onPasswordReset,
}: {
  u: AdminUser
  isSelf: boolean
  onChanged: () => Promise<void>
  onPasswordReset: (info: { email: string; password: string }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [draft, setDraft] = useState({ email: u.email, nome: u.nome ?? '', role: u.role })

  async function save() {
    setBusy('save')
    setErr(null)
    try {
      const patch: Partial<{ email: string; nome: string; role: OsintRole }> = {}
      if (draft.email !== u.email) patch.email = draft.email.trim().toLowerCase()
      if (draft.nome !== (u.nome ?? '')) patch.nome = draft.nome.trim()
      if (draft.role !== u.role) patch.role = draft.role
      if (Object.keys(patch).length > 0) await osintApi.patchUser(u.id, patch)
      setEditing(false)
      await onChanged()
    } catch (e) {
      setErr(friendlyErr(e))
    } finally {
      setBusy(null)
    }
  }

  async function toggleActive() {
    setBusy('active')
    setErr(null)
    try {
      await osintApi.patchUser(u.id, { active: !u.active })
      await onChanged()
    } catch (e) {
      setErr(friendlyErr(e))
    } finally {
      setBusy(null)
    }
  }

  async function reset() {
    setBusy('reset')
    setErr(null)
    try {
      const r = await osintApi.resetUserPassword(u.id)
      onPasswordReset({ email: u.email, password: r.default_password })
      await onChanged()
    } catch (e) {
      setErr(friendlyErr(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <li
      className="py-5"
      style={{
        borderBottom: '1px solid var(--color-ivy-rule-subtle)',
        background: u.active ? 'transparent' : 'oklch(0.85 0.012 90 / 0.25)',
      }}
    >
      {!editing ? (
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3 flex-wrap">
              <p
                style={{
                  color: 'var(--color-ivy-near)',
                  fontWeight: 600,
                  fontSize: 'clamp(15px,1.1vw,17px)',
                  textDecoration: u.active ? 'none' : 'line-through',
                  textDecorationColor: 'var(--color-ivy-mid)',
                }}
              >
                {u.nome || u.email}
              </p>
              <span className="ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>
                {u.email}
              </span>
              <RoleBadge role={u.role} />
              {!u.active && <ChipBadge tone="blood">⊘ Inativo</ChipBadge>}
              {u.must_change_password && <ChipBadge tone="blood">Pendente troca de senha</ChipBadge>}
              {isSelf && (
                <span className="ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>(você)</span>
              )}
            </div>
            <p className="ivy-foot mt-1" style={{ color: 'var(--color-ivy-mid)' }}>
              Criado em {new Date(u.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>

          {/* Hierarquia: primary (Editar) | secondary (Reset) ‖ destrutivo (Desativar) */}
          <div className="flex items-center gap-3 flex-wrap" style={{ opacity: u.active ? 1 : 0.85 }}>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={reset}
              disabled={!u.active || busy === 'reset'}
            >
              {busy === 'reset' ? '...' : 'Resetar senha'}
            </Button>
            <span aria-hidden style={{ width: 1, height: 22, background: 'var(--color-ivy-rule-subtle)' }} />
            {isSelf ? (
              <span
                className="ivy-meta"
                style={{
                  color: 'var(--color-ivy-mid)',
                  padding: '8px 14px',
                  fontSize: 11,
                  letterSpacing: '0.25em',
                }}
              >
                Não disponível para você
              </span>
            ) : (
              <ConfirmInline
                label={u.active ? 'Desativar' : 'Reativar'}
                tone={u.active ? 'danger' : 'olive'}
                disabled={busy === 'active'}
                onConfirm={toggleActive}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-x-6 gap-y-4 items-end">
          <Field
            name={`nome-${u.id}`}
            label="Nome"
            colSpan={5}
            value={draft.nome}
            onChange={(v) => setDraft((d) => ({ ...d, nome: v }))}
            maxLength={120}
          />
          <Field
            name={`email-${u.id}`}
            label="E-mail"
            type="email"
            colSpan={4}
            value={draft.email}
            onChange={(v) => setDraft((d) => ({ ...d, email: v }))}
          />
          {!isSelf ? (
            <RoleSelect
              id={`role-${u.id}`}
              value={draft.role}
              onChange={(v) => setDraft((d) => ({ ...d, role: v }))}
              colSpan="col-span-12 md:col-span-3"
            />
          ) : (
            <div className="col-span-12 md:col-span-3">
              <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
                Função
              </p>
              <p className="ivy-foot mt-2" style={{ color: 'var(--color-ivy-mid)' }}>
                Sua função pode ser alterada por outro admin.
              </p>
            </div>
          )}
          <div className="col-span-12 flex items-center gap-4 flex-wrap">
            <Button type="button" onClick={save} disabled={busy === 'save'}>
              {busy === 'save' ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {err && (
        <p role="alert" className="mt-3 ivy-meta" style={{ color: 'var(--color-ivy-blood)' }}>
          {err}
        </p>
      )}
    </li>
  )
}

/* ───────────────────────────── Small bits ───────────────────────────────── */

function RoleBadge({ role }: { role: OsintRole }) {
  const admin = role === 'admin'
  return (
    <span
      className="ivy-foot"
      style={{
        color: admin ? 'var(--color-ivy-olive)' : 'var(--color-ivy-mid)',
        border: `1px solid ${admin ? 'var(--color-ivy-olive)' : 'var(--color-ivy-tan)'}`,
        padding: '2px 8px',
        letterSpacing: '0.25em',
        fontSize: 10,
      }}
    >
      {admin ? 'ADMIN' : 'ANALISTA'}
    </span>
  )
}

function ChipBadge({ children, tone }: { children: React.ReactNode; tone: 'blood' | 'olive' }) {
  const color = tone === 'blood' ? 'var(--color-ivy-blood)' : 'var(--color-ivy-olive)'
  return (
    <span
      className="ivy-foot"
      style={{
        color,
        background: tone === 'blood' ? 'oklch(0.36 0.135 28 / 0.1)' : 'transparent',
        padding: '2px 8px',
        letterSpacing: '0.2em',
        fontSize: 10,
        border: `1px solid ${color}`,
      }}
    >
      {children}
    </span>
  )
}

function RoleSelect({
  id,
  value,
  onChange,
  colSpan,
}: {
  id: string
  value: OsintRole
  onChange: (v: OsintRole) => void
  colSpan: string
}) {
  return (
    <div className={colSpan}>
      <label htmlFor={id} className="ivy-meta block mb-2" style={{ color: 'var(--color-ivy-mid)' }}>
        Função
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as OsintRole)}
        className="ivy-meta"
        style={{
          background: 'transparent',
          color: 'var(--color-ivy-near)',
          border: 0,
          borderBottom: '1px solid var(--color-ivy-border-input)',
          padding: '12px 0',
          minHeight: 44,
          fontSize: 16,
          fontFamily: 'var(--font-body)',
          textTransform: 'none',
          letterSpacing: 0,
          width: '100%',
        }}
      >
        <option value="analista">Analista</option>
        <option value="admin">Administrador</option>
      </select>
    </div>
  )
}

function UsersSkeleton() {
  return (
    <ul
      className="flex flex-col"
      style={{ borderTop: '1px solid var(--color-ivy-tan)' }}
      aria-busy="true"
      aria-live="polite"
    >
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="py-5"
          style={{ borderBottom: '1px solid var(--color-ivy-rule-subtle)' }}
        >
          <div className="flex items-center gap-4">
            <div style={{ width: 200, height: 18, background: 'var(--color-ivy-rule-subtle)' }} />
            <div style={{ width: 140, height: 12, background: 'var(--color-ivy-rule-subtle)', opacity: 0.6 }} />
            <div style={{ width: 70, height: 14, background: 'var(--color-ivy-rule-subtle)', opacity: 0.5 }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function friendlyErr(e: unknown): string {
  const m = e instanceof Error ? e.message : 'erro'
  if (m === 'last_admin_protected') return 'Não é possível remover o último administrador ativo.'
  if (m === 'cannot_deactivate_self') return 'Você não pode desativar seu próprio usuário.'
  if (m === 'cannot_demote_self') return 'Você não pode rebaixar seu próprio usuário.'
  if (m === 'email_already_registered') return 'E-mail já em uso.'
  return m
}
