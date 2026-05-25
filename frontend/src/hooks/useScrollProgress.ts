import { useEffect, useRef, useState } from 'react'

/**
 * Mede o progresso (0..1) com o qual a seção atravessa a viewport.
 * 0  = topo da seção colado no topo da viewport
 * 1  = base da seção colado no topo da viewport
 * Antes/depois é clampado em 0/1, então o 3D só anima enquanto a seção
 * está efetivamente no campo de scroll do usuário.
 */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    let latest = 0

    function compute() {
      const node = ref.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      if (total <= 0) {
        latest = rect.top < 0 ? 1 : 0
      } else {
        const passed = -rect.top
        latest = Math.min(1, Math.max(0, passed / total))
      }
      setProgress(latest)
    }

    function onScroll() {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        compute()
      })
    }

    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return { ref, progress }
}
