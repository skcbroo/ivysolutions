import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field } from '../../components/osint/Field'
import { OsintLayout } from '../../components/osint/Layout'
import { isAbortError, osintApi, type Capabilities, type Opcoes } from '../../lib/osint'
import { formatCpf, validateCpf } from '../../utils/cpf'

const onlyDigits = (s: string) => s.replace(/\D/g, '')

const OPCOES_PADRAO: Opcoes = {
  processos: true,
  analiseLlm: true,
  internacional: { opensanctions: true, companiesHouse: true, icij: true },
}

export function Nova() {
  const nav = useNavigate()
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [capsLoading, setCapsLoading] = useState(true)
  const [opcoes, setOpcoes] = useState<Opcoes>(OPCOES_PADRAO)

  useEffect(() => {
    const ctl = new AbortController()
    osintApi
      .capabilities(ctl.signal)
      .then((c) => {
        setCaps(c)
        setCapsLoading(false)
      })
      .catch((e) => {
        if (isAbortError(e)) return
        setCaps(null)
        setCapsLoading(false)
      })
    return () => ctl.abort()
  }, [])

  // Dependência: B3 (LLM) exige B2 (processos). Sem processos, força LLM off.
  const opcoesEfetivas: Opcoes = {
    ...opcoes,
    analiseLlm: opcoes.processos && opcoes.analiseLlm,
  }

  const errors = {
    nome:
      nome.trim().length < 3
        ? 'Nome completo (mín. 3 caracteres).'
        : !/^[\p{L}\s'.-]+$/u.test(nome.trim())
        ? 'Nome com caracteres inválidos.'
        : null,
    cpf:
      onlyDigits(cpf).length !== 11
        ? 'CPF deve ter 11 dígitos.'
        : !validateCpf(cpf)
        ? 'CPF inválido.'
        : null,
  }
  const showError = (k: keyof typeof errors) => touched[k] && errors[k]

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ nome: true, cpf: true })
    if (errors.nome || errors.cpf) return
    setStatus('sending')
    setErrorMsg(null)
    try {
      const inv = await osintApi.criarInvestigacao(nome.trim(), onlyDigits(cpf), opcoesEfetivas)
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
        <Section title="Dados do alvo" className="mt-2">
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
              spanClass="col-span-12 md:col-span-6"
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
        </Section>

        <EscopoSection caps={caps} loading={capsLoading} opcoes={opcoes} setOpcoes={setOpcoes} />

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

function EscopoSection({
  caps,
  loading,
  opcoes,
  setOpcoes,
}: {
  caps: Capabilities | null
  loading: boolean
  opcoes: Opcoes
  setOpcoes: React.Dispatch<React.SetStateAction<Opcoes>>
}) {
  return (
    <Section
      title="Escopo da investigação"
      desc="Sociedades (Bloco 1) sempre roda. Os demais são opcionais. Desmarque o que não precisar."
      className="mt-16"
    >
      {loading ? (
        <EscopoSkeleton />
      ) : (
        <>
          <Section title="Processos judiciais (Bloco 2)" bordered>
            <Toggle
              label="Varre processos por nome em todas as instâncias."
              checked={opcoes.processos}
              onChange={(v) => setOpcoes((o) => ({ ...o, processos: v }))}
            />
          </Section>

          {caps?.analiseLlm && (
            <Section title="Análise patrimonial — IA (Bloco 3)" bordered>
              <Toggle
                label="Resume as comunicações dos processos com foco em patrimônio."
                hint={opcoes.processos ? undefined : 'Requer Processos ligado.'}
                checked={opcoes.processos && opcoes.analiseLlm}
                disabled={!opcoes.processos}
                onChange={(v) => setOpcoes((o) => ({ ...o, analiseLlm: v }))}
              />
            </Section>
          )}

          {caps?.internacional && (caps.opensanctions || caps.companiesHouse || caps.icij) && (
            <Section title="Buscas internacionais (Bloco 4)" bordered>
              {caps.opensanctions && (
                <Toggle
                  label="OpenSanctions"
                  hint="Sanções, PEP e watchlists internacionais."
                  checked={opcoes.internacional.opensanctions}
                  onChange={(v) =>
                    setOpcoes((o) => ({ ...o, internacional: { ...o.internacional, opensanctions: v } }))
                  }
                />
              )}
              {caps.companiesHouse && (
                <Toggle
                  label="UK Companies House"
                  hint="Sociedades do alvo no Reino Unido."
                  checked={opcoes.internacional.companiesHouse}
                  onChange={(v) =>
                    setOpcoes((o) => ({ ...o, internacional: { ...o.internacional, companiesHouse: v } }))
                  }
                />
              )}
              {caps.icij && (
                <Toggle
                  label="ICIJ Offshore Leaks"
                  hint="Vínculos do alvo em vazamentos offshore (Panama, Pandora, Paradise Papers etc.)."
                  checked={opcoes.internacional.icij}
                  onChange={(v) =>
                    setOpcoes((o) => ({ ...o, internacional: { ...o.internacional, icij: v } }))
                  }
                />
              )}
            </Section>
          )}
        </>
      )}
    </Section>
  )
}

function Section({
  title,
  desc,
  bordered = false,
  className,
  children,
}: {
  title: string
  desc?: string
  bordered?: boolean
  className?: string
  children: React.ReactNode
}) {
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId} className={className}>
      {bordered ? (
        <p
          id={labelId}
          className="ivy-foot"
          style={{ color: 'var(--color-ivy-mid)', letterSpacing: '0.2em', marginBottom: 10 }}
        >
          {title}
        </p>
      ) : (
        <p
          id={labelId}
          className="ivy-display"
          style={{
            color: 'var(--color-ivy-near)',
            fontSize: 'clamp(22px,2vw,30px)',
            lineHeight: 1,
            marginBottom: desc ? 10 : 16,
          }}
        >
          {title}
        </p>
      )}
      {desc && (
        <p
          className="mb-5"
          style={{ color: 'var(--color-ivy-mid)', fontSize: 14, lineHeight: 1.5, maxWidth: '52ch' }}
        >
          {desc}
        </p>
      )}
      <div
        className={bordered ? 'flex flex-col gap-4 pl-4' : 'flex flex-col gap-8'}
        style={bordered ? { borderLeft: '1px solid var(--color-ivy-rule-subtle)' } : undefined}
      >
        {children}
      </div>
    </div>
  )
}

function EscopoSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden role="presentation">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <span style={{ width: 16, height: 16, background: 'var(--color-ivy-rule-subtle)', flex: 'none', marginTop: 3 }} />
          <span style={{ display: 'block', width: i === 0 ? '40%' : '32%', height: 12, background: 'var(--color-ivy-rule-subtle)' }} />
        </div>
      ))}
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          marginTop: 3,
          width: 16,
          height: 16,
          accentColor: 'var(--color-ivy-olive)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          flex: 'none',
        }}
      />
      <label htmlFor={id} style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <span
          style={{
            color: disabled ? 'var(--color-ivy-mid)' : 'var(--color-ivy-near)',
            fontSize: 'clamp(14px,1vw,16px)',
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        {hint && (
          <span id={hintId} className="block ivy-foot mt-0.5" style={{ color: 'var(--color-ivy-mid)' }}>
            {hint}
          </span>
        )}
      </label>
    </div>
  )
}

function NovaAside() {
  return (
    <div>
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        Fluxo da investigação
      </p>
      <ol className="mt-5">
        <Step n="01" title="Sociedades" tag="Sempre">
          Mapeia todas as empresas em que o alvo aparece como sócio e detalha cada uma:
          situação, capital, endereço e contatos.
        </Step>
        <Step n="02" title="Processos judiciais" tag="Opcional">
          Varre processos por nome em todas as instâncias e tribunais.
        </Step>
        <Step n="03" title="Análise patrimonial" tag="IA · opcional">
          A IA resume as comunicações dos processos com foco em bens e patrimônio.
          Depende dos processos estarem ligados.
        </Step>
        <Step n="04" title="Buscas internacionais" tag="Opcional">
          Cruza o alvo com sanções, PEP e watchlists globais (OpenSanctions) e com
          sociedades no Reino Unido (UK Companies House).
        </Step>
        <Step n="05" title="Dossiê" last>
          Consolida tudo no relatório final: criminais, advogados recorrentes e vínculos
          entre as partes.
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
  tag,
  children,
  last,
}: {
  n: string
  title: string
  tag?: string
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
      <div className="flex items-baseline gap-2.5 flex-wrap">
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
        {tag && (
          <span
            className="ivy-foot"
            style={{
              color: tag === 'Sempre' ? 'var(--color-ivy-olive)' : 'var(--color-ivy-mid)',
              letterSpacing: '0.18em',
            }}
          >
            {tag}
          </span>
        )}
      </div>
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
