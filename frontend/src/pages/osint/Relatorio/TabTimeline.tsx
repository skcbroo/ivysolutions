import { useMemo, useState } from 'react'
import type { InvestigacaoFull } from '../../../lib/osint'
import { formatBRL, formatCnpj } from './format'
import { FilterBar, FilterChip } from './Tabs'

/* ───────────────────────── Linha do tempo ───────────────────────────── */

type TimelineEvent = {
  date: string // 'YYYY-MM-DD' (para processos sem dia, usamos YYYY-12-31 pra ir no fim do ano)
  year: string
  type: 'empresa_abertura' | 'socio_entrada' | 'empresa_situacao' | 'processo' | 'comunicacao'
  title: string
  description?: string
  tone: 'olive' | 'mid' | 'blood'
  link?: string | null
  empresa?: string
}

type TimelineFilter = 'todos' | 'empresas' | 'processos' | 'criticos'

export function TabTimeline({ data }: { data: InvestigacaoFull }) {
  const [filter, setFilter] = useState<TimelineFilter>('todos')

  const events = useMemo(() => extractTimelineEvents(data), [data])

  const filtered = useMemo(() => {
    if (filter === 'todos') return events
    if (filter === 'empresas') {
      return events.filter((e) =>
        e.type === 'empresa_abertura' || e.type === 'socio_entrada' || e.type === 'empresa_situacao',
      )
    }
    if (filter === 'processos') {
      return events.filter((e) => e.type === 'processo' || e.type === 'comunicacao')
    }
    // criticos: situação INAPTA/FALIDA, criminais, comunicações
    return events.filter((e) => e.tone === 'blood' || e.type === 'comunicacao')
  }, [events, filter])

  // Agrupa por ano
  const byYear = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>()
    for (const e of filtered) {
      if (!map.has(e.year)) map.set(e.year, [])
      map.get(e.year)!.push(e)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  if (events.length === 0) {
    return (
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        Sem eventos datados para construir a linha do tempo.
      </p>
    )
  }

  const totEmpresas = events.filter((e) => e.type !== 'processo' && e.type !== 'comunicacao').length
  const totProcessos = events.filter((e) => e.type === 'processo' || e.type === 'comunicacao').length
  const totCriticos = events.filter((e) => e.tone === 'blood' || e.type === 'comunicacao').length

  return (
    <>
      <FilterBar>
        <FilterChip active={filter === 'todos'} onClick={() => setFilter('todos')}>
          Todos ({events.length})
        </FilterChip>
        <FilterChip active={filter === 'empresas'} onClick={() => setFilter('empresas')}>
          Sociedades ({totEmpresas})
        </FilterChip>
        <FilterChip active={filter === 'processos'} onClick={() => setFilter('processos')}>
          Processos ({totProcessos})
        </FilterChip>
        {totCriticos > 0 && (
          <FilterChip
            active={filter === 'criticos'}
            onClick={() => setFilter('criticos')}
            tone="blood"
          >
            ⚠ Críticos ({totCriticos})
          </FilterChip>
        )}
      </FilterBar>

      <p className="ivy-meta mb-6" style={{ color: 'var(--color-ivy-mid)' }}>
        {filtered.length} evento{filtered.length === 1 ? '' : 's'} ordenados do mais recente
      </p>

      <ol className="flex flex-col gap-12 m-0 p-0">
        {byYear.map(([year, items]) => (
          <YearBlock key={year} year={year} events={items} />
        ))}
      </ol>
    </>
  )
}

function YearBlock({ year, events }: { year: string; events: TimelineEvent[] }) {
  return (
    <li className="grid grid-cols-12 gap-x-6" style={{ listStyle: 'none' }}>
      <div className="col-span-12 md:col-span-2">
        <p
          className="ivy-display sticky md:top-24"
          style={{
            fontSize: 'clamp(40px,5vw,72px)',
            color: 'var(--color-ivy-olive)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {year}
        </p>
        <p className="ivy-foot mt-2" style={{ color: 'var(--color-ivy-mid)' }}>
          {events.length} evento{events.length === 1 ? '' : 's'}
        </p>
      </div>
      <ul
        className="col-span-12 md:col-span-10 flex flex-col"
        style={{ borderLeft: '1px solid var(--color-ivy-rule-subtle)', listStyle: 'none', margin: 0, padding: 0 }}
      >
        {events.map((e, i) => (
          <TimelineRow key={`${year}-${i}`} ev={e} />
        ))}
      </ul>
    </li>
  )
}

function TimelineRow({ ev }: { ev: TimelineEvent }) {
  const color =
    ev.tone === 'blood' ? 'var(--color-ivy-blood)'
    : ev.tone === 'olive' ? 'var(--color-ivy-olive)'
    : 'var(--color-ivy-mid)'

  return (
    <li
      className="relative pl-8 py-4"
      style={{
        borderBottom: '1px solid var(--color-ivy-rule-subtle)',
      }}
    >
      {/* marcador na linha */}
      <span
        aria-hidden
        className="absolute"
        style={{
          left: -5,
          top: 22,
          width: 9,
          height: 9,
          background: color,
          borderRadius: ev.type === 'processo' ? 0 : ev.type === 'comunicacao' ? '50%' : 0,
          transform: ev.type === 'empresa_situacao' ? 'rotate(45deg)' : 'none',
        }}
      />
      <p
        className="ivy-foot"
        style={{ color, letterSpacing: '0.25em' }}
      >
        {ev.date && /^\d{4}-\d{2}-\d{2}/.test(ev.date)
          ? new Date(ev.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : ev.year}
        {' · '}
        <span style={{ color: 'var(--color-ivy-mid)' }}>{labelFor(ev.type)}</span>
      </p>
      <p
        className="mt-2"
        style={{
          color: 'var(--color-ivy-near)',
          fontSize: 'clamp(14px,1vw,16px)',
          lineHeight: 1.35,
          fontWeight: 500,
        }}
      >
        {ev.title}
      </p>
      {ev.description && (
        <p
          className="mt-1 ivy-foot"
          style={{ color: 'var(--color-ivy-mid)' }}
        >
          {ev.description}
        </p>
      )}
      {ev.link && (
        <a
          href={ev.link}
          target="_blank"
          rel="noreferrer"
          className="ivy-foot mt-1 inline-block"
          style={{
            color: 'var(--color-ivy-olive)',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Abrir no tribunal →
        </a>
      )}
    </li>
  )
}

function labelFor(t: TimelineEvent['type']): string {
  switch (t) {
    case 'empresa_abertura': return 'Constituição de empresa'
    case 'socio_entrada': return 'Entrada como sócio'
    case 'empresa_situacao': return 'Mudança de situação'
    case 'processo': return 'Processo distribuído'
    case 'comunicacao': return 'Comunicação processual'
  }
}

function extractTimelineEvents(data: InvestigacaoFull): TimelineEvent[] {
  const out: TimelineEvent[] = []

  // ── Eventos das empresas ────────────────────────────────────────────
  for (const e of data.empresas) {
    if (e.abertura) {
      const d = isoDate(e.abertura)
      if (d) {
        out.push({
          date: d,
          year: d.slice(0, 4),
          type: 'empresa_abertura',
          title: `Empresa constituída: ${e.nome ?? formatCnpj(e.cnpj14)}`,
          description: [
            e.capital != null ? `Capital ${formatBRL(e.capital)}` : null,
            e.natureza ?? null,
          ].filter(Boolean).join(' · ') || undefined,
          tone: 'olive',
          empresa: e.nome ?? undefined,
        })
      }
    }
    if (e.data_entrada) {
      const d = isoDate(e.data_entrada)
      if (d) {
        out.push({
          date: d,
          year: d.slice(0, 4),
          type: 'socio_entrada',
          title: `Entrou como ${e.cargo ?? 'sócio'} em ${e.nome ?? formatCnpj(e.cnpj14)}`,
          description: e.capital != null ? `Capital da empresa: ${formatBRL(e.capital)}` : undefined,
          tone: 'olive',
          empresa: e.nome ?? undefined,
        })
      }
    }
    if (e.data_situacao && e.situacao && !/ATIVA/i.test(e.situacao)) {
      const d = isoDate(e.data_situacao)
      if (d) {
        out.push({
          date: d,
          year: d.slice(0, 4),
          type: 'empresa_situacao',
          title: `${e.nome ?? formatCnpj(e.cnpj14)} → ${e.situacao}`,
          tone: 'blood',
          empresa: e.nome ?? undefined,
        })
      }
    }
  }

  // ── Processos: distribuição (ano extraído do número CNJ) ─────────────
  // Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
  const cnjYearRx = /\d{7}-\d{2}\.(\d{4})\.\d\.\d{2}\.\d{4}/
  for (const p of data.processos) {
    const m = cnjYearRx.exec(p.numero)
    if (m) {
      const year = m[1]
      out.push({
        date: `${year}-12-31`,
        year,
        type: 'processo',
        title: `${p.criminal ? '⚠ Processo criminal' : 'Processo'} ${p.numero}`,
        description: [p.tribunal, p.classe, p.polo ? `polo ${p.polo}` : null]
          .filter(Boolean)
          .join(' · ') || undefined,
        tone: p.criminal ? 'blood' : 'mid',
        link: p.link ?? null,
      })
    }
    // Comunicação mais recente (se houver)
    const ult = p.comunicacoes?.[0]
    if (ult?.data) {
      const d = isoDate(ult.data)
      if (d) {
        out.push({
          date: d,
          year: d.slice(0, 4),
          type: 'comunicacao',
          title: ult.tipo ?? 'Comunicação processual',
          description: [
            p.numero,
            ult.texto ? truncate(stripNoise(ult.texto), 180) : null,
          ].filter(Boolean).join(' — ') || undefined,
          tone: p.criminal ? 'blood' : 'mid',
          link: ult.link ?? p.link ?? null,
        })
      }
    }
  }

  // Mais recente primeiro
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

function isoDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m1 = /^(\d{4}-\d{2}-\d{2})/.exec(raw)
  if (m1) return m1[1]
  const m2 = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw)
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`
  return null
}

function stripNoise(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
