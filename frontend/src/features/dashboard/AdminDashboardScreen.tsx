import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { backendApi, type AccessAttempt, type WeeklySchedule } from '../../service/backend-api'
import { addDays, formatDateTime, gymDate, mondayOfGymWeek } from '../../service/date-time'
import { useAuth } from '../authentication/use-auth'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { ActionButton, DashboardCard, DashboardHeader, QuickActions, StatusCard, type QuickAction, type StatusTone } from './DashboardParts'
import { formatDayMonth, formatMoney, formatNumericDate, loadRevenueWeek, type RevenueWeek } from './dashboard-data'
import { weekRangeLabel } from '../schedule/schedule-model'
import './dashboard.css'

const ROLE_LABEL = { MEMBER: 'Socio', TRAINER: 'Entrenador', ADMIN: 'Administrador' } as const
const NO_API = 'El backend todavía no expone esta funcionalidad'
const MORE_SECTIONS: QuickAction[] = [
  { label: 'Accesos', icon: 'qr', to: '/admin/accesos' },
  { label: 'Sedes', icon: 'building', to: '/admin/sedes' },
  { label: 'Eventos', icon: 'trophy', to: '/admin/eventos' },
  { label: 'Novedades', icon: 'megaphone', to: '/admin/novedades' },
]

function buildActions(pendingMedicalCertificates: number | undefined): QuickAction[] {
  const pendingLabel = pendingMedicalCertificates === undefined
    ? 'Revisar aptos médicos'
    : `Revisar aptos médicos (${pendingMedicalCertificates})`
  return [
    { label: 'Registrar un pago', icon: 'wallet', to: '/admin/pagos', primary: true },
    { label: pendingLabel, icon: 'file', to: '/admin/aptos' },
    { label: 'Crear una cuenta', icon: 'users', to: '/admin/usuarios' },
    { label: 'Publicar una novedad', icon: 'megaphone', unavailableReason: NO_API },
  ]
}

function MetricCard({ label, tone, value, loading, error, to, unit, sub }: { label: string; tone: StatusTone; value: number | undefined; loading: boolean; error: string; to: string; unit: string; sub?: string }) {
  if (loading) return <StatusCard label={label} value="—" tone={tone} sub="Cargando…" to={to}/>
  if (error || value === undefined) return <StatusCard label={label} value="—" tone={tone} sub="No se pudo cargar" to={to}/>
  return <StatusCard label={label} value={`${value} ${unit}`} tone={tone} sub={sub} to={to}/>
}

export function AdminDashboardScreen() {
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const metrics = useApiResource(backendApi.getAdminDashboardMetrics)
  const revenue = useApiResource(loadRevenueWeek)
  const access = useApiResource(useCallback(() => backendApi.listAccessAttempts({ page: 1, limit: 4 }), []))
  const schedule = useApiResource(useCallback(async () => {
    const weekStartsOn = mondayOfGymWeek()
    const nextWeekStartsOn = addDays(weekStartsOn, 7)
    const [current, next] = await Promise.all([
      backendApi.getWeeklySchedule(weekStartsOn),
      backendApi.getWeeklySchedule(nextWeekStartsOn),
    ])
    return { current, next, nextWeekStartsOn }
  }, []))
  const greeting = `Buen día, ${session?.user.firstName ?? ''}`
  const actions = buildActions(metrics.data?.pendingMedicalCertificates)
  const statusSection = <>
    <div className="status-grid admin-metrics-grid">
      <MetricCard label="SOCIOS ACTIVOS" tone="black" value={metrics.data?.activeMembers} loading={metrics.loading} error={metrics.error} to="/admin/usuarios?role=MEMBER&status=ACTIVE" unit="socios" sub={metrics.data ? `${metrics.data.inactiveMembers} desactivados` : undefined}/>
      <MetricCard label="CUOTAS AL DÍA" tone="blue" value={metrics.data?.currentMemberships} loading={metrics.loading} error={metrics.error} to="/admin/usuarios?role=MEMBER&membershipStatus=CURRENT" unit="socios" sub={metrics.data ? `${metrics.data.expiringMemberships} próximas a vencer` : undefined}/>
      <MetricCard label="CUOTAS VENCIDAS" tone="pink" value={metrics.data?.expiredMemberships} loading={metrics.loading} error={metrics.error} to="/admin/usuarios?role=MEMBER&membershipStatus=EXPIRED" unit="socios" sub="Requieren seguimiento"/>
      <MetricCard label="APTOS PENDIENTES" tone="purple" value={metrics.data?.pendingMedicalCertificates} loading={metrics.loading} error={metrics.error} to="/admin/aptos?status=PENDING" unit="aptos" sub={metrics.data ? `${metrics.data.rejectedMedicalCertificates} rechazados esta semana` : undefined}/>
    </div>
    {metrics.error && <p className="error-message" role="alert">{metrics.error} <button type="button" className="text-link" onClick={() => void metrics.reload()}>Reintentar</button></p>}
  </>

  if (isMobile) {
    return <div className="app-page dashboard-screen">
      <DashboardHeader greeting={greeting} intro={`Resumen de hoy · ${formatNumericDate(gymDate())}`}/>
      {statusSection}
      <QuickActions title="Acciones frecuentes" actions={actions.slice(0, 3)}/>
      <DashboardCard title="Más secciones"><div className="more-sections">{MORE_SECTIONS.map((action) => <ActionButton key={action.label} action={action}/>)}</div></DashboardCard>
      <AccessAttemptsCard loading={access.loading} error={access.error} data={access.data?.items ?? []} retry={() => void access.reload()} isMobile/>
    </div>
  }

  return <div className="app-page dashboard-screen">
    <DashboardHeader eyebrow="PANEL ADMINISTRATIVO" greeting={greeting} intro="Resumen de socios, cuotas, aptos médicos y accesos de M-TEAM."/>
    {statusSection}
    <div className="admin-panel-grid">
      <div className="admin-dashboard-column admin-dashboard-main-column">
        <RevenueCard loading={revenue.loading} error={revenue.error} data={revenue.data} retry={() => void revenue.reload()}/>
        <AccessAttemptsCard loading={access.loading} error={access.error} data={access.data?.items ?? []} retry={() => void access.reload()}/>
      </div>
      <div className="admin-dashboard-column admin-dashboard-side-column">
        <QuickActions title="Acciones frecuentes" actions={actions}/>
        <InitialPeriodCard loading={metrics.loading} error={metrics.error} value={metrics.data?.initialPeriodMembers} retry={() => void metrics.reload()}/>
        <ScheduleStatusCard loading={schedule.loading} error={schedule.error} data={schedule.data} retry={() => void schedule.reload()}/>
      </div>
    </div>
  </div>
}

function RevenueCard({ loading, error, data, retry }: { loading: boolean; error: string; data: RevenueWeek | null; retry: () => void }) {
  const max = Math.max(...(data?.days.map((day) => day.amount) ?? [0]), 0)
  return <DashboardCard title="Recaudación de los últimos 7 días" className="revenue-card" action={data && !loading && !error ? <strong className="revenue-total">{formatMoney(data.total)}</strong> : undefined}>{loading ? <LoadingState message="Cargando recaudación…"/> : error || !data ? <ErrorState message={error || 'No se pudo cargar la recaudación.'} retry={retry}/> : <div className="revenue-chart"><div className="revenue-bars" role="list" aria-label="Recaudación diaria">{data.days.map((day, index) => <div key={day.date} className="revenue-bar-slot" role="listitem" aria-label={`${formatNumericDate(day.date)}: ${formatMoney(day.amount)}`}><span className={index === data.days.length - 1 ? 'revenue-bar is-today' : 'revenue-bar'} style={{ height: max > 0 ? `${Math.max((day.amount / max) * 100, 4)}%` : '4%' }}/></div>)}</div><div className="revenue-dates" aria-hidden="true">{data.days.map((day) => <span key={day.date} className="revenue-bar-date">{formatDayMonth(day.date)}</span>)}</div></div>}</DashboardCard>
}

function InitialPeriodCard({ loading, error, value, retry }: { loading: boolean; error: string; value: number | undefined; retry: () => void }) {
  return <DashboardCard title="Período inicial de 20 días"><div className="initial-period-summary" role="status">{loading ? <LoadingState message="Cargando período inicial…"/> : error ? <ErrorState message={error} retry={retry}/> : <><strong>{value ?? 0} socios</strong><span>Socios que todavía pueden ingresar sin apto aprobado.</span><Link className="text-link" to="/admin/usuarios?role=MEMBER&initialPeriod=true">Ver socios en período inicial</Link></>}</div></DashboardCard>
}

function AccessAttemptsCard({ loading, error, data, retry, isMobile = false }: { loading: boolean; error: string; data: AccessAttempt[]; retry: () => void; isMobile?: boolean }) {
  return <DashboardCard title={isMobile ? 'Últimos accesos' : 'Últimos intentos de acceso'} className="access-card" action={!isMobile && <Link className="dashboard-inline-link access-history-link" to="/admin/accesos">Ver historial</Link>}>
    {loading ? <LoadingState message="Cargando accesos…"/> : error ? <ErrorState message={error} retry={retry}/> : !data.length ? <EmptyState message="No hay intentos de acceso disponibles."/> : <div className="access-attempt-list">{data.map((attempt) => <AccessAttemptCard key={attempt.id} attempt={attempt}/>)}</div>}
  </DashboardCard>
}

function AccessAttemptCard({ attempt }: { attempt: AccessAttempt }) {
  const name = attempt.user ? `${attempt.user.firstName} ${attempt.user.lastName}` : 'Usuario no disponible'
  const initials = attempt.user ? `${attempt.user.firstName[0]}${attempt.user.lastName[0]}` : '?'
  const resultLabel = attempt.result === 'ALLOWED' ? 'Permitido' : 'Rechazado'
  return <article className="access-attempt-card"><span className="access-attempt-avatar">{initials}</span><div className="access-attempt-copy"><strong>{name}</strong><small>{ROLE_LABEL[attempt.roleAtAttempt]} · {formatDateTime(attempt.attemptedAt)}</small><span>{attempt.branch?.name ?? 'Sede no disponible'}</span></div><span className={`badge ${attempt.result === 'ALLOWED' ? 'badge-info' : 'badge-primary'}`}>{resultLabel}</span></article>
}

function ScheduleStatusCard({ loading, error, data, retry }: { loading: boolean; error: string; data: { current: WeeklySchedule; next: WeeklySchedule; nextWeekStartsOn: string } | null; retry: () => void }) {
  const [copying, setCopying] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  if (loading) return <DashboardCard title="Cronograma semanal"><LoadingState message="Cargando cronograma…"/></DashboardCard>
  if (error || !data) return <DashboardCard title="Cronograma semanal"><ErrorState message={error || 'No se pudo cargar el cronograma.'} retry={retry}/></DashboardCard>
  const scheduleData = data
  const nextMissing = scheduleData.next.id === null
  async function copySchedule() {
    if (!scheduleData.current.id) return
    setCopying(true)
    setMessage(null)
    try {
      await backendApi.copyWeeklySchedule(scheduleData.current.id, scheduleData.nextWeekStartsOn)
      setMessage({ tone: 'success', text: 'Se generó el cronograma de la semana siguiente.' })
      retry()
    } catch (value) {
      setMessage({ tone: 'error', text: value instanceof Error ? value.message : 'No se pudo generar el cronograma.' })
    } finally {
      setCopying(false)
    }
  }
  return <DashboardCard title="Cronograma semanal"><div className="schedule-status-summary"><span>La {weekRangeLabel(scheduleData.nextWeekStartsOn).toLowerCase()} {nextMissing ? 'todavía no fue generada.' : 'ya fue generada.'}</span>{nextMissing && scheduleData.current.id && <button type="button" className="button button-purple button-block" onClick={() => void copySchedule()} disabled={copying}>{copying ? 'Generando…' : 'Generar desde la semana anterior'}</button>}{message && <p className={message.tone === 'error' ? 'error-message' : 'success-message'} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>}</div></DashboardCard>
}
