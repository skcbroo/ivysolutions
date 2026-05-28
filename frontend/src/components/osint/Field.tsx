import type { HTMLAttributes } from 'react'

type Props = {
  name: string
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: string | null
  type?: string
  required?: boolean
  colSpan?: number
  placeholder?: string
  autoComplete?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
  /** Use em fundos escuros (.ivy-scanlines). Padrão: false (fundo paper). */
  dark?: boolean
}

export function Field({
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  type = 'text',
  required,
  colSpan = 12,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  dark = false,
}: Props) {
  const id = `osint-${name}`
  const errorId = `${id}-err`
  const hasError = !!error
  const textColor = dark ? 'var(--color-ivy-bone)' : 'var(--color-ivy-near)'
  const labelColor = dark ? 'var(--color-ivy-tan)' : 'var(--color-ivy-mid)'
  const borderColor = hasError
    ? 'var(--color-ivy-blood)'
    : dark
    ? 'var(--color-ivy-tan)'
    : 'var(--color-ivy-border-input)'
  return (
    <label
      htmlFor={id}
      className="block"
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      <span className="ivy-meta block mb-2" style={{ color: labelColor }}>
        {label}
        {required && (
          <span aria-hidden style={{ color: 'var(--color-ivy-blood)' }}>
            {' '}
            *
          </span>
        )}
      </span>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        required={required}
        aria-required={required || undefined}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full bg-transparent"
        style={{
          border: 0,
          borderBottom: `1px solid ${borderColor}`,
          color: textColor,
          padding: '12px 0',
          minHeight: 44,
          fontSize: 16,
          fontFamily: 'var(--font-body)',
          transition: 'border-color 180ms var(--ease-ivy)',
        }}
      />
      {hasError && (
        <p
          id={errorId}
          role="alert"
          className="mt-2"
          style={{ color: 'var(--color-ivy-blood)', fontSize: 12, letterSpacing: '0.04em', lineHeight: 1.4 }}
        >
          {error}
        </p>
      )}
    </label>
  )
}
