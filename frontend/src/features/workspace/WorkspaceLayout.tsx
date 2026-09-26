import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser } from '../authentication/auth-types'
import { Icon } from './Icon'
import { MobileTabBar } from './MobileTabBar'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import type { NavEntry } from './navigation'

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
  return <div className="app-shell">
    <WorkspaceSidebar user={user} active={active} onLogout={onLogout}/>
    <div className="app-main">
      <header className="app-topbar">
        {mobileBackHref && <Link className="app-topbar-back" to={mobileBackHref} aria-label="Volver"><Icon name="back" size={22}/></Link>}
        <h1 className="app-topbar-title">{mobileTitle ?? title}</h1>
      </header>
      <main className="app-content">
        {notice && <div className="app-notice-error" role="alert"><Icon name="alert" size={20}/><span>{notice}</span><button type="button" className="text-link" onClick={onDismissNotice}>Cerrar</button></div>}
        {children}
      </main>
    </div>
    <MobileTabBar role={user.role} active={active}/>
  </div>
}
