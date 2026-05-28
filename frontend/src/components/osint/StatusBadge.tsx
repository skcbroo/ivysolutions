type Status = 'pendente' | 'rodando' | 'concluido' | 'concluido_parcial' | 'erro'

type Props = {
  status: Status
  /** Quando o badge é exibido sozinho como anúncio (ex: status em destaque), torna a região live para leitores de tela. */
  live?: boolean
}

type Skin = {
  label: string
  background: string
  color: string
  border?: string
  /** Forma do glifo de status — redundância visual além da cor (a11y). */
  shape: 'dot' | 'pulse' | 'square' | 'tri'
}

const SKINS: Record<Status, Skin> = {
  pendente: {
    label: 'Pendente',
    background: 'transparent',
    color: 'var(--color-ivy-mid)',
    border: '1px solid var(--color-ivy-tan)',
    shape: 'dot',
  },
  rodando: {
    label: 'Rodando',
    background: 'var(--color-ivy-olive)',
    color: 'var(--color-ivy-bone)',
    shape: 'pulse',
  },
  concluido: {
    label: 'Concluído',
    background: 'transparent',
    color: 'var(--color-ivy-olive)',
    border: '1px solid var(--color-ivy-olive)',
    shape: 'square',
  },
  concluido_parcial: {
    label: 'Parcial',
    background: 'transparent',
    color: 'var(--color-ivy-blood)',
    border: '1px solid var(--color-ivy-blood)',
    shape: 'tri',
  },
  erro: {
    label: 'Erro',
    background: 'var(--color-ivy-blood)',
    color: 'var(--color-ivy-bone)',
    shape: 'tri',
  },
}

export function StatusBadge({ status, live = false }: Props) {
  const skin = SKINS[status] ?? SKINS.pendente
  return (
    <span
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      aria-label={`Status: ${skin.label}`}
      className="ivy-meta inline-flex items-center gap-2 whitespace-nowrap"
      style={{
        background: skin.background,
        color: skin.color,
        border: skin.border ?? '1px solid transparent',
        padding: '4px 10px',
        fontSize: 11,
        letterSpacing: '0.25em',
        lineHeight: 1,
      }}
    >
      <Glyph shape={skin.shape} color={skin.color} />
      {skin.label}
    </span>
  )
}

function Glyph({ shape, color }: { shape: Skin['shape']; color: string }) {
  if (shape === 'pulse') {
    return (
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          animation: 'osintPulse 1.4s ease-in-out infinite',
          flex: 'none',
        }}
      />
    )
  }
  if (shape === 'square') {
    return <span aria-hidden style={{ width: 8, height: 8, background: color, flex: 'none' }} />
  }
  if (shape === 'tri') {
    return (
      <span
        aria-hidden
        style={{
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderBottom: `8px solid ${color}`,
          flex: 'none',
        }}
      />
    )
  }
  // dot
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        border: `1.5px solid ${color}`,
        flex: 'none',
      }}
    />
  )
}
