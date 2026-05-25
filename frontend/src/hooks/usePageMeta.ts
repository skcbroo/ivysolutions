import { useEffect } from 'react'

type Meta = {
  title: string
  description?: string
  canonical?: string
}

/** Atualiza title, meta description e canonical da página atual.
 *  Por ser SPA, isso afeta navegação client-side e o browser tab.
 *  Para crawlers, o que vale é o index.html (default). Páginas internas
 *  precisariam de SSR ou de um prerender para serem indexadas com meta
 *  específica - quando virar prioridade, plugar @vite-pwa/pre-render ou
 *  mover para SSR. */
export function usePageMeta({ title, description, canonical }: Meta) {
  useEffect(() => {
    document.title = title

    if (description) setMeta('name', 'description', description)
    if (canonical) setLink('canonical', canonical)
  }, [title, description, canonical])
}

function setMeta(attr: 'name' | 'property', value: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${value}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, value)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}
