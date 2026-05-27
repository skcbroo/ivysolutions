import { useState, useRef, useEffect } from 'react'
import { Button, type ButtonVariant } from './Button'

type Props = {
  label: string
  confirmLabel?: string
  tone?: 'danger' | 'olive'
  disabled?: boolean
  onConfirm: () => void | Promise<void>
  /** Tempo (ms) que o estado "armado" fica antes de auto-cancelar. */
  armedTimeout?: number
}

/**
 * Confirmação inline em 2 cliques. Substitui window.confirm:
 *  - Click 1: vira "Confirmar X?" com tonalidade alerta
 *  - Click 2: executa
 *  - Auto-cancela após `armedTimeout` ou ao perder foco
 *
 * Acessível: usa aria-live="polite" para anunciar o estado intermediário.
 */
export function ConfirmInline({
  label,
  confirmLabel,
  tone = 'danger',
  disabled,
  onConfirm,
  armedTimeout = 4_000,
}: Props) {
  const [armed, setArmed] = useState(false)
  const [running, setRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function disarm() {
    setArmed(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  async function onClick() {
    if (!armed) {
      setArmed(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(disarm, armedTimeout)
      return
    }
    disarm()
    setRunning(true)
    try {
      await onConfirm()
    } finally {
      setRunning(false)
    }
  }

  const variant: ButtonVariant = armed
    ? tone === 'danger' ? 'danger' : 'primary'
    : tone === 'danger' ? 'danger-ghost' : 'ghost'

  return (
    <span className="inline-flex items-center gap-2" aria-live="polite">
      <Button
        size="sm"
        variant={variant}
        disabled={disabled || running}
        onClick={onClick}
        onBlur={() => {
          // pequeno delay para permitir 2º click sem perder estado
          setTimeout(() => {
            if (armed) disarm()
          }, 200)
        }}
      >
        {running ? '...' : armed ? (confirmLabel ?? `Confirmar ${label}`) : label}
      </Button>
      {armed && !running && (
        <Button size="sm" variant="ghost" onClick={disarm}>
          Cancelar
        </Button>
      )}
    </span>
  )
}
