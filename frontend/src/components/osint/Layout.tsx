import { Link, NavLink, useNavigate } from 'react-router-dom'
import { clearSession, getUser } from '../../lib/osint'

type Props = {
  children: React.ReactNode
  protocol: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** CTA pequeno/chip que fica colado à direita do título (botão "Nova", badge de status). */
  rightSlot?: React.ReactNode
  /** Painel lateral de contexto. Em md+ fica alinhado ao topo paralelo ao título;
   *  no mobile empilha acima do main. Usado por Nova (fluxo) e Perfil (dados da conta). */
  aside?: React.ReactNode
}

const NAV_BASE: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/osint', label: 'Investigações', end: true },
  { to: '/osint/nova', label: 'Nova' },
]
const NAV_ADMIN: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/osint/admin/usuarios', label: 'Usuários' },
]

export function OsintLayout({ children, protocol, title, subtitle, rightSlot, aside }: Props) {
  const user = getUser()
  const nav = useNavigate()
  const items = user?.role === 'admin' ? [...NAV_BASE, ...NAV_ADMIN] : NAV_BASE

  function logout() {
    clearSession()
    nav('/osint/login', { replace: true })
  }

  return (
    <div className="ivy-paper-noise min-h-dvh" style={{ background: 'var(--color-ivy-paper)' }}>
      <header
        className="sticky top-0 z-30"
        style={{
          background: 'var(--color-ivy-paper)',
          borderBottom: '1px solid var(--color-ivy-tan)',
        }}
      >
        <div className="ivy-page py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-10">
            <Link
              to="/osint"
              className="ivy-display"
              style={{
                fontSize: 'clamp(16px, 1.2vw, 20px)',
                letterSpacing: '0.4em',
                color: 'var(--color-ivy-near)',
                textDecoration: 'none',
              }}
            >
              IVY · OSINT
            </Link>
            <nav className="flex items-center gap-7">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="ivy-meta"
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--color-ivy-olive)' : 'var(--color-ivy-mid)',
                    textDecoration: 'none',
                    padding: '12px 0',
                    borderBottom: `2px solid ${isActive ? 'var(--color-ivy-olive)' : 'transparent'}`,
                    transition: 'color 180ms var(--ease-ivy), border-color 180ms var(--ease-ivy)',
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-6 min-w-0">
            {user && (
              <Link
                to="/osint/perfil"
                className="ivy-meta hidden md:inline truncate"
                style={{
                  color: 'var(--color-ivy-mid)',
                  maxWidth: '28ch',
                  textDecoration: 'none',
                  padding: '12px 0',
                }}
                title={`Perfil — ${user.email}`}
              >
                {user.email}
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="ivy-meta"
              style={{
                color: 'var(--color-ivy-olive)',
                background: 'transparent',
                border: 0,
                padding: '12px 4px',
                cursor: 'pointer',
              }}
            >
              Encerrar sessão
            </button>
          </div>
        </div>
      </header>

      {/* Quando há `aside`, o título e a aside compartilham uma única grid de 12 col
          que se estende por TODO o conteúdo (header de página + main). A aside
          ocupa 4 col à direita, alinhada ao topo do título, descendo até o fim
          do main. No mobile, tudo empilha. */}
      {aside ? (
        <div className="ivy-page grid grid-cols-12 gap-x-6 pt-[clamp(48px,7vw,88px)] pb-[clamp(64px,8vw,120px)] items-start">
          <div className="col-span-12 md:col-span-8">
            <PageHeader protocol={protocol} title={title} subtitle={subtitle} rightSlot={rightSlot} />
            <hr className="ivy-rule-olive mt-[clamp(24px,3vw,40px)] mb-10" />
            <main>{children}</main>
          </div>
          <aside className="col-span-12 md:col-span-4 md:pl-10 md:border-l md:border-[color:var(--color-ivy-tan)]/40 order-first md:order-none">
            {aside}
          </aside>
        </div>
      ) : (
        <>
          <section>
            <div className="ivy-page pt-[clamp(48px,7vw,88px)] pb-[clamp(24px,3vw,40px)] grid grid-cols-12 gap-x-6 gap-y-6 items-end">
              <div className="col-span-12 md:col-span-8">
                <PageHeader protocol={protocol} title={title} subtitle={subtitle} />
              </div>
              {rightSlot && (
                <aside className="col-span-12 md:col-span-4 md:text-right flex md:justify-end items-end">
                  {rightSlot}
                </aside>
              )}
            </div>
          </section>
          <main>{children}</main>
        </>
      )}
    </div>
  )
}

function PageHeader({
  protocol,
  title,
  subtitle,
  rightSlot,
}: {
  protocol: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  rightSlot?: React.ReactNode
}) {
  return (
    <header>
      <div className="ivy-bar-blood">
        <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
          {protocol}
        </p>
        <h1
          className="ivy-display mt-4"
          style={{
            fontSize: 'clamp(32px, 5.6vw, 72px)',
            color: 'var(--color-ivy-near)',
            lineHeight: 0.98,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-5 max-w-[58ch]"
            style={{ color: 'var(--color-ivy-mid)', fontSize: 'clamp(14px,1vw,16px)', lineHeight: 1.6 }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {rightSlot && <div className="mt-6">{rightSlot}</div>}
    </header>
  )
}
