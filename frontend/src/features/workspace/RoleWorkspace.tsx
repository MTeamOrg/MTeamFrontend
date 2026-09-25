import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrowserQRCodeReader } from '@zxing/browser'
import { useAuth } from '../authentication/use-auth'
import type { UserRole } from '../authentication/auth-types'
import { Icon, type IconName } from './Icon'
import { DashboardForRole } from './DashboardScreens'
import { UnavailableForm } from './UnavailableForm'
import { AdminMedicalScreen, MemberMedicalScreen } from './MedicalScreens'
import { AdminClassCalendar, MemberClassCalendar } from './ClassSchedules'
import { AdminEventsScreen, AdminNewsScreen } from './AdminContentScreens'
import { AdminPaymentsScreen } from './AdminPaymentsScreen'
import { TrainerDirectoryScreen } from './TrainerDirectoryScreen'
import { MemberPaymentsScreen } from './MemberPaymentsScreen'

type Entry = { label: string; href: string; icon: IconName }
const NAVIGATION: Record<UserRole, Entry[]> = {
  MEMBER: [
    { label: 'Inicio', href: '', icon: 'home' }, { label: 'Mi perfil', href: 'perfil', icon: 'user' }, { label: 'Apto médico', href: 'apto-medico', icon: 'file' }, { label: 'Acceso QR', href: 'acceso', icon: 'qr' }, { label: 'Clases', href: 'clases', icon: 'calendar' }, { label: 'Eventos', href: 'eventos', icon: 'trophy' }, { label: 'Novedades', href: 'novedades', icon: 'megaphone' }, { label: 'Notificaciones', href: 'notificaciones', icon: 'bell' },
  ],
  TRAINER: [
    { label: 'Inicio', href: '', icon: 'home' }, { label: 'Mi perfil', href: 'perfil', icon: 'user' }, { label: 'Mis clases', href: 'clases', icon: 'calendar' }, { label: 'Acceso QR', href: 'acceso', icon: 'qr' }, { label: 'Eventos', href: 'eventos', icon: 'trophy' }, { label: 'Novedades', href: 'novedades', icon: 'megaphone' }, { label: 'Notificaciones', href: 'notificaciones', icon: 'bell' },
  ],
  ADMIN: [
    { label: 'Panel', href: '', icon: 'chart' }, { label: 'Usuarios', href: 'usuarios', icon: 'users' }, { label: 'Pagos y cuota', href: 'pagos', icon: 'wallet' }, { label: 'Aptos médicos', href: 'aptos', icon: 'file' }, { label: 'Accesos', href: 'accesos', icon: 'qr' }, { label: 'Clases', href: 'clases', icon: 'calendar' }, { label: 'Sedes', href: 'sedes', icon: 'building' }, { label: 'Eventos', href: 'eventos', icon: 'trophy' }, { label: 'Novedades', href: 'novedades', icon: 'megaphone' },
  ],
}

// Figma-only preview rows, matching the A2 users table; these are not real users.
const FIGMA_PREVIEW_USERS = [
  { name: 'Juan Manuel Pérez', document: '40.123.456', email: 'juan@email.com', role: 'Socio', status: 'Activa', fee: 'Al día' },
  { name: 'Micaela Rossi', document: '38.554.201', email: 'mica@email.com', role: 'Socio', status: 'Activa', fee: 'Vencida' },
  { name: 'Lucas Torres', document: '44.870.910', email: 'lucas@email.com', role: 'Socio', status: 'Activa', fee: 'Próxima a vencer' },
  { name: 'Carla Giménez', document: '33.210.556', email: 'carla@mteam.com.ar', role: 'Entrenador', status: 'Activa', fee: '—' },
  { name: 'Diego Ruiz', document: '31.998.741', email: 'diego@mteam.com.ar', role: 'Entrenador', status: 'Activa', fee: '—' },
  { name: 'Sofía Núñez', document: '35.771.400', email: 'sofia@mteam.com.ar', role: 'Entrenador', status: 'Activa', fee: '—' },
  { name: 'Ana Vidal', document: '45.112.003', email: 'ana@email.com', role: 'Socio', status: 'Activa', fee: 'Al día' },
  { name: 'Pedro Lima', document: '42.667.310', email: 'pedro@email.com', role: 'Socio', status: 'Desactivada', fee: 'Al día' },
  { name: 'Lara Frenkel', document: '39.004.882', email: 'lara@mteam.com.ar', role: 'Administradora', status: 'Activa', fee: '—' },
]

const TITLE_BY_SEGMENT: Record<string, string> = {
  '': 'Inicio', perfil: 'Mi perfil', 'apto-medico': 'Apto médico', acceso: 'Acceso QR', clases: 'Clases', eventos: 'Eventos', novedades: 'Novedades', notificaciones: 'Notificaciones', usuarios: 'Usuarios', pagos: 'Pagos y cuota', aptos: 'Aptos médicos', accesos: 'Accesos', sedes: 'Sedes',
}

export function RoleWorkspace({ role }: { role: UserRole }) {
  const { session, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const base = role === 'MEMBER' ? '/socio' : role === 'TRAINER' ? '/entrenador' : '/admin'
  const expected = role === 'MEMBER' ? '/socio' : role === 'TRAINER' ? '/entrenador' : '/admin'
  const path = location.pathname.replace(expected, '').replace(/^\//, '')
  const segment = path.split('/')[0]
  const entries = NAVIGATION[role]
  const mobileEntries = role === 'ADMIN'
    ? entries.slice(0, 5)
    : role === 'MEMBER'
      ? [entries[0], entries[1], entries[3], entries[4], entries[6]]
      : [entries[0], entries[1], entries[3], entries[2], entries[5]]
  const title = segment === 'clases' ? role === 'ADMIN' ? 'Cronograma de clases' : role === 'TRAINER' ? 'Mis clases' : 'Clases de la semana' : segment === 'entrenadores' ? 'Entrenadores' : segment === 'pagos' && role === 'MEMBER' ? 'Pagos' : TITLE_BY_SEGMENT[segment] ?? (role === 'ADMIN' && segment === 'crear-usuario' ? 'Crear cuenta' : role === 'ADMIN' && segment === 'detalle-usuario' ? 'Detalle de usuario' : role === 'ADMIN' && segment === 'registrar-pago' ? 'Registrar pago' : role === 'ADMIN' && segment === 'revisar-apto' ? 'Revisar apto médico' : 'Panel')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState('')
  const [notice, setNotice] = useState('')
  const [roleFilter, setRoleFilter] = useState('Todos')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [feeFilter, setFeeFilter] = useState('Todas')

  async function handleLogout() { await logout(); navigate('/iniciar-sesion', { replace: true }) }
  function unavailableAction(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setNotice('La API de este módulo todavía no está disponible. No se guardaron cambios.') }
  function actionButton(label: string, icon?: IconName) { return <button className="button button-primary" onClick={() => { setDialog(label); setNotice('') }}>{icon && <Icon name={icon}/>} {label}</button> }

  const filteredUsers = FIGMA_PREVIEW_USERS.filter(user => `${user.name} ${user.document} ${user.email} ${user.role} ${user.status}`.toLowerCase().includes(query.toLowerCase()) && (roleFilter === 'Todos' || user.role === roleFilter) && (statusFilter === 'Todos' || user.status === statusFilter) && (feeFilter === 'Todas' || user.fee === feeFilter))
  const selectedUser = FIGMA_PREVIEW_USERS.find(user => user.name === new URLSearchParams(location.search).get('nombre'))
  const activeNav = entries.find(entry => entry.href === segment) ?? entries[0]

  if (session?.user.role !== role) {
    const roleBase = session?.user.role === 'ADMIN' ? '/admin' : session?.user.role === 'TRAINER' ? '/entrenador' : '/socio'
    return <Navigate to={roleBase} replace />
  }

  return <div className="workspace-shell">
    <aside className="workspace-sidebar">
      <Link to={base} className="workspace-brand"><span className="brand-mark">M</span><span>M-TEAM <b>GIMNASIO</b></span></Link>
      <div className="workspace-role">{role === 'MEMBER' ? 'SOCIO' : role === 'TRAINER' ? 'ENTRENADOR' : 'ADMINISTRADOR'}</div>
      <nav>{entries.map(entry => <Link key={entry.href} className={activeNav.href === entry.href ? 'selected' : ''} to={entry.href ? `${base}/${entry.href}` : base}><Icon name={entry.icon} size={22}/><span>{entry.label}</span>{entry.label === 'Notificaciones' && <span className="nav-count">2</span>}</Link>)}</nav>
      <button className="sidebar-logout" onClick={() => void handleLogout()}><Icon name="logout"/><span>Cerrar sesión</span></button>
    </aside>
    <div className="workspace-main">
      <header className="workspace-topbar"><div className="breadcrumbs">M-TEAM <Icon name="chevron" size={15}/> {title}</div><div className="topbar-user"><span className="avatar">{session?.user.firstName.slice(0, 1)}{session?.user.lastName.slice(0, 1)}</span><div><strong>{session?.user.firstName} {session?.user.lastName}</strong><small>{role === 'MEMBER' ? 'Socio' : role === 'TRAINER' ? 'Entrenador' : 'Administrador'}</small></div><button className="icon-action" aria-label="Cerrar sesión" onClick={() => void handleLogout()}><Icon name="logout"/></button></div></header>
      <main className="workspace-content"><div className="workspace-page-heading"><div><span className="eyebrow">{role === 'ADMIN' ? 'PANEL DE ADMINISTRACIÓN' : role === 'TRAINER' ? 'ÁREA DE ENTRENADOR' : 'MI ESPACIO'}</span><h1>{title}</h1></div>{role === 'ADMIN' && segment === 'usuarios' && <button className="button button-primary" onClick={() => navigate(`${base}/crear-usuario`)}><Icon name="plus"/> Crear una cuenta</button>}{role === 'ADMIN' && segment === 'pagos' && <button className="button button-primary" onClick={() => navigate(`${base}/registrar-pago`)}><Icon name="plus"/> Registrar un pago</button>}{role === 'ADMIN' && segment === 'aptos' && <button className="button button-secondary" onClick={() => navigate(`${base}/revisar-apto`)}>Revisar aptos médicos (7)</button>}{role === 'ADMIN' && segment === 'clases' && actionButton('Nueva clase', 'plus')}{role === 'ADMIN' && segment === 'sedes' && actionButton('Nueva sede', 'plus')}{role === 'ADMIN' && segment === 'eventos' && actionButton('Nuevo evento', 'plus')}{role === 'ADMIN' && segment === 'novedades' && actionButton('Publicar una novedad', 'plus')}</div>
        {renderScreen()}
      </main>
    </div>
    <nav className="workspace-mobile-tabs">{mobileEntries.map(entry => <Link key={entry.href} className={activeNav.href === entry.href ? 'selected' : ''} to={entry.href ? `${base}/${entry.href}` : base}><Icon name={entry.icon}/><span>{role === 'ADMIN' && entry.label === 'Pagos y cuota' ? 'Pagos' : role === 'ADMIN' && entry.label === 'Aptos médicos' ? 'Aptos' : entry.label.replace('Mi ', '').replace('Mis ', '')}</span></Link>)}</nav>
    {dialog && <ActionDialog title={dialog} notice={notice} onClose={() => setDialog('')} onSubmit={unavailableAction}/>}
  </div>

  function renderScreen() {
    if (!segment) return <DashboardForRole role={role} name={session ? `${session.user.firstName} ${session.user.lastName}` : ''} onAction={setDialog}/>
    if (segment === 'perfil') return <ProfileScreen role={role} name={`${session?.user.firstName} ${session?.user.lastName}`} email={session?.user.email ?? ''} onAction={value=>{if(value==='Cambiar contraseña')navigate('/cambiar-contrasena-voluntario');else if(value==='Ver mi apto médico')navigate(`${base}/apto-medico`);else setDialog(value)}}/>
    if (segment === 'apto-medico') return <MemberMedicalScreen/>
    if (segment === 'aptos') return <AdminMedicalScreen onReview={member => navigate(`${base}/revisar-apto?nombre=${encodeURIComponent(member)}`)}/>
    if (segment === 'acceso' || segment === 'accesos') return <AccessScreen admin={role === 'ADMIN'}/>
    if (segment === 'clases') return role === 'ADMIN' ? <AdminClassCalendar onAction={setDialog}/> : <MemberClassCalendar trainer={role === 'TRAINER'} trainerName={`${session?.user.firstName} ${session?.user.lastName}`}/>
    if (segment === 'entrenadores' && role === 'MEMBER') return <TrainerDirectoryScreen/>
    if (segment === 'eventos' && role === 'ADMIN') return <AdminEventsScreen onUnavailable={setNotice}/>
    if (segment === 'eventos') return <EventsScreen admin={false} onAction={setDialog}/>
    if (segment === 'novedades' && role === 'ADMIN') return <AdminNewsScreen notice={notice} onSubmit={unavailableAction} onUnavailable={setNotice}/>
    if (segment === 'novedades') return <NewsScreen admin={false} onAction={setDialog}/>
    if (segment === 'notificaciones') return <NotificationsScreen role={role} notice={notice} onUnavailable={() => setNotice('La API de notificaciones todavía no está disponible. No se modificó el estado de lectura.')}/>
    if (segment === 'usuarios') return <UsersScreen rows={filteredUsers} query={query} setQuery={setQuery} roleFilter={roleFilter} setRoleFilter={setRoleFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} feeFilter={feeFilter} setFeeFilter={setFeeFilter} onAction={(userName) => navigate(`${base}/detalle-usuario?nombre=${encodeURIComponent(userName)}`)}/>
    if (segment === 'pagos' && role === 'ADMIN') return <AdminPaymentsScreen notice={notice} onSubmit={unavailableAction} onCancelPayment={member=>setDialog(`Anular pago · ${member}`)}/>
    if (segment === 'pagos' && role === 'MEMBER') return <MemberPaymentsScreen/>
    if (segment === 'sedes') return <AdminBranches onAction={setDialog}/>
    if (segment === 'crear-usuario' || segment === 'registrar-pago' || segment === 'revisar-apto' || segment === 'detalle-usuario') return <UnavailableForm title={title} notice={notice} onSubmit={unavailableAction} onClose={() => navigate(base)} onAction={setDialog} selectedName={selectedUser?.name ?? ''} selectedStatus={selectedUser?.status ?? ''}/>
    return <Navigate to={base} replace/>
  }
}

function PageIntro({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div>{action}</div> }
function StatCard({ label, value, icon, tone = '' }: { label: string; value: string; icon: IconName; tone?: string }) { return <article className="stat-card"><span className={`stat-icon ${tone}`}><Icon name={icon} size={23}/></span><div><span>{label}</span><strong>{value}</strong></div></article> }
// Profile values beyond the auth session mirror Figma solely for layout preview until a profile endpoint exists.
function ProfileScreen({ role, name, email, onAction }: { role: UserRole; name: string; email: string; onAction: (v: string) => void }) { return <><div className="surface-card profile-card"><div className="profile-head"><span className="profile-avatar">{name.split(' ').map(x => x[0]).join('')}</span><div><h2>{name}</h2><p>{role === 'TRAINER' ? 'Entrenador · Musculación' : 'Socio M-TEAM'}</p></div><button className="button button-secondary" onClick={() => onAction('Editar perfil')}><Icon name="edit"/> Editar datos</button></div><div className="profile-fields"><Field label="Nombre y apellido" value={name}/><Field label="Correo electrónico" value={email}/><Field label="Documento" value="40.123.456"/><Field label="Fecha de nacimiento" value="14/03/1999"/><Field label="Teléfono" value="+54 11 5555-5555"/>{role === 'MEMBER' && <><Field label="Contacto de emergencia" value="María Pérez"/><Field label="Teléfono de emergencia" value="+54 11 4444-4444"/></>}{role === 'TRAINER' && <><Field label="Especialidad" value="Entrenamiento funcional"/><Field label="Sedes" value="Villa Urquiza · Belgrano"/></>}</div><div className="profile-actions"><button className="button button-secondary" onClick={() => onAction('Cambiar contraseña')}>Cambiar contraseña</button>{role === 'MEMBER' && <button className="button button-secondary" onClick={() => onAction('Ver mi apto médico')}>Ver mi apto médico</button>}</div></div></> }
function Field({ label, value }: { label: string; value: string }) { return <label className="read-field"><span>{label}</span><input readOnly value={value}/></label> }

// Rows below reproduce A9 solely to preserve the Figma table while the access-history API is absent.
const FIGMA_PREVIEW_ACCESS = [
  { user:'Juan Manuel Pérez',role:'Socio',branch:'Belgrano',time:'06/09 · 19:24',result:'Permitido' },
  { user:'Micaela Rossi',role:'Socia',branch:'Villa Urquiza',time:'06/09 · 19:18',result:'Rechazado · cuota vencida' },
  { user:'Carla Giménez',role:'Entrenadora',branch:'Belgrano',time:'06/09 · 17:52',result:'Permitido' },
  { user:'Lucas Torres',role:'Socio',branch:'Belgrano',time:'06/09 · 17:40',result:'Permitido · período inicial' },
  { user:'Ana Vidal',role:'Socia',branch:'Villa Urquiza',time:'06/09 · 16:05',result:'Permitido' },
  { user:'Pedro Lima',role:'Socio',branch:'Belgrano',time:'06/09 · 15:31',result:'Rechazado · cuenta desactivada' },
  { user:'Diego Ruiz',role:'Entrenador',branch:'Villa Urquiza',time:'06/09 · 14:12',result:'Permitido' },
  { user:'Sofía Núñez',role:'Entrenadora',branch:'Belgrano',time:'06/09 · 08:47',result:'Permitido' },
]

function AccessScreen({ admin }: { admin: boolean }) {
  const [scanning, setScanning] = useState(false)
  const [query, setQuery] = useState('')
  const [branch, setBranch] = useState('Todas')
  const [roleFilter, setRoleFilter] = useState('Todos')
  const [result, setResult] = useState('Todos')
  const [dateRange, setDateRange] = useState('Hoy')
  if (admin) {
    const rows = FIGMA_PREVIEW_ACCESS.filter(item => `${item.user} ${item.role} ${item.branch}`.toLowerCase().includes(query.toLowerCase()) && (branch==='Todas'||item.branch===branch) && (roleFilter==='Todos'||item.role===roleFilter) && (result==='Todos'||item.result.startsWith(result)))
    return <>
      <div className="dashboard-stat-grid access-admin-stats"><StatCard label="Ingresos de hoy" value="96 accesos" icon="qr"/><StatCard label="Permitidos" value="88 accesos" icon="check" tone="blue"/><StatCard label="Rechazados" value="8 accesos" icon="alert" tone="pink"/><StatCard label="Socios distintos" value="74 socios" icon="users"/></div>
      <section className="surface-card"><div className="toolbar access-filter-toolbar"><label className="search-shell"><Icon name="search"/><input placeholder="Buscar por usuario o documento" value={query} onChange={event=>setQuery(event.target.value)}/></label><select value={branch} onChange={event=>setBranch(event.target.value)} aria-label="Filtrar por sede"><option>Todas</option><option>Belgrano</option><option>Villa Urquiza</option></select><select value={roleFilter} onChange={event=>setRoleFilter(event.target.value)} aria-label="Filtrar por rol"><option>Todos</option><option>Socio</option><option>Socia</option><option>Entrenador</option><option>Entrenadora</option></select><select value={result} onChange={event=>setResult(event.target.value)} aria-label="Filtrar por resultado"><option>Todos</option><option>Permitido</option><option>Rechazado</option></select><select value={dateRange} onChange={event=>setDateRange(event.target.value)} aria-label="Filtrar por fecha"><option>Hoy</option><option>7 días</option><option>30 días</option></select></div><DataTable headings={['Usuario','Rol','Sede','Fecha y hora','Resultado']} rows={rows.map(item=>[item.user,item.role,item.branch,item.time,item.result])}/></section>
      <p className="integration-pending-note">La tabla y los indicadores muestran datos de referencia de Figma; los accesos reales requieren el servicio de historial.</p>
    </>
  }
  return <section className="access-screen-grid"><div className="surface-card access-page"><PageIntro title="Acceso QR" description="Apuntá la cámara al código fijo del molinete. El código identifica la sede y el punto de acceso."/><QrScanner scanning={scanning} onScanning={setScanning}/></div><aside className="access-help-column"><section className="surface-card"><h2>Cómo funciona</h2><p>El código QR está fijo en el molinete e identifica la sede y el punto de acceso. A vos te identifica tu sesión, no el código.</p></section><section className="surface-card"><h2><Icon name="qr"/> Permisos de cámara</h2><p>Si el navegador bloqueó la cámara, habilitala desde el candado de la barra de direcciones.</p><button className="button button-secondary" onClick={()=>{setScanning(false);window.setTimeout(()=>setScanning(true),0)}}><Icon name="check"/> Reintentar</button></section><p className="integration-pending-note">La lectura del QR funciona en el navegador. La validación del usuario, la sede y el resultado dependen del servicio de accesos.</p></aside></section>
}

function QrScanner({ scanning, onScanning }: { scanning: boolean; onScanning: (value: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [decoded, setDecoded] = useState(false)
  useEffect(() => {
    if (!scanning) return
    let cancelled = false
    let controls: { stop: () => void } | undefined
    async function startReader() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no permite acceder a la cámara. Revisá los permisos e intentá nuevamente.')
        onScanning(false)
        return
      }
      try {
        const video = videoRef.current
        if (!video) return
        const reader = new BrowserQRCodeReader()
        controls = await reader.decodeFromVideoDevice(undefined, video, (result, scanError, scannerControls) => {
          controls = scannerControls
          if (cancelled) { scannerControls.stop(); return }
          if (result) {
            setDecoded(true)
            setError('QR leído. La validación del ingreso necesita el servicio de accesos del backend.')
            scannerControls.stop()
            onScanning(false)
          } else if (scanError && scanError.name !== 'NotFoundException') {
            setError('No pudimos leer ese código. Acomodá el QR dentro del recuadro e intentá nuevamente.')
          }
        })
        if (cancelled) controls.stop()
      } catch (cameraError) {
        if (cancelled) return
        const message = cameraError instanceof Error && cameraError.name === 'NotAllowedError'
          ? 'No se pudo abrir la cámara. Permití el acceso en el navegador y volvé a intentar.'
          : 'No se encontró una cámara disponible. Conectá una cámara e intentá nuevamente.'
        setError(message)
        onScanning(false)
      }
    }
    void startReader()
    return () => { cancelled = true; controls?.stop() }
  }, [scanning, onScanning])

  function toggleScanner() {
    if (!scanning) { setError(''); setDecoded(false) }
    onScanning(!scanning)
  }
  return <><div className={`scanner-viewport ${scanning ? 'scanning' : ''}`}>{scanning ? <video ref={videoRef} className="scanner-video" muted playsInline/> : <Icon name="qr" size={64}/>}<div className="scanner-frame"><span/><span/><span/><span/></div>{!scanning && <small>{decoded ? 'Código QR detectado' : 'La cámara se activa al iniciar el escaneo'}</small>}</div><div className="scanner-controls"><button className="button button-primary" onClick={toggleScanner}><Icon name="qr"/>{scanning ? 'Detener escáner' : 'Escanear QR'}</button><p>Permití el acceso a la cámara cuando el navegador lo solicite.</p>{error && <div className="error-message" role="alert">{error}</div>}</div></>
}
function EventsScreen({ admin, onAction }: { admin: boolean; onAction: (v: string) => void }) { const [filter,setFilter]=useState(admin?'Todos':'Próximos'); const [query,setQuery]=useState(''); const items=[{title:'Torneo interno de Crossfit',date:'Sábado 19/09/2026 · 10:00',place:'Villa Urquiza',state:'Publicado',group:'Próximos'},{title:'Clase abierta de Zumba',date:'Viernes 25/09/2026 · 19:00',place:'Belgrano',state:'Publicado',group:'Próximos'},{title:'Charla de nutrición deportiva',date:'Miércoles 07/10/2026 · 20:00',place:'Belgrano',state:'Borrador',group:'Próximos'},{title:'Maratón M-TEAM 5K',date:'Domingo 30/08/2026 · 09:00',place:'Parque Saavedra',state:'Finalizado',group:'Finalizados'},{title:'Jornada de puertas abiertas',date:'Sábado 22/08/2026 · 11:00',place:'Villa Urquiza',state:'Cancelado',group:'Cancelados'}]; const shown=items.filter(item=>(filter==='Todos'||item.group===filter)&&`${item.title} ${item.place}`.toLowerCase().includes(query.toLowerCase())); return <>{!admin && <div className="filter-pills">{['Próximos','Finalizados','Cancelados'].map(item=><button key={item} className={filter===item?'selected':''} onClick={()=>setFilter(item)}>{item}</button>)}</div>}{admin && <div className="toolbar"><label className="search-shell"><Icon name="search"/><input placeholder="Buscar evento" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="button button-secondary" onClick={() => onAction('Filtrar eventos')}><Icon name="filter"/> Filtros</button></div>}<div className="event-grid event-list workspace-events">{shown.map(event => <article className="workspace-event-card" key={event.title}><div className="event-thumb"><Icon name="trophy" size={30}/></div><div><span className={`badge ${event.group==='Cancelados'?'badge-disabled':event.group==='Finalizados'?'badge-neutral':event.state==='Borrador'?'badge-secondary':'badge-info'}`}>{event.state}</span><h3>{event.title}</h3><p><Icon name="calendar"/>{event.date}</p><p><Icon name="pin"/>{event.place}</p>{admin && <button className="text-link" onClick={() => onAction('Editar evento')}>Editar</button>}</div></article>)}</div></> }

function NewsScreen({ admin, onAction }: { admin: boolean; onAction: (v: string) => void }) { const items = [{title:'Feriado del 8 de septiembre',audience:'Todos',date:'06/09/2026'},{title:'Nueva clase de Boxeo',audience:'Todos',date:'05/09/2026'},{title:'Mantenimiento de vestuarios',audience:'Socios',date:'03/09/2026'},{title:'Reunión de entrenadores',audience:'Entrenadores',date:'02/09/2026'},{title:'Cambio de horario de verano',audience:'Todos',date:'Borrador'}]; return <><div className="toolbar"><SearchBox/>{admin && <button className="button button-secondary" onClick={() => onAction('Filtrar novedades')}><Icon name="filter"/> Filtrar</button>}</div><div className="news-list workspace-news">{items.map(item=><article className="news-card" key={item.title}><div className="news-date"><Icon name="megaphone"/></div><div className="news-body"><div className="news-meta"><span className="badge badge-info">{item.audience}</span><time>{item.date}</time></div><h3>{item.title}</h3><p>Información y novedades de M-TEAM.</p>{admin && <button className="text-link" onClick={() => onAction('Editar novedad')}>Editar</button>}</div></article>)}</div></> }

function NotificationsScreen({ role, notice, onUnavailable }: { role: UserRole; notice: string; onUnavailable: () => void }) { return <section className="surface-card"><PageIntro title="Notificaciones" description="Tus novedades y avisos más recientes." action={<button className="button button-secondary" onClick={onUnavailable}>Marcar todas como leídas</button>}/>{notice && <div className="notice-inline" role="status">{notice}</div>}<div className="notification-list">{[{title:role === 'MEMBER' ? 'Tu apto médico fue aprobado' : 'Cambio en tu cronograma',text:'Consultá los detalles desde tu perfil.',date:'Hoy · 09:20'},{title:role === 'MEMBER' ? 'Tu cuota vence en 5 días' : 'Nueva clase asignada',text:'Revisá la información actualizada en la plataforma.',date:'Ayer · 18:10'},{title:'Se canceló un evento',text:'La jornada de puertas abiertas fue cancelada.',date:'05/09/2026 · 12:30'}].map((n,i)=><article className={`notification-item ${i===0?'unread':''}`} key={n.title}><span className="notification-icon"><Icon name="bell"/></span><div><h3>{n.title}</h3><p>{n.text}</p><time>{n.date}</time></div><button className="icon-action" aria-label="Marcar como leída" onClick={onUnavailable}><Icon name="check"/></button></article>)}</div></section> }

function UsersScreen({ rows, query, setQuery, roleFilter, setRoleFilter, statusFilter, setStatusFilter, feeFilter, setFeeFilter, onAction }: { rows: typeof FIGMA_PREVIEW_USERS; query: string; setQuery: (value: string) => void; roleFilter: string; setRoleFilter: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; feeFilter: string; setFeeFilter: (value: string) => void; onAction: (name: string) => void }) {
  return <section className="surface-card"><div className="toolbar"><label className="search-shell"><Icon name="search"/><input placeholder="Buscar por nombre, documento o correo" value={query} onChange={event => setQuery(event.target.value)}/></label><select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} aria-label="Filtrar por rol"><option value="Todos">Rol: todos</option><option>Socio</option><option>Entrenador</option><option>Administradora</option></select><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filtrar por estado"><option value="Todos">Estado: todos</option><option>Activa</option><option>Desactivada</option></select><select value={feeFilter} onChange={event => setFeeFilter(event.target.value)} aria-label="Filtrar por cuota"><option value="Todas">Cuota: todas</option><option>Al día</option><option>Próxima a vencer</option><option>Vencida</option></select><button className="button button-secondary" onClick={() => { setRoleFilter('Todos'); setStatusFilter('Todos'); setFeeFilter('Todas'); setQuery('') }}><Icon name="filter"/> Limpiar</button></div><DataTable headings={['Usuario','Documento','Correo','Rol','Cuota','Estado']} rows={rows.map(user => [user.name,user.document,user.email,user.role,user.fee,user.status])} onAction={row => onAction(row[0])} actionColumn={0}/><div className="table-pagination"><span>Mostrando {rows.length} resultados de referencia</span><div><button className="button button-secondary" disabled>Anterior</button><button className="button button-secondary" disabled>Siguiente</button></div></div></section>
}

// Branch cards and contact details in this table are Figma preview fixtures, not a live branch directory.
const FIGMA_PREVIEW_BRANCHES = [
  { name:'Villa Urquiza',address:'Av. Triunvirato 4200, CABA',hours:'L a V 7–23 · S 9–15',phone:'+54 11 4521-8800',status:'Activa' },
  { name:'Belgrano',address:'Av. Cabildo 2350, CABA',hours:'L a V 6:30–23:30 · S 9–16',phone:'+54 11 4783-1200',status:'Activa' },
]
function AdminBranches({ onAction }: { onAction:(value:string)=>void }) {
  const [query,setQuery]=useState('')
  const [status,setStatus]=useState('Todas')
  const shown=FIGMA_PREVIEW_BRANCHES.filter(branch=>`${branch.name} ${branch.address}`.toLowerCase().includes(query.toLowerCase())&&(status==='Todas'||branch.status===status))
  return <section className="admin-list-layout"><p className="page-intro">Las sedes desactivadas dejan de mostrarse a socios y no pueden asignarse a nuevas clases, pero conservan su historial.</p><div className="toolbar admin-list-toolbar"><label className="search-shell"><Icon name="search"/><input placeholder="Buscar por nombre o dirección" value={query} onChange={event=>setQuery(event.target.value)}/></label><select value={status} onChange={event=>setStatus(event.target.value)} aria-label="Filtrar sedes por estado"><option value="Todas">Estado: todas</option><option>Activa</option><option>Desactivada</option></select></div><div className="table-scroll surface-card"><table className="data-table"><thead><tr><th>Sede</th><th>Dirección</th><th>Horarios</th><th>Teléfono</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{shown.map(branch=><tr key={branch.name}><td>{branch.name}</td><td>{branch.address}</td><td>{branch.hours}</td><td>{branch.phone}</td><td><span className="badge badge-neutral">{branch.status}</span></td><td><div className="table-actions"><button className="button button-secondary" onClick={()=>onAction('Editar sede')}>Editar</button><button className="button button-danger-outline" onClick={()=>onAction('Desactivar sede')}>Desactivar</button></div></td></tr>)}</tbody></table>{shown.length===0&&<div className="empty-state"><p>No hay sedes que coincidan con la búsqueda.</p></div>}</div></section>
}

function DataTable({ headings, rows, onAction, actionColumn = rows[0]?.length - 1 }: {headings:string[]; rows:string[][]; onAction?:(row:string[])=>void; actionColumn?:number}) { return <div className="table-scroll"><table className="data-table"><thead><tr>{headings.map((heading,index)=><th key={`${heading}-${index}`}>{heading}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={`${row[0]}-${index}`}>{row.map((cell,column)=><td key={`${column}-${cell}`}>{column===actionColumn && onAction ? <button className="text-link" onClick={()=>onAction(row)}>{cell}</button> : <span className={cell==='Activa'||cell==='Acreditado'||cell==='Permitido'||cell==='Aprobado'||cell==='Al día'?'table-status success':cell==='Rechazado'||cell==='Desactivada'||cell==='Anulado'||cell==='Vencida'?'table-status danger':cell==='Pendiente'||cell==='Próxima a vencer'?'table-status pending':''}>{cell}</span>}</td>)}</tr>)}</tbody></table>{rows.length===0 && <div className="empty-state"><Icon name="search"/><p>No hay resultados para estos filtros.</p></div>}</div> }
function SearchBox({ placeholder = 'Buscar' }: {placeholder?:string}) { return <label className="search-shell"><Icon name="search"/><input placeholder={placeholder}/></label> }

function ActionDialog({ title, notice, onClose, onSubmit }: {title:string;notice:string;onClose:()=>void;onSubmit:(event:FormEvent<HTMLFormElement>)=>void}) {
  const name=title.toLowerCase()
  const isCopy=name.includes('generar desde')||name.includes('copiar a la semana')
  const isCancel=name.includes('anular pago')||name.includes('desactivar')||name.includes('activar cuenta')||name.includes('cancelar evento')
  const isClass=name.includes('clase')
  const isBranch=name.includes('sede')
  const isEvent=name.includes('evento')
  const isNews=name.includes('novedad')||name.includes('publicar una novedad')
  const isFee=name.includes('cuota')||name.includes('valor')
  const isMedical=name.includes('apto')
  const isPassword=name.includes('contraseña')||name.includes('restablecer')
  const isProfile=name.includes('perfil')
  const isActivation=name.includes('activar cuenta')
  const fields: [string,string,boolean?][] = isCopy||isActivation?[]:isCancel?[['Motivo','textarea',name.includes('anular')||name.includes('desactivar')]]:isClass?[['Actividad','text',true],['Día','date',true],['Horario','time',true],['Sede','select',true],['Entrenador','select',false]]:isBranch?[['Nombre','text',true],['Dirección','text',true],['Horarios','text',true],['Teléfono','tel',true],['Descripción','textarea',true],['Imagen','file',false],['Ubicación en Google Maps','url',false]]:isEvent?[['Título','text',true],['Descripción','textarea',true],['Fecha','date',true],['Horario','time',true],['Ubicación','text',true],['Imagen','file',false]]:isNews?[['Título','text',true],['Contenido','textarea',true],['Audiencia','select',true],['Imagen','file',false]]:isFee?[['Nuevo valor','number',true],['Fecha de vigencia','date',true]]:isMedical?[['Archivo del apto médico','file',true],['Observación','textarea',false]]:isPassword?[[name.includes('temporal')?'Contraseña temporal':'Nueva contraseña','password',true]]:isProfile?[['Correo electrónico','email',true],['Teléfono','tel',true],['Fotografía','file',false]]:[['Nombre','text',true],['Apellido','text',true],['Correo electrónico','email',true],['Teléfono','tel',true]]
  const actionLabel=isCopy?'Confirmar copia':isActivation?'Confirmar activación':isCancel?name.includes('anular')?'Confirmar anulación':name.includes('desactivar')?'Confirmar desactivación':'Confirmar cancelación':isEvent?'Guardar borrador':isNews?'Guardar borrador':'Guardar cambios'
  return <div className="dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="dialog-close" aria-label="Cerrar" onClick={onClose}><Icon name="close"/></button><span className="eyebrow">M-TEAM</span><h2 id="dialog-title">{title}</h2><form onSubmit={onSubmit}>{isCopy?<p>Se copiará la distribución de la semana anterior a la semana siguiente. La semana original se conserva.</p>:<div className="dialog-fields">{fields.map(([label,type,required])=><label className="read-field" key={label}><span>{label}</span>{type==='select'?<select required={required}><option value="">Seleccioná una opción</option>{(label==='Audiencia'?['Todos','Socios','Entrenadores']:label==='Sede'?['Villa Urquiza','Belgrano']:label==='Entrenador'?['Sin asignar','Carla Giménez','Diego Ruiz','Sofía Núñez']:[]).map(value=><option key={value}>{value}</option>)}</select>:type==='textarea'?<textarea rows={4} required={required} placeholder={label==='Motivo'?'Ingresá el motivo requerido':''}/>:<input type={type} min={type==='number'?'0':undefined} accept={type==='file'?'.pdf,.jpg,.jpeg,.png':undefined} required={required}/>}</label>)}</div>}<p className="integration-pending-note">La interfaz está lista, pero falta el servicio de este módulo. No se enviará ni guardará información.</p>{notice&&<div className="notice-inline" role="status">{notice}</div>}<div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">{actionLabel}</button></div></form></section></div>
}
