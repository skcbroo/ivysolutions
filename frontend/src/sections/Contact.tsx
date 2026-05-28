import { useState } from 'react'
import { apiUrl } from '../lib/api'
import { track } from '../lib/analytics'

type Status = 'idle' | 'sending' | 'sent' | 'error'

type FormState = {
  name: string
  email: string
  phone: string
}

type FormErrors = Partial<Record<keyof FormState | 'submit', string>>

/* ------------------ formatação e validação ------------------ */

/** Mantém apenas dígitos. */
const onlyDigits = (s: string) => s.replace(/\D/g, '')

/** Formata telefone BR enquanto o usuário digita.
 *  10 dígitos → (DD) XXXX-XXXX  ·  11 dígitos → (DD) XXXXX-XXXX */
function formatPhone(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Regex RFC-lite, suficiente em frontend; backend revalida. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate(state: FormState): FormErrors {
  const errs: FormErrors = {}
  const name = state.name.trim()
  if (name.length < 2) errs.name = 'Informe o nome completo.'
  else if (name.length > 80) errs.name = 'Nome muito longo.'
  else if (!/^[\p{L}\s'.-]+$/u.test(name))
    errs.name = 'Nome contém caracteres inválidos.'

  const email = state.email.trim()
  if (email.length === 0) errs.email = 'Informe um e-mail de contato.'
  else if (!EMAIL_RE.test(email)) errs.email = 'E-mail inválido.'
  else if (email.length > 120) errs.email = 'E-mail muito longo.'

  const phoneDigits = onlyDigits(state.phone)
  if (phoneDigits.length === 0) errs.phone = 'Informe um telefone.'
  else if (phoneDigits.length < 10 || phoneDigits.length > 11)
    errs.phone = 'Telefone deve ter 10 ou 11 dígitos.'
  else if (parseInt(phoneDigits.slice(0, 2), 10) < 11)
    errs.phone = 'DDD inválido.'

  return errs
}

/* ------------------ component ------------------ */

export function Contact() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [values, setValues] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
  })

  const errors = validate(values)
  const showError = (k: keyof FormState) => touched[k] && errors[k]

  function update(field: keyof FormState, raw: string) {
    const next = field === 'phone' ? formatPhone(raw) : raw
    setValues((v) => ({ ...v, [field]: next }))
  }

  function markTouched(field: keyof FormState) {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTouched({ name: true, email: true, phone: true })

    // honeypot: bot detecta-se preenchendo este campo.
    const honeypot = (
      e.currentTarget.elements.namedItem('website') as HTMLInputElement | null
    )?.value
    if (honeypot && honeypot.trim()) {
      setStatus('sent')
      setValues({ name: '', email: '', phone: '' })
      return
    }

    if (Object.keys(errors).length > 0) return

    setStatus('sending')
    setErrorMsg(null)
    try {
      const res = await fetch(apiUrl('/api/leads'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          phone: onlyDigits(values.phone),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      track('lead_submit', { method: 'form' })
      setStatus('sent')
      setValues({ name: '', email: '', phone: '' })
      setTouched({})
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'erro desconhecido')
    }
  }

  return (
    <section
      id="contato"
      className="ivy-scanlines text-[color:var(--color-ivy-bone)]"
    >
      <div className="ivy-page py-[clamp(48px,7vw,88px)] grid grid-cols-12 gap-x-6 gap-y-10 items-center">
        <header className="col-span-12 md:col-span-5">
          <div className="ivy-bar-blood">
            <p
              className="ivy-meta"
              style={{ color: 'var(--color-ivy-tan)' }}
            >
              Solicitação de diagnóstico
            </p>
            <h2
              className="ivy-display mt-4"
              style={{
                fontSize: 'clamp(36px,6.5vw,80px)',
                color: 'var(--color-ivy-bone)',
                lineHeight: 0.98,
              }}
            >
              Envie o caso.
              <br />
              <span style={{ color: 'var(--color-ivy-tan)' }}>
                Sigilo absoluto.
              </span>
            </h2>
          </div>
          <p
            className="mt-8 max-w-[44ch]"
            style={{
              fontSize: 'clamp(15px,1.1vw,17px)',
              lineHeight: 1.65,
              color: 'oklch(0.86 0.018 88)',
            }}
          >
            Um operador sênior da IVY retorna em até 24 horas úteis. Não há
            triagem comercial. Casos fora dos critérios de ticket recebem
            resposta técnica explicando a razão.
          </p>
        </header>

        {status === 'sent' ? (
          <ConfirmationBlock />
        ) : (
        <form
          onSubmit={onSubmit}
          noValidate
          className="col-span-12 md:col-span-7 md:pl-10 md:border-l md:border-[color:var(--color-ivy-tan)]/40"
        >
          <div className="grid grid-cols-12 gap-x-6 gap-y-6">
            <Field
              name="name"
              label="Nome"
              colSpan={12}
              required
              value={values.name}
              onChange={(v) => update('name', v)}
              onBlur={() => markTouched('name')}
              error={showError('name') ? errors.name : null}
              autoComplete="name"
              maxLength={80}
            />
            <Field
              name="email"
              type="email"
              label="E-mail"
              colSpan={7}
              required
              value={values.email}
              onChange={(v) => update('email', v)}
              onBlur={() => markTouched('email')}
              error={showError('email') ? errors.email : null}
              autoComplete="email"
              inputMode="email"
              maxLength={120}
              placeholder="nome@empresa.com.br"
            />
            <Field
              name="phone"
              type="tel"
              label="Telefone"
              colSpan={5}
              required
              value={values.phone}
              onChange={(v) => update('phone', v)}
              onBlur={() => markTouched('phone')}
              error={showError('phone') ? errors.phone : null}
              autoComplete="tel"
              inputMode="numeric"
              placeholder="(11) 99999-9999"
              maxLength={16}
            />
            {/* honeypot — invisível, posicionado off-screen */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="hidden"
            />
          </div>

          <div className="mt-8">
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
              {status === 'sending' ? 'Enviando...' : 'Enviar'}
            </button>
          </div>

          {status === 'error' && errorMsg && (
            <p
              className="mt-5 ivy-meta"
              style={{ color: 'var(--color-ivy-blood)' }}
            >
              Falha no envio: {errorMsg}
            </p>
          )}
        </form>
        )}
      </div>
    </section>
  )
}

function ConfirmationBlock() {
  return (
    <div className="col-span-12 md:col-span-7 md:pl-10 md:border-l md:border-[color:var(--color-ivy-tan)]/40 flex flex-col items-start">
      <CheckGlyph />
      <p
        className="ivy-meta mt-6"
        style={{ color: 'var(--color-ivy-olive)' }}
      >
        Contato recebido
      </p>
      <h3
        className="ivy-display mt-4"
        style={{
          color: 'var(--color-ivy-bone)',
          fontSize: 'clamp(28px,4vw,48px)',
          lineHeight: 1.05,
        }}
      >
        Em até 24 horas úteis,
        <br />
        retornaremos pelo
        <br />
        telefone informado.
      </h3>
      <hr
        style={{
          border: 0,
          borderTop: '3px solid var(--color-ivy-olive)',
          width: 'clamp(48px,6vw,80px)',
          marginTop: 28,
        }}
      />
      <p
        className="mt-6 max-w-[44ch]"
        style={{
          color: 'oklch(0.82 0.018 88)',
          fontSize: 'clamp(14px,1vw,16px)',
          lineHeight: 1.6,
        }}
      >
        Se preferir falar agora, o WhatsApp da operação está disponível no
        rodapé.
      </p>
    </div>
  )
}

function CheckGlyph() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        border: '1.5px solid var(--color-ivy-olive)',
        background: 'transparent',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 12.5L9.5 18L20 7"
          stroke="var(--color-ivy-olive)"
          strokeWidth="2.2"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
    </span>
  )
}

type FieldProps = {
  name: string
  label: string
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  error: string | null | undefined
  type?: string
  required?: boolean
  colSpan?: number
  placeholder?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
}

function Field({
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  type = 'text',
  required,
  colSpan = 12,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
}: FieldProps) {
  const id = `f-${name}`
  const errorId = `${id}-err`
  const hasError = !!error
  return (
    <label
      htmlFor={id}
      className="block"
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      <span
        className="ivy-meta block mb-2"
        style={{ color: 'var(--color-ivy-tan)' }}
      >
        {label}
        {required && (
          <span aria-hidden style={{ color: 'var(--color-ivy-blood)' }}>
            {' '}
            *
          </span>
        )}
      </span>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full bg-transparent"
        style={{
          border: 0,
          borderBottom: `1px solid ${
            hasError
              ? 'var(--color-ivy-blood)'
              : 'var(--color-ivy-tan)'
          }`,
          color: 'var(--color-ivy-bone)',
          padding: '10px 0',
          fontSize: 16,
          fontFamily: 'var(--font-body)',
          outline: 'none',
          transition: 'border-color 180ms var(--ease-ivy)',
        }}
      />
      {hasError && (
        <p
          id={errorId}
          className="mt-2"
          style={{
            color: 'var(--color-ivy-blood)',
            fontSize: 12,
            letterSpacing: '0.04em',
            lineHeight: 1.4,
          }}
        >
          {error}
        </p>
      )}
    </label>
  )
}
