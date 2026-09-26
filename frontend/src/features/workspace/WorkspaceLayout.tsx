import type { ReactNode } from 'react'
import type { AuthUser } from '../authentication/auth-types'
import { Icon } from './Icon'
import { MobileTabBar } from './MobileTabBar'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import type { NavEntry } from './navigation'

export function WorkspaceLayout({ user, active, title, notice, onDismissNotice, onLogout, children }: {
  user: AuthUser
  active: NavEntry
  title: string
  notice?: string
  onDismissNotice: () => void
  onLogout: () => void
  children: ReactNode
}) {
  return <div className="app-shell">
    <WorkspaceSidebar user={user} active={active} onLogout={onLogout}/>
    <div className="app-main">
      <header className="app-topbar">
        <h1 className="app-topbar-title">{title}</h1>
      </header>
      <main className="app-content">
        {notice && <div className="app-notice-error" role="alert"><Icon name="alert" size={20}/><span>{notice}</span><button type="button" className="text-link" onClick={onDismissNotice}>Cerrar</button></div>}
        {children}
      </main>
    </div>
    <MobileTabBar role={user.role} active={active}/>
  </div>
}
