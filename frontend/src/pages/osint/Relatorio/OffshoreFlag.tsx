import { useState } from 'react'
import type { VinculoOffshore } from '../../../lib/osint'

const datasetLabel = (slug: string) =>
  slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

/**
 * Flag de vínculos offshore (ICIJ Offshore Leaks). Mesmo tratamento de risco do
 * SancoesFlag: visível no topo, expansível.
 */
export function OffshoreFlag({ offshore }: { offshore: VinculoOffshore[] }) {
  const [open, setOpen] = useState(false)
  if (offshore.length === 0) return null

  const datasets = [...new Set(offshore.map((o) => datasetLabel(o.dataset)))].slice(0, 6)

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
          ⚠ Vínculos offshore — ICIJ Offshore Leaks
        </p>
        <p className="mt-2" style={{ color: 'var(--color-ivy-near)', fontSize: 'clamp(15px,1.1vw,17px)', lineHeight: 1.5 }}>
          Alvo aparece em <strong>{offshore.length}</strong> registro(s) de vazamentos offshore
          {datasets.length > 0 && (
            <span style={{ color: 'var(--color-ivy-mid)' }}> · {datasets.join(', ')}</span>
          )}
        </p>
        <p className="ivy-foot mt-2" style={{ color: 'var(--color-ivy-mid)' }}>
          {open ? 'Ocultar detalhes ▲' : 'Ver detalhes ▼'}
        </p>
      </button>

      {open && (
        <div className="px-6 pb-6 flex flex-col gap-5" style={{ borderTop: '1px solid var(--color-ivy-blood)' }}>
          {offshore.map((o, i) => (
            <div key={i} className="pt-5">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <p className="ivy-display" style={{ fontSize: 'clamp(16px,1.3vw,20px)', color: 'var(--color-ivy-near)', lineHeight: 1.1 }}>
                  {o.entidade}
                </p>
                <span className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
                  {datasetLabel(o.dataset)}
                </span>
              </div>
              <dl className="mt-2 grid gap-y-1" style={{ gridTemplateColumns: 'max-content 1fr', columnGap: 16 }}>
                {o.tipo && (
                  <>
                    <dt className="ivy-foot" style={{ color: 'var(--color-ivy-mid)', letterSpacing: '0.2em' }}>
                      Tipo
                    </dt>
                    <dd style={{ color: 'var(--color-ivy-near)', fontSize: 14 }}>{o.tipo}</dd>
                  </>
                )}
              </dl>
              {(o.conexoes ?? []).length > 0 && (
                <div className="mt-3 pl-4" style={{ borderLeft: '1px solid var(--color-ivy-blood)' }}>
                  <p className="ivy-foot" style={{ color: 'var(--color-ivy-mid)', letterSpacing: '0.2em', marginBottom: 6 }}>
                    Conexões no grafo ({o.conexoes.length})
                  </p>
                  <div className="flex flex-col gap-3">
                    {o.conexoes.map((c, j) => (
                      <div key={j}>
                        <p style={{ color: 'var(--color-ivy-near)', fontSize: 14, fontWeight: 500 }}>
                          {c.categoria && (
                            <span className="ivy-foot" style={{ color: 'var(--color-ivy-mid)', marginRight: 6 }}>
                              {c.categoria}
                            </span>
                          )}
                          {c.nome}
                        </p>
                        <p className="ivy-foot mt-0.5" style={{ color: 'var(--color-ivy-mid)' }}>
                          {[
                            c.jurisdicao && `jurisdição ${c.jurisdicao}`,
                            c.status && `status ${c.status}`,
                            c.incorporacao && `incorp. ${c.incorporacao}`,
                            c.endereco,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {o.url && (
                <a
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ivy-foot mt-2 inline-block"
                  style={{ color: 'var(--color-ivy-olive)', textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  Ver no ICIJ →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
