import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { backendApi, type Branch, type MembershipStatus } from '../../service/backend-api'
import { formatDate } from '../../service/date-time'
import { useAuth } from '../authentication/use-auth'
import { ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { SafeImage } from '../workspace/SafeImage'
import { StatusCard, type StatusTone } from '../workspace/StatusCard'
import { DashboardHeader } from './DashboardParts'
import { formatMoney } from './dashboard-data'
import './dashboard.css'

const MEMBERSHIP_STATUS: Record<MembershipStatus, { label: string; tone: StatusTone }> = {
  CURRENT: { label: 'Al día', tone: 'blue' },
  EXPIRING_SOON: { label: 'Por vencer', tone: 'purple' },
  EXPIRED: { label: 'Vencida', tone: 'pink' },
}

const MEDICAL_STATUS = {
  APPROVED: { label: 'Aprobado', tone: 'blue' as StatusTone },
  PENDING: { label: 'Pendiente', tone: 'purple' as StatusTone },
  REJECTED: { label: 'Rechazado', tone: 'pink' as StatusTone },
}

export function MemberDashboardScreen() {
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const membership = useApiResource(backendApi.getOwnMembership)
  const medical = useApiResource(() => backendApi.getOwnMedicalCertificates())
  const branches = useApiResource(useCallback(() => backendApi.listBranches('', 1, 100), []))
  const firstName = session?.user.firstName ?? ''
  const accountLabel = session?.user.status === 'ACTIVE' ? 'Tu cuenta está habilitada.' : 'Tu cuenta está deshabilitada.'
  const header = <DashboardHeader
    eyebrow={isMobile ? undefined : 'BIENVENIDO A M-TEAM'}
    greeting={`¡Hola, ${firstName}!`}
    intro={isMobile ? accountLabel : `${accountLabel} Consultá tu cuota, tu apto médico y nuestras sedes.`}
  />

  if (membership.loading) return <div className="app-page member-dashboard">{header}<div className="app-card"><LoadingState message="Cargando tu situación…"/></div></div>
  if (membership.error || !membership.data) return <div className="app-page member-dashboard">{header}<div className="app-card"><ErrorState message={membership.error || 'No se pudo cargar tu situación.'} retry={() => void membership.reload()}/></div></div>

  const membershipStatus = MEMBERSHIP_STATUS[membership.data.status]
  const medicalView = medical.data?.current ? MEDICAL_STATUS[medical.data.current.status] : null
  const medicalValue = medical.loading ? 'Cargando…' : medical.error ? 'No disponible' : medicalView?.label ?? 'Sin cargar'
  const medicalSub = medical.loading
    ? 'Consultando el backend'
    : medical.error
      ? 'Revisá la pantalla de apto médico'
      : medical.data?.current?.reviewedAt
        ? `Revisado el ${formatDate(medical.data.current.reviewedAt)}`
        : medicalView?.label === 'Pendiente' ? 'En revisión' : 'Todavía no cargaste un apto'

  return <div className="app-page member-dashboard">
    {header}
    <div className="member-status-grid">
      <StatusCard
        label="ESTADO DE CUOTA"
        value={membershipStatus.label}
        tone={membershipStatus.tone}
        sub={membership.data.expiresAt ? `Vence el ${formatDate(membership.data.expiresAt)} · ${membership.data.daysRemaining} días` : 'Sin vencimiento informado'}
        to="/socio/pagos"
      />
      <StatusCard label="APTO MÉDICO" value={medicalValue} tone={medicalView?.tone ?? 'purple'} sub={medicalSub} to="/socio/apto-medico"/>
      <StatusCard label="ACCESO AL GIMNASIO" value="No disponible" tone="black" sub="El módulo de acceso todavía no está implementado"/>
      <StatusCard label="VALOR DE LA CUOTA" value={formatMoney(membership.data.currentPrice)} tone="black" sub="Valor informado por el backend" to="/socio/pagos"/>
    </div>
    <div className="member-dashboard-actions" aria-label="Acciones del socio">
      <Link className="button button-secondary" to="/socio/clases"><Icon name="calendar" size={20}/>Ver mis clases</Link>
      <Link className="button button-secondary" to="/socio/apto-medico"><Icon name="file" size={20}/>Mi apto médico</Link>
    </div>
    {medical.error && <p className="error-message" role="alert">{medical.error} <Link className="text-link" to="/socio/apto-medico">Ir a apto médico</Link></p>}
    <section className="member-branches-section" aria-labelledby="member-branches-title">
      <div className="member-section-heading">
        <h2 id="member-branches-title">Nuestras sedes</h2>
        <p>Encontrá la sede más cómoda para entrenar.</p>
      </div>
      {branches.loading
        ? <div className="app-card"><LoadingState message="Cargando sedes…"/></div>
        : branches.error
          ? <div className="app-card"><ErrorState message={branches.error} retry={() => void branches.reload()}/></div>
          : !branches.data?.items.length
            ? <div className="app-card"><p className="member-empty-copy">No hay sedes disponibles para mostrar.</p></div>
            : <div className="member-branch-grid">{branches.data.items.map((branch) => <MemberBranchCard key={branch.id} branch={branch}/>)}</div>}
    </section>
  </div>
}

function MemberBranchCard({ branch }: { branch: Branch }) {
  const mapQuery = branch.latitude && branch.longitude ? `${branch.latitude},${branch.longitude}` : branch.address
  return <article className="member-branch-card">
    <SafeImage className="member-branch-image" src={branch.imageUrl} alt={`Imagen de la sede ${branch.name}`} />
    <div className="member-branch-content">
      <div className="member-branch-title-row"><h3>{branch.name}</h3><span className="badge badge-info">Activa</span></div>
      <p><Icon name="pin" size={20}/>{branch.address}</p>
      <p><Icon name="clock" size={20}/>{branch.openingHours}</p>
      {branch.phone && <p><Icon name="phone" size={20}/>{branch.phone}</p>}
      <a className="button button-secondary member-branch-directions" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer"><Icon name="map" size={20}/>Cómo llegar</a>
    </div>
  </article>
}
