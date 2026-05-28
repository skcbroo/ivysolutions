import type { EstadoBloco } from './estadoBlocos'

/**
 * Estado-vazio padronizado de uma seção: distingue "não solicitado" (fora do
 * escopo), "falhou" e "processando" do "rodou e nada encontrado" (`vazioTexto`).
 */
export function EstadoVazio({ estado, vazioTexto }: { estado: EstadoBloco; vazioTexto: string }) {
  const map: Record<EstadoBloco['tipo'], { titulo: string; sub?: string; blood?: boolean }> = {
    ok: { titulo: '' },
    vazio: { titulo: vazioTexto },
    nao_solicitado: {
      titulo: 'Não solicitado',
      sub: 'Este bloco ficou fora do escopo escolhido para esta investigação.',
    },
    falhou: {
      titulo: 'Falhou',
      sub: 'A busca deste bloco falhou — veja as falhas no topo do dossiê.',
      blood: true,
    },
    processando: { titulo: 'Processando…', sub: 'A investigação ainda está em andamento.' },
  }
  const s = map[estado.tipo]
  return (
    <div className="py-2">
      <p
        className="ivy-meta"
        style={{ color: s.blood ? 'var(--color-ivy-blood)' : 'var(--color-ivy-mid)' }}
      >
        {s.titulo}
      </p>
      {s.sub && (
        <p className="mt-2" style={{ color: 'var(--color-ivy-mid)', fontSize: 14, lineHeight: 1.5, maxWidth: '48ch' }}>
          {s.sub}
        </p>
      )}
    </div>
  )
}

export function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      style={{
        padding: '12px 14px',
        textAlign: align ?? 'left',
        fontWeight: 400,
      }}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align,
  bold,
  mono,
  tone,
}: {
  children: React.ReactNode
  align?: 'right'
  bold?: boolean
  mono?: boolean
  tone?: 'blood' | 'ok' | 'mid' | 'default'
}) {
  const color =
    tone === 'blood'
      ? 'var(--color-ivy-blood)'
      : tone === 'ok'
      ? 'var(--color-ivy-olive)'
      : tone === 'mid'
      ? 'var(--color-ivy-mid)'
      : 'var(--color-ivy-near)'
  return (
    <td
      style={{
        padding: '14px',
        textAlign: align ?? 'left',
        verticalAlign: 'top',
        fontWeight: bold ? 600 : 400,
        fontVariantNumeric: mono ? 'tabular-nums' : undefined,
        color,
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </td>
  )
}
