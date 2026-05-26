import { useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Field } from '../../components/osint/Field'
import { getToken, osintApi, setSession } from '../../lib/osint'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function Login() {
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/osint'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (getToken()) return <Navigate to={from} replace />

  const errors = {
    email: !email.trim() ? 'Informe o e-mail.' : !EMAIL_RE.test(email.trim()) ? 'E-mail inválido.' : null,
    password: password.length < 1 ? 'Informe a senha.' : null,
  }
  const showError = (k: keyof typeof errors) => touched[k] && errors[k]

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (errors.email || errors.password) return
    setStatus('sending')
    setErrorMsg(null)
    try {
      const { token, user } = await osintApi.login(email.trim().toLowerCase(), password)
      setSession(token, user)
      nav(from, { replace: true })
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'erro desconhecido'
      setErrorMsg(msg === 'invalid_credentials' ? 'Credenciais inválidas.' : msg)
    }
  }

  return (
    <section className="ivy-scanlines min-h-dvh" style={{ color: 'var(--color-ivy-bone)' }}>
      <div className="ivy-page py-[clamp(80px,12vw,160px)] grid grid-cols-12 gap-x-6 gap-y-12 items-center">
        <header className="col-span-12 md:col-span-6">
          <div className="ivy-bar-blood">
            <p className="ivy-meta" style={{ color: 'var(--color-ivy-tan)' }}>
              Acesso restrito · Analistas
            </p>
            <h1 className="ivy-display mt-4" style={{
              fontSize: 'clamp(40px,6.5vw,80px)',
              color: 'var(--color-ivy-bone)',
              lineHeight: 0.98,
            }}>
              Investigação
              <br />
              <span style={{ color: 'var(--color-ivy-tan)' }}>patrimonial.</span>
            </h1>
          </div>
          <p className="mt-8 max-w-[48ch]" style={{ color: 'var(--color-ivy-bone-soft)', fontSize: 'clamp(14px,1vw,16px)', lineHeight: 1.65 }}>
            Plataforma interna de cruzamento OSINT. Acesso permitido apenas a operadores autorizados.
            Atividades de consulta são registradas para auditoria.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          noValidate
          className="col-span-12 md:col-span-6 md:pl-10 md:border-l md:border-[color:var(--color-ivy-tan)]/40"
        >
          <div className="grid grid-cols-12 gap-x-6 gap-y-6">
            <Field
              dark
              name="email"
              type="email"
              label="E-mail"
              colSpan={12}
              required
              value={email}
              onChange={setEmail}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              error={showError('email') ? errors.email : null}
              autoComplete="email"
              maxLength={120}
              inputMode="email"
              placeholder="analista@ivy.com"
            />
            <Field
              dark
              name="password"
              type="password"
              label="Senha"
              colSpan={12}
              required
              value={password}
              onChange={setPassword}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              error={showError('password') ? errors.password : null}
              autoComplete="current-password"
              maxLength={200}
            />
          </div>

          <div className="mt-8 flex items-center gap-6">
            <button
              type="submit"
              disabled={status === 'sending'}
              className="ivy-meta disabled:opacity-60"
              style={{
                background: 'var(--color-ivy-olive)',
                color: 'var(--color-ivy-bone)',
                padding: '16px 28px',
                letterSpacing: '0.3em',
                fontSize: 12,
                border: 0,
              }}
            >
              {status === 'sending' ? 'Validando...' : 'Entrar'}
            </button>
          </div>

          {status === 'error' && errorMsg && (
            <p
              role="alert"
              className="mt-5 ivy-meta"
              style={{ color: 'var(--color-ivy-blood)' }}
            >
              {errorMsg}
            </p>
          )}
        </form>
      </div>
    </section>
  )
}
