import { useState } from 'react'
import type { Sancao } from '../../../lib/osint'

/**
 * Flag de risco internacional (sanções/PEP do OpenSanctions) no topo do dossiê.
 * É o insight de maior impacto — fica visível, não escondido numa aba.
 */
export function SancoesFlag({ sancoes }: { sancoes: Sancao[] }) {
  const [open, setOpen] = useState(false)
  if (sancoes.length === 0) return null

  const listas = [...new Set(sancoes.flatMap((s) => s.listas))].slice(0, 6)

  return (
    <div
      role="alert"
      className="mb-10"
      style={{
        border: '1px solid var(--color-ivy-blood)',
        background: 'oklch(0.36 0.135 28 / 0.06)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left p-6"
        style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
      >
        <p className="ivy-meta" style={{ color: 'var(--color-ivy-blood)' }}>
          ⚠ Risco internacional — sanções / PEP
        </p>
        <p className="mt-2" style={{ color: 'var(--color-ivy-near)', fontSize: 'clamp(15px,1.1vw,17px)', lineHeight: 1.5 }}>
          Alvo consta em <strong>{sancoes.length}</strong> registro(s) de bases internacionais
          {listas.length > 0 && (
            <span style={{ color: 'var(--color-ivy-mid)' }}> · {listas.join(', ')}{sancoes.length > listas.length ? '…' : ''}</span>
          )}
        </p>
        <p className="ivy-foot mt-2" style={{ color: 'var(--color-ivy-mid)' }}>
          {open ? 'Ocultar detalhes ▲' : 'Ver detalhes ▼'}
        </p>
      </button>

      {open && (
        <div className="px-6 pb-6 flex flex-col gap-5" style={{ borderTop: '1px solid var(--color-ivy-blood)' }}>
          {sancoes.map((s, i) => (
            <div key={i} className="pt-5">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <p className="ivy-display" style={{ fontSize: 'clamp(16px,1.3vw,20px)', color: 'var(--color-ivy-near)', lineHeight: 1.1 }}>
                  {s.entidade}
                </p>
                {typeof s.score === 'number' && (
                  <span className="ivy-meta" style={{ color: 'var(--color-ivy-mid)', fontVariantNumeric: 'tabular-nums' }}>
                    score {s.score.toFixed(2)}
                  </span>
                )}
              </div>
              <dl className="mt-2 grid gap-y-1" style={{ gridTemplateColumns: 'max-content 1fr', columnGap: 16 }}>
                <Row label="Programas" values={s.programas} />
                <Row label="Países" values={s.paises} />
                <Row label="Listas" values={s.listas} />
                <Row label="Aliases" values={s.aliases} />
              </dl>
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ivy-foot mt-2 inline-block"
                  style={{ color: 'var(--color-ivy-olive)', textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  Ver no OpenSanctions →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ label, values }: { label: string; values: string[] }) {
  if (!values || values.length === 0) return null
  return (
    <>
      <dt className="ivy-foot" style={{ color: 'var(--color-ivy-mid)', letterSpacing: '0.2em' }}>
        {label}
      </dt>
      <dd style={{ color: 'var(--color-ivy-near)', fontSize: 14, overflowWrap: 'anywhere' }}>
        {values.join(', ')}
      </dd>
    </>
  )
}
