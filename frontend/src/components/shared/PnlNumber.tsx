import { cn } from '@/lib/utils'
import { pnlSign, pnlVariant } from '@/lib/format'

interface Props {
  value: number | null | undefined
  formatter: (v: number) => string
  className?: string
}

/** Renders a profit/loss number with ＋/－ prefix and semantic color */
export default function PnlNumber({ value, formatter, className }: Props) {
  if (value == null) return <span className={cn('text-[var(--color-text-tertiary)]', className)}>—</span>
  const variant = pnlVariant(value)
  return (
    <span
      className={cn('tabular-nums', className)}
      style={{
        color:
          variant === 'profit'
            ? 'var(--color-profit)'
            : variant === 'loss'
            ? 'var(--color-loss)'
            : 'var(--color-text-primary)',
      }}
    >
      {pnlSign(value)}{formatter(value)}
    </span>
  )
}
