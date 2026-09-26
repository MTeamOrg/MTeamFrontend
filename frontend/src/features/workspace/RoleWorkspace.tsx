import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AUTH_FORBIDDEN_EVENT } from '../../service/api-client'
import { useAuth } from '../authentication/use-auth'
import type { UserRole } from '../authentication/auth-types'
import { AdminDashboardScreen } from '../dashboard/AdminDashboardScreen'
import { MemberDashboardScreen } from '../dashboard/MemberDashboardScreen'
import { TrainerDashboardScreen } from '../dashboard/TrainerDashboardScreen'
import { WeeklyScheduleScreen } from '../schedule/WeeklyScheduleScreen'
import { AdminBranchesScreen } from './AdminBranchesScreen'
import { AdminPaymentsScreen } from './AdminPaymentsScreen'
import { AdminUsersScreen } from './AdminUsersScreen'
import { UnavailableScreen } from './ApiStates'
import { MemberPaymentsScreen } from './MemberPaymentsScreen'
import { AdminMedicalCertificatesScreen } from './AdminMedicalCertificatesScreen'
import { AdminMedicalReviewScreen } from './AdminMedicalReviewScreen'
import { MemberMedicalCertificateScreen } from './MemberMedicalCertificateScreen'
import { ProfileScreen } from './ProfileScreen'
import { TrainerDirectoryScreen } from './TrainerDirectoryScreen'
import { WorkspaceLayout } from './WorkspaceLayout'
import { ROLE_BASE, resolveSection } from './navigation'

const UNAVAILABLE: Record<string, { module: string; roles: UserRole[] }> = {
  acceso: { module: 'Acceso QR', roles: ['MEMBER', 'TRAINER'] },
  accesos: { module: 'Accesos', roles: ['ADMIN'] },
  eventos: { module: 'Eventos', roles: ['MEMBER', 'TRAINER', 'ADMIN'] },
  novedades: { module: 'Novedades', roles: ['MEMBER', 'TRAINER', 'ADMIN'] },
  notificaciones: { module: 'Notificaciones', roles: ['MEMBER', 'TRAINER'] },
}

export function RoleWorkspace({ role }: { role: UserRole }) {
  const { session, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [permissionNotice, setPermissionNotice] = useState('')
  const base = ROLE_BASE[role]
  const pathSegments = location.pathname.replace(base, '').split('/').filter(Boolean)
  const segment = pathSegments[0] ?? ''
  const nestedId = pathSegments[1]
  const { active, title } = resolveSection(role, segment)
  const screenTitle = role === 'ADMIN' && segment === 'aptos' && nestedId ? 'Revisar apto médico' : title

  useEffect(() => {
    const showForbidden = () => setPermissionNotice('No tenés permisos suficientes para realizar esa operación.')
    window.addEventListener(AUTH_FORBIDDEN_EVENT, showForbidden)
    return () => window.removeEventListener(AUTH_FORBIDDEN_EVENT, showForbidden)
  }, [])

  if (!session || session.user.role !== role) {
    return <Navigate to={session ? ROLE_BASE[session.user.role] : '/iniciar-sesion'} replace/>
  }

  async function handleLogout() {
    await logout()
    navigate('/iniciar-sesion', { replace: true })
  }

  return <WorkspaceLayout
    user={session.user}
    active={active}
    title={screenTitle}
    mobileBackHref={role === 'ADMIN' && segment === 'aptos' && nestedId ? '/admin/aptos' : undefined}
    mobileTitle={role === 'ADMIN' && segment === 'aptos' && nestedId ? 'Revisar apto' : undefined}
    notice={permissionNotice}
    onDismissNotice={() => setPermissionNotice('')}
    onLogout={() => void handleLogout()}
  >
    {renderScreen()}
  </WorkspaceLayout>

  function renderScreen() {
    if (!segment) {
      if (role === 'ADMIN') return <AdminDashboardScreen/>
      if (role === 'TRAINER') return <TrainerDashboardScreen/>
      return <MemberDashboardScreen/>
    }
    if (segment === 'perfil') return <ProfileScreen role={role} onPasswordChange={() => navigate('/cambiar-contrasena-voluntario')}/>
    if (segment === 'clases') return <WeeklyScheduleScreen variant={role === 'ADMIN' ? 'admin' : role === 'TRAINER' ? 'trainer' : 'member'}/>
    if (role === 'MEMBER' && segment === 'pagos') return <MemberPaymentsScreen/>
    if (role === 'MEMBER' && segment === 'apto-medico') return <MemberMedicalCertificateScreen/>
    if (role === 'MEMBER' && segment === 'entrenadores') return <TrainerDirectoryScreen/>
    if (role === 'ADMIN' && segment === 'usuarios') return <AdminUsersScreen/>
    if (role === 'ADMIN' && segment === 'pagos') return <AdminPaymentsScreen/>
    if (role === 'ADMIN' && segment === 'sedes') return <AdminBranchesScreen/>
    if (role === 'ADMIN' && segment === 'aptos') return nestedId
      ? <AdminMedicalReviewScreen id={nestedId}/>
      : <AdminMedicalCertificatesScreen/>
    const unavailable = UNAVAILABLE[segment]
    if (unavailable?.roles.includes(role)) return <UnavailableScreen title={title} module={unavailable.module}/>
    return <Navigate to={base} replace/>
  }
}
