import { useMemo, useState } from 'react'
import { useSortable } from '../../../hooks/useSortable'
import type { InvestigacaoFull } from '../../../lib/osint'
import { formatBRL, formatCnpj } from './format'
import { Td, Th } from './shared'
import { FilterBar, FilterChip, SortableTh } from './Tabs'

type ContatoView = 'ambos' | 'email' | 'telefone'

type EmpresaSortKey = 'cnpj14' | 'nome' | 'situacao' | 'capital' | 'cargo'
type EmpresaFiltro = 'todas' | 'ativas' | 'inaptas' | 'com_alerta'

export function TabEmpresas({ data }: { data: InvestigacaoFull }) {
  const [contatoView, setContatoView] = useState<ContatoView>('ambos')
  const [filtro, setFiltro] = useState<EmpresaFiltro>('todas')

  // filtragem
  const filtered = useMemo(() => {
    if (filtro === 'todas') return data.empresas
    if (filtro === 'ativas') return data.empresas.filter((e) => e.situacao && /ATIVA/i.test(e.situacao))
    if (filtro === 'inaptas')
      return data.empresas.filter((e) => e.situacao && !/ATIVA/i.test(e.situacao))
    return data.empresas.filter((e) => e.alertas.length > 0)
  }, [data.empresas, filtro])

  // ordenação
  const accessors: Record<EmpresaSortKey, (e: InvestigacaoFull['empresas'][number]) => string | number | null> = {
    cnpj14: (e) => e.cnpj14,
    nome: (e) => e.nome,
    situacao: (e) => e.situacao,
    capital: (e) => (e.capital == null ? null : Number(e.capital)),
    cargo: (e) => e.cargo,
  }
  const { sorted, sort, toggle } = useSortable<InvestigacaoFull['empresas'][number], EmpresaSortKey>(
    filtered,
    accessors,
    { key: 'capital', dir: 'desc' },
  )

  if (data.empresas.length === 0) {
    return (
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        Nenhuma empresa registrada.
      </p>
    )
  }

  const temEmail = data.empresas.some((e) => (e.emails ?? []).length > 0)
  const temTel = data.empresas.some((e) => (e.telefones ?? []).length > 0)
  const countAlertas = data.empresas.filter((e) => e.alertas.length > 0).length
  const countAtivas = data.empresas.filter((e) => e.situacao && /ATIVA/i.test(e.situacao)).length

  return (
    <>
      <FilterBar>
        <FilterChip active={filtro === 'todas'} onClick={() => setFiltro('todas')}>
          Todas ({data.empresas.length})
        </FilterChip>
        <FilterChip active={filtro === 'ativas'} onClick={() => setFiltro('ativas')}>
          Ativas ({countAtivas})
        </FilterChip>
        <FilterChip active={filtro === 'inaptas'} onClick={() => setFiltro('inaptas')}>
          Inativas / Falidas ({data.empresas.length - countAtivas})
        </FilterChip>
        {countAlertas > 0 && (
          <FilterChip
            active={filtro === 'com_alerta'}
            onClick={() => setFiltro('com_alerta')}
            tone="blood"
          >
            ⚠ Com alerta ({countAlertas})
          </FilterChip>
        )}
      </FilterBar>

      {/* Desktop ≥md: tabela. */}
      <div className="hidden md:block">
        <table
          className="w-full text-left"
          style={{ borderCollapse: 'collapse', fontSize: 'clamp(13px,0.95vw,15px)' }}
        >
          <thead>
            <tr className="ivy-meta" style={{ color: 'var(--color-ivy-mid)', borderBottom: '1px solid var(--color-ivy-tan)' }}>
              <SortableTh sortKey="cnpj14" current={sort} onSort={toggle}>CNPJ</SortableTh>
              <SortableTh sortKey="nome" current={sort} onSort={toggle}>Empresa</SortableTh>
              <SortableTh sortKey="situacao" current={sort} onSort={toggle}>Situação</SortableTh>
              <SortableTh sortKey="capital" current={sort} onSort={toggle} align="right">Capital</SortableTh>
              <SortableTh sortKey="cargo" current={sort} onSort={toggle}>Cargo</SortableTh>
              <Th>
                <ContatoToggle value={contatoView} onChange={setContatoView} hasEmail={temEmail} hasTel={temTel} />
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--color-ivy-rule-subtle)' }}>
                <Td mono>{formatCnpj(e.cnpj14)}</Td>
                <Td bold>
                  {e.nome ?? ''}
                  {e.alertas.length > 0 && (
                    <span className="ivy-foot block mt-1" style={{ color: 'var(--color-ivy-blood)' }}>
                      ⚠ {e.alertas.join(' · ')}
                    </span>
                  )}
                </Td>
                <Td tone={e.situacao && /ATIVA/i.test(e.situacao) ? 'ok' : 'mid'}>
                  {e.situacao ?? ''}
                </Td>
                <Td align="right" mono>{formatBRL(e.capital)}</Td>
                <Td>{e.cargo ?? ''}</Td>
                <Td>
                  <ContatoCell empresa={e} view={contatoView} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile <md: cada empresa vira um bloco vertical. */}
      <ul className="md:hidden flex flex-col" style={{ borderTop: '1px solid var(--color-ivy-tan)' }}>
        {sorted.map((e) => {
          const ativa = e.situacao && /ATIVA/i.test(e.situacao)
          return (
            <li
              key={e.id}
              className="py-5"
              style={{ borderBottom: '1px solid var(--color-ivy-rule-subtle)' }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="ivy-foot"
                  style={{
                    color: ativa ? 'var(--color-ivy-olive)' : 'var(--color-ivy-mid)',
                    letterSpacing: '0.2em',
                  }}
                >
                  {e.situacao ?? 'situação desconhecida'}
                </span>
                <span className="ivy-foot" style={{ color: 'var(--color-ivy-mid)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCnpj(e.cnpj14)}
                </span>
              </div>
              <p
                className="mt-2"
                style={{
                  color: 'var(--color-ivy-near)',
                  fontWeight: 600,
                  fontSize: 'clamp(15px,4.2vw,18px)',
                  lineHeight: 1.25,
                }}
              >
                {e.nome ?? 'razão social não localizada'}
              </p>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {e.capital != null && (
                  <DatumMobile label="Capital" value={formatBRL(e.capital)} />
                )}
                {e.cargo && <DatumMobile label="Cargo" value={e.cargo} />}
              </dl>
              {(e.emails?.length || e.telefones?.length) && (
                <div className="mt-3 flex flex-col gap-1">
                  {(e.emails ?? []).map((m) => (
                    <a
                      key={m}
                      href={`mailto:${m}`}
                      className="ivy-foot"
                      style={{ color: 'var(--color-ivy-near)', textDecoration: 'underline', textUnderlineOffset: 3 }}
                    >
                      {m}
                    </a>
                  ))}
                  {(e.telefones ?? []).map((t) => (
                    <a
                      key={t}
                      href={`tel:${t.replace(/\D/g, '')}`}
                      className="ivy-foot"
                      style={{ color: 'var(--color-ivy-mid)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {t}
                    </a>
                  ))}
                </div>
              )}
              {e.alertas.length > 0 && (
                <p className="mt-3 ivy-foot" style={{ color: 'var(--color-ivy-blood)' }}>
                  ⚠ {e.alertas.join(' · ')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function ContatoToggle({
  value,
  onChange,
  hasEmail,
  hasTel,
}: {
  value: ContatoView
  onChange: (v: ContatoView) => void
  hasEmail: boolean
  hasTel: boolean
}) {
  // Se só tem um tipo, não mostra toggle — fixa o label da coluna.
  if (!hasEmail && !hasTel) return <span>Contato</span>
  if (!hasEmail) return <span>Telefone</span>
  if (!hasTel) return <span>Email</span>

  const opts: Array<{ id: ContatoView; label: string }> = [
    { id: 'ambos', label: 'Email + Tel' },
    { id: 'email', label: 'Email' },
    { id: 'telefone', label: 'Telefone' },
  ]
  return (
    <label className="inline-flex items-center gap-2">
      <span>Contato</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ContatoView)}
        className="ivy-meta"
        aria-label="Visualização da coluna de contato"
        style={{
          background: 'transparent',
          color: 'var(--color-ivy-olive)',
          border: '1px solid var(--color-ivy-tan)',
          padding: '4px 8px',
          fontSize: 11,
          letterSpacing: '0.15em',
          fontFamily: 'var(--font-body)',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ContatoCell({ empresa, view }: { empresa: InvestigacaoFull['empresas'][number]; view: ContatoView }) {
  const emails = empresa.emails ?? []
  const tels = empresa.telefones ?? []
  if (emails.length === 0 && tels.length === 0) {
    return <span style={{ color: 'var(--color-ivy-mid)' }}>—</span>
  }
  const showEmail = view === 'ambos' || view === 'email'
  const showTel = view === 'ambos' || view === 'telefone'
  return (
    <div className="flex flex-col gap-0.5">
      {showEmail && emails[0] && (
        <a
          href={`mailto:${emails[0]}`}
          style={{ color: 'var(--color-ivy-near)', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          {emails[0]}
          {emails.length > 1 && (
            <span className="ml-2 ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>
              +{emails.length - 1}
            </span>
          )}
        </a>
      )}
      {showTel && tels[0] && (
        <a
          href={`tel:${tels[0].replace(/\D/g, '')}`}
          className="ivy-foot"
          style={{ color: 'var(--color-ivy-mid)', fontVariantNumeric: 'tabular-nums' }}
        >
          {tels[0]}
          {tels.length > 1 && (
            <span className="ml-2" style={{ color: 'var(--color-ivy-mid)' }}>
              +{tels.length - 1}
            </span>
          )}
        </a>
      )}
    </div>
  )
}

function DatumMobile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>{label}</dt>
      <dd
        style={{
          color: 'var(--color-ivy-near)',
          fontSize: 14,
          margin: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </dd>
    </div>
  )
}
