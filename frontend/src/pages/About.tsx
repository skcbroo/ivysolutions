import { useEffect } from 'react'
import { usePageMeta } from '../hooks/usePageMeta'
import { Footer } from '../sections/Footer'

export function About() {
  usePageMeta({
    title: 'Sobre a IVY · Operadores de recuperação',
    description:
      'A IVY é formada por ex-agentes de forças de segurança, analistas de OSINT e investigadores patrimoniais. Atuamos onde a cobrança convencional parou.',
    canonical: 'https://www.ivysolutions.com.br/sobre',
  })

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <>
      <section
        className="ivy-scanlines text-[color:var(--color-ivy-bone)]"
      >
        <div className="ivy-page pt-[clamp(88px,10vw,128px)] pb-[clamp(40px,6vw,72px)]">
          <div className="ivy-bar-blood max-w-[1100px]">
            <p
              className="ivy-meta"
              style={{ color: 'var(--color-ivy-tan)' }}
            >
              Sobre a IVY
            </p>
            <h1
              className="ivy-display mt-4"
              style={{
                fontSize: 'clamp(40px,9vw,120px)',
                color: 'var(--color-ivy-bone)',
                lineHeight: 0.96,
              }}
            >
              Operadores
              <br />
              de recuperação.
            </h1>
            <p
              className="mt-[clamp(20px,3vw,32px)] max-w-[58ch]"
              style={{
                color: 'oklch(0.86 0.018 88)',
                fontSize: 'clamp(16px,1.2vw,19px)',
                lineHeight: 1.6,
              }}
            >
              A IVY foi formada por profissionais que estiveram do lado
              errado do problema: ex-agentes de forças de segurança,
              analistas de OSINT e investigadores patrimoniais que viram,
              repetidamente, créditos legítimos serem perdidos por limitação
              operacional da cobrança tradicional. A empresa existe para
              corrigir esse vetor.
            </p>
          </div>
        </div>
      </section>

      <section className="ivy-paper-noise">
        <div className="ivy-page py-[clamp(48px,7vw,88px)] grid grid-cols-12 gap-x-6 gap-y-10">
          <Block
            kicker="Origem"
            title="Por que a IVY existe."
            body="Grande parte do estoque brasileiro de crédito judicial está concentrado em devedores contumazes — empresas e pessoas físicas com técnica formada para ocultar patrimônio. A cobrança tradicional não foi projetada para esses casos. A IVY é. Foi montada para operar exatamente no espaço entre o crédito reconhecido e a recuperação efetiva."
          />
          <Block
            kicker="Disciplina"
            title="Hipótese, evidência, prova, ação."
            body="Operamos com a mesma disciplina de uma investigação institucional. Nada é movimentado antes da prova estar arquivada. O sigilo é parte do método — não retórica de marketing. Cada operação tem um plano único, fechado com o cliente antes da etapa de execução."
          />
          <Block
            kicker="Posicionamento"
            title={
              <>
                Não somos{' '}
                <span style={{ color: 'var(--color-ivy-olive)' }}>
                  cobrança
                </span>
                .
                <br />
                Não somos{' '}
                <span style={{ color: 'var(--color-ivy-olive)' }}>
                  advocacia
                </span>
                .
                <br />
                Não somos{' '}
                <span style={{ color: 'var(--color-ivy-olive)' }}>
                  software
                </span>
                .
              </>
            }
            body="A IVY ocupa um espaço institucional que ainda não estava nomeado no Brasil. Atuamos como o braço investigativo e estratégico de credores, escritórios e gestoras de NPL. O jurídico continua sendo do cliente. O que entregamos é a inteligência que falta para o jurídico atuar com chance real de êxito."
          />
        </div>
      </section>

      <section
        style={{ background: 'var(--color-ivy-charcoal)' }}
        className="text-[color:var(--color-ivy-bone)]"
      >
        <div className="ivy-page py-[clamp(48px,7vw,88px)] grid grid-cols-12 gap-x-6 gap-y-10">
          <header className="col-span-12 md:col-span-8">
            <p
              className="ivy-meta"
              style={{ color: 'var(--color-ivy-tan)' }}
            >
              Estrutura
            </p>
            <h2
              className="ivy-display mt-4"
              style={{
                color: 'var(--color-ivy-bone)',
                fontSize: 'clamp(32px,6vw,72px)',
                lineHeight: 1,
              }}
            >
              Como a equipe está organizada.
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
                color: 'oklch(0.86 0.018 88)',
                fontSize: 'clamp(15px,1.1vw,17px)',
                lineHeight: 1.65,
              }}
            >
              A IVY não trabalha por terceirização externa. Toda operação é
              conduzida por equipe interna, com identidades individuais
              preservadas em sigilo institucional. Quatro disciplinas
              operam em conjunto desde a primeira leitura do caso.
            </p>
          </header>
          <ul className="col-span-12 mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
            <Discipline
              code="01"
              name="Inteligência"
              body="Ex-agentes de forças de segurança e analistas de OSINT. Cruzam bases públicas, registrais e abertas em escala. Mapeiam grupos econômicos a partir de fragmentos."
            />
            <Discipline
              code="02"
              name="Investigação patrimonial"
              body="Especialistas em rastreamento de bens, blindagem patrimonial e fluxos de pagamento. Operam o cruzamento que produz a prova."
            />
            <Discipline
              code="03"
              name="Operações de campo"
              body="Diligências discretas, notificações, constatações de ocupação. Quando a base de dados não basta, a equipe vai ao endereço."
            />
            <Discipline
              code="04"
              name="Engenharia jurídica"
              body="Advogados especialistas em execução, desconsideração, fraude à execução e sucessão irregular. Traduzem o achado da investigação em peça processual."
            />
          </ul>
        </div>
      </section>

      <section className="ivy-paper-noise">
        <div className="ivy-page py-[clamp(48px,7vw,88px)] grid grid-cols-12 gap-x-6 gap-y-10 items-center">
          <div className="col-span-12 md:col-span-8">
            <p className="ivy-meta ivy-meta--olive">Próxima leitura</p>
            <h2
              className="ivy-display mt-4"
              style={{
                fontSize: 'clamp(28px,5vw,56px)',
                color: 'var(--color-ivy-near)',
                lineHeight: 1.05,
              }}
            >
              O método em quatro etapas, demonstrado em movimento.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 md:text-right">
            <a
              href="/#protocolo"
              className="ivy-meta"
              style={{
                background: 'var(--color-ivy-olive)',
                color: 'var(--color-ivy-bone)',
                padding: '14px 22px',
                letterSpacing: '0.3em',
                fontSize: 12,
                display: 'inline-block',
              }}
            >
              Ver o protocolo →
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}

function Block({
  kicker,
  title,
  body,
}: {
  kicker: string
  title: React.ReactNode
  body: string
}) {
  return (
    <article className="col-span-12 md:col-span-4">
      <p className="ivy-meta ivy-meta--olive">{kicker}</p>
      <h3
        className="ivy-display mt-3"
        style={{
          fontSize: 'clamp(22px,2.4vw,32px)',
          color: 'var(--color-ivy-near)',
          lineHeight: 1.1,
        }}
      >
        {title}
      </h3>
      <hr className="ivy-rule-olive mt-4" />
      <p
        className="mt-5"
        style={{
          color: 'oklch(0.32 0.005 130)',
          fontSize: 'clamp(15px,1.05vw,17px)',
          lineHeight: 1.65,
        }}
      >
        {body}
      </p>
    </article>
  )
}

function Discipline({
  code,
  name,
  body,
}: {
  code: string
  name: string
  body: string
}) {
  return (
    <li>
      <div className="flex items-baseline gap-4">
        <span
          className="ivy-display"
          style={{
            color: 'var(--color-ivy-tan)',
            fontSize: 'clamp(28px,3.4vw,44px)',
            lineHeight: 1,
          }}
        >
          {code}
        </span>
        <span
          className="ivy-display"
          style={{
            color: 'var(--color-ivy-bone)',
            fontSize: 'clamp(20px,2vw,28px)',
            lineHeight: 1,
          }}
        >
          {name}
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
          maxWidth: '44ch',
        }}
      >
        {body}
      </p>
    </li>
  )
}
