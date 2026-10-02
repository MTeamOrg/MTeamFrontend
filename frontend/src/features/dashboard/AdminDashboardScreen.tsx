import { Link } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { backendApi } from '../../service/backend-api'
import { gymDate } from '../../service/date-time'
import { useAuth } from '../authentication/use-auth'
import { ErrorState, LoadingState } from '../workspace/ApiStates'
import { DashboardCard, DashboardHeader, PendingState, QuickActions, StatusCard, type QuickAction, type StatusTone } from './DashboardParts'
import { formatDayMonth, formatMoney, formatNumericDate, loadRevenueWeek, type RevenueWeek } from './dashboard-data'
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

function MetricCard({ label, tone, value, loading, error, to }: { label: string; tone: StatusTone; value: number | undefined; loading: boolean; error: string; to: string }) {
  if (loading) return <StatusCard label={label} value="—" tone={tone} sub="Cargando…" to={to}/>
  if (error || value === undefined) return <StatusCard label={label} value="—" tone={tone} sub="No se pudo cargar" to={to}/>
  return <StatusCard label={label} value={String(value)} tone={tone} to={to}/>
}

export function AdminDashboardScreen() {
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const metrics = useApiResource(backendApi.getAdminDashboardMetrics)
  const revenue = useApiResource(loadRevenueWeek)
  const greeting = `Buen día, ${session?.user.firstName ?? ''}`
  const statusSection = <>
    <div className="status-grid admin-metrics-grid">
      <MetricCard label="SOCIOS ACTIVOS" tone="black" value={metrics.data?.activeMembers} loading={metrics.loading} error={metrics.error} to="/admin/usuarios?role=MEMBER&status=ACTIVE"/>
      <MetricCard label="SOCIOS INACTIVOS" tone="pink" value={metrics.data?.inactiveMembers} loading={metrics.loading} error={metrics.error} to="/admin/usuarios?role=MEMBER&status=INACTIVE"/>
      <MetricCard label="CUOTAS AL DÍA" tone="blue" value={metrics.data?.currentMemberships} loading={metrics.loading} error={metrics.error} to="/admin/usuarios?role=MEMBER&membershipStatus=CURRENT"/>
      <MetricCard label="CUOTAS PRÓXIMAS" tone="purple" value={metrics.data?.expiringMemberships} loading={metrics.loading} error={metrics.error} to="/admin/usuarios?role=MEMBER&membershipStatus=EXPIRING_SOON"/>
      <MetricCard label="CUOTAS VENCIDAS" tone="pink" value={metrics.data?.expiredMemberships} loading={metrics.loading} error={metrics.error} to="/admin/usuarios?role=MEMBER&membershipStatus=EXPIRED"/>
      <MetricCard label="APTOS PENDIENTES" tone="purple" value={metrics.data?.pendingMedicalCertificates} loading={metrics.loading} error={metrics.error} to="/admin/aptos?status=PENDING"/>
      <MetricCard label="APTOS RECHAZADOS" tone="pink" value={metrics.data?.rejectedMedicalCertificates} loading={metrics.loading} error={metrics.error} to="/admin/aptos?status=REJECTED"/>
      <MetricCard label="PERÍODO INICIAL" tone="black" value={metrics.data?.initialPeriodMembers} loading={metrics.loading} error={metrics.error} to="/admin/usuarios?role=MEMBER&initialPeriod=true"/>
    </div>
    {metrics.error && <p className="error-message" role="alert">{metrics.error} <button type="button" className="text-link" onClick={() => void metrics.reload()}>Reintentar</button></p>}
  </>

  if (isMobile) {
    return <div className="app-page dashboard-screen"><DashboardHeader greeting={greeting} intro={`Resumen de hoy · ${formatNumericDate(gymDate())}`}/>{statusSection}<QuickActions title="Acciones frecuentes" actions={ACTIONS}/><DashboardCard title="Más secciones"><QuickActions title="" actions={MORE_SECTIONS}/></DashboardCard><DashboardCard title="Últimos accesos"><PendingState title={ACCESS_UNAVAILABLE}/></DashboardCard></div>
  }
  return <div className="app-page dashboard-screen"><DashboardHeader eyebrow="PANEL ADMINISTRATIVO" greeting={greeting} intro="Resumen de socios, cuotas, aptos médicos y accesos de M-TEAM."/>{statusSection}<div className="admin-panel-grid"><RevenueCard loading={revenue.loading} error={revenue.error} data={revenue.data} retry={() => void revenue.reload()}/><QuickActions title="Acciones frecuentes" actions={ACTIONS}/><DashboardCard title="Últimos intentos de acceso" className="access-card"><PendingState title={ACCESS_UNAVAILABLE} detail="Este módulo requiere el backend de control de accesos."/></DashboardCard><DashboardCard title="Período inicial de 20 días" className="initial-period-card"><p className="pending-state" role="status"><strong>{metrics.loading ? 'Cargando…' : metrics.error ? 'No se pudo cargar' : `${metrics.data?.initialPeriodMembers ?? 0} socios`}</strong><Link className="text-link" to="/admin/usuarios?role=MEMBER&initialPeriod=true">Ver socios en período inicial</Link></p></DashboardCard></div></div>
}

function RevenueCard({ loading, error, data, retry }: { loading: boolean; error: string; data: RevenueWeek | null; retry: () => void }) {
  const max = Math.max(...(data?.days.map((day) => day.amount) ?? [0]), 0)
  return <DashboardCard title="Recaudación de los últimos 7 días" className="revenue-card" action={data && !loading && !error ? <strong className="revenue-total">{formatMoney(data.total)}</strong> : undefined}>{loading ? <LoadingState message="Cargando recaudación…"/> : error || !data ? <ErrorState message={error || 'No se pudo cargar la recaudación.'} retry={retry}/> : <div className="revenue-chart"><div className="revenue-bars" role="list" aria-label="Recaudación diaria">{data.days.map((day, index) => <div key={day.date} className="revenue-bar-slot" role="listitem" aria-label={`${formatNumericDate(day.date)}: ${formatMoney(day.amount)}`}><span className={index === data.days.length - 1 ? 'revenue-bar is-today' : 'revenue-bar'} style={{ height: max > 0 ? `${Math.max((day.amount / max) * 100, 4)}%` : '4%' }}/></div>)}</div><div className="revenue-dates" aria-hidden="true">{data.days.map((day) => <span key={day.date} className="revenue-bar-date">{formatDayMonth(day.date)}</span>)}</div></div>}</DashboardCard>
}
