import { Link, useLocation } from 'react-router-dom'
import type { UserRole } from '../authentication/auth-types'
import { Icon } from './Icon'
import { hrefFor, mobileTabs, type NavEntry } from './navigation'

export function MobileTabBar({ role, active }: { role: UserRole; active: NavEntry }) {
  const { pathname } = useLocation()
  return <nav className="app-tabbar" aria-label="Navegación inferior">
    {mobileTabs(role).map((entry) => {
      const selected = entry.href === active.href || (role === 'ADMIN' && entry.href === 'perfil' && pathname === hrefFor(role, 'perfil'))
      return <Link key={entry.href} to={hrefFor(role, entry.href)} className={selected ? 'app-tab is-active' : 'app-tab'} aria-current={selected ? 'page' : undefined}>
        <Icon name={entry.icon} size={22}/>
        <span>{entry.tabLabel}</span>
      </Link>
    })}
  </nav>
}
