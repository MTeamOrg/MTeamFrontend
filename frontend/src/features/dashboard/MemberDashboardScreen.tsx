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
  const firstName = session?.user.firstName ?? ''
  const header = <DashboardHeader
    greeting={`Buen día, ${firstName}`}
    intro={isMobile ? `Resumen de hoy · ${formatNumericDate(gymDate())}` : 'Tu cuota, tus pagos y las próximas clases de M-TEAM.'}
  />

  if (home.loading) return <div className="app-page dashboard-screen">{header}<div className="app-card"><LoadingState/></div></div>
  if (home.error || !home.data) return <div className="app-page dashboard-screen">{header}<div className="app-card"><ErrorState message={home.error || 'No se pudo cargar tu resumen.'} retry={() => void home.reload()}/></div></div>

  const { membership, payments, upcoming } = home.data
  const status = MEMBERSHIP[membership.status]
  return <div className="app-page dashboard-screen">
    {header}
    <div className="status-grid">
      <StatusCard label="ESTADO DE CUOTA" value={status.label} tone={status.tone} sub={membership.expiresAt ? `${membership.daysRemaining} días restantes` : undefined}/>
      <StatusCard label="VENCIMIENTO" value={membership.expiresAt ? formatDate(membership.expiresAt) : 'Sin pagos'} tone="black"/>
      <StatusCard label="VALOR VIGENTE" value={formatMoney(membership.currentPrice)} tone="blue"/>
      <StatusCard label="APTO MÉDICO" value="—" tone="purple" sub="Backend pendiente"/>
    </div>
    <div className="dashboard-columns">
      <DashboardCard title="Próximas clases" action={<Link className="text-link" to="/socio/clases">Ver cronograma</Link>}>
        {upcoming.length
          ? <div className="dashboard-list">{upcoming.map((scheduledClass, index) => <MobileClassCard key={scheduledClass.id} scheduledClass={scheduledClass} tone={toneForIndex(index)} dayLabel={shortDateLabel(scheduledClass.day)}/>)}</div>
          : <EmptyState message="No hay más clases programadas esta semana."/>}
      </DashboardCard>
      <DashboardCard title="Mis pagos" action={<Link className="text-link" to="/socio/pagos">Ver historial</Link>}>
        {payments.items.length
          ? <ul className="payment-list">{payments.items.map((payment) => <li key={payment.id}>
            <span><strong>{formatMoney(payment.amount)}</strong><small>{formatDate(payment.accreditedAt)} · {payment.method}</small></span>
            <span className={`badge ${payment.status === 'VOIDED' ? 'badge-disabled' : 'badge-info'}`}>{payment.status === 'VOIDED' ? 'Anulado' : 'Acreditado'}</span>
          </li>)}</ul>
          : <EmptyState message="Todavía no hay pagos registrados."/>}
        <Link className="dashboard-inline-link" to="/socio/entrenadores"><Icon name="users" size={18}/>Conocé a los entrenadores</Link>
      </DashboardCard>
    </div>
  </div>
}
