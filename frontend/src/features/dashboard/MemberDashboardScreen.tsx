import { Link } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { backendApi, type MembershipStatus } from '../../service/backend-api'
import { formatDate, gymDate } from '../../service/date-time'
import { useAuth } from '../authentication/use-auth'
import { MobileClassCard } from '../schedule/ScheduledClassCard'
import { shortDateLabel, toneForIndex } from '../schedule/schedule-model'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { DashboardCard, DashboardHeader, StatusCard, type StatusTone } from './DashboardParts'
import { formatMoney, formatNumericDate } from './dashboard-data'
import './dashboard.css'

const MEMBERSHIP: Record<MembershipStatus, { label: string; tone: StatusTone }> = {
  CURRENT: { label: 'Al día', tone: 'blue' },
  EXPIRING_SOON: { label: 'Por vencer', tone: 'purple' },
  EXPIRED: { label: 'Vencida', tone: 'pink' },
}

async function loadMemberHome() {
  const [membership, payments, schedule] = await Promise.all([
    backendApi.getOwnMembership(),
    backendApi.listOwnPayments(1, 3),
    backendApi.getWeeklySchedule(),
  ])
  const now = Date.now()
  const upcoming = schedule.classes.filter((scheduledClass) => new Date(scheduledClass.startsAt).getTime() > now).slice(0, 4)
  return { membership, payments, upcoming }
}

export function MemberDashboardScreen() {
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const home = useApiResource(loadMemberHome)
  const medical = useApiResource(() => backendApi.getOwnMedicalCertificates())
  const firstName = session?.user.firstName ?? ''
  const header = <DashboardHeader greeting={`Buen día, ${firstName}`} intro={isMobile ? `Resumen de hoy · ${formatNumericDate(gymDate())}` : 'Tu estado de cuenta, apto médico y próximas clases de M-TEAM.'}/>

  if (home.loading) return <div className="app-page dashboard-screen">{header}<div className="app-card"><LoadingState/></div></div>
  if (home.error || !home.data) return <div className="app-page dashboard-screen">{header}<div className="app-card"><ErrorState message={home.error || 'No se pudo cargar tu resumen.'} retry={() => void home.reload()}/></div></div>

  const { membership, payments, upcoming } = home.data
  const status = MEMBERSHIP[membership.status]
  const medicalStatus = medical.data?.current
    ? { APPROVED: { label: 'Aprobado', sub: 'Apto vigente' }, PENDING: { label: 'Pendiente', sub: 'En revisión' }, REJECTED: { label: 'Rechazado', sub: 'Revisá el certificado' } }[medical.data.current.status]
    : null
  const latestPayment = membership.lastPaymentAt ? formatDate(membership.lastPaymentAt) : 'Sin pagos'
  const medicalValue = medical.loading ? '—' : medical.error ? '—' : medicalStatus?.label ?? 'Sin cargar'
  const medicalSub = medical.loading ? 'Cargando…' : medical.error ? 'No disponible' : medicalStatus?.sub ?? 'Subí tu certificado'
  const initialPeriod = medical.data?.initialPeriod
  return <div className="app-page dashboard-screen">
    {header}
    <div className="status-grid member-situation-grid">
      <StatusCard label="ESTADO DE CUENTA" value={session?.user.status === 'ACTIVE' ? 'Activa' : 'Desactivada'} tone={session?.user.status === 'ACTIVE' ? 'blue' : 'pink'} to="/socio/perfil"/>
      <StatusCard label="ESTADO DE CUOTA" value={status.label} tone={status.tone} sub={membership.expiresAt ? `${membership.daysRemaining} días restantes` : 'Sin vigencia'} to="/socio/pagos"/>
      <StatusCard label="ÚLTIMO PAGO" value={latestPayment} tone="black" to="/socio/pagos"/>
      <StatusCard label="VENCIMIENTO" value={membership.expiresAt ? formatDate(membership.expiresAt) : 'Sin pagos'} tone="black" to="/socio/pagos"/>
      <StatusCard label="DÍAS RESTANTES" value={membership.expiresAt ? String(membership.daysRemaining) : '—'} tone={status.tone} sub={membership.expiresAt ? 'de la cuota vigente' : 'Sin vigencia'} to="/socio/pagos"/>
      <StatusCard label="VALOR VIGENTE" value={formatMoney(membership.currentPrice)} tone="blue" to="/socio/pagos"/>
      <StatusCard label="APTO MÉDICO" value={medicalValue} tone="purple" sub={medicalSub} to="/socio/apto-medico"/>
      {initialPeriod?.isActive && <StatusCard label="PERÍODO INICIAL" value={`${initialPeriod.daysRemaining} días`} tone="purple" sub="Podés ingresar sin apto aprobado" to="/socio/apto-medico"/>}
    </div>
    {medical.error && <p className="error-message" role="alert">{medical.error} <Link className="text-link" to="/socio/apto-medico">Ir a apto médico</Link></p>}
    <div className="dashboard-columns">
      <DashboardCard title="Próximas clases" action={<Link className="text-link" to="/socio/clases">Ver cronograma</Link>}>
        {upcoming.length ? <div className="dashboard-list">{upcoming.map((scheduledClass, index) => <MobileClassCard key={scheduledClass.id} scheduledClass={scheduledClass} tone={toneForIndex(index)} dayLabel={shortDateLabel(scheduledClass.day)}/>)}</div> : <EmptyState message="No hay más clases programadas esta semana."/>}
      </DashboardCard>
      <DashboardCard title="Mis pagos" action={<Link className="text-link" to="/socio/pagos">Ver historial</Link>}>
        {payments.items.length ? <ul className="payment-list">{payments.items.map((payment) => <li key={payment.id}><span><strong>{formatMoney(payment.amount)}</strong><small>{formatDate(payment.accreditedAt)} · {payment.method}</small></span><span className={`badge ${payment.status === 'VOIDED' ? 'badge-disabled' : 'badge-info'}`}>{payment.status === 'VOIDED' ? 'Anulado' : 'Acreditado'}</span></li>)}</ul> : <EmptyState message="Todavía no hay pagos registrados."/>}
        <Link className="dashboard-inline-link" to="/socio/entrenadores"><Icon name="users" size={18}/>Conocé a los entrenadores</Link>
      </DashboardCard>
    </div>
  </div>
}
