import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { backendApi, type Branch } from '../../service/backend-api'
import { useAuth } from '../authentication/use-auth'
import { ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { SafeImage } from '../workspace/SafeImage'
import { StatusCard } from '../workspace/StatusCard'
import { DashboardHeader, QuickActions } from './DashboardParts'
import { describeAccess, describeFee, describeMedical, describeMembership, readSource } from './member-situation'
import './dashboard.css'

export function MemberDashboardScreen() {
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const membershipResource = useApiResource(backendApi.getOwnMembership)
  // The loader must keep its identity between renders: `useApiResource` reloads whenever it changes.
  const medicalResource = useApiResource(useCallback(() => backendApi.getOwnMedicalCertificates(), []))
  const branches = useApiResource(useCallback(() => backendApi.listBranches('', 1, 100), []))
  const firstName = session?.user.firstName ?? ''
  const accountActive = session?.user.status === 'ACTIVE'
  const accountLabel = accountActive ? 'Tu cuenta está habilitada.' : 'Tu cuenta está deshabilitada.'
  const membership = readSource(membershipResource)
  const medical = readSource(medicalResource)
  const rejected = medical.state === 'ready' && medical.data.current?.status === 'REJECTED' ? medical.data.current : null

  return <div className="app-page member-dashboard">
    <DashboardHeader
      eyebrow={isMobile ? undefined : 'BIENVENIDO A M-TEAM'}
      greeting={`¡Hola, ${firstName}!`}
      intro={isMobile ? accountLabel : `${accountLabel} Consultá tu cuota, tu apto médico y nuestras sedes.`}
    />
    <div className="member-status-grid">
      <StatusCard label="ESTADO DE CUOTA" {...describeMembership(membership)} to="/socio/pagos"/>
      <StatusCard label="APTO MÉDICO" {...describeMedical(medical)} to="/socio/apto-medico"/>
      <StatusCard label="ACCESO AL GIMNASIO" {...describeAccess({ accountActive, membership, medical })}/>
      <StatusCard label="VALOR DE LA CUOTA" {...describeFee(membership)} to="/socio/pagos"/>
    </div>
    <div className="member-dashboard-actions" aria-label="Acciones del socio">
      <Link className="button button-secondary" to="/socio/clases"><Icon name="calendar" size={20}/>Ver mis clases</Link>
      <Link className="button button-secondary" to="/socio/apto-medico"><Icon name="file" size={20}/>Mi apto médico</Link>
    </div>
    {isMobile && <QuickActions title="Más secciones" actions={[
      { label: 'Eventos', icon: 'trophy', to: '/socio/eventos' },
      { label: 'Novedades', icon: 'megaphone', to: '/socio/novedades' },
    ]}/>}
    {membership.state === 'error' && <p className="error-message" role="alert"><span>No pudimos obtener tu cuota. {membership.message}</span> <button type="button" className="text-link" onClick={() => void membershipResource.reload()}>Reintentar</button></p>}
    {medical.state === 'error' && <p className="error-message" role="alert"><span>No pudimos obtener tu apto médico. {medical.message}</span> <button type="button" className="text-link" onClick={() => void medicalResource.reload()}>Reintentar</button></p>}
    {rejected && <p className="error-message" role="status"><span>Tu apto médico fue rechazado{rejected.reviewComment ? `. Observación: “${rejected.reviewComment}”` : '.'}</span> <Link className="text-link" to="/socio/apto-medico">Ver apto médico</Link></p>}
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
