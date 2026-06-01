/** Format a decimal number as currency (CNY) with 万/亿 suffix */
export function formatAmount(value: number | null | undefined): string {
  if (value == null) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e8) return `${sign}¥${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${sign}¥${(abs / 1e4).toFixed(2)}万`
  return `${sign}¥${abs.toFixed(2)}`
}

/** Format CNY as a full amount without 万/亿 compaction. */
export function formatExactAmount(value: number | string | null | undefined): string {
  if (value == null) return '—'
  const raw = String(value).trim()
  if (!raw) return '—'

  const sign = raw.startsWith('-') ? '-' : ''
  const unsigned = sign ? raw.slice(1) : raw
  const [intPartRaw, decimalPartRaw = ''] = unsigned.split('.')
  const intPart = (intPartRaw || '0').replace(/^0+(?=\d)/, '')
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const trimmedDecimal = decimalPartRaw.length > 2
    ? decimalPartRaw.replace(/0+$/, '').padEnd(2, '0')
    : decimalPartRaw.padEnd(2, '0')

  return `${sign}¥${formattedInt}.${trimmedDecimal}`
}

/** Format percent without an explicit positive sign. Sign-aware wrappers add '+' where needed. */
export function formatPct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${(value * 100).toFixed(2)}%`
}

/** Format percent with a positive sign for standalone, non-PnlNumber usage. */
export function formatSignedPct(value: number | null | undefined): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatPct(value)}`
}

/** Format a PnL number with sign and color class hint */
export function pnlSign(value: number): string {
  return value >= 0 ? '+' : ''
}

/** Format date string YYYYMMDD → YYYY-MM-DD */
export function formatTradeDate(d: string): string {
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
  return d
}

/** Format datetime ISO string → YYYY-MM-DD HH:mm */
export function formatDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Return 'profit' | 'loss' | 'neutral' for coloring */
export function pnlVariant(value: number): 'profit' | 'loss' | 'neutral' {
  if (value > 0) return 'profit'
  if (value < 0) return 'loss'
  return 'neutral'
}
