import type { Internacional, InvestigacaoFull } from '../../../lib/osint'

type FonteMeta = {
  label: string
  linkText: string
  programasLabel: string
  datasetsLabel: string
  /** ⚠ destaca match (ex.: sanção). No Companies House o match é só de nome. */
  flagMatch: boolean
}

const FONTES: Record<string, FonteMeta> = {
  opensanctions: {
    label: 'OpenSanctions',
    linkText: 'Ver no OpenSanctions →',
    programasLabel: 'Programas',
    datasetsLabel: 'Listas',
    flagMatch: true,
  },
  uk_companies: {
    label: 'UK Companies House',
    linkText: 'Ver no Companies House →',
    programasLabel: 'Cargos',
    datasetsLabel: 'Empresas',
    flagMatch: false,
  },
}

function fonteMeta(fonte: string): FonteMeta {
  return (
    FONTES[fonte] ?? {
      label: fonte,
      linkText: 'Ver detalhe →',
      programasLabel: 'Programas',
      datasetsLabel: 'Listas',
      flagMatch: false,
    }
  )
}

export function TabInternacional({ data }: { data: InvestigacaoFull }) {
  const hits = data.internacional ?? []

  if (hits.length === 0) {
    return (
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        Nenhum resultado em bases internacionais.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        {hits.length} resultado(s) em bases internacionais.
      </p>
      {hits.map((h, i) => (
        <HitCard key={`${h.fonte}-${i}`} hit={h} />
      ))}
    </div>
  )
}

function HitCard({ hit }: { hit: Internacional }) {
  const meta = fonteMeta(hit.fonte)
  const flag = meta.flagMatch && hit.match
  return (
    <div
      style={{
        border: `1px solid ${flag ? 'var(--color-ivy-blood)' : 'var(--color-ivy-tan)'}`,
        padding: '16px 18px',
      }}
    >
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)', letterSpacing: '0.2em', fontSize: 11 }}>
        {meta.label}
      </p>
      <div className="flex items-baseline justify-between gap-4 flex-wrap mt-1">
        <p
          className="ivy-display"
          style={{ fontSize: 'clamp(18px,1.4vw,22px)', color: 'var(--color-ivy-near)', lineHeight: 1.1 }}
        >
          {flag && (
            <span style={{ color: 'var(--color-ivy-blood)' }} aria-label="match de sanção">
              ⚠{' '}
            </span>
          )}
          {hit.entidade}
        </p>
        {typeof hit.score === 'number' && (
          <span
            className="ivy-meta"
            style={{ color: 'var(--color-ivy-mid)', fontVariantNumeric: 'tabular-nums' }}
          >
            score {hit.score.toFixed(2)}
          </span>
        )}
      </div>

      <dl className="mt-3 grid gap-y-2" style={{ gridTemplateColumns: 'max-content 1fr', columnGap: 16 }}>
        <Row label={meta.programasLabel} values={hit.programas} />
        <Row label="Países" values={hit.paises} />
        <Row label={meta.datasetsLabel} values={hit.datasets} />
        <Row label="Aliases" values={hit.aliases} />
      </dl>

      {hit.url && (
        <a
          href={hit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ivy-meta mt-3 inline-block"
          style={{ color: 'var(--color-ivy-olive)', letterSpacing: '0.2em', fontSize: 11 }}
        >
          {meta.linkText}
        </a>
      )}
    </div>
  )
}

function Row({ label, values }: { label: string; values: string[] }) {
  if (!values || values.length === 0) return null
  return (
    <>
      <dt
        className="ivy-meta"
        style={{ color: 'var(--color-ivy-mid)', fontSize: 11, letterSpacing: '0.2em' }}
      >
        {label}
      </dt>
      <dd style={{ color: 'var(--color-ivy-near)', fontSize: 14, overflowWrap: 'anywhere' }}>
        {values.join(', ')}
      </dd>
    </>
  )
}
