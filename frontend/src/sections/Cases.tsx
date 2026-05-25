export function Cases() {
  return (
    <section id="cases">
      <div className="ivy-paper-noise">
        <div className="ivy-page pt-[clamp(48px,7vw,88px)] pb-[clamp(20px,3vw,40px)] grid grid-cols-12 gap-6">
          <header className="col-span-12 md:col-span-8">
            <p className="ivy-meta ivy-meta--olive mb-5">Casos de sucesso</p>
            <h2
              className="ivy-display"
              style={{
                fontSize: 'clamp(32px,5.5vw,64px)',
                color: 'var(--color-ivy-near)',
                lineHeight: 1.02,
              }}
            >
              Casos encerrados.
              <br />
              <span style={{ whiteSpace: 'nowrap' }}>
                Identidades{' '}
                <span style={{ color: 'var(--color-ivy-olive)' }}>
                  protegidas.
                </span>
              </span>
            </h2>
            <hr className="ivy-rule-olive mt-8" />
            <p
              className="max-w-[62ch] mt-6"
              style={{ fontSize: 'clamp(15px,1.1vw,17px)', lineHeight: 1.65 }}
            >
              As operações abaixo são reais. Nomes, valores e identificadores
              que permitiriam reconstituir as partes envolvidas estão
              suprimidos por protocolo de confidencialidade institucional.
              Demais informações foram mantidas para fins de demonstração de
              método.
            </p>
          </header>
        </div>

        <div className="ivy-page pb-[clamp(48px,7vw,88px)] grid grid-cols-12 gap-x-6 gap-y-14 md:gap-y-20">
          <CaseFile
            code="01"
            title="Execução parada há quatro anos encerrada por desconsideração"
            duration="9 meses"
            resultado="Ganho líquido superior a R$ 2.000.000"
            sections={[
              {
                label: 'Situação inicial',
                body: (
                  <>
                    Execução judicial movida contra a empresa{' '}
                    <Redacted len={20} /> com créditos superiores a R${' '}
                    <Redacted len={3} /> milhões reconhecidos em sentença.
                    Quatro anos sem resultado. Solicitação de diagnóstico
                    protocolada à IVY pela equipe jurídica do credor.
                  </>
                ),
              },
              {
                label: 'Levantamento',
                body: (
                  <>
                    Cruzamento de bases societárias indicou que a devedora
                    operava formalmente, mas a atividade econômica vinha
                    sendo conduzida por três sociedades distintas,
                    registradas no mesmo endereço (<Redacted len={26} />),
                    com sócios em comum e estrutura de pagamentos cruzada.
                    Identificada transferência via PIX entre conta da
                    devedora e CNPJ <Redacted len={16} />, configurando
                    confusão patrimonial.
                  </>
                ),
              },
              {
                label: 'Verificação',
                body: (
                  <>
                    Contato telefônico ao número original da devedora foi
                    atendido por funcionário da empresa sucessora,
                    identificando-se com o nome do empreendimento original.
                    A gravação foi anexada aos autos como prova.
                  </>
                ),
              },
              {
                label: 'Encerramento',
                body: (
                  <>
                    Pedido de desconsideração da personalidade jurídica
                    deferido. Bens das sociedades sucessoras alcançados.
                    Crédito satisfeito.
                  </>
                ),
              },
            ]}
          />

          <CaseFile
            code="02"
            title="Imóvel em região litorânea nobre penhorado após dezoito anos"
            duration="11 meses"
            resultado="Imóvel arrematado em leilão judicial"
            sections={[
              {
                label: 'Situação inicial',
                body: (
                  <>
                    Devedor contumaz com atuação no setor naval.{' '}
                    <Redacted len={10} /> processos em aberto. Declarações
                    fiscais inconclusivas. Bens declarados insuficientes
                    para satisfação do crédito.
                  </>
                ),
              },
              {
                label: 'Levantamento',
                body: (
                  <>
                    Análise cruzada das declarações fiscais dos últimos
                    doze anos com base registral imobiliária. Identificada
                    referência indireta a imóvel em <Redacted len={32} />{' '}
                    por meio de processo físico de 2008 envolvendo o mesmo
                    réu, no qual o bem aparecia como propriedade pessoal
                    não declarada nas execuções correntes.
                  </>
                ),
              },
              {
                label: 'Verificação',
                body: (
                  <>
                    Diligência junto à administração condominial confirmou
                    ocupação contínua do imóvel pelo devedor. Documentação
                    registral atualizada anexada aos autos.
                  </>
                ),
              },
              {
                label: 'Encerramento',
                body: (
                  <>
                    Penhora deferida. Imóvel levado a leilão e arrematado.
                    Ativo oculto há mais de uma década incorporado à
                    execução.
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>
    </section>
  )
}

function CaseFile({
  code,
  title,
  duration,
  resultado,
  sections,
}: {
  code: string
  title: string
  duration: string
  resultado: string
  sections: { label: string; body: React.ReactNode }[]
}) {
  return (
    <article className="col-span-12 grid grid-cols-12 gap-x-6 gap-y-6">
      <header className="col-span-12 md:col-span-4">
        <div
          className="flex items-center gap-3"
          style={{ color: 'var(--color-ivy-mid)' }}
        >
          <span className="ivy-meta" style={{ color: 'var(--color-ivy-near)' }}>
            Operação {code}
          </span>
          <span style={{ color: 'var(--color-ivy-tan)' }}>·</span>
          <span className="ivy-meta">ENCERRADO</span>
        </div>
        <h3
          className="ivy-display mt-6"
          style={{
            fontSize: 'clamp(26px,3.4vw,40px)',
            color: 'var(--color-ivy-near)',
            lineHeight: 1.05,
            letterSpacing: '0.01em',
          }}
        >
          {title}
        </h3>
        <hr className="ivy-rule-olive mt-5" />
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 max-w-[40ch]">
          <DLRow label="Duração" value={duration} />
          <DLRow label="Resultado" value={resultado} />
        </dl>
      </header>
      <div className="col-span-12 md:col-span-8 md:pl-8 md:border-l md:border-[color:var(--color-ivy-tan)]">
        <dl className="divide-y divide-[color:var(--color-ivy-tan)]/60">
          {sections.map((s) => (
            <div
              key={s.label}
              className="grid grid-cols-12 gap-3 py-5 first:pt-0"
            >
              <dt
                className="col-span-12 md:col-span-3 ivy-meta"
                style={{ color: 'var(--color-ivy-olive)' }}
              >
                {s.label}
              </dt>
              <dd
                className="col-span-12 md:col-span-9"
                style={{
                  fontSize: 'clamp(15px,1.05vw,17px)',
                  lineHeight: 1.65,
                  color: 'oklch(0.28 0.005 130)',
                }}
              >
                {s.body}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  )
}

function DLRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        className="ivy-foot"
        style={{ color: 'var(--color-ivy-olive)' }}
      >
        {label}
      </dt>
      <dd
        className="ivy-display mt-1"
        style={{
          color: 'var(--color-ivy-near)',
          fontSize: 'clamp(15px,1.2vw,18px)',
          letterSpacing: '0.02em',
          lineHeight: 1.15,
        }}
      >
        {value}
      </dd>
    </div>
  )
}

function Redacted({ len }: { len: number }) {
  // Texto invisível atrás de barra preta: o span é inline puro, então
  // herda exatamente o line-height e a baseline do texto ao redor.
  return (
    <span className="ivy-redact" aria-label="informação redigida">
      {'X'.repeat(len)}
    </span>
  )
}
