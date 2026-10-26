import { Link } from 'react-router-dom'

export type StatusTone = 'black' | 'blue' | 'pink' | 'purple'

export function StatusCard({ label, value, tone, sub, to }: { label: string; value: string; tone: StatusTone; sub?: string; to?: string }) {
  const content = <>
    <span className="status-card-label">{label}</span>
    <strong className={`status-card-value tone-${tone}`}>{value}</strong>
    {sub && <span className="status-card-sub">{sub}</span>}
  </>
  return to
    ? <Link className="status-card" to={to}>{content}</Link>
    : <article className="status-card">{content}</article>
}
