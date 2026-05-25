import { Suspense, lazy, useEffect, useState } from 'react'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { StaticFallback } from '../three/StaticFallback'

const MoneyScene = lazy(() =>
  import('../three/MoneyScene').then((m) => ({ default: m.MoneyScene })),
)

const PANELS = [
  {
    code: '01',
    title: 'Diagnóstico',
    body:
      'Auditoria sigilosa do acervo processual e da carteira. Mapeamento do passivo, identificação dos gargalos jurídicos e quantificação do potencial real de recuperação.',
    foot: 'Sem cobrança nesta etapa · 1 a 2 semanas',
  },
  {
    code: '02',
    title: 'Investigação',
    body:
      'Cruzamento de bases societárias, registrais e abertas. Mapeamento de grupos econômicos, sucessões irregulares e fluxos cruzados de pagamento. Localização de ativos ocultos e estruturas de blindagem.',
    foot: 'OSINT · Investigação patrimonial · 4 a 10 semanas',
  },
  {
    code: '03',
    title: 'Estratégia',
    body:
      'Entre vários caminhos processuais possíveis, fechamos um. Desconsideração, fraude à execução, sucessão irregular ou confusão patrimonial. Um plano, sem desvio. Nenhum ativo é movimentado antes do plano estar fechado com o cliente.',
    foot: 'Tese definida em conjunto com o jurídico do cliente · 1 a 3 semanas',
  },
  {
    code: '04',
    title: 'Execução',
    body:
      'Penhora, adjudicação, leilão judicial ou acordo estruturado. O ativo recuperado retorna ao credor.',
    foot: 'Primeira recuperação · 6 a 12 meses',
  },
] as const

export function MoneyJourney() {
  const { ref, progress } = useScrollProgress<HTMLDivElement>()
  const reducedMotion = usePrefersReducedMotion()
  const activeIdx = Math.min(3, Math.floor(progress * 4))

  return (
    <section id="protocolo">
      <div
        ref={ref}
        className="relative"
        style={{
          height: '500vh',
          background: 'var(--color-ivy-black)',
        }}
      >
        <div
          className="sticky top-0 w-full overflow-hidden ivy-scanlines"
          style={{ height: '100vh' }}
        >
          {!reducedMotion ? (
            <Suspense fallback={<StaticFallback />}>
              <MoneyScene progress={progress} />
            </Suspense>
          ) : (
            <StaticFallback />
          )}

          {/* HUD inferior — referência de progresso */}
          <div className="absolute bottom-6 left-0 right-0 px-[var(--page-gutter)] pointer-events-none">
            <div className="flex items-center gap-4 max-w-[1440px] mx-auto">
              <span
                className="ivy-meta"
                style={{ color: 'var(--color-ivy-tan)' }}
              >
                Jornada do Cliente
              </span>
              <div
                className="flex-1 h-px"
                style={{
                  background: 'oklch(0.72 0.03 80 / 0.3)',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '0 auto 0 0',
                    width: `${progress * 100}%`,
                    background: 'var(--color-ivy-olive)',
                    transition: 'width 80ms linear',
                  }}
                />
              </div>
              <span
                className="ivy-foot"
                style={{ color: 'var(--color-ivy-tan)' }}
              >
                {Math.round(progress * 100)
                  .toString()
                  .padStart(2, '0')}
                %
              </span>
            </div>
          </div>
        </div>

        {/* painéis sobrepostos — um por viewport */}
        <div className="absolute inset-0 pointer-events-none">
          {PANELS.map((p, i) => {
            const isActive = activeIdx === i
            const leftSide = i % 2 === 0
            return (
              <div
                key={p.code}
                className="ivy-page"
                style={{
                  position: 'absolute',
                  top: `${i * 125}vh`,
                  height: '100vh',
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <article
                  className="max-w-[44ch] pointer-events-auto"
                  style={{
                    marginLeft: leftSide ? 0 : 'auto',
                    textAlign: leftSide ? 'left' : 'right',
                    opacity: isActive ? 1 : 0.35,
                    transition: 'opacity 300ms var(--ease-ivy)',
                  }}
                >
                  <div
                    className="flex items-baseline gap-4"
                    style={{
                      justifyContent: leftSide ? 'flex-start' : 'flex-end',
                    }}
                  >
                    <span
                      className="ivy-display"
                      style={{
                        color: 'var(--color-ivy-tan)',
                        fontSize: 'clamp(32px,4vw,52px)',
                        lineHeight: 1,
                      }}
                    >
                      {p.code}
                    </span>
                    <h3
                      className="ivy-display"
                      style={{
                        color: 'var(--color-ivy-bone)',
                        fontSize: 'clamp(40px,7vw,80px)',
                        lineHeight: 1,
                      }}
                    >
                      {p.title}
                    </h3>
                  </div>
                  <hr
                    className="mt-5"
                    style={{
                      border: 0,
                      borderTop: '3px solid var(--color-ivy-olive)',
                      width: 'clamp(40px,5vw,72px)',
                      marginLeft: leftSide ? 0 : 'auto',
                      marginRight: leftSide ? 'auto' : 0,
                    }}
                  />
                  <p
                    className="mt-6"
                    style={{
                      color: 'oklch(0.86 0.018 88)',
                      fontSize: 'clamp(15px,1.2vw,18px)',
                      lineHeight: 1.65,
                    }}
                  >
                    {p.body}
                  </p>
                  <p
                    className="ivy-foot mt-5"
                    style={{ color: 'var(--color-ivy-tan)' }}
                  >
                    {p.foot}
                  </p>
                </article>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mql.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return reduced
}
