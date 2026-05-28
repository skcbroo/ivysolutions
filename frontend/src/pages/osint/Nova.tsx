import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field } from '../../components/osint/Field'
import { OsintLayout } from '../../components/osint/Layout'
import { osintApi } from '../../lib/osint'

const onlyDigits = (s: string) => s.replace(/\D/g, '')

function formatCpf(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function Nova() {
  const nav = useNavigate()
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const errors = {
    nome:
      nome.trim().length < 3
        ? 'Nome completo (mín. 3 caracteres).'
        : !/^[\p{L}\s'.-]+$/u.test(nome.trim())
        ? 'Nome com caracteres inválidos.'
        : null,
    cpf: onlyDigits(cpf).length !== 11 ? 'CPF deve ter 11 dígitos.' : null,
  }
  const showError = (k: keyof typeof errors) => touched[k] && errors[k]

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ nome: true, cpf: true })
    if (errors.nome || errors.cpf) return
    setStatus('sending')
    setErrorMsg(null)
    try {
      const inv = await osintApi.criarInvestigacao(nome.trim(), onlyDigits(cpf))
      nav(`/osint/${inv.id}`)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'erro desconhecido')
    }
  }

  return (
    <OsintLayout
      protocol="Protocolo · Nova investigação"
      title={
        <>
          Iniciar
          <br />
          <span style={{ color: 'var(--color-ivy-olive)' }}>dossiê.</span>
        </>
      }
      subtitle="Informe o alvo. A execução é assíncrona: pode acompanhar o andamento na lista ou nesta página assim que aberta."
      aside={<NovaAside />}
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-12 gap-x-6 gap-y-6">
          <Field
            name="nome"
            label="Nome completo do alvo"
            colSpan={12}
            required
            value={nome}
            onChange={setNome}
            onBlur={() => setTouched((t) => ({ ...t, nome: true }))}
            error={showError('nome') ? errors.nome : null}
            placeholder="Ex.: Sidnei Piva de Jesus"
            maxLength={120}
          />
          <Field
            name="cpf"
            label="CPF"
            colSpan={6}
            required
            value={cpf}
            onChange={(v) => setCpf(formatCpf(v))}
            onBlur={() => setTouched((t) => ({ ...t, cpf: true }))}
            error={showError('cpf') ? errors.cpf : null}
            inputMode="numeric"
            placeholder="000.000.000-00"
            maxLength={14}
          />
        </div>

        <div className="mt-10 flex items-center gap-6 flex-wrap">
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
              minHeight: 44,
            }}
          >
            {status === 'sending' ? 'Disparando...' : 'Iniciar investigação'}
          </button>
          <button
            type="button"
            onClick={() => nav('/osint')}
            className="ivy-meta"
            style={{
              background: 'transparent',
              color: 'var(--color-ivy-mid)',
              padding: '16px 12px',
              minHeight: 44,
              border: 0,
              letterSpacing: '0.3em',
              fontSize: 12,
            }}
          >
            Cancelar
          </button>
        </div>

        {status === 'error' && errorMsg && (
          <p
            role="alert"
            className="mt-6 ivy-meta"
            style={{ color: 'var(--color-ivy-blood)' }}
          >
            Falha: {errorMsg}
          </p>
        )}
      </form>
    </OsintLayout>
  )
}

function NovaAside() {
  return (
    <div>
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        Fluxo da investigação
      </p>
      <ol className="mt-5">
        <Step n="01" title="Sociedades">
          Identifica todas as empresas em que o alvo aparece como sócio.
        </Step>
        <Step n="02" title="Patrimônio">
          Detalha cada empresa: situação, capital, endereço e contatos.
        </Step>
        <Step n="03" title="Processos">
          Varre processos judiciais por nome em todas as instâncias.
        </Step>
        <Step n="04" title="Dossiê" last>
          Consolida criminais, advogados recorrentes e vínculos no relatório final.
        </Step>
      </ol>
      <div
        className="mt-8 pt-6"
        style={{ borderTop: '1px solid var(--color-ivy-rule-subtle)' }}
      >
        <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
          Tempo médio
        </p>
        <p
          className="ivy-display mt-2"
          style={{ fontSize: 'clamp(28px,3vw,40px)', color: 'var(--color-ivy-near)', lineHeight: 1 }}
        >
          5 a 30 minutos
        </p>
        <p
          className="mt-2"
          style={{ color: 'var(--color-ivy-mid)', fontSize: 14, lineHeight: 1.5 }}
        >
          Você pode fechar a página; o resultado fica salvo no dossiê.
        </p>
      </div>
    </div>
  )
}

function Step({
  n,
  title,
  children,
  last,
}: {
  n: string
  title: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <li
      className="relative pl-12"
      style={{ paddingBottom: last ? 0 : 28, listStyle: 'none' }}
    >
      {/* linha vertical conectora */}
      {!last && (
        <span
          aria-hidden
          className="absolute"
          style={{
            left: 11,
            top: 28,
            bottom: 0,
            width: 1,
            background: 'var(--color-ivy-rule-soft)',
          }}
        />
      )}
      {/* número quadrado olive */}
      <span
        aria-hidden
        className="absolute ivy-meta"
        style={{
          left: 0,
          top: 0,
          width: 24,
          height: 24,
          background: 'var(--color-ivy-olive)',
          color: 'var(--color-ivy-bone)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          letterSpacing: '0.15em',
        }}
      >
        {n}
      </span>
      <p
        className="ivy-display"
        style={{
          fontSize: 'clamp(18px,1.4vw,22px)',
          color: 'var(--color-ivy-near)',
          lineHeight: 1.1,
        }}
      >
        {title}
      </p>
      <p
        className="mt-2"
        style={{
          color: 'var(--color-ivy-mid)',
          fontSize: 'clamp(14px,1vw,15px)',
          lineHeight: 1.5,
          maxWidth: '38ch',
        }}
      >
        {children}
      </p>
    </li>
  )
}
