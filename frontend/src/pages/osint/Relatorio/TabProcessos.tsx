import { useMemo, useState } from 'react'
import { useSortable } from '../../../hooks/useSortable'
import type { InvestigacaoFull } from '../../../lib/osint'
import { truncStr } from './format'
import { Td } from './shared'
import { FilterBar, FilterChip, SortableTh } from './Tabs'

type ProcessoFiltro = 'todos' | 'criminal' | 'pessoal' | 'empresarial'

export function TabProcessos({ data }: { data: InvestigacaoFull }) {
  const [filtro, setFiltro] = useState<ProcessoFiltro>('todos')
  const [tribunalFiltro, setTribunalFiltro] = useState<string>('')

  const tribunaisUnicos = useMemo(() => {
    const set = new Set<string>()
    for (const p of data.processos) if (p.tribunal) set.add(p.tribunal.split(' ')[0])
    return Array.from(set).sort()
  }, [data.processos])

  const filtered = useMemo(() => {
    let out = data.processos
    if (filtro === 'criminal') out = out.filter((p) => p.criminal)
    else if (filtro === 'pessoal') out = out.filter((p) => p.vinculo === 'pessoal')
    else if (filtro === 'empresarial') out = out.filter((p) => p.vinculo === 'empresarial')
    if (tribunalFiltro) out = out.filter((p) => p.tribunal?.startsWith(tribunalFiltro))
    return out
  }, [data.processos, filtro, tribunalFiltro])

  if (data.processos.length === 0) {
    return (
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        Nenhum processo registrado.
      </p>
    )
  }
  const totalCriminais = data.processos.filter((p) => p.criminal).length
  const totalPessoais = data.processos.filter((p) => p.vinculo === 'pessoal').length
  const totalEmpresariais = data.processos.filter((p) => p.vinculo === 'empresarial').length

  return (
    <>
      <FilterBar>
        <FilterChip active={filtro === 'todos'} onClick={() => setFiltro('todos')}>
          Todos ({data.processos.length})
        </FilterChip>
        <FilterChip active={filtro === 'pessoal'} onClick={() => setFiltro('pessoal')}>
          Vínculo pessoal ({totalPessoais})
        </FilterChip>
        <FilterChip active={filtro === 'empresarial'} onClick={() => setFiltro('empresarial')}>
          Vínculo empresarial ({totalEmpresariais})
        </FilterChip>
        {totalCriminais > 0 && (
          <FilterChip
            active={filtro === 'criminal'}
            onClick={() => setFiltro('criminal')}
            tone="blood"
          >
            ⚠ Criminais ({totalCriminais})
          </FilterChip>
        )}
        {tribunaisUnicos.length > 1 && (
          <label className="inline-flex items-center gap-2">
            <span className="ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>
              Tribunal:
            </span>
            <select
              value={tribunalFiltro}
              onChange={(e) => setTribunalFiltro(e.target.value)}
              className="ivy-meta"
              aria-label="Filtro por tribunal"
              style={{
                background: 'transparent',
                color: tribunalFiltro ? 'var(--color-ivy-olive)' : 'var(--color-ivy-mid)',
                border: '1px solid var(--color-ivy-tan)',
                padding: '5px 10px',
                fontSize: 11,
                letterSpacing: '0.15em',
                fontFamily: 'var(--font-body)',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              <option value="">Todos</option>
              {tribunaisUnicos.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
      </FilterBar>

      <section>
        <p className="ivy-meta mb-3" style={{ color: 'var(--color-ivy-mid)' }}>
          {filtered.length} processo{filtered.length === 1 ? '' : 's'}
          {filtered.length !== data.processos.length && ` (de ${data.processos.length})`}
        </p>
        <ProcessosTable rows={filtered.slice(0, 200)} />
        {filtered.length > 200 && (
          <p className="ivy-foot mt-4" style={{ color: 'var(--color-ivy-mid)' }}>
            (+{filtered.length - 200} processos omitidos do listing)
          </p>
        )}
      </section>

      {data.advogados.length > 0 && (
        <section className="mt-12">
          <p className="ivy-meta mb-3" style={{ color: 'var(--color-ivy-mid)' }}>
            Advogados identificados ({data.advogados.length})
          </p>
          <ul className="ivy-list" style={{ color: 'var(--color-ivy-near)', fontSize: 'clamp(13px,0.95vw,15px)' }}>
            {data.advogados.map((a) => (
              <li key={a.id}>
                {a.nome}
                {a.oab && (
                  <span className="ivy-foot ml-2" style={{ color: 'var(--color-ivy-mid)' }}>
                    OAB {a.oab}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

type ProcessoSortKey = 'numero' | 'tribunal' | 'orgao' | 'classe' | 'polo'

function ProcessosTable({ rows }: { rows: InvestigacaoFull['processos'] }) {
  const accessors: Record<ProcessoSortKey, (p: InvestigacaoFull['processos'][number]) => string | number | null> = {
    numero: (p) => p.numero,
    tribunal: (p) => p.tribunal,
    orgao: (p) => p.orgao,
    classe: (p) => p.classe,
    polo: (p) => p.polo,
  }
  const { sorted, sort, toggle } = useSortable(rows, accessors)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      {/* Desktop ≥md. */}
      <div className="hidden md:block">
        <table
          className="w-full text-left"
          style={{ borderCollapse: 'collapse', fontSize: 'clamp(13px,0.95vw,15px)' }}
        >
          <thead>
            <tr className="ivy-meta" style={{ color: 'var(--color-ivy-mid)', borderBottom: '1px solid var(--color-ivy-tan)' }}>
              <th style={{ padding: '12px 0', width: 32 }} aria-label="Expandir" />
              <SortableTh sortKey="numero" current={sort} onSort={toggle}>Número</SortableTh>
              <SortableTh sortKey="tribunal" current={sort} onSort={toggle}>Tribunal</SortableTh>
              <SortableTh sortKey="orgao" current={sort} onSort={toggle}>Órgão</SortableTh>
              <SortableTh sortKey="classe" current={sort} onSort={toggle}>Classe</SortableTh>
              <SortableTh sortKey="polo" current={sort} onSort={toggle}>Polo / Vínculo</SortableTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const hasComm = (p.comunicacoes?.length ?? 0) > 0
              const isOpen = expanded.has(p.id)
              return (
                <ProcessoRowDesktop
                  key={p.id}
                  p={p}
                  hasComm={hasComm}
                  isOpen={isOpen}
                  onToggle={() => hasComm && toggleRow(p.id)}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile <md: registros verticais (mesma ordem do desktop). */}
      <ul className="md:hidden flex flex-col" style={{ borderTop: '1px solid var(--color-ivy-tan)' }}>
        {sorted.map((p) => {
          const hasComm = (p.comunicacoes?.length ?? 0) > 0
          const isOpen = expanded.has(p.id)
          return (
            <ProcessoRowMobile
              key={p.id}
              p={p}
              hasComm={hasComm}
              isOpen={isOpen}
              onToggle={() => hasComm && toggleRow(p.id)}
            />
          )
        })}
      </ul>
    </>
  )
}

function ProcessoRowDesktop({
  p,
  hasComm,
  isOpen,
  onToggle,
}: {
  p: InvestigacaoFull['processos'][number]
  hasComm: boolean
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr style={{ borderBottom: isOpen ? 'none' : '1px solid var(--color-ivy-rule-subtle)' }}>
        <td style={{ padding: '8px 0', verticalAlign: 'top', width: 32 }}>
          {hasComm ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-label={isOpen ? 'Recolher comunicações' : 'Expandir comunicações'}
              className="ivy-foot"
              style={{
                background: 'transparent',
                border: 0,
                padding: 6,
                color: 'var(--color-ivy-olive)',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {isOpen ? '−' : '+'}
            </button>
          ) : null}
        </td>
        <Td mono>{p.numero}</Td>
        <Td>{p.tribunal ?? ''}</Td>
        <Td>{p.orgao ?? ''}</Td>
        <Td tone={p.criminal ? 'blood' : 'default'}>{p.classe ?? ''}</Td>
        <Td><VinculoCell processo={p} /></Td>
      </tr>
      {isOpen && hasComm && (
        <tr style={{ borderBottom: '1px solid var(--color-ivy-rule-subtle)' }}>
          <td />
          <td colSpan={5} style={{ padding: '0 14px 18px 14px' }}>
            <ComunicacoesList processo={p} />
          </td>
        </tr>
      )}
    </>
  )
}

function ProcessoRowMobile({
  p,
  hasComm,
  isOpen,
  onToggle,
}: {
  p: InvestigacaoFull['processos'][number]
  hasComm: boolean
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <li
      className="py-5"
      style={{ borderBottom: '1px solid var(--color-ivy-rule-subtle)' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="ivy-foot"
          style={{
            color: p.criminal ? 'var(--color-ivy-blood)' : 'var(--color-ivy-mid)',
            letterSpacing: '0.2em',
          }}
        >
          {p.criminal ? '⚠ criminal' : p.tribunal}
        </span>
        <span className="ivy-foot" style={{ color: 'var(--color-ivy-mid)', fontVariantNumeric: 'tabular-nums' }}>
          {p.numero}
        </span>
      </div>
      <p
        className="mt-2"
        style={{
          color: p.criminal ? 'var(--color-ivy-blood)' : 'var(--color-ivy-near)',
          fontWeight: 500,
          fontSize: 14,
          lineHeight: 1.3,
        }}
      >
        {p.classe ?? 'classe não informada'}
      </p>
      <p className="mt-1 ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>
        {[p.criminal ? p.tribunal : null, p.orgao].filter(Boolean).join(' · ')}
      </p>
      <div className="mt-2">
        <VinculoCell processo={p} />
      </div>
      {hasComm && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="ivy-foot mt-3 inline-block"
          style={{
            background: 'transparent',
            border: 0,
            color: 'var(--color-ivy-olive)',
            padding: '8px 0',
            cursor: 'pointer',
            letterSpacing: '0.2em',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          {isOpen ? '− Recolher comunicações' : `+ ${p.comunicacoes.length} comunicaç${p.comunicacoes.length === 1 ? 'ão' : 'ões'}`}
        </button>
      )}
      {isOpen && hasComm && (
        <div className="mt-3">
          <ComunicacoesList processo={p} />
        </div>
      )}
    </li>
  )
}

function ComunicacoesList({ processo }: { processo: InvestigacaoFull['processos'][number] }) {
  const items = processo.comunicacoes ?? []
  return (
    <ul
      className="flex flex-col gap-4 m-0"
      style={{
        borderLeft: '2px solid var(--color-ivy-rule-subtle)',
        paddingLeft: 16,
        listStyle: 'none',
      }}
    >
      {items.map((c, i) => (
        <li key={i}>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="ivy-foot" style={{ color: 'var(--color-ivy-olive)', letterSpacing: '0.25em' }}>
              {c.data ? new Date(c.data).toLocaleDateString('pt-BR') : 'sem data'}
            </span>
            {c.tipo && (
              <span className="ivy-foot" style={{ color: 'var(--color-ivy-mid)' }}>
                {c.tipo}
              </span>
            )}
            {c.link && (
              <a
                href={c.link}
                target="_blank"
                rel="noreferrer"
                className="ivy-foot"
                style={{ color: 'var(--color-ivy-olive)', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                Abrir no tribunal →
              </a>
            )}
          </div>
          {c.texto && (
            <p
              className="mt-1"
              style={{
                color: 'var(--color-ivy-near)',
                fontSize: 13,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
              }}
            >
              {c.texto}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Célula combinada de Polo + Vínculo.
 * Mostra o polo (A/P) quando o alvo é parte direta;
 * caso contrário, indica a natureza do vínculo (via empresa / via CPF no texto).
 */
function VinculoCell({ processo }: { processo: InvestigacaoFull['processos'][number] }) {
  const { polo, vinculo, empresa_vinculada } = processo

  if (polo === 'A' || polo === 'P') {
    const isAtivo = polo === 'A'
    return (
      <span
        className="ivy-foot inline-flex items-center gap-2"
        style={{
          color: isAtivo ? 'var(--color-ivy-olive)' : 'var(--color-ivy-blood)',
          letterSpacing: '0.2em',
        }}
        title={isAtivo ? 'Alvo no polo ativo (autor/requerente)' : 'Alvo no polo passivo (réu/requerido)'}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            background: 'currentColor',
            borderRadius: '50%',
          }}
        />
        Polo {isAtivo ? 'Ativo' : 'Passivo'}
      </span>
    )
  }

  if (vinculo === 'empresarial') {
    return (
      <span
        className="ivy-foot"
        style={{ color: 'var(--color-ivy-mid)', fontStyle: 'italic' }}
        title={
          empresa_vinculada
            ? `Alvo não é parte direta. Vínculo via empresa: ${empresa_vinculada}`
            : 'Alvo não é parte direta. Vínculo via empresa do alvo.'
        }
      >
        via empresa{empresa_vinculada ? ` (${truncStr(empresa_vinculada, 28)})` : ''}
      </span>
    )
  }

  if (vinculo === 'cpf') {
    return (
      <span
        className="ivy-foot"
        style={{ color: 'var(--color-ivy-mid)', fontStyle: 'italic' }}
        title="CPF do alvo encontrado no texto da comunicação"
      >
        via CPF no texto
      </span>
    )
  }

  return <span style={{ color: 'var(--color-ivy-mid)' }}>—</span>
}
