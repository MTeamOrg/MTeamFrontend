import { Link } from 'react-router-dom'
import type { UserRole } from '../authentication/auth-types'
import { Icon, type IconName } from './Icon'

// These values mirror the Figma prototype only. They are not live gym records.
const FIGMA_PREVIEW = {
  branches: [
    { name: 'Villa Urquiza', address: 'Av. Triunvirato 4200, CABA', hours: 'Lun a Vie 7:00–23:00 · Sáb 9:00–15:00', phone: '+54 11 4521-8800' },
    { name: 'Belgrano', address: 'Av. Cabildo 2350, CABA', hours: 'Lun a Vie 6:30–23:30 · Sáb 9:00–16:00', phone: '+54 11 4783-1200' },
  ],
  classes: [
    { time: '08:00', activity: 'Funcional', branch: 'Villa Urquiza · Sala 2', trainer: 'Carla Giménez', state: 'Finalizada' },
    { time: '18:00', activity: 'Musculación', branch: 'Belgrano · Sala principal', trainer: 'Diego Ruiz', state: 'Próxima' },
    { time: '20:00', activity: 'Spinning', branch: 'Belgrano · Sala de ciclismo', trainer: 'Carla Giménez', state: 'Programada' },
  ],
}

type StatProps = { label: string; value: string; hint: string; icon: IconName; tone?: string; href?: string }

function StatusCard({ label, value, hint, icon, tone = '', href }: StatProps) {
  const content = <><span className={`stat-icon ${tone}`}><Icon name={icon}/></span><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></>
  return href ? <Link className="stat-card stat-card-link" to={href}>{content}</Link> : <article className="stat-card">{content}</article>
}

function BranchPreview() {
  return <section className="dashboard-branches"><div className="dashboard-section-title"><h2>Nuestras sedes</h2><span>La misma cuota te habilita en las dos</span></div><div className="dashboard-branch-grid">{FIGMA_PREVIEW.branches.map(branch => <article className="dashboard-branch-card" key={branch.name}><div className="media-placeholder"><Icon name="image"/></div><div className="dashboard-branch-info"><div><h3>{branch.name}</h3><span className="badge badge-info">Abierta</span></div><p><Icon name="pin"/>{branch.address}</p><p><Icon name="clock"/>{branch.hours}</p><p><Icon name="phone"/>{branch.phone}</p><Link className="button button-secondary" to="/sedes"><Icon name="map"/> Cómo llegar</Link></div></article>)}</div></section>
}

function ClassPreview({ compact = false }: { compact?: boolean }) {
  return <div className={`dashboard-class-list ${compact ? 'compact' : ''}`}>{FIGMA_PREVIEW.classes.map(item => <article className="dashboard-class-row" key={item.time}><strong>{item.time}<small>60 min</small></strong><span className="class-divider"/><div><h3>{item.activity}</h3><p>{item.branch}</p>{!compact && <small>{item.trainer}</small>}</div><span className={`badge ${item.state === 'Finalizada' ? 'badge-neutral' : item.state === 'Próxima' ? 'badge-secondary' : 'badge-info'}`}>{item.state}</span></article>)}</div>
}

export function MemberDashboard({ name }: { name: string }) {
  return <>
    <section className="member-dashboard-welcome"><span className="eyebrow">BIENVENIDO A M-TEAM</span><h2>¡Hola, {name}!</h2><p>Tu cuenta está habilitada. Escaneá el QR del molinete para ingresar a cualquiera de las dos sedes.</p></section>
    <div className="dashboard-stat-grid">
      <StatusCard label="Estado de cuota" value="Al día" hint="Vence el 28/09/2026 · faltan 22 días" icon="wallet" tone="blue"/>
      <StatusCard label="Apto médico" value="Aprobado" hint="Revisado el 02/09/2026" icon="file" tone="blue"/>
      <StatusCard label="Acceso al gimnasio" value="Habilitado" hint="Podés escanear el QR del molinete" icon="qr" tone="blue"/>
      <StatusCard label="Valor de la cuota" value="$ 32.000" hint="Vigente desde el 01/09/2026" icon="wallet"/>
    </div>
    <div className="dashboard-actions"><Link className="button button-primary" to="/socio/acceso"><Icon name="qr"/> Abrir escáner QR</Link><Link className="button button-secondary" to="/socio/clases"><Icon name="calendar"/> Ver mis clases</Link><Link className="button button-secondary" to="/socio/apto-medico"><Icon name="file"/> Mi apto médico</Link></div>
    <Link className="member-payment-history-link" to="/socio/pagos">Ver historial de pagos →</Link>
    <BranchPreview/>
  </>
}

export function TrainerDashboard({ name }: { name: string }) {
  return <>
    <section className="member-dashboard-welcome"><span className="eyebrow">PANEL DEL ENTRENADOR</span><h2>¡Hola, {name}!</h2><p>Tenés 3 clases asignadas hoy. Acordate de escanear el QR del molinete al llegar.</p></section>
    <div className="dashboard-stat-grid">
      <StatusCard label="Clases de hoy" value="3 clases" hint="Próxima: 18:00 · Musculación" icon="calendar"/>
      <StatusCard label="Clases de la semana" value="9 clases" hint="Entre las dos sedes" icon="dumbbell"/>
      <StatusCard label="Acceso al gimnasio" value="Habilitado" hint="Cuenta activa como entrenadora" icon="qr" tone="blue"/>
      <StatusCard label="Notificaciones" value="2 sin leer" hint="Cambios de horario y eventos" icon="bell" tone="purple"/>
    </div>
    <div className="dashboard-actions"><Link className="button button-primary" to="/entrenador/acceso"><Icon name="qr"/> Abrir escáner QR</Link><Link className="button button-secondary" to="/entrenador/clases"><Icon name="calendar"/> Ver mis clases</Link></div>
    <div className="trainer-dashboard-grid"><section className="surface-card"><div className="dashboard-section-title"><h2>Tus clases de hoy</h2><Link to="/entrenador/clases">Ver todas →</Link></div><ClassPreview compact/></section><section className="surface-card"><div className="dashboard-section-title"><h2>Últimas novedades</h2></div><ul className="dashboard-news-preview"><li>Feriado del 8 de septiembre</li><li>Nueva clase de Boxeo en Belgrano</li><li>Mantenimiento de vestuarios</li></ul><Link className="text-link" to="/entrenador/novedades">Ver todas las novedades →</Link></section></div>
    <BranchPreview/>
  </>
}

export function AdminDashboard({ name, onAction }: { name: string; onAction: (value: string) => void }) {
  return <>
    <section className="admin-dashboard-welcome"><span className="eyebrow">PANEL ADMINISTRATIVO</span><h2>Buen día, {name}</h2><p>Resumen de socios, cuotas, aptos médicos y accesos de M-TEAM.</p></section>
    <div className="dashboard-stat-grid">
      <StatusCard label="Socios activos" value="184 socios" hint="12 desactivados" icon="users" href="/admin/usuarios"/>
      <StatusCard label="Cuotas al día" value="141 socios" hint="23 próximas a vencer" icon="wallet" tone="blue" href="/admin/pagos"/>
      <StatusCard label="Cuotas vencidas" value="20 socios" hint="Requieren seguimiento" icon="alert" tone="pink" href="/admin/usuarios"/>
      <StatusCard label="Aptos pendientes" value="7 aptos" hint="2 rechazados esta semana" icon="file" tone="purple" href="/admin/aptos"/>
    </div>
    <div className="admin-dashboard-grid"><div className="admin-dashboard-main">
      <section className="surface-card revenue-card"><div className="dashboard-section-title"><h2>Recaudación de los últimos 7 días</h2><strong>$ 512.000</strong></div><div className="revenue-chart" aria-label="Gráfico de recaudación de los últimos siete días">{[48,68,42,88,61,79,100].map((height,index)=><div key={index}><span style={{height:`${height}%`}} className={index===6?'today':''}/><small>{['31/08','01/09','02/09','03/09','04/09','05/09','06/09'][index]}</small></div>)}</div></section>
      <section className="surface-card dashboard-accesses"><div className="dashboard-section-title"><h2>Últimos intentos de acceso</h2><Link to="/admin/accesos">Ver historial →</Link></div>{[
        ['JP','Juan Manuel Pérez','Belgrano · Molinete 1 · 19:24','Permitido','blue'],['MR','Micaela Rossi','V. Urquiza · Molinete 2 · 19:18','Rechazado · cuota vencida','pink'],['CG','Carla Giménez','Belgrano · Molinete 1 · 17:52','Permitido','blue'],['LT','Lucas Torres','Belgrano · Molinete 1 · 17:40','Rechazado · apto pendiente','pink'],
      ].map(([initials,user,detail,status,tone])=><article className="dashboard-access-row" key={user}><span className={`avatar ${tone}`}>{initials}</span><div><strong>{user}</strong><small>{detail}</small></div><span className={`badge ${tone==='pink'?'badge-primary':'badge-info'}`}>{status}</span></article>)}</section>
    </div><div className="admin-dashboard-side">
      <section className="surface-card"><h2>Acciones recientes</h2><div className="dashboard-quick-actions"><Link className="button button-primary" to="/admin/registrar-pago"><Icon name="plus"/> Registrar un pago</Link><Link className="button button-secondary" to="/admin/aptos"><Icon name="file"/> Revisar aptos médicos (7)</Link><Link className="button button-secondary" to="/admin/crear-usuario"><Icon name="user"/> Crear una cuenta</Link><Link className="button button-secondary" to="/admin/novedades"><Icon name="megaphone"/> Publicar una novedad</Link></div></section>
      <section className="surface-card grace-period-card"><h2>Período inicial de 20 días</h2><p>Socios que todavía pueden ingresar sin apto aprobado.</p>{[['Lucas Torres','Quedan 6 días'],['Ana Vidal','Quedan 14 días'],['Pedro Lima','Quedan 19 días']].map(([user,days])=><div key={user}><span>{user}</span><span className="badge badge-secondary">{days}</span></div>)}</section>
      <section className="surface-card next-week-card"><div className="dashboard-section-title"><h2>Cronograma</h2><span className="badge badge-primary">Sin generar</span></div><p>La semana del 14 al 19 de septiembre todavía no fue generada.</p><button className="button button-purple" onClick={()=>onAction('Generar desde la semana anterior')}><Icon name="copy"/> Generar desde la semana anterior</button></section>
    </div></div>
  </>
}

export function DashboardForRole({ role, name, onAction }: { role: UserRole; name: string; onAction: (value: string) => void }) {
  if (role === 'MEMBER') return <MemberDashboard name={name}/>
  if (role === 'TRAINER') return <TrainerDashboard name={name}/>
  return <AdminDashboard name={name} onAction={onAction}/>
}
