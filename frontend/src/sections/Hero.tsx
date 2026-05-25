/**
 * Headline options — descomente a versão escolhida. Default: A.
 *   A) "Recuperamos o que foi escondido."
 *   B) "Patrimônio oculto é localizável."
 *   C) "Onde a cobrança parou, começa a investigação."
 */
const HEADLINE = 'Recuperamos o que foi escondido.'

export function Hero() {
  return (
    <section
      id="hero"
      className="ivy-scanlines text-[color:var(--color-ivy-bone)] relative"
    >
      <div className="ivy-page pt-[clamp(88px,10vw,128px)] pb-[clamp(40px,6vw,72px)]">
        <div className="ivy-bar-blood max-w-[1100px]">
          <h1
            className="ivy-display text-[color:var(--color-ivy-bone)]"
            style={{ fontSize: 'clamp(56px, 14vw, 176px)' }}
          >
            IVY
          </h1>
          <p
            className="ivy-meta mt-2"
            style={{ color: 'var(--color-ivy-tan)' }}
          >
            Recuperação de Ativos
          </p>
          <h2
            className="mt-[clamp(20px,3vw,36px)] max-w-[20ch] ivy-display text-[color:var(--color-ivy-bone)]"
            style={{
              fontSize: 'clamp(28px,5.2vw,64px)',
              letterSpacing: '0.02em',
              lineHeight: 1.02,
            }}
          >
            {HEADLINE}
          </h2>
          <p
            className="mt-[clamp(14px,2vw,24px)] max-w-[58ch] text-[color:var(--color-ivy-bone)]"
            style={{ fontSize: 'clamp(16px,1.2vw,19px)', lineHeight: 1.6 }}
          >
            Inteligência de dados e operações de campo para localizar
            patrimônio oculto de devedores contumazes. Atuamos exatamente
            onde a cobrança convencional parou.
          </p>
          <div className="mt-[clamp(20px,3vw,36px)] flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="#contato"
              className="ivy-meta"
              style={{
                background: 'var(--color-ivy-olive)',
                color: 'var(--color-ivy-bone)',
                padding: '14px 22px',
                letterSpacing: '0.3em',
                fontSize: 12,
                display: 'inline-block',
              }}
            >
              Solicitar diagnóstico
            </a>
            <a
              href="#protocolo"
              className="ivy-meta"
              style={{
                border: '1px solid var(--color-ivy-tan)',
                color: 'var(--color-ivy-bone)',
                padding: '13px 22px',
                letterSpacing: '0.3em',
                fontSize: 12,
                display: 'inline-block',
              }}
            >
              Ler o briefing →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
