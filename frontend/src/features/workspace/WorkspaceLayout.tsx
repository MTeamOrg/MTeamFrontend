import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser } from '../authentication/auth-types'
import { useNotifications } from '../communications/use-notifications'
import { Icon } from './Icon'
import { MobileTabBar } from './MobileTabBar'
import { UnreadBadge } from './UnreadBadge'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { hrefFor, type NavEntry } from './navigation'
import './workspace-user.css'

export function WorkspaceLayout({ user, active, title, notice, onDismissNotice, onLogout, mobileBackHref, mobileTitle, children }: {
  user: AuthUser
  active: NavEntry
  title: string
  notice?: string
  onDismissNotice: () => void
  onLogout: () => void
  mobileBackHref?: string
  mobileTitle?: string
  children: ReactNode
}) {
  const { unreadCount } = useNotifications()
  // The bottom tab bar has no room for them, so on phones the bell is the way into the notifications and
  // the (i) icon the way into the frequently asked questions. Administrators reach them from the panel.
  const hasNotifications = user.role !== 'ADMIN'
  return <div className="app-shell">
    <WorkspaceSidebar user={user} active={active} onLogout={onLogout}/>
    <div className="app-main">
      <header className="app-topbar">
        {mobileBackHref && <Link className="app-topbar-back" to={mobileBackHref} aria-label="Volver"><Icon name="back" size={22}/></Link>}
        <h1 className="app-topbar-title">{mobileTitle ?? title}</h1>
        {hasNotifications && <Link className={active.href === 'preguntas-frecuentes' ? 'app-topbar-help is-active' : 'app-topbar-help'} to={hrefFor(user.role, 'preguntas-frecuentes')} aria-current={active.href === 'preguntas-frecuentes' ? 'page' : undefined}>
          <Icon name="info" size={22}/>
          <span className="visually-hidden">Preguntas frecuentes</span>
        </Link>}
        {hasNotifications && <Link className={active.href === 'notificaciones' ? 'app-topbar-bell is-active' : 'app-topbar-bell'} to={hrefFor(user.role, 'notificaciones')} aria-current={active.href === 'notificaciones' ? 'page' : undefined}>
          <Icon name="bell" size={22}/>
          <span className="visually-hidden">Notificaciones</span>
          <UnreadBadge count={unreadCount}/>
        </Link>}
      </header>
      <main className="app-content">
        {notice && <div className="app-notice-error" role="alert"><Icon name="alert" size={20}/><span>{notice}</span><button type="button" className="text-link" onClick={onDismissNotice}>Cerrar</button></div>}
        {children}
      </main>
    </div>
    <MobileTabBar role={user.role} active={active}/>
  </div>
}
