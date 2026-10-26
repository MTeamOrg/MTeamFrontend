import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { backendApi, type Branch } from '../../service/backend-api'
import { gymDate, mondayOfGymWeek } from '../../service/date-time'
import { useAuth } from '../authentication/use-auth'
import { BranchDirections } from '../branches/BranchDirections'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { SafeImage } from '../workspace/SafeImage'
import { DashboardHeader, QuickActions, StatusCard } from './DashboardParts'
import './dashboard.css'

export function TrainerDashboardScreen() {
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const userId = session?.user.id
  const classes = useApiResource(useCallback(async () => {
    const schedule = await backendApi.getTrainerSchedule(mondayOfGymWeek())
    return schedule.classes.filter((item) => item.trainer?.id === userId).sort((left, right) => left.startsAt.localeCompare(right.startsAt))
  }, [userId]))
  const news = useApiResource(useCallback(() => backendApi.listNewsPosts({ page: 1, limit: 3, status: 'PUBLISHED' }), []))
  const notifications = useApiResource(useCallback(() => backendApi.listNotifications({ page: 1, limit: 1, isRead: false }), []))
  const branches = useApiResource(useCallback(() => backendApi.listBranches('', 1, 100), []))
  const today = classes.data?.filter((item) => item.day === gymDate()) ?? []
  const isAccountActive = session?.user.status === 'ACTIVE'
  const posts = news.data?.items.filter((post) => post.status === 'PUBLISHED' && (post.audience === 'ALL' || post.audience === 'TRAINERS')) ?? []
  const classValue = (count: number) => classes.loading ? 'Cargando…' : classes.error ? 'No disponible' : `${count} ${count === 1 ? 'clase' : 'clases'}`
  return <div className="app-page trainer-dashboard">
    <DashboardHeader eyebrow={isMobile ? undefined : 'PANEL DEL ENTRENADOR'} greeting={`¡Hola, ${session?.user.firstName ?? ''}!`} intro={classes.loading ? 'Consultando tus clases de hoy…' : classes.error ? 'No pudimos consultar tus clases de hoy.' : `Tenés ${today.length} ${today.length === 1 ? 'clase asignada' : 'clases asignadas'} hoy.${isMobile ? '' : ' Acordate de escanear el QR al llegar.'}`}/>
    <div className="trainer-status-grid">
      <StatusCard label="CLASES DE HOY" value={classValue(today.length)} tone="black" sub={today[0] ? `Primera: ${today[0].startTime} · ${today[0].activity}` : 'Tus clases asignadas'}/>
      {!isMobile && <StatusCard label="CLASES DE LA SEMANA" value={classValue(classes.data?.length ?? 0)} tone="black" sub="Entre todas tus sedes"/>}
      <StatusCard label="ACCESO AL GIMNASIO" value={isAccountActive ? 'Cuenta activa' : 'Cuenta no habilitada'} tone="blue" sub="El acceso se valida al escanear el QR"/>
      {!isMobile && <div><StatusCard label="NOTIFICACIONES" value={notifications.loading ? 'Cargando…' : notifications.error ? 'No disponible' : `${notifications.data?.unreadCount ?? notifications.data?.total ?? 0} sin leer`} tone="purple" sub="Consultar notificaciones" to="/entrenador/notificaciones"/>{notifications.error && <ErrorState message={notifications.error} retry={() => void notifications.reload()}/>}</div>}
    </div>
    <div className="trainer-actions"><Link className="button button-primary" to="/entrenador/acceso"><Icon name="qr"/>Abrir escáner QR</Link>{!isMobile && <Link className="button button-secondary" to="/entrenador/clases"><Icon name="calendar"/>Ver mis clases</Link>}</div>
    {isMobile && <QuickActions title="Más secciones" actions={[
      { label: 'Novedades', icon: 'megaphone', to: '/entrenador/novedades' },
    ]}/>}
    <div className="trainer-content-grid">
      <section className="trainer-section" aria-labelledby="trainer-classes-title">
        <header className="trainer-section-heading"><h2 id="trainer-classes-title">Tus clases de hoy</h2><Link className="text-link" to="/entrenador/clases">Ver todas →</Link></header>
        {classes.loading ? <LoadingState message="Cargando clases…"/> : classes.error ? <ErrorState message={classes.error} retry={() => void classes.reload()}/> : !today.length ? <EmptyState message="No tenés clases asignadas para hoy."/> : <div className="dashboard-list">{today.map((item, index) => <article className="trainer-class-card" key={item.id}><time dateTime={item.startsAt}>{item.startTime}</time><div className={`trainer-class-copy trainer-accent-${index % 3}`}><h3>{item.activity}</h3><p>{item.branch.name}</p></div><span className="badge badge-neutral">Sin estado informado</span></article>)}<p className="trainer-data-note">Duración, espacio y estado no informados por el cronograma.</p></div>}
      </section>
      {!isMobile && <section className="trainer-section" aria-labelledby="trainer-news-title"><header className="trainer-section-heading"><h2 id="trainer-news-title">Últimas novedades</h2></header><div className="trainer-news-card">{news.loading ? <LoadingState message="Cargando novedades…"/> : news.error ? <ErrorState message={news.error} retry={() => void news.reload()}/> : !posts.length ? <EmptyState message="No hay novedades publicadas para mostrar."/> : <ul>{posts.map((post) => <li key={post.id}><Link to="/entrenador/novedades">{post.title}</Link></li>)}</ul>}<Link className="text-link" to="/entrenador/novedades">Ver todas las novedades →</Link></div></section>}
    </div>
    <section className="trainer-section" aria-labelledby="trainer-branches-title"><header className="trainer-section-heading"><h2 id="trainer-branches-title">Nuestras sedes</h2></header>{branches.loading ? <LoadingState message="Cargando sedes…"/> : branches.error ? <ErrorState message={branches.error} retry={() => void branches.reload()}/> : !branches.data?.items.length ? <EmptyState message="No hay sedes disponibles para mostrar."/> : <div className="member-branch-grid">{branches.data.items.map((branch) => <TrainerBranchCard key={branch.id} branch={branch}/>)}</div>}</section>
  </div>
}

function TrainerBranchCard({ branch }: { branch: Branch }) {
  return <article className="member-branch-card"><SafeImage className="member-branch-image" src={branch.imageUrl} alt={`Imagen de la sede ${branch.name}`}/><div className="member-branch-content"><div className="member-branch-title-row"><h3>{branch.name}</h3><span className="badge badge-info">{branch.isActive === undefined ? 'Estado no informado' : branch.isActive ? 'Activa' : 'Inactiva'}</span></div><p><Icon name="pin" size={16}/>{branch.address || 'Dirección no informada'}</p><p><Icon name="clock" size={16}/>{branch.openingHours || 'Horario no informado'}</p><p><Icon name="phone" size={16}/>{branch.phone || 'Teléfono no informado'}</p><BranchDirections branch={branch} className="button button-secondary member-branch-directions"/></div></article>
}
