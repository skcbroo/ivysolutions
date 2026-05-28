import { useEffect, useRef } from 'react'

/**
 * setInterval que respeita Page Visibility API:
 * - executa imediatamente na primeira chamada (kick-off)
 * - pausa quando a aba fica oculta
 * - retoma + dispara um ciclo extra ao voltar a ficar visível
 *
 * Útil para polling de status que não precisa rodar quando ninguém está vendo.
 */
export function useVisibleInterval(cb: () => void | Promise<void>, ms: number) {
  const cbRef = useRef(cb)
  cbRef.current = cb

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (timer) return
      timer = setInterval(() => {
        void cbRef.current()
      }, ms)
    }
    const stop = () => {
      if (!timer) return
      clearInterval(timer)
      timer = null
    }

    void cbRef.current()
    if (document.visibilityState !== 'hidden') start()

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stop()
      } else {
        void cbRef.current()
        start()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [ms])
}
