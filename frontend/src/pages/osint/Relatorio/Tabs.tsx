import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export type Tab = 'empresas' | 'processos' | 'timeline' | 'relatorio'

export const TAB_ITEMS: Array<{ id: Tab; label: string }> = [
  { id: 'empresas', label: 'Empresas' },
  { id: 'processos', label: 'Processos' },
  { id: 'timeline', label: 'Linha do tempo' },
  { id: 'relatorio', label: 'Relatório MD' },
]

export function tabId(t: Tab) {
  return `osint-tab-${t}`
}
export function panelId(t: Tab) {
  return `osint-panel-${t}`
}

export function Tabs({
  tab,
  onChange,
  counts,
}: {
  tab: Tab
  onChange: (t: Tab) => void
  counts: { empresas: number; processos: number }
}) {
  const tabsRef = useRef<HTMLDivElement>(null)
  const counters: Record<Tab, number | undefined> = {
    empresas: counts.empresas,
    processos: counts.processos,
    timeline: undefined,
    relatorio: undefined,
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const idx = TAB_ITEMS.findIndex((i) => i.id === tab)
    let next = idx
    if (e.key === 'ArrowLeft') next = (idx - 1 + TAB_ITEMS.length) % TAB_ITEMS.length
    else if (e.key === 'ArrowRight') next = (idx + 1) % TAB_ITEMS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TAB_ITEMS.length - 1
    const nextTab = TAB_ITEMS[next].id
    onChange(nextTab)
    requestAnimationFrame(() => {
      tabsRef.current?.querySelector<HTMLButtonElement>(`#${tabId(nextTab)}`)?.focus()
    })
  }

  return (
    <div
      ref={tabsRef}
      role="tablist"
      aria-label="Seções do dossiê"
      onKeyDown={onKey}
      className="flex gap-8 mb-8 overflow-x-auto"
      style={{ borderBottom: '1px solid var(--color-ivy-tan)' }}
    >
      {TAB_ITEMS.map((it) => {
        const active = tab === it.id
        const count = counters[it.id]
        return (
          <button
            key={it.id}
            id={tabId(it.id)}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={panelId(it.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.id)}
            className="ivy-meta"
            style={{
              background: 'transparent',
              border: 0,
              padding: '14px 4px',
              minHeight: 44,
              borderBottom: `2px solid ${active ? 'var(--color-ivy-olive)' : 'transparent'}`,
              color: active ? 'var(--color-ivy-olive)' : 'var(--color-ivy-mid)',
              cursor: 'pointer',
              letterSpacing: '0.3em',
              fontSize: 12,
              transition: 'color 180ms var(--ease-ivy), border-color 180ms var(--ease-ivy)',
              whiteSpace: 'nowrap',
            }}
          >
            {it.label}
            {typeof count === 'number' && (
              <span
                className="ml-2"
                aria-hidden
                style={{ color: 'var(--color-ivy-mid)', letterSpacing: '0.1em' }}
              >
                ({count})
              </span>
            )}
            {typeof count === 'number' && (
              <span className="sr-only">, {count} {count === 1 ? 'item' : 'itens'}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({
  id,
  labelledBy,
  hidden,
  children,
}: {
  id: string
  labelledBy: string
  hidden: boolean
  children: ReactNode
}) {
  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={labelledBy}
      tabIndex={0}
      hidden={hidden}
    >
      {children}
    </div>
  )
}

/**
 * Th clicável com indicador de ordenação. Acessível: aria-sort + botão dentro do th.
 */
export function SortableTh<K extends string>({
  children,
  sortKey,
  current,
  onSort,
  align,
}: {
  children: ReactNode
  sortKey: K
  current: { key: K; dir: 'asc' | 'desc' } | null
  onSort: (k: K) => void
  align?: 'right'
}) {
  const active = current?.key === sortKey
  const dir = active ? current?.dir : null
  const ariaSort: 'ascending' | 'descending' | 'none' =
    dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'

  return (
    <th
      aria-sort={ariaSort}
      style={{
        padding: 0,
        textAlign: align ?? 'left',
        fontWeight: 400,
      }}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="ivy-meta"
        style={{
          background: 'transparent',
          border: 0,
          color: active ? 'var(--color-ivy-olive)' : 'var(--color-ivy-mid)',
          padding: '12px 14px',
          textAlign: align ?? 'left',
          letterSpacing: 'inherit',
          fontSize: 'inherit',
          textTransform: 'inherit',
          fontFamily: 'inherit',
          cursor: 'pointer',
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          transition: 'color 180ms var(--ease-ivy)',
        }}
      >
        <span>{children}</span>
        <span aria-hidden style={{ fontSize: 10, lineHeight: 1, opacity: active ? 1 : 0.35 }}>
          {dir === 'desc' ? '↓' : '↑'}
        </span>
      </button>
    </th>
  )
}

/**
 * Pill clicável (chip de filtro). active = preenchido olive; inativo = outline tan.
 */
export function FilterChip({
  active,
  onClick,
  children,
  tone = 'default',
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  tone?: 'default' | 'blood'
}) {
  const bg = active ? (tone === 'blood' ? 'var(--color-ivy-blood)' : 'var(--color-ivy-olive)') : 'transparent'
  const fg = active ? 'var(--color-ivy-bone)' : tone === 'blood' ? 'var(--color-ivy-blood)' : 'var(--color-ivy-mid)'
  const border = active ? bg : tone === 'blood' ? 'var(--color-ivy-blood)' : 'var(--color-ivy-tan)'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="ivy-meta"
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        padding: '6px 12px',
        fontSize: 11,
        letterSpacing: '0.2em',
        cursor: 'pointer',
        transition: 'background 180ms var(--ease-ivy), color 180ms var(--ease-ivy)',
      }}
    >
      {children}
    </button>
  )
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 items-center">
      <span className="ivy-foot mr-2" style={{ color: 'var(--color-ivy-mid)' }}>Filtros:</span>
      {children}
    </div>
  )
}
