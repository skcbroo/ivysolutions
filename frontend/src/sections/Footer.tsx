const PHONE_DISPLAY = '+55 61 8301-5739'
const PHONE_TEL = '+556183015739'
const WHATSAPP_URL = `https://wa.me/556183015739?text=${encodeURIComponent(
  'Olá, gostaria de falar com a IVY sobre uma operação de recuperação.',
)}`

export function Footer() {
  return (
    <footer
      style={{
        background: 'var(--color-ivy-olive)',
        color: 'var(--color-ivy-bone)',
      }}
    >
      <div className="ivy-page py-12 grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6">
          <p
            className="ivy-display"
            style={{
              color: 'var(--color-ivy-bone)',
              fontSize: 'clamp(40px,6vw,72px)',
              letterSpacing: '0.4em',
            }}
          >
            IVY
          </p>
          <p
            className="ivy-foot mt-2"
            style={{ color: 'var(--color-ivy-tan)' }}
          >
            Recuperação de ativos · Sigilo institucional
          </p>

          <div className="mt-8 flex flex-col gap-2">
            <p
              className="ivy-meta"
              style={{ color: 'var(--color-ivy-tan)' }}
            >
              Contato direto
            </p>
            <a
              href={`tel:${PHONE_TEL}`}
              className="ivy-display"
              style={{
                color: 'var(--color-ivy-bone)',
                fontSize: 'clamp(20px,2vw,28px)',
                letterSpacing: '0.04em',
                textDecoration: 'none',
              }}
            >
              {PHONE_DISPLAY}
            </a>
          </div>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ivy-meta inline-flex items-center gap-3 mt-6"
            style={{
              border: '1px solid var(--color-ivy-bone)',
              color: 'var(--color-ivy-bone)',
              padding: '12px 20px',
              letterSpacing: '0.28em',
              fontSize: 11,
              textDecoration: 'none',
            }}
          >
            <WhatsappGlyph />
            Fale conosco
          </a>
        </div>

        <nav
          className="col-span-12 md:col-span-6 md:text-right"
          aria-label="Navegação do rodapé"
        >
          <ul className="space-y-2">
            <FootLink href="/sobre">Sobre a IVY</FootLink>
            <FootLink href="/#protocolo">Protocolo operacional</FootLink>
            <FootLink href="/#cases">Casos encerrados</FootLink>
            <FootLink href="/#contato">Briefing de entrada</FootLink>
          </ul>
        </nav>
      </div>
      <div
        className="ivy-page pt-6 pb-10 flex items-baseline justify-between gap-6 flex-wrap"
        style={{
          borderTop: '1px solid oklch(0.72 0.03 80 / 0.35)',
        }}
      >
        <p
          className="ivy-foot"
          style={{ color: 'var(--color-ivy-tan)' }}
        >
          © 2026 IVY
        </p>
        <a
          href="/osint"
          className="ivy-foot"
          style={{
            color: 'var(--color-ivy-tan)',
            textDecoration: 'none',
            opacity: 0.7,
            letterSpacing: '0.25em',
            transition: 'opacity 180ms var(--ease-ivy)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.7'
          }}
          title="Acesso restrito a analistas"
        >
          Acesso operacional →
        </a>
      </div>
    </footer>
  )
}

function FootLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <li>
      <a
        href={href}
        className="ivy-meta"
        style={{ color: 'var(--color-ivy-bone)' }}
      >
        {children}
      </a>
    </li>
  )
}

function WhatsappGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 21l1.6-5A8.5 8.5 0 1 1 8 19.4L3 21z" strokeLinejoin="round" />
      <path
        d="M9 8.5c.4-.3.8-.3 1 .1l.6 1.2c.1.3.1.5-.1.7l-.5.5c.6 1.2 1.6 2.2 2.8 2.8l.5-.5c.2-.2.4-.2.7-.1l1.2.6c.4.2.4.6.1 1-.8 1-2 1.3-3.2.7-1.7-.8-3-2.1-3.8-3.8-.6-1.2-.3-2.4.7-3.2z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}
