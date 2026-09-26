import { useApiResource } from '../../hooks/use-api-resource'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { backendApi } from '../../service/backend-api'
import { gymDate } from '../../service/date-time'
import { useAuth } from '../authentication/use-auth'
import { ErrorState, LoadingState } from '../workspace/ApiStates'
import { ActionButton, DashboardCard, DashboardHeader, PendingState, QuickActions, StatusCard, type QuickAction, type StatusTone } from './DashboardParts'
import { formatMoney, formatNumericDate, loadRevenueWeek, type RevenueWeek } from './dashboard-data'
import './dashboard.css'

const NO_API = 'El backend todavía no expone esta funcionalidad'

const ACTIONS: QuickAction[] = [
  { label: 'Registrar un pago', icon: 'wallet', to: '/admin/pagos', primary: true },
  { label: 'Crear una cuenta', icon: 'users', to: '/admin/usuarios' },
  { label: 'Revisar aptos médicos', icon: 'file', to: '/admin/aptos' },
  { label: 'Publicar una novedad', icon: 'megaphone', unavailableReason: NO_API },
]

const MORE_SECTIONS: QuickAction[] = [
  { label: 'Accesos', icon: 'qr', to: '/admin/accesos' },
  { label: 'Sedes', icon: 'building', to: '/admin/sedes' },
  { label: 'Eventos', icon: 'trophy', to: '/admin/eventos' },
  { label: 'Novedades', icon: 'megaphone', to: '/admin/novedades' },
]

const ACCESS_UNAVAILABLE = 'Historial de accesos no disponible'

// Each source loads independently so one failing request does not blank the whole panel.
const loadActiveMembers = async () =>
  (await backendApi.listUsers({ role: 'MEMBER', status: 'ACTIVE', page: 1, limit: 1 })).total

const loadMembershipTotals = async () => {
  const [current, expiringSoon, expired] = await Promise.all([
    backendApi.listMembers({ membershipStatus: 'CURRENT', page: 1, limit: 1 }),
    backendApi.listMembers({ membershipStatus: 'EXPIRING_SOON', page: 1, limit: 1 }),
    backendApi.listMembers({ membershipStatus: 'EXPIRED', page: 1, limit: 1 }),
  ])
  return { upToDate: current.total + expiringSoon.total, expired: expired.total }
}

const loadRevenue = () => loadRevenueWeek()

const loadPendingMedicalCertificates = async () =>
  (await backendApi.listAdminMedicalCertificates({ status: 'PENDING', page: 1, limit: 1 })).total

function MetricCard({ label, tone, value, loading, error, to }: { label: string; tone: StatusTone; value: number | undefined; loading: boolean; error: string; to?: string }) {
  if (loading) return <StatusCard label={label} value="—" tone={tone} sub="Cargando…" to={to}/>
  if (error || value === undefined) return <StatusCard label={label} value="—" tone={tone} sub="No se pudo cargar" to={to}/>
  return <StatusCard label={label} value={String(value)} tone={tone} to={to}/>
}

export function AdminDashboardScreen() {
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const activeMembers = useApiResource(loadActiveMembers)
  const membership = useApiResource(loadMembershipTotals)
  const revenue = useApiResource(loadRevenue)
  const pendingMedicalCertificates = useApiResource(loadPendingMedicalCertificates)
  const greeting = `Buen día, ${session?.user.firstName ?? ''}`

  const metricErrors = [activeMembers.error, membership.error].filter(Boolean)
  const statusSection = <>
    <div className="status-grid">
      <MetricCard label="SOCIOS ACTIVOS" tone="black" value={activeMembers.data ?? undefined} loading={activeMembers.loading} error={activeMembers.error}/>
      <MetricCard label="CUOTAS AL DÍA" tone="blue" value={membership.data?.upToDate} loading={membership.loading} error={membership.error}/>
      <MetricCard label="CUOTAS VENCIDAS" tone="pink" value={membership.data?.expired} loading={membership.loading} error={membership.error}/>
      <MetricCard label="APTOS PENDIENTES" tone="purple" value={pendingMedicalCertificates.data ?? undefined} loading={pendingMedicalCertificates.loading} error={pendingMedicalCertificates.error} to="/admin/aptos"/>
    </div>
    {metricErrors.length > 0 && <p className="error-message" role="alert">
      {metricErrors.join(' · ')}
      <button type="button" className="text-link" onClick={() => {
        if (activeMembers.error) void activeMembers.reload()
        if (membership.error) void membership.reload()
      }}>Reintentar</button>
    </p>}
  </>

  if (isMobile) {
    return <div className="app-page dashboard-screen">
      <DashboardHeader greeting={greeting} intro={`Resumen de hoy · ${formatNumericDate(gymDate())}`}/>
      {statusSection}
      <QuickActions title="Acciones frecuentes" actions={ACTIONS}/>
      <DashboardCard title="Más secciones">
        <div className="more-sections">{MORE_SECTIONS.map((action) => <ActionButton key={action.label} action={action}/>)}</div>
      </DashboardCard>
      <DashboardCard title="Últimos accesos"><PendingState title={ACCESS_UNAVAILABLE}/></DashboardCard>
    </div>
  }

  return <div className="app-page dashboard-screen">
    <DashboardHeader eyebrow="PANEL ADMINISTRATIVO" greeting={greeting} intro="Resumen de socios, cuotas, aptos médicos y accesos de M-TEAM."/>
    {statusSection}
    <div className="admin-panel-grid">
      <RevenueCard loading={revenue.loading} error={revenue.error} data={revenue.data} retry={() => void revenue.reload()}/>
      <QuickActions title="Acciones frecuentes" actions={ACTIONS}/>
      <DashboardCard title="Últimos intentos de acceso" className="access-card">
        <PendingState title={ACCESS_UNAVAILABLE} detail="Este módulo requiere el backend de control de accesos."/>
      </DashboardCard>
      <DashboardCard title="Período inicial de 20 días" className="initial-period-card">
        <PendingState title="Backend pendiente" detail="La API no informa la fecha del primer pago ni el estado del apto médico de cada socio."/>
      </DashboardCard>
    </div>
  </div>
}

function RevenueCard({ loading, error, data, retry }: { loading: boolean; error: string; data: RevenueWeek | null; retry: () => void }) {
  const max = Math.max(...(data?.days.map((day) => day.amount) ?? [0]), 0)
  return <DashboardCard
    title="Recaudación de los últimos 7 días"
    className="revenue-card"
    action={data && !loading && !error ? <strong className="revenue-total">{formatMoney(data.total)}</strong> : undefined}
  >
    {loading ? <LoadingState message="Cargando recaudación…"/> : error || !data ? <ErrorState message={error || 'No se pudo cargar la recaudación.'} retry={retry}/> : <div className="revenue-bars" role="list" aria-label="Recaudación diaria">
      {data.days.map((day, index) => <div key={day.date} className="revenue-bar-slot" role="listitem" aria-label={`${formatNumericDate(day.date)}: ${formatMoney(day.amount)}`}>
        <span className={index === data.days.length - 1 ? 'revenue-bar is-today' : 'revenue-bar'} style={{ height: max > 0 ? `${Math.max((day.amount / max) * 100, 4)}%` : '4%' }}/>
      </div>)}
    </div>}
  </DashboardCard>
}
