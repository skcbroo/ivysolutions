import type { InvestigacaoFull } from '../../../lib/osint'

export function RunningPanel({
  progresso,
}: {
  progresso: InvestigacaoFull['progresso'] | undefined
}) {
  const atual = progresso?.atual ?? 0
  const total = Math.max(progresso?.total ?? 1, 1)
  const pct = Math.min(100, Math.round((atual / total) * 100))
  const bloco = progresso?.bloco_atual === 'block1' ? 'Etapa 1 · Sociedades' : 'Etapa 2 · Processos'
  const etapa = progresso?.etapa ?? 'Preparando consultas'
  const eta = formatEta(progresso?.eta_ms)

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label={`Em execução, ${pct}% concluído${eta ? `, ${eta} restantes` : ''}, ${etapa}`}
      className="mb-10 p-6 border"
      style={{
        borderColor: 'var(--color-ivy-olive)',
        background: 'var(--color-ivy-paper-soft)',
      }}
    >
      <div className="flex items-baseline justify-between gap-6 flex-wrap">
        <div>
          <p className="ivy-meta" style={{ color: 'var(--color-ivy-olive)' }}>
            Em execução · {bloco}
          </p>
          <p
            className="ivy-display mt-2"
            style={{ fontSize: 'clamp(20px,2vw,28px)', color: 'var(--color-ivy-near)', lineHeight: 1.1 }}
          >
            {etapa}
          </p>
        </div>
        <div className="text-right">
          <p
            className="ivy-display"
            style={{ fontSize: 'clamp(40px,4vw,56px)', color: 'var(--color-ivy-olive)', lineHeight: 1 }}
          >
            {pct}%
          </p>
          {eta && (
            <p className="ivy-foot mt-2" style={{ color: 'var(--color-ivy-mid)' }}>
              ~{eta} restantes
            </p>
          )}
        </div>
      </div>
      <div
        className="mt-5"
        style={{
          background: 'var(--color-ivy-track)',
          height: 6,
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'var(--color-ivy-olive)',
            height: '100%',
            width: '100%',
            transformOrigin: 'left center',
            transform: `scaleX(${pct / 100})`,
            transition: 'transform 500ms var(--ease-ivy)',
          }}
        />
      </div>
      <p className="ivy-foot mt-2" style={{ color: 'var(--color-ivy-mid)' }}>
        {atual} de {total} consultas concluídas
      </p>
    </div>
  )
}

function formatEta(ms: number | null | undefined): string | null {
  if (!ms || ms < 0) return null
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m < 60) return r > 0 ? `${m}min ${r}s` : `${m}min`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}min`
}
