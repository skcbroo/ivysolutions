import type { InvestigacaoFull } from '../../../lib/osint'
import { formatBRL } from './format'
import { estadoEmpresas, estadoProcessos, rotuloEstado, type EstadoBloco } from './estadoBlocos'

/**
 * Faixa de "dado de protocolo" do dossiê. Listamento semântico denso, à maneira
 * de cabeçalho de relatório institucional. Distingue "não rodado" (fora do
 * escopo / falhou) de "rodou e achou 0".
 */
export function DossieProtocolo({ data }: { data: InvestigacaoFull }) {
  const empresas = estadoEmpresas(data)
  const processos = estadoProcessos(data)
  const criminaisN = data.processos.filter((p) => p.criminal).length

  return (
    <dl className="flex flex-wrap items-baseline gap-x-12 md:gap-x-16 gap-y-8 mb-8">
      <Datum label="Empresas mapeadas" estado={empresas} value={data.empresas.length} />
      <Datum
        label="Capital declarado"
        estado={empresas}
        valueText={empresas.tipo === 'ok' ? formatBRL(data.capital_total) || '—' : undefined}
      />
      <Datum label="Processos" estado={processos} value={data.processos.length} />
      <Datum
        label="Criminais"
        estado={processos}
        value={criminaisN}
        tone={processos.tipo === 'ok' && criminaisN > 0 ? 'blood' : 'default'}
      />
    </dl>
  )
}

function Datum({
  label,
  estado,
  value,
  valueText,
  tone = 'default',
}: {
  label: string
  estado: EstadoBloco
  value?: number
  valueText?: string
  tone?: 'blood' | 'default'
}) {
  // Estado não-rodado/falhou/processando → rótulo pequeno; senão, número grande.
  const isNumero = estado.tipo === 'ok' || estado.tipo === 'vazio'
  const falhou = estado.tipo === 'falhou'
  const color = falhou ? 'var(--color-ivy-blood)' : tone === 'blood' ? 'var(--color-ivy-blood)' : 'var(--color-ivy-near)'

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <dt className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        {label}
      </dt>
      {isNumero ? (
        <dd
          className="ivy-display"
          style={{
            fontSize: 'clamp(32px, 3.4vw, 48px)',
            color,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            margin: 0,
          }}
        >
          {valueText ?? (value ?? 0).toLocaleString('pt-BR')}
        </dd>
      ) : (
        <dd
          className="ivy-meta"
          style={{
            color: falhou ? 'var(--color-ivy-blood)' : 'var(--color-ivy-mid)',
            margin: 0,
            // alinha verticalmente com os números grandes vizinhos
            paddingTop: 'clamp(10px, 1.2vw, 18px)',
            paddingBottom: 'clamp(10px, 1.2vw, 18px)',
          }}
        >
          {rotuloEstado(estado)}
        </dd>
      )}
    </div>
  )
}
