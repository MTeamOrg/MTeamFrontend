export type StatusTone = 'black' | 'blue' | 'pink' | 'purple'

export function StatusCard({ label, value, tone, sub }: { label: string; value: string; tone: StatusTone; sub?: string }) {
  return <article className="status-card">
    <span className="status-card-label">{label}</span>
    <strong className={`status-card-value tone-${tone}`}>{value}</strong>
    {sub && <span className="status-card-sub">{sub}</span>}
  </article>
}
