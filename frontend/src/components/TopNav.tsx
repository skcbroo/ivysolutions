import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { track } from '../lib/analytics'

type NavLink = { to: string; label: string; hash?: boolean }

const LINKS: NavLink[] = [
  { to: '/sobre', label: 'Sobre' },
  { to: '/#protocolo', label: 'Protocolo', hash: true },
  { to: '/#cases', label: 'Casos', hash: true },
]

const WHATSAPP_URL = `https://wa.me/5561995913312?text=${encodeURIComponent(
  'Olá, gostaria de falar com a IVY sobre uma operação de recuperação.',
)}`

export function TopNav() {
  const [solid, setSolid] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    function onScroll() {
      setSolid(window.scrollY > 80)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // se já estamos na rota /sobre por exemplo, links de hash precisam voltar
  // para "/" + hash; o react-router cuida disso porque o "to" começa com "/".
  const isHome = pathname === '/'

  return (
    <header
      className="fixed left-0 right-0 z-50"
      style={{
        top: 6,
        transition: 'background-color 220ms var(--ease-ivy), border-color 220ms',
        background: solid
          ? 'color-mix(in oklab, var(--color-ivy-black) 88%, transparent)'
          : 'transparent',
        backdropFilter: solid ? 'blur(8px) saturate(120%)' : 'none',
        WebkitBackdropFilter: solid ? 'blur(8px) saturate(120%)' : 'none',
        borderBottom: solid
          ? '1px solid oklch(0.72 0.03 80 / 0.18)'
          : '1px solid transparent',
      }}
    >
      <div className="ivy-page flex items-center justify-between h-[58px] md:h-[64px] relative">
        <Link
          to="/"
          aria-label="IVY · home"
          className="ivy-display relative z-10"
          style={{
            color: 'var(--color-ivy-bone)',
            fontSize: 'clamp(18px, 1.4vw, 22px)',
            letterSpacing: '0.4em',
            lineHeight: 1,
            textDecoration: 'none',
          }}
        >
          IVY
        </Link>

        <nav
          className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2"
          aria-label="Navegação principal"
        >
          {LINKS.map((l) => {
            // se for âncora e estamos na home, usa anchor normal (scroll suave),
            // senão usa Link do react-router para navegar com o hash.
            if (l.hash && isHome) {
              return (
                <a
                  key={l.to}
                  href={l.to.replace('/', '')}
                  className="ivy-meta"
                  style={navLinkStyle}
                >
                  {l.label}
                </a>
              )
            }
            return (
              <Link
                key={l.to}
                to={l.to}
                className="ivy-meta"
                style={{ ...navLinkStyle, textDecoration: 'none' }}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { location: 'topnav' })}
            aria-label="Falar com a IVY no WhatsApp"
            className="ivy-meta inline-flex items-center gap-2"
            style={whatsStyle}
          >
            <WhatsappGlyph />
            <span className="hidden md:inline">WhatsApp</span>
          </a>
          {isHome ? (
            <a href="#contato" className="ivy-meta" style={ctaStyle}>
              Diagnóstico
            </a>
          ) : (
            <Link
              to="/#contato"
              className="ivy-meta"
              style={{ ...ctaStyle, textDecoration: 'none' }}
            >
              Diagnóstico
            </Link>
          )}
        </div>
      </div>
    </header>
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
      <path
        d="M3 21l1.6-5A8.5 8.5 0 1 1 8 19.4L3 21z"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.5c.4-.3.8-.3 1 .1l.6 1.2c.1.3.1.5-.1.7l-.5.5c.6 1.2 1.6 2.2 2.8 2.8l.5-.5c.2-.2.4-.2.7-.1l1.2.6c.4.2.4.6.1 1-.8 1-2 1.3-3.2.7-1.7-.8-3-2.1-3.8-3.8-.6-1.2-.3-2.4.7-3.2z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

const navLinkStyle: React.CSSProperties = {
  color: 'var(--color-ivy-bone)',
  opacity: 0.78,
  fontSize: 11,
  letterSpacing: '0.28em',
}

const ctaStyle: React.CSSProperties = {
  background: 'var(--color-ivy-olive)',
  color: 'var(--color-ivy-bone)',
  padding: '10px 16px',
  letterSpacing: '0.25em',
  fontSize: 11,
  display: 'inline-block',
}

const whatsStyle: React.CSSProperties = {
  border: '1px solid oklch(0.72 0.03 80 / 0.6)',
  color: 'var(--color-ivy-bone)',
  padding: '9px 14px',
  letterSpacing: '0.25em',
  fontSize: 11,
  textDecoration: 'none',
}
