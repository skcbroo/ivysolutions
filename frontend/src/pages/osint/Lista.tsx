import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { OsintLayout } from '../../components/osint/Layout'
import { StatusBadge } from '../../components/osint/StatusBadge'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { isAbortError, osintApi, type InvestigacaoLite } from '../../lib/osint'

const formatBRL = (raw: string | null) => {
  if (!raw) return ''
  const n = Number(raw)
  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : ''
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

export function Lista() {
  const [items, setItems] = useState<InvestigacaoLite[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const ctl = new AbortController()
    abortRef.current = ctl
    try {
      const data = await osintApi.listar(ctl.signal)
      setItems(data)
      setError(null)
    } catch (err) {
      if (isAbortError(err)) return
      setError(err instanceof Error ? err.message : 'erro de rede')
    }
  }, [])

  useVisibleInterval(load, 5_000)

  return (
    <OsintLayout
      protocol="Protocolo · Investigações"
      title="Dossiês em curso."
      subtitle="Cada linha representa uma investigação patrimonial. Status em tempo real; nova execução não bloqueia consultas anteriores."
      rightSlot={
        <Link
          to="/osint/nova"
          className="ivy-meta"
          style={{
            background: 'var(--color-ivy-olive)',
            color: 'var(--color-ivy-bone)',
            padding: '14px 22px',
            letterSpacing: '0.3em',
            fontSize: 12,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          + Nova investigação
        </Link>
      }
    >
      <div className="ivy-page pb-[clamp(64px,8vw,120px)]">
        <hr className="ivy-rule-olive mb-10" />

        {error && (
          <div
            role="alert"
            className="mb-8 p-5 flex items-center justify-between gap-4 flex-wrap"
            style={{ border: '1px solid var(--color-ivy-blood)' }}
          >
            <p className="ivy-meta" style={{ color: 'var(--color-ivy-blood)' }}>
              Falha ao carregar: {error}
            </p>
            <button
              type="button"
              onClick={load}
              className="ivy-meta"
              style={{
                background: 'transparent',
                color: 'var(--color-ivy-near)',
                padding: '10px 18px',
                border: '1px solid var(--color-ivy-tan)',
                letterSpacing: '0.25em',
                fontSize: 11,
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!items && !error && (
          <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
            Carregando...
          </p>
        )}

        {items && items.length === 0 && (
          <div
            className="p-10 border"
            style={{ borderColor: 'var(--color-ivy-tan)', color: 'var(--color-ivy-mid)' }}
          >
            <p className="ivy-meta mb-3">Nenhuma investigação registrada</p>
            <p style={{ fontSize: 'clamp(14px,1vw,16px)', lineHeight: 1.6 }}>
              Use o botão acima para iniciar o primeiro dossiê.
            </p>
          </div>
        )}

        {items && items.length > 0 && (
          <>
            {/* Desktop ≥md: tabela densa. */}
            <div className="hidden md:block">
              <table
                className="w-full text-left"
                style={{ borderCollapse: 'collapse', fontSize: 'clamp(13px,0.95vw,15px)' }}
              >
                <thead>
                  <tr
                    className="ivy-meta"
                    style={{ color: 'var(--color-ivy-mid)', borderBottom: '1px solid var(--color-ivy-tan)' }}
                  >
                    <Th>Data</Th>
                    <Th>Nome</Th>
                    <Th>CPF</Th>
                    <Th>Status</Th>
                    <Th>Empresas / Processos</Th>
                    <Th align="right">Detalhes</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-ivy-rule-subtle)' }}>
                      <Td>{formatDate(inv.created_at)}</Td>
                      <Td bold>{inv.nome}</Td>
                      <Td mono>{inv.cpf}</Td>
                      <Td>
                        <StatusBadge status={inv.status} />
                        {inv.status === 'rodando' && (
                          <span className="ivy-foot block mt-1" style={{ color: 'var(--color-ivy-mid)' }}>
                            {inv.progresso?.etapa ??
                              (inv.progresso?.bloco_atual === 'block1' ? 'Sociedades' : 'Processos')}
                            {inv.progresso?.total
                              ? ` · ${Math.round(((inv.progresso.atual ?? 0) / inv.progresso.total) * 100)}%`
                              : ''}
                          </span>
                        )}
                        {inv.status === 'erro' && inv.erro_msg && (
                          <span className="ivy-foot block mt-1" style={{ color: 'var(--color-ivy-blood)' }}>
                            {inv.erro_msg.slice(0, 60)}
                          </span>
                        )}
                      </Td>
                      <Td>
                        {inv.capital_total ? (
                          <>
                            <span style={{ color: 'var(--color-ivy-near)', fontWeight: 600 }}>
                              {formatBRL(inv.capital_total)}
                            </span>
                            <span className="ivy-foot block" style={{ color: 'var(--color-ivy-mid)' }}>
                              {inv.pje_count ?? 0} processos
                            </span>
                          </>
                        ) : null}
                      </Td>
                      <Td align="right">
                        <Link
                          to={`/osint/${inv.id}`}
                          className="ivy-meta inline-block"
                          style={{
                            color: 'var(--color-ivy-olive)',
                            textDecoration: 'none',
                            padding: '8px 12px',
                            margin: '-8px -12px',
                          }}
                        >
                          Abrir →
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile <md: cada investigação vira um registro vertical. */}
            <ul className="md:hidden flex flex-col" style={{ borderTop: '1px solid var(--color-ivy-tan)' }}>
              {items.map((inv) => (
                <li
                  key={inv.id}
                  style={{ borderBottom: '1px solid var(--color-ivy-rule-subtle)' }}
                >
                  <Link
                    to={`/osint/${inv.id}`}
                    className="block"
                    style={{
                      textDecoration: 'none',
                      color: 'var(--color-ivy-near)',
                      padding: '20px 4px',
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-3">
                      <span className="ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>
                        Dossiê #{inv.id} · {formatDate(inv.created_at)}
                      </span>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p
                      className="ivy-display"
                      style={{
                        fontSize: 'clamp(20px,5vw,28px)',
                        lineHeight: 1.05,
                        color: 'var(--color-ivy-near)',
                      }}
                    >
                      {inv.nome}
                    </p>
                    <p className="mt-1 ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>
                      CPF {inv.cpf}
                    </p>
                    {inv.status === 'rodando' && (
                      <p className="ivy-foot mt-3" style={{ color: 'var(--color-ivy-mid)' }}>
                        {inv.progresso?.etapa ?? 'Em execução'}
                        {inv.progresso?.total
                          ? ` · ${Math.round(((inv.progresso.atual ?? 0) / inv.progresso.total) * 100)}%`
                          : ''}
                      </p>
                    )}
                    {inv.status === 'erro' && inv.erro_msg && (
                      <p
                        className="ivy-foot mt-3"
                        style={{ color: 'var(--color-ivy-blood)' }}
                      >
                        {inv.erro_msg.slice(0, 80)}
                      </p>
                    )}
                    {inv.capital_total && (
                      <dl className="mt-4 flex gap-6 flex-wrap">
                        <div>
                          <dt className="ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>
                            Capital
                          </dt>
                          <dd
                            className="ivy-display"
                            style={{ fontSize: 22, lineHeight: 1, color: 'var(--color-ivy-near)', margin: 0 }}
                          >
                            {formatBRL(inv.capital_total)}
                          </dd>
                        </div>
                        <div>
                          <dt className="ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>
                            Processos
                          </dt>
                          <dd
                            className="ivy-display"
                            style={{ fontSize: 22, lineHeight: 1, color: 'var(--color-ivy-near)', margin: 0 }}
                          >
                            {(inv.pje_count ?? 0).toLocaleString('pt-BR')}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </OsintLayout>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      style={{
        padding: '12px 14px',
        textAlign: align ?? 'left',
        fontWeight: 400,
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align,
  bold,
  mono,
}: {
  children: React.ReactNode
  align?: 'right'
  bold?: boolean
  mono?: boolean
}) {
  return (
    <td
      style={{
        padding: '14px',
        textAlign: align ?? 'left',
        verticalAlign: 'top',
        fontWeight: bold ? 600 : 400,
        fontVariantNumeric: mono ? 'tabular-nums' : undefined,
        color: 'var(--color-ivy-near)',
        overflowWrap: 'anywhere',
        wordBreak: 'normal',
      }}
    >
      {children}
    </td>
  )
}
