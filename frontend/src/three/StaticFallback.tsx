/**
 * Fallback estático para usuários com prefers-reduced-motion ou GPU
 * indisponível. 4 quadros em SVG wireframe, mesmas 4 cenas.
 */
export function StaticFallback() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-0 h-full">
      <Frame title="01 PERDIDO">
        <rect
          x="20"
          y="60"
          width="60"
          height="22"
          fill="none"
          stroke="#5A6B55"
          strokeWidth="1"
        />
        <path
          d="M0 90 L100 90 M10 100 L90 100 M0 110 L100 110"
          stroke="#3D4A3A"
          strokeWidth="0.5"
          fill="none"
        />
      </Frame>
      <Frame title="02 MAPEADO">
        <g stroke="#5A6B55" strokeWidth="0.6" fill="none">
          <line x1="50" y1="50" x2="20" y2="30" />
          <line x1="50" y1="50" x2="80" y2="30" />
          <line x1="50" y1="50" x2="30" y2="80" />
          <line x1="50" y1="50" x2="75" y2="75" />
          <line x1="20" y1="30" x2="80" y2="30" />
        </g>
        <g fill="none" strokeWidth="0.8">
          <circle cx="50" cy="50" r="4" stroke="#5A6B55" />
          <circle cx="20" cy="30" r="3" stroke="#5A6B55" />
          <circle cx="80" cy="30" r="3" stroke="#8B1A1A" />
          <circle cx="30" cy="80" r="3" stroke="#5A6B55" />
          <circle cx="75" cy="75" r="3" stroke="#8B1A1A" />
        </g>
      </Frame>
      <Frame title="03 EXPOSTO">
        <g stroke="#5A6B55" strokeWidth="0.8" fill="none">
          <rect x="15" y="55" width="20" height="35" />
          <rect x="42" y="62" width="16" height="28" />
          <rect x="65" y="48" width="22" height="42" />
        </g>
      </Frame>
      <Frame title="04 RETORNADO">
        <g stroke="#5A6B55" strokeWidth="0.8" fill="none">
          <rect x="38" y="38" width="24" height="24" />
        </g>
        <g
          stroke="#5A6B55"
          strokeWidth="0.6"
          fill="none"
          markerEnd="url(#arrow)"
        >
          <line x1="15" y1="50" x2="35" y2="50" />
          <line x1="85" y1="50" x2="65" y2="50" />
          <line x1="50" y1="15" x2="50" y2="35" />
          <line x1="50" y1="85" x2="50" y2="65" />
        </g>
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L4,3 L0,6" stroke="#5A6B55" fill="none" strokeWidth="0.8" />
          </marker>
        </defs>
      </Frame>
    </div>
  )
}

function Frame({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="relative aspect-square md:aspect-auto md:h-full"
      style={{
        background: 'oklch(0.12 0.003 130)',
        borderRight: '1px solid oklch(0.72 0.03 80 / 0.2)',
      }}
    >
      <svg
        viewBox="0 0 100 120"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {children}
      </svg>
      <p
        className="ivy-meta absolute bottom-3 left-3"
        style={{ color: 'var(--color-ivy-tan)' }}
      >
        {title}
      </p>
    </div>
  )
}
