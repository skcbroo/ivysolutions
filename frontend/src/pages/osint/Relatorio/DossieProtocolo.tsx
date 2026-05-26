/**
 * Faixa de "dado de protocolo" do dossiê. Substitui o template hero-metric
 * (cards em grid simétrica) por um listamento semântico denso, à maneira de
 * cabeçalho de relatório institucional. Hierarquia por tipo, não por moldura.
 */
export function DossieProtocolo({
  empresas,
  capital,
  processos,
  criminais,
}: {
  empresas: number
  capital: string
  processos: number
  criminais: number
}) {
  return (
    <dl className="flex flex-wrap items-baseline gap-x-12 md:gap-x-16 gap-y-8 mb-8">
      <Datum label="Empresas mapeadas" value={empresas.toLocaleString('pt-BR')} />
      <Datum label="Capital declarado" value={capital} />
      <Datum label="Processos" value={processos.toLocaleString('pt-BR')} />
      <Datum
        label="Criminais"
        value={criminais.toLocaleString('pt-BR')}
        tone={criminais > 0 ? 'blood' : 'default'}
      />
    </dl>
  )
}

function Datum({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'blood' | 'default'
}) {
  const color = tone === 'blood' ? 'var(--color-ivy-blood)' : 'var(--color-ivy-near)'
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <dt className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        {label}
      </dt>
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
        {value}
      </dd>
    </div>
  )
}
