import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/osint/Button'
import { Field } from '../../components/osint/Field'
import { OsintLayout } from '../../components/osint/Layout'
import { type AdminUser, isAbortError, osintApi, setSession, getUser, getToken } from '../../lib/osint'

export function Perfil() {
  const nav = useNavigate()
  const sessionUser = getUser()
  const [me, setMe] = useState<AdminUser | null>(null)
  const [load, setLoad] = useState<'loading' | 'ok' | 'error'>('loading')

  const [current, setCurrent] = useState('')
  const [novaA, setNovaA] = useState('')
  const [novaB, setNovaB] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const loadMe = useCallback(async () => {
    try {
      const u = await osintApi.me()
      setMe(u)
      setLoad('ok')
    } catch (err) {
      if (isAbortError(err)) return
      setLoad('error')
    }
  }, [])

  useEffect(() => {
    void loadMe()
  }, [loadMe])

  const errors = {
    current: current.length === 0 ? 'Informe a senha atual.' : null,
    novaA:
      novaA.length < 8
        ? 'A nova senha precisa ter ao menos 8 caracteres.'
        : novaA === current
        ? 'A nova senha precisa ser diferente da atual.'
        : null,
    novaB: novaB !== novaA ? 'As senhas não coincidem.' : null,
  }
  const showErr = (k: keyof typeof errors) => touched[k] && errors[k]

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ current: true, novaA: true, novaB: true })
    if (errors.current || errors.novaA || errors.novaB) return
    setStatus('sending')
    setErrMsg(null)
    try {
      await osintApi.changeMyPassword(current, novaA)
      setStatus('sent')
      setCurrent('')
      setNovaA('')
      setNovaB('')
      setTouched({})
      const token = getToken()
      if (sessionUser && token) setSession(token, { ...sessionUser, must_change_password: false })
      await loadMe()
    } catch (err) {
      setStatus('error')
      const m = err instanceof Error ? err.message : 'erro desconhecido'
      const friendly =
        m === 'wrong_current_password' ? 'Senha atual incorreta.'
        : m === 'same_password' ? 'A nova senha precisa ser diferente da atual.'
        : m === 'cannot_use_default_password' ? 'Não use a senha padrão. Escolha uma própria.'
        : m
      setErrMsg(friendly)
    }
  }

  return (
    <OsintLayout
      protocol="Protocolo · Perfil"
      title={me?.nome ?? sessionUser?.email ?? 'Perfil'}
      subtitle={
        <>
          {me?.email}
          {me?.role && (
            <>
              {' · '}
              <span style={{ color: me.role === 'admin' ? 'var(--color-ivy-olive)' : 'var(--color-ivy-mid)' }}>
                {me.role === 'admin' ? 'Administrador' : 'Analista'}
              </span>
            </>
          )}
        </>
      }
      aside={load === 'ok' ? <DadosDaConta me={me} /> : null}
    >
      {load === 'loading' && <PerfilSkeleton />}

      {load === 'error' && (
        <p role="alert" className="ivy-meta" style={{ color: 'var(--color-ivy-blood)' }}>
          Não foi possível carregar o perfil.
        </p>
      )}

      {load === 'ok' && me?.must_change_password && (
        <div
          role="status"
          aria-live="polite"
          className="mb-8 p-5"
          style={{
            border: '1px solid var(--color-ivy-olive)',
            background: 'var(--color-ivy-paper-soft)',
          }}
        >
          <p className="ivy-meta" style={{ color: 'var(--color-ivy-olive)' }}>
            Troca obrigatória de senha
          </p>
          <p className="mt-2" style={{ color: 'var(--color-ivy-near)', fontSize: 'clamp(14px,1vw,16px)' }}>
            Sua senha atual é a padrão da plataforma. Defina uma senha própria antes de continuar.
          </p>
        </div>
      )}

      {load === 'ok' && (
        <>
          <form onSubmit={onSubmit} noValidate>
            <p className="ivy-meta mb-4" style={{ color: 'var(--color-ivy-mid)' }}>
              Trocar senha
            </p>
            <div className="grid grid-cols-12 gap-x-6 gap-y-6">
                <Field
                  name="current"
                  type="password"
                  label="Senha atual"
                  colSpan={12}
                  required
                  value={current}
                  onChange={setCurrent}
                  onBlur={() => setTouched((t) => ({ ...t, current: true }))}
                  error={showErr('current') ? errors.current : null}
                  autoComplete="current-password"
                />
                <Field
                  name="novaA"
                  type="password"
                  label="Nova senha"
                  colSpan={12}
                  required
                  value={novaA}
                  onChange={setNovaA}
                  onBlur={() => setTouched((t) => ({ ...t, novaA: true }))}
                  error={showErr('novaA') ? errors.novaA : null}
                  autoComplete="new-password"
                />
                <Field
                  name="novaB"
                  type="password"
                  label="Confirmar nova senha"
                  colSpan={12}
                  required
                  value={novaB}
                  onChange={setNovaB}
                  onBlur={() => setTouched((t) => ({ ...t, novaB: true }))}
                  error={showErr('novaB') ? errors.novaB : null}
                  autoComplete="new-password"
                />
              </div>

              <div className="mt-8 flex items-center gap-6 flex-wrap">
                <Button type="submit" size="lg" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Aplicando...' : 'Atualizar senha'}
                </Button>
                {status === 'sent' && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-3"
                  >
                    <span className="ivy-meta" style={{ color: 'var(--color-ivy-olive)' }}>
                      Senha atualizada
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => nav('/osint')}>
                      Ir para investigações
                    </Button>
                  </div>
                )}
              </div>

          {status === 'error' && errMsg && (
            <p role="alert" className="mt-5 ivy-meta" style={{ color: 'var(--color-ivy-blood)' }}>
              {errMsg}
            </p>
          )}
        </form>
        </>
      )}
    </OsintLayout>
  )
}

function DadosDaConta({ me }: { me: AdminUser | null }) {
  if (!me) return null
  return (
    <div>
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        Dados da conta
      </p>
      <dl className="mt-5 flex flex-col gap-4">
        <Info label="E-mail" value={me.email} />
        <Info label="Nome" value={me.nome} />
        <Info label="Função" value={me.role === 'admin' ? 'Administrador' : 'Analista'} />
        <Info
          label="Conta criada"
          value={me.created_at ? new Date(me.created_at).toLocaleDateString('pt-BR') : null}
        />
      </dl>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  const shown = value && value.trim().length > 0 ? value : null
  return (
    <div>
      <dt className="ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>
        {label}
      </dt>
      <dd
        className="mt-1"
        style={{
          color: shown ? 'var(--color-ivy-near)' : 'var(--color-ivy-mid)',
          fontSize: 'clamp(14px,1vw,16px)',
          margin: 0,
        }}
      >
        {shown ?? <span style={{ fontStyle: 'italic', opacity: 0.7 }}>não informado</span>}
      </dd>
    </div>
  )
}

function PerfilSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-x-6 gap-y-10" aria-busy="true" aria-live="polite">
      <div className="col-span-12 md:col-span-7 flex flex-col gap-6">
        <SkeletonField />
        <SkeletonField />
        <SkeletonField />
        <div style={{ height: 48, width: 200, background: 'var(--color-ivy-rule-subtle)' }} />
      </div>
      <div className="col-span-12 md:col-span-5 md:pl-10 md:border-l md:border-[color:var(--color-ivy-tan)]/40 flex flex-col gap-5">
        <SkeletonLine width="40%" />
        <SkeletonLine width="80%" />
        <SkeletonLine width="60%" />
        <SkeletonLine width="50%" />
      </div>
    </div>
  )
}

function SkeletonField() {
  return (
    <div>
      <SkeletonLine width="30%" height={11} />
      <div className="mt-3" style={{ height: 1, background: 'var(--color-ivy-tan)', width: '100%' }} />
    </div>
  )
}

function SkeletonLine({ width = '100%', height = 14 }: { width?: string; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        background: 'var(--color-ivy-rule-subtle)',
        opacity: 0.7,
      }}
      aria-hidden
    />
  )
}
