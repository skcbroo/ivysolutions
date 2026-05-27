import { useState } from 'react'

const MD_PREVIEW_CHARS = 4000

export function TabRelatorio({ md }: { md: string | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!md) {
    return (
      <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>
        Relatório ainda não gerado.
      </p>
    )
  }
  const content: string = md
  const truncated = content.length > MD_PREVIEW_CHARS
  const shown = !truncated || expanded ? content : content.slice(0, MD_PREVIEW_CHARS) + '\n\n…'

  function copy() {
    navigator.clipboard.writeText(content)
  }
  function download() {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio.md`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <div className="flex gap-4 mb-6 flex-wrap">
        <button
          type="button"
          onClick={download}
          className="ivy-meta"
          style={{
            background: 'var(--color-ivy-olive)',
            color: 'var(--color-ivy-bone)',
            padding: '14px 22px',
            minHeight: 44,
            letterSpacing: '0.3em',
            fontSize: 11,
            border: 0,
          }}
        >
          Baixar .md
        </button>
        <button
          type="button"
          onClick={copy}
          className="ivy-meta"
          style={{
            background: 'transparent',
            color: 'var(--color-ivy-near)',
            padding: '14px 22px',
            minHeight: 44,
            letterSpacing: '0.3em',
            fontSize: 11,
            border: '1px solid var(--color-ivy-tan)',
          }}
        >
          Copiar
        </button>
      </div>
      <pre
        className="p-6 overflow-x-auto"
        style={{
          background: 'var(--color-ivy-paper)',
          border: '1px solid var(--color-ivy-tan)',
          color: 'var(--color-ivy-near)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {shown}
      </pre>
      {truncated && (
        <div className="mt-4 flex items-center gap-6">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ivy-meta"
            style={{
              background: 'transparent',
              color: 'var(--color-ivy-olive)',
              padding: '12px 0',
              border: 0,
              letterSpacing: '0.3em',
              fontSize: 11,
            }}
          >
            {expanded
              ? 'Recolher'
              : `Expandir relatório completo (${(content.length / 1024).toFixed(0)} KB)`}
          </button>
        </div>
      )}
    </>
  )
}
