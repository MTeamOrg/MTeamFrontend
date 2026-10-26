import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../workspace/Icon'

export { StatusCard, type StatusTone } from '../workspace/StatusCard'

export function DashboardHeader({ eyebrow, greeting, intro }: { eyebrow?: string; greeting: string; intro: string }) {
  return <header className="dashboard-header">
    {eyebrow && <span className="dashboard-pill">{eyebrow}</span>}
    <h1>{greeting}</h1>
    <p>{intro}</p>
  </header>
}

export interface QuickAction {
  label: string
  icon: IconName
  to?: string
  primary?: boolean
  unavailableReason?: string
}

export function ActionButton({ action }: { action: QuickAction }) {
  const className = `button button-block ${action.primary ? 'button-primary' : 'button-secondary'}`
  if (action.to) return <Link className={className} to={action.to}><Icon name={action.icon} size={20}/>{action.label}</Link>
  return <button type="button" className={className} disabled title={action.unavailableReason}>
    <Icon name={action.icon} size={20}/>{action.label}
  </button>
}

export function QuickActions({ title, actions }: { title: string; actions: QuickAction[] }) {
  return <section className="app-card quick-actions">
    <h2 className="app-card-title">{title}</h2>
    {actions.map((action) => <ActionButton key={action.label} action={action}/>)}
  </section>
}

export function PendingState({ title, detail }: { title: string; detail?: string }) {
  return <div className="pending-state" role="status">
    <strong>{title}</strong>
    {detail && <p>{detail}</p>}
  </div>
}

export function DashboardCard({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`app-card dashboard-card ${className}`}>
    <header className="dashboard-card-header"><h2>{title}</h2>{action}</header>
    {children}
  </section>
}
