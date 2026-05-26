export function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      style={{
        padding: '12px 14px',
        textAlign: align ?? 'left',
        fontWeight: 400,
      }}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align,
  bold,
  mono,
  tone,
}: {
  children: React.ReactNode
  align?: 'right'
  bold?: boolean
  mono?: boolean
  tone?: 'blood' | 'ok' | 'mid' | 'default'
}) {
  const color =
    tone === 'blood'
      ? 'var(--color-ivy-blood)'
      : tone === 'ok'
      ? 'var(--color-ivy-olive)'
      : tone === 'mid'
      ? 'var(--color-ivy-mid)'
      : 'var(--color-ivy-near)'
  return (
    <td
      style={{
        padding: '14px',
        textAlign: align ?? 'left',
        verticalAlign: 'top',
        fontWeight: bold ? 600 : 400,
        fontVariantNumeric: mono ? 'tabular-nums' : undefined,
        color,
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </td>
  )
}
