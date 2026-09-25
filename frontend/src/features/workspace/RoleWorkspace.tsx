import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AUTH_FORBIDDEN_EVENT } from '../../service/api-client'
import { useAuth } from '../authentication/use-auth'
import type { UserRole } from '../authentication/auth-types'
import { AdminBranchesScreen } from './AdminBranchesScreen'
import { AdminPaymentsScreen } from './AdminPaymentsScreen'
import { AdminUsersScreen } from './AdminUsersScreen'
import { UnavailableState } from './ApiStates'
import { Icon, type IconName } from './Icon'
import { MemberPaymentsScreen } from './MemberPaymentsScreen'
import { ProfileScreen } from './ProfileScreen'
import { TrainerDirectoryScreen } from './TrainerDirectoryScreen'

type Entry = { label: string; href: string; icon: IconName }

const NAVIGATION: Record<UserRole, Entry[]> = {
  MEMBER: [
    { label: 'Inicio', href: '', icon: 'home' },
    { label: 'Mi perfil', href: 'perfil', icon: 'user' },
    { label: 'Pagos', href: 'pagos', icon: 'wallet' },
    { label: 'Entrenadores', href: 'entrenadores', icon: 'users' },
    { label: 'Clases', href: 'clases', icon: 'calendar' },
    { label: 'Apto médico', href: 'apto-medico', icon: 'file' },
    { label: 'Acceso QR', href: 'acceso', icon: 'qr' },
    { label: 'Eventos', href: 'eventos', icon: 'trophy' },
    { label: 'Novedades', href: 'novedades', icon: 'megaphone' },
    { label: 'Notificaciones', href: 'notificaciones', icon: 'bell' },
  ],
  TRAINER: [
    { label: 'Inicio', href: '', icon: 'home' },
    { label: 'Mi perfil', href: 'perfil', icon: 'user' },
    { label: 'Mis clases', href: 'clases', icon: 'calendar' },
    { label: 'Acceso QR', href: 'acceso', icon: 'qr' },
    { label: 'Eventos', href: 'eventos', icon: 'trophy' },
    { label: 'Novedades', href: 'novedades', icon: 'megaphone' },
    { label: 'Notificaciones', href: 'notificaciones', icon: 'bell' },
  ],
  ADMIN: [
    { label: 'Panel', href: '', icon: 'chart' },
    { label: 'Usuarios', href: 'usuarios', icon: 'users' },
    { label: 'Pagos y cuota', href: 'pagos', icon: 'wallet' },
    { label: 'Sedes', href: 'sedes', icon: 'building' },
    { label: 'Clases', href: 'clases', icon: 'calendar' },
    { label: 'Aptos médicos', href: 'aptos', icon: 'file' },
    { label: 'Accesos', href: 'accesos', icon: 'qr' },
    { label: 'Eventos', href: 'eventos', icon: 'trophy' },
    { label: 'Novedades', href: 'novedades', icon: 'megaphone' },
  ],
}

const TITLES: Record<string, string> = {
  '': 'Inicio',
  perfil: 'Mi perfil',
  pagos: 'Pagos y cuota',
  entrenadores: 'Entrenadores',
  clases: 'Clases',
  'apto-medico': 'Apto médico',
  aptos: 'Aptos médicos',
  acceso: 'Acceso QR',
  accesos: 'Accesos',
  eventos: 'Eventos',
  novedades: 'Novedades',
  notificaciones: 'Notificaciones',
  usuarios: 'Usuarios',
  sedes: 'Sedes',
}

export function RoleWorkspace({ role }: { role: UserRole }) {
  const { session, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const base = role === 'MEMBER' ? '/socio' : role === 'TRAINER' ? '/entrenador' : '/admin'
  const path = location.pathname.replace(base, '').replace(/^\//, '')
  const segment = path.split('/')[0]
  const entries = NAVIGATION[role]
  const activeNav = entries.find((entry) => entry.href === segment) ?? entries[0]
  const title = TITLES[segment] ?? 'Inicio'
  const [permissionNotice, setPermissionNotice] = useState('')

  useEffect(() => {
    const showForbidden = () => setPermissionNotice('No tenés permisos suficientes para realizar esa operación.')
    window.addEventListener(AUTH_FORBIDDEN_EVENT, showForbidden)
    return () => window.removeEventListener(AUTH_FORBIDDEN_EVENT, showForbidden)
  }, [])

  if (session?.user.role !== role) {
    const roleBase = session?.user.role === 'ADMIN' ? '/admin' : session?.user.role === 'TRAINER' ? '/entrenador' : '/socio'
    return <Navigate to={roleBase} replace/>
  }

  async function handleLogout() {
    await logout()
    navigate('/iniciar-sesion', { replace: true })
  }

  return <div className="workspace-shell">
    <aside className="workspace-sidebar">
      <Link to={base} className="workspace-brand"><span className="brand-mark">M</span><span>M-TEAM <b>GIMNASIO</b></span></Link>
      <div className="workspace-role">{role === 'MEMBER' ? 'SOCIO' : role === 'TRAINER' ? 'ENTRENADOR' : 'ADMINISTRADOR'}</div>
      <nav>{entries.map((entry) => <Link key={entry.href} className={activeNav.href === entry.href ? 'selected' : ''} to={entry.href ? `${base}/${entry.href}` : base}><Icon name={entry.icon} size={22}/><span>{entry.label}</span></Link>)}</nav>
      <button className="sidebar-logout" onClick={() => void handleLogout()}><Icon name="logout"/><span>Cerrar sesión</span></button>
    </aside>
    <div className="workspace-main">
      <header className="workspace-topbar"><div className="breadcrumbs">M-TEAM <Icon name="chevron" size={15}/> {title}</div><div className="topbar-user"><span className="avatar">{session?.user.firstName.slice(0, 1)}{session?.user.lastName.slice(0, 1)}</span><div><strong>{session?.user.firstName} {session?.user.lastName}</strong><small>{role === 'MEMBER' ? 'Socio' : role === 'TRAINER' ? 'Entrenador' : 'Administrador'}</small></div><button className="icon-action" aria-label="Cerrar sesión" onClick={() => void handleLogout()}><Icon name="logout"/></button></div></header>
      <main className="workspace-content"><div className="workspace-page-heading"><div><span className="eyebrow">{role === 'ADMIN' ? 'PANEL DE ADMINISTRACIÓN' : role === 'TRAINER' ? 'ÁREA DE ENTRENADOR' : 'MI ESPACIO'}</span><h1>{title}</h1></div></div>{permissionNotice && <div className="error-message" role="alert">{permissionNotice}<button className="text-link" onClick={() => setPermissionNotice('')}>Cerrar</button></div>}{renderScreen()}</main>
    </div>
    <nav className="workspace-mobile-tabs">{entries.slice(0, 5).map((entry) => <Link key={entry.href} className={activeNav.href === entry.href ? 'selected' : ''} to={entry.href ? `${base}/${entry.href}` : base}><Icon name={entry.icon}/><span>{entry.label.replace('Mi ', '').replace('Mis ', '').replace(' y cuota', '')}</span></Link>)}</nav>
  </div>

  function renderScreen() {
    if (!segment) return <UnavailableState module="Dashboard"/>
    if (segment === 'perfil') return <ProfileScreen role={role} onPasswordChange={() => navigate('/cambiar-contrasena-voluntario')}/>
    if (segment === 'pagos' && role === 'MEMBER') return <MemberPaymentsScreen/>
    if (segment === 'entrenadores' && role === 'MEMBER') return <TrainerDirectoryScreen/>
    if (segment === 'usuarios' && role === 'ADMIN') return <AdminUsersScreen/>
    if (segment === 'pagos' && role === 'ADMIN') return <AdminPaymentsScreen/>
    if (segment === 'sedes' && role === 'ADMIN') return <AdminBranchesScreen/>
    if (segment === 'clases') return <UnavailableState module={role === 'TRAINER' ? 'Clases asignadas' : 'Cronograma semanal'}/>
    if (segment === 'apto-medico' || segment === 'aptos') return <UnavailableState module="Aptos médicos"/>
    if (segment === 'acceso' || segment === 'accesos') return <UnavailableState module="Acceso mediante QR"/>
    if (segment === 'eventos') return <UnavailableState module="Eventos"/>
    if (segment === 'novedades') return <UnavailableState module="Novedades"/>
    if (segment === 'notificaciones') return <UnavailableState module="Notificaciones"/>
    return <Navigate to={base} replace/>
  }
}
