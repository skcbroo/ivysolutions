import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

type Props = {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '8px 14px', minHeight: 36, fontSize: 11 },
  md: { padding: '12px 22px', minHeight: 44, fontSize: 11 },
  lg: { padding: '16px 28px', minHeight: 48, fontSize: 12 },
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'var(--color-ivy-olive)',
    color: 'var(--color-ivy-bone)',
    border: 0,
  },
  secondary: {
    background: 'transparent',
    color: 'var(--color-ivy-near)',
    border: '1px solid var(--color-ivy-tan)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-ivy-mid)',
    border: 0,
  },
  danger: {
    background: 'var(--color-ivy-blood)',
    color: 'var(--color-ivy-bone)',
    border: 0,
  },
  'danger-ghost': {
    background: 'transparent',
    color: 'var(--color-ivy-blood)',
    border: '1px solid var(--color-ivy-blood)',
  },
}

/**
 * Botão unificado do design system OSINT.
 * `:focus-visible` é coberto pelo globals.css.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  style,
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`ivy-meta disabled:opacity-40 ${className ?? ''}`}
      style={{
        ...sizeStyles[size],
        ...variantStyles[variant],
        letterSpacing: '0.3em',
        fontFamily: 'var(--font-body)',
        textTransform: 'uppercase',
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        transition: 'background 180ms var(--ease-ivy), color 180ms var(--ease-ivy), border-color 180ms var(--ease-ivy)',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
