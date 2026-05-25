const PERFIS = [
  {
    funcao: 'Inteligência',
    descricao:
      'Ex-agentes de forças de segurança e analistas de OSINT. Cruzam bases públicas, registrais, fiscais e abertas em escala. Mapeiam grupos econômicos a partir de fragmentos.',
  },
  {
    funcao: 'Investigação patrimonial',
    descricao:
      'Especialistas em rastreamento de bens, blindagem patrimonial e fluxos de pagamento. Operam o cruzamento que produz a prova.',
  },
  {
    funcao: 'Operações de campo',
    descricao:
      'Diligências discretas, notificações, constatações de ocupação. Quando a base de dados não basta, a equipe vai ao endereço.',
  },
  {
    funcao: 'Engenharia jurídica',
    descricao:
      'Advogados especialistas em execução, desconsideração, fraude à execução e sucessão irregular. Traduzem o achado da investigação em peça processual.',
  },
] as const

export function Team() {
  return (
    <section
      id="equipe"
      style={{ background: 'var(--color-ivy-charcoal)' }}
      className="text-[color:var(--color-ivy-bone)]"
    >
      <div className="ivy-page py-[clamp(48px,7vw,88px)] grid grid-cols-12 gap-6">
        <header className="col-span-12 md:col-span-8">
          <p
            className="ivy-meta"
            style={{ color: 'var(--color-ivy-tan)' }}
          >
            Equipe operacional
          </p>
          <h2
            className="ivy-display mt-4"
            style={{
              fontSize: 'clamp(36px,7vw,80px)',
              color: 'var(--color-ivy-bone)',
              lineHeight: 0.98,
            }}
          >
            Quem conduz a operação.
            <br />
            <span style={{ color: 'var(--color-ivy-tan)' }}>
              Quatro disciplinas.
            </span>
          </h2>
          <hr
            style={{
              border: 0,
              borderTop: '3px solid var(--color-ivy-olive)',
              width: 'clamp(48px,6vw,80px)',
              marginTop: 20,
            }}
          />
          <p
            className="mt-8 max-w-[62ch]"
            style={{
              fontSize: 'clamp(15px,1.1vw,17px)',
              lineHeight: 1.7,
              color: 'oklch(0.86 0.018 88)',
            }}
          >
            A IVY não trabalha por terceirização externa. Toda operação é
            conduzida por equipe interna. Identidades individuais são
            mantidas em sigilo institucional. O que importa é a função
            exercida, não o nome.
          </p>
        </header>
        <ul className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 mt-6">
          {PERFIS.map((p, i) => (
            <li key={p.funcao}>
              <div className="flex items-baseline gap-4">
                <span
                  className="ivy-display"
                  style={{
                    color: 'var(--color-ivy-tan)',
                    fontSize: 'clamp(28px,3.4vw,44px)',
                  }}
                >
                  0{i + 1}
                </span>
                <span
                  className="ivy-display"
                  style={{
                    color: 'var(--color-ivy-bone)',
                    fontSize: 'clamp(20px,2vw,28px)',
                  }}
                >
                  {p.funcao}
                </span>
              </div>
              <hr
                style={{
                  border: 0,
                  borderTop: '1px solid oklch(0.72 0.03 80 / 0.4)',
                  marginTop: 12,
                  marginBottom: 12,
                  maxWidth: '32ch',
                }}
              />
              <p
                style={{
                  color: 'oklch(0.86 0.018 88)',
                  fontSize: 'clamp(14px,1vw,16px)',
                  lineHeight: 1.65,
                  maxWidth: '40ch',
                }}
              >
                {p.descricao}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
