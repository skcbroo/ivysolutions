export function Positioning() {
  return (
    <section id="posicionamento" className="ivy-paper-noise relative">
      <div className="ivy-page py-[clamp(48px,7vw,88px)] grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-10 md:col-start-2">
          <h2
            className="ivy-display"
            style={{
              fontSize: 'clamp(32px,6.5vw,84px)',
              color: 'var(--color-ivy-near)',
              lineHeight: 1.02,
            }}
          >
            A IVY não é{' '}
            <span style={{ color: 'var(--color-ivy-olive)' }}>cobrança</span>.
            <br />
            Não é{' '}
            <span style={{ color: 'var(--color-ivy-olive)' }}>advocacia</span>.
            <br />
            Não é{' '}
            <span style={{ color: 'var(--color-ivy-olive)' }}>software</span>.
          </h2>
          <hr className="ivy-rule-olive mt-10" />
          <p
            className="max-w-[62ch] mt-8"
            style={{
              fontSize: 'clamp(17px,1.3vw,21px)',
              lineHeight: 1.6,
              color: 'oklch(0.28 0.005 130)',
            }}
          >
            A IVY resolve casos. Encontra o que está escondido. Produz
            inteligência acionável para que credores recuperem o que lhes é
            devido. A equipe combina ex-agentes de forças de segurança,
            analistas de OSINT e especialistas em investigação patrimonial.
          </p>
        </div>
      </div>
    </section>
  )
}
