import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AUTH_FORBIDDEN_EVENT } from '../../service/api-client'
import type { AdminUserDetail } from '../../service/backend-api'
import { useAuth } from '../authentication/use-auth'
import type { UserRole } from '../authentication/auth-types'
import { AdminDashboardScreen } from '../dashboard/AdminDashboardScreen'
import { MemberDashboardScreen } from '../dashboard/MemberDashboardScreen'
import { TrainerDashboardScreen } from '../dashboard/TrainerDashboardScreen'
import { WeeklyScheduleScreen } from '../schedule/WeeklyScheduleScreen'
import { AdminBranchesScreen } from './AdminBranchesScreen'
import { AdminPaymentsScreen } from './AdminPaymentsScreen'
import { AdminUsersScreen } from './AdminUsersScreen'
import { UserDetailScreen } from './UserDetailScreen'
import { UnavailableScreen } from './ApiStates'
import { MemberPaymentsScreen } from './MemberPaymentsScreen'
import { AdminMedicalCertificatesScreen } from './AdminMedicalCertificatesScreen'
import { AdminMedicalReviewScreen } from './AdminMedicalReviewScreen'
import { MemberMedicalCertificateScreen } from './MemberMedicalCertificateScreen'
import { EventsScreen } from '../communications/EventsScreen'
import { NewsScreen } from '../communications/NewsScreen'
import { NotificationsProvider } from '../communications/NotificationsProvider'
import { NotificationsScreen } from '../communications/NotificationsScreen'
import { FrequentlyAskedQuestionsPage } from '../public-site/FrequentlyAskedQuestionsPage'
import { ProfileScreen } from './ProfileScreen'
import { TrainerDirectoryScreen } from './TrainerDirectoryScreen'
import { AccessScanScreen } from './AccessScanScreen'
import { AdminAccessAttemptsScreen } from './AdminAccessAttemptsScreen'
import { WorkspaceLayout } from './WorkspaceLayout'
import { ROLE_BASE, resolveSection } from './navigation'

const UNAVAILABLE: Record<string, { module: string; roles: UserRole[] }> = {
  notificaciones: { module: 'Notificaciones', roles: ['MEMBER', 'TRAINER'] },
}

export function RoleWorkspace({ role }: { role: UserRole }) {
  const { session, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [permissionNotice, setPermissionNotice] = useState('')
  const [memberDetail, setMemberDetail] = useState<AdminUserDetail | null>(null)
  const base = ROLE_BASE[role]
  const pathSegments = location.pathname.replace(base, '').split('/').filter(Boolean)
  const segment = pathSegments[0] ?? ''
  const nestedId = pathSegments[1]
  const { active, title } = resolveSection(role, segment)
  const isAdminUserDetail = role === 'ADMIN' && segment === 'usuarios' && Boolean(nestedId)
  const screenTitle = isAdminUserDetail ? 'Detalle de usuario' : role === 'ADMIN' && segment === 'aptos' && nestedId ? 'Revisar apto médico' : title

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

  // Keyed by account so that a different user never inherits the previous unread counter.
  return <NotificationsProvider key={session.user.id} enabled={role !== 'ADMIN'}>
    <WorkspaceLayout
      user={session.user}
      active={active}
      title={screenTitle}
      mobileBackHref={segment === 'eventos' ? base : isAdminUserDetail ? `/admin/usuarios${location.search}` : role === 'ADMIN' && segment === 'aptos' && nestedId ? '/admin/aptos' : role === 'ADMIN' && ['sedes', 'novedades'].includes(segment) ? '/admin' : undefined}
      mobileTitle={isAdminUserDetail ? memberDetail?.id === nestedId ? `${memberDetail.firstName} ${memberDetail.lastName}` : 'Detalle de usuario' : role === 'ADMIN' && segment === 'aptos' && nestedId ? 'Revisar apto' : undefined}
      notice={permissionNotice}
      onDismissNotice={() => setPermissionNotice('')}
      onLogout={() => void handleLogout()}
    >
      {renderScreen()}
    </WorkspaceLayout>
  </NotificationsProvider>

  function renderScreen() {
    if (!segment) {
      if (role === 'ADMIN') return <AdminDashboardScreen onLogout={() => void handleLogout()}/>
      if (role === 'TRAINER') return <TrainerDashboardScreen/>
      return <MemberDashboardScreen/>
    }
    if (segment === 'perfil') return <ProfileScreen role={role} onPasswordChange={() => navigate('/cambiar-contrasena-voluntario')} onLogout={() => void handleLogout()}/>
    if (segment === 'clases') return <WeeklyScheduleScreen variant={role === 'ADMIN' ? 'admin' : role === 'TRAINER' ? 'trainer' : 'member'}/>
    if (role === 'MEMBER' && segment === 'pagos') return <MemberPaymentsScreen/>
    if (role === 'MEMBER' && segment === 'apto-medico') return <MemberMedicalCertificateScreen/>
    if (role === 'MEMBER' && segment === 'entrenadores') return <TrainerDirectoryScreen/>
    if (role === 'ADMIN' && segment === 'usuarios') return nestedId ? <UserDetailScreen id={nestedId} onMemberLoaded={setMemberDetail}/> : <AdminUsersScreen/>
    if (role === 'ADMIN' && segment === 'pagos') return <AdminPaymentsScreen/>
    if (role === 'ADMIN' && segment === 'sedes') return <AdminBranchesScreen/>
    if (role === 'ADMIN' && segment === 'aptos') return nestedId
      ? <AdminMedicalReviewScreen id={nestedId}/>
      : <AdminMedicalCertificatesScreen/>
    if (segment === 'eventos') return <EventsScreen isAdmin={role === 'ADMIN'}/>
    if (segment === 'novedades') return <NewsScreen isAdmin={role === 'ADMIN'}/>
    if (segment === 'acceso' && (role === 'MEMBER' || role === 'TRAINER')) return <AccessScanScreen role={role}/>
    if (role === 'ADMIN' && segment === 'accesos') return <AdminAccessAttemptsScreen/>
    if (segment === 'notificaciones' && role !== 'ADMIN') return <NotificationsScreen/>
    if (segment === 'preguntas-frecuentes') return <FrequentlyAskedQuestionsPage role={role}/>
    const unavailable = UNAVAILABLE[segment]
    if (unavailable?.roles.includes(role)) return <UnavailableScreen title={title} module={unavailable.module}/>
    return <Navigate to={base} replace/>
  }
}
