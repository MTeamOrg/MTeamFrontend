import { Link } from 'react-router-dom'
import type { AuthUser } from '../authentication/auth-types'
import { Icon } from './Icon'
import { NAVIGATION, ROLE_BASE, ROLE_LABEL, hrefFor, type NavEntry } from './navigation'

export function WorkspaceSidebar({ user, active, onLogout }: { user: AuthUser; active: NavEntry; onLogout: () => void }) {
  const role = user.role
  return <aside className="app-sidebar">
    <Link to={ROLE_BASE[role]} className="app-sidebar-brand" aria-label="M-TEAM Gimnasio, inicio">
      <span className="app-brand-mark" aria-hidden="true">M</span>
      <span className="app-brand-name">M-TEAM <span>GIMNASIO</span></span>
    </Link>
    <nav className="app-sidebar-nav" aria-label="Navegación principal">
      {NAVIGATION[role].map((entry) => {
        const selected = entry.href === active.href
        return <Link key={entry.href} to={hrefFor(role, entry.href)} className={selected ? 'app-nav-item is-active' : 'app-nav-item'} aria-current={selected ? 'page' : undefined}>
          <Icon name={entry.icon} size={22}/>
          <span>{entry.label}</span>
        </Link>
      })}
    </nav>
    <div className="app-sidebar-footer">
      <div className="app-sidebar-user">
        <span className="app-avatar" aria-hidden="true">{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</span>
        <div>
          <strong>{user.firstName} {user.lastName}</strong>
          <small>{ROLE_LABEL[role]}</small>
        </div>
      </div>
      <button type="button" className="app-sidebar-logout" onClick={onLogout}>
        <Icon name="logout" size={20}/>
        <span>Cerrar sesión</span>
      </button>
    </div>
  </aside>
}
