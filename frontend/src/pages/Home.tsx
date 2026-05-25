import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { Hero } from '../sections/Hero'
import { Positioning } from '../sections/Positioning'
import { MoneyJourney } from '../sections/MoneyJourney'
import { Cases } from '../sections/Cases'
import { Contact } from '../sections/Contact'
import { Footer } from '../sections/Footer'

export function Home() {
  usePageMeta({
    title: 'IVY · Recuperação de Ativos — Inteligência aplicada a crédito travado',
    description:
      'Inteligência de dados e operações de campo para localizar patrimônio oculto de devedores contumazes. A IVY atua onde a cobrança convencional parou.',
    canonical: 'https://ivy.com.br/',
  })

  const { hash } = useLocation()

  // Scroll para a âncora quando a Home é montada vinda de outra rota.
  useEffect(() => {
    if (!hash) return
    const id = hash.slice(1)
    const el = document.getElementById(id)
    if (!el) return
    // próximo frame para garantir layout pronto (3D pode estar carregando)
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'start' })
    })
  }, [hash])

  return (
    <>
      <Hero />
      <Positioning />
      <MoneyJourney />
      <Cases />
      <Contact />
      <Footer />
    </>
  )
}
