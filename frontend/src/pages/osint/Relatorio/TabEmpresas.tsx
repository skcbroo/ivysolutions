import { useMemo, useState } from 'react'
import { useSortable } from '../../../hooks/useSortable'
import type { Empresa, EmpresaExterior, InvestigacaoFull } from '../../../lib/osint'
import { formatBRL, formatCnpj } from './format'
import { Td, Th } from './shared'
import { FilterBar, FilterChip, SortableTh } from './Tabs'

type ContatoView = 'ambos' | 'email' | 'telefone'

type EmpresaSortKey = 'ident' | 'nome' | 'situacao' | 'capital' | 'cargo' | 'jurisdicao'
type EmpresaFiltro = 'todas' | 'ativas' | 'inaptas' | 'exterior' | 'com_alerta'

/** Linha unificada: empresas BR (Block 1) + sociedades no exterior (Block 4). */
type Row = {
  key: string
  exterior: boolean
  jurisdicao: string // 'BR' | 'GB' ...
  ident: string // CNPJ formatado (BR) ou nº de registro (exterior)
  nome: string
  situacao: string | null
  ativa: boolean
  capital: number | null
  cargo: string | null
  periodo: string | null // exterior: 'AAAA → AAAA/ativo'
  alertas: string[]
  emails: string[]
  telefones: string[]
  url: string | null
}

const JURIS_LABEL: Record<string, string> = { BR: 'Brasil', GB: 'Reino Unido' }
const ano = (d: string | null) => (d && /^\d{4}/.test(d) ? d.slice(0, 4) : d ?? '?')

function brToRow(e: Empresa): Row {
  return {
    key: `br-${e.id}`,
    exterior: false,
    jurisdicao: 'BR',
    ident: formatCnpj(e.cnpj14),
    nome: e.nome ?? 'razão social não localizada',
    situacao: e.situacao,
    ativa: !!(e.situacao && /ATIVA/i.test(e.situacao)),
    capital: e.capital == null ? null : Number(e.capital),
    cargo: e.cargo,
    periodo: null,
    alertas: e.alertas ?? [],
    emails: e.emails ?? [],
    telefones: e.telefones ?? [],
    url: null,
  }
}

function extToRow(e: EmpresaExterior, i: number): Row {
  return {
    key: `ext-${i}`,
    exterior: true,
    jurisdicao: e.jurisdicao,
    ident: e.numero ?? '—',
    nome: e.empresa,
    situacao: e.saida ? 'Saída registrada' : 'Vínculo ativo',
    ativa: !e.saida,
    capital: null,
    cargo: e.cargo,
    periodo: `${ano(e.entrada)} → ${e.saida ? ano(e.saida) : 'ativo'}`,
    alertas: [],
    emails: [],
    telefones: [],
    url: e.url,
  }
}

export function TabEmpresas({ data }: { data: InvestigacaoFull }) {
  const [contatoView, setContatoView] = useState<ContatoView>('ambos')
  const [filtro, setFiltro] = useState<EmpresaFiltro>('todas')

  const rows = useMemo<Row[]>(
    () => [
      ...data.empresas.map(brToRow),
      ...(data.empresas_exterior ?? []).map(extToRow),
    ],
    [data.empresas, data.empresas_exterior],
  )

  const filtered = useMemo(() => {
    if (filtro === 'ativas') return rows.filter((r) => r.ativa)
    if (filtro === 'inaptas') return rows.filter((r) => !r.ativa)
    if (filtro === 'exterior') return rows.filter((r) => r.exterior)
    if (filtro === 'com_alerta') return rows.filter((r) => r.alertas.length > 0)
    return rows
  }, [rows, filtro])

  const accessors: Record<EmpresaSortKey, (r: Row) => string | number | null> = {
    ident: (r) => r.ident,
    nome: (r) => r.nome,
    situacao: (r) => r.situacao,
    capital: (r) => r.capital,
    cargo: (r) => r.cargo,
    jurisdicao: (r) => r.jurisdicao,
  }
  const { sorted, sort, toggle } = useSortable<Row, EmpresaSortKey>(filtered, accessors, {
    key: 'capital',
    dir: 'desc',
  })

  if (rows.length === 0) {
    return (
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        Nenhuma empresa registrada.
      </p>
    )
  }

  const temEmail = rows.some((r) => r.emails.length > 0)
  const temTel = rows.some((r) => r.telefones.length > 0)
  const countAlertas = rows.filter((r) => r.alertas.length > 0).length
  const countAtivas = rows.filter((r) => r.ativa).length
  const countExterior = rows.filter((r) => r.exterior).length

  return (
    <>
      <FilterBar>
        <FilterChip active={filtro === 'todas'} onClick={() => setFiltro('todas')}>
          Todas ({rows.length})
        </FilterChip>
        <FilterChip active={filtro === 'ativas'} onClick={() => setFiltro('ativas')}>
          Ativas ({countAtivas})
        </FilterChip>
        <FilterChip active={filtro === 'inaptas'} onClick={() => setFiltro('inaptas')}>
          Inativas / Falidas ({rows.length - countAtivas})
        </FilterChip>
        {countExterior > 0 && (
          <FilterChip active={filtro === 'exterior'} onClick={() => setFiltro('exterior')}>
            No exterior ({countExterior})
          </FilterChip>
        )}
        {countAlertas > 0 && (
          <FilterChip active={filtro === 'com_alerta'} onClick={() => setFiltro('com_alerta')} tone="blood">
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
              <SortableTh sortKey="jurisdicao" current={sort} onSort={toggle}>Juris.</SortableTh>
              <SortableTh sortKey="ident" current={sort} onSort={toggle}>CNPJ / Reg.</SortableTh>
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
            {sorted.map((r) => (
              <tr key={r.key} style={{ borderBottom: '1px solid var(--color-ivy-rule-subtle)' }}>
                <Td><JurisBadge code={r.jurisdicao} /></Td>
                <Td mono>{r.ident}</Td>
                <Td bold>
                  {r.nome}
                  {r.periodo && (
                    <span className="ivy-foot block mt-1" style={{ color: 'var(--color-ivy-mid)' }}>
                      {r.periodo}
                    </span>
                  )}
                  {r.alertas.length > 0 && (
                    <span className="ivy-foot block mt-1" style={{ color: 'var(--color-ivy-blood)' }}>
                      ⚠ {r.alertas.join(' · ')}
                    </span>
                  )}
                </Td>
                <Td tone={r.ativa ? 'ok' : 'mid'}>{r.situacao ?? ''}</Td>
                <Td align="right" mono>{r.capital == null ? '—' : formatBRL(r.capital)}</Td>
                <Td>{r.cargo ?? ''}</Td>
                <Td>
                  {r.exterior ? <FonteLink url={r.url} /> : <ContatoCell row={r} view={contatoView} />}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile <md: cada empresa vira um bloco vertical. */}
      <ul className="md:hidden flex flex-col" style={{ borderTop: '1px solid var(--color-ivy-tan)' }}>
        {sorted.map((r) => (
          <li key={r.key} className="py-5" style={{ borderBottom: '1px solid var(--color-ivy-rule-subtle)' }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2">
                <JurisBadge code={r.jurisdicao} />
                <span
                  className="ivy-foot"
                  style={{ color: r.ativa ? 'var(--color-ivy-olive)' : 'var(--color-ivy-mid)', letterSpacing: '0.2em' }}
                >
                  {r.situacao ?? 'situação desconhecida'}
                </span>
              </span>
              <span className="ivy-foot" style={{ color: 'var(--color-ivy-mid)', fontVariantNumeric: 'tabular-nums' }}>
                {r.ident}
              </span>
            </div>
            <p className="mt-2" style={{ color: 'var(--color-ivy-near)', fontWeight: 600, fontSize: 'clamp(15px,4.2vw,18px)', lineHeight: 1.25 }}>
              {r.nome}
            </p>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {r.capital != null && <DatumMobile label="Capital" value={formatBRL(r.capital)} />}
              {r.cargo && <DatumMobile label="Cargo" value={r.cargo} />}
              {r.periodo && <DatumMobile label="Período" value={r.periodo} />}
            </dl>
            {!r.exterior && (r.emails.length > 0 || r.telefones.length > 0) && (
              <div className="mt-3 flex flex-col gap-1">
                {r.emails.map((m) => (
                  <a key={m} href={`mailto:${m}`} className="ivy-foot" style={{ color: 'var(--color-ivy-near)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    {m}
                  </a>
                ))}
                {r.telefones.map((t) => (
                  <a key={t} href={`tel:${t.replace(/\D/g, '')}`} className="ivy-foot" style={{ color: 'var(--color-ivy-mid)', fontVariantNumeric: 'tabular-nums' }}>
                    {t}
                  </a>
                ))}
              </div>
            )}
            {r.exterior && r.url && (
              <div className="mt-3">
                <FonteLink url={r.url} />
              </div>
            )}
            {r.alertas.length > 0 && (
              <p className="mt-3 ivy-foot" style={{ color: 'var(--color-ivy-blood)' }}>
                ⚠ {r.alertas.join(' · ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

function JurisBadge({ code }: { code: string }) {
  const exterior = code !== 'BR'
  return (
    <span
      className="ivy-foot"
      title={JURIS_LABEL[code] ?? code}
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        letterSpacing: '0.15em',
        border: `1px solid ${exterior ? 'var(--color-ivy-olive)' : 'var(--color-ivy-tan)'}`,
        color: exterior ? 'var(--color-ivy-olive)' : 'var(--color-ivy-mid)',
        whiteSpace: 'nowrap',
      }}
    >
      {code}
    </span>
  )
}

function FonteLink({ url }: { url: string | null }) {
  if (!url) return <span style={{ color: 'var(--color-ivy-mid)' }}>—</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="ivy-foot"
      style={{ color: 'var(--color-ivy-olive)', textDecoration: 'underline', textUnderlineOffset: 3 }}
    >
      Companies House →
    </a>
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

export function ContatoCell({ row, view }: { row: { emails: string[]; telefones: string[] }; view: ContatoView }) {
  const emails = row.emails ?? []
  const tels = row.telefones ?? []
  if (emails.length === 0 && tels.length === 0) {
    return <span style={{ color: 'var(--color-ivy-mid)' }}>—</span>
  }
  const showEmail = view === 'ambos' || view === 'email'
  const showTel = view === 'ambos' || view === 'telefone'
  return (
    <div className="flex flex-col gap-0.5">
      {showEmail && emails[0] && (
        <a href={`mailto:${emails[0]}`} style={{ color: 'var(--color-ivy-near)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          {emails[0]}
          {emails.length > 1 && (
            <span className="ml-2 ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>
              +{emails.length - 1}
            </span>
          )}
        </a>
      )}
      {showTel && tels[0] && (
        <a href={`tel:${tels[0].replace(/\D/g, '')}`} className="ivy-foot" style={{ color: 'var(--color-ivy-mid)', fontVariantNumeric: 'tabular-nums' }}>
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
      <dd style={{ color: 'var(--color-ivy-near)', fontSize: 14, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </dd>
    </div>
  )
}
