import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../workspace/Icon'

// Public branch/event/news entries are Figma layout fixtures until their read APIs exist.
const BRANCHES = [
  { name: 'Villa Urquiza', address: 'Av. Triunvirato 4200, CABA', hours: 'Lun a Vie 7:00–23:00 · Sáb 9:00–15:00', phone: '+54 11 4521-8800' },
  { name: 'Belgrano', address: 'Av. Cabildo 2350, CABA', hours: 'Lun a Vie 6:30–23:30 · Sáb 9:00–16:00', phone: '+54 11 4783-1200' },
]

const EVENTS = [
  { title: 'Torneo interno de Crossfit', date: 'Sábado 19/09/2026 · 10:00', place: 'Sede Villa Urquiza', status: 'Publicado', startsAt: '2026-09-19T10:00:00' },
  { title: 'Clase abierta de Zumba', date: 'Viernes 25/09/2026 · 19:00', place: 'Sede Belgrano', status: 'Publicado', startsAt: '2026-09-25T19:00:00' },
  { title: 'Charla de nutrición deportiva', date: 'Miércoles 07/10/2026 · 20:00', place: 'Sede Belgrano', status: 'Publicado', startsAt: '2026-10-07T20:00:00' },
  { title: 'Maratón M-TEAM 5K', date: 'Domingo 30/08/2026 · 09:00', place: 'Parque Saavedra', status: 'Publicado', startsAt: '2026-08-30T09:00:00' },
  { title: 'Jornada de puertas abiertas', date: 'Sábado 22/08/2026 · 11:00', place: 'Sede Villa Urquiza', status: 'Cancelado', startsAt: '2026-08-22T11:00:00' },
]

const NEWS = [
  { title: 'Feriado del 8 de septiembre', audience: 'Todos', date: '06/09/2026', content: 'Conocé los horarios especiales de nuestras sedes durante el feriado.' },
  { title: 'Nueva clase de Boxeo en Belgrano', audience: 'Todos', date: '05/09/2026', content: 'Sumamos un nuevo horario para que puedas entrenar durante la semana.' },
  { title: 'Mantenimiento de vestuarios · Villa Urquiza', audience: 'Socios', date: '03/09/2026', content: 'Estamos trabajando para mejorar las instalaciones de la sede.' },
  { title: 'Actualización del valor de la cuota', audience: 'Todos', date: '01/09/2026', content: 'Consultá el valor vigente de la cuota mensual desde tu perfil.' },
]

export function PublicSite() {
  const { pathname } = useLocation()
  const active = pathname === '/' ? 'Inicio' : pathname.slice(1)
  return (
    <div className="public-site">
      <header className="public-header">
        <Link className="brand-lockup" to="/" aria-label="M-Team Gimnasio, inicio"><span className="brand-mark">M</span><span>M-TEAM <b>GIMNASIO</b></span></Link>
        <nav className="public-nav" aria-label="Navegación principal">
          {[['Inicio', '/'], ['Sedes', '/sedes'], ['Eventos', '/eventos'], ['Novedades', '/novedades']].map(([label, href]) => <Link key={href} className={active === label.toLowerCase() || (href === '/' && active === 'Inicio') ? 'active' : ''} to={href}>{label}</Link>)}
        </nav>
        <div className="public-actions"><Link className="button button-secondary" to="/iniciar-sesion">Iniciar sesión</Link><Link className="button button-primary" to="/crear-cuenta">Crear cuenta</Link></div>
        <Link className="mobile-signin" to="/iniciar-sesion">Ingresar</Link>
      </header>
      <main>
        {pathname === '/sedes' ? <BranchesPage /> : pathname.startsWith('/sedes/') ? <BranchDetailsPage slug={pathname.split('/')[2] ?? ''}/> : pathname === '/eventos' ? <EventsPage /> : pathname === '/novedades' ? <NewsPage /> : <LandingPage />}
      </main>
      <footer className="public-footer"><Brand /><span>Tu mejor versión, nuestro compromiso.</span><span>Villa Urquiza · Belgrano</span></footer>
      <nav className="mobile-public-tabs" aria-label="Navegación"><Link className={active === 'Inicio' ? 'selected' : ''} to="/"><Icon name="home"/>Inicio</Link><Link className={active === 'sedes' ? 'selected' : ''} to="/sedes"><Icon name="pin"/>Sedes</Link><Link className={active === 'eventos' ? 'selected' : ''} to="/eventos"><Icon name="trophy"/>Eventos</Link><Link className={active === 'novedades' ? 'selected' : ''} to="/novedades"><Icon name="megaphone"/>Novedades</Link><Link to="/iniciar-sesion"><Icon name="user"/>Ingresar</Link></nav>
    </div>
  )
}

function Brand() { return <span className="brand-lockup"><span className="brand-mark">M</span><span>M-TEAM <b>GIMNASIO</b></span></span> }

function LandingPage() {
  const upcomingEvents = EVENTS.map(event => ({ ...event, state: eventState(event) })).filter(event => event.state === 'Próximo').sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()).slice(0, 3)
  return <>
    <section className="landing-hero"><div className="hero-copy"><span className="eyebrow">DOS SEDES EN CABA</span><h1>Entrená en M-TEAM</h1><p><span className="hero-desktop-description">Musculación, funcional, spinning, yoga y boxeo. Una sola cuota mensual para las dos sedes, sin permanencia.</span><span className="hero-mobile-description">Una sola cuota mensual para las dos sedes, sin permanencia.</span></p><div className="hero-buttons"><Link className="button button-primary" to="/crear-cuenta">Crear cuenta</Link><Link className="button button-dark" to="/iniciar-sesion">Ya soy socio</Link></div></div><div className="hero-highlights"><Highlight icon="wallet" label="Cuota mensual" value="$ 32.000" mobileNote="Las dos sedes"/><Highlight icon="calendar" label="Clases por semana" value="14 clases" mobileLabel="Clases" mobileValue="14 por semana" mobileNote="Sin reserva previa"/><Highlight icon="qr" label="Ingreso" value="Con QR desde el celular"/></div></section>
    <section className="public-section"><SectionTitle title="Nuestras sedes" link="Ver las sedes" href="/sedes"/><BranchCards compact/></section>
    <section className="public-section"><SectionTitle title="Próximos eventos" link="Ver todos" href="/eventos"/><div className="event-grid">{upcomingEvents.map(event => <EventCard key={event.title} event={event}/>)}</div></section>
    <section className="landing-cta"><h2>¿Empezamos?</h2><p>Creá tu cuenta, acercate al mostrador a registrar el primer pago y ya podés entrenar.</p><Link className="button button-primary" to="/crear-cuenta">Crear cuenta</Link></section>
  </>
}

function Highlight({ icon, label, value, mobileLabel, mobileValue, mobileNote }: { icon: 'wallet' | 'calendar' | 'qr'; label: string; value: string; mobileLabel?: string; mobileValue?: string; mobileNote?: string }) { return <div className="hero-highlight"><Icon name={icon}/><div><span className="highlight-desktop-label">{label}</span><span className="highlight-mobile-label">{mobileLabel ?? label.toUpperCase()}</span><strong className="highlight-desktop-value">{value}</strong><strong className="highlight-mobile-value">{mobileValue ?? value}</strong>{mobileNote && <small>{mobileNote}</small>}</div></div> }

function SectionTitle({ title, link, href }: { title: string; link?: string; href?: string }) { return <div className="section-title"><h2>{title}</h2>{link && href && <Link to={href}>{link} <span>→</span></Link>}</div> }

function BranchCards({ compact = false }: { compact?: boolean }) { return <div className={`branch-grid ${compact ? 'compact' : ''}`}>{BRANCHES.map((branch,index) => <article className="branch-card" key={branch.name}><div className="media-placeholder"><Icon name="image"/></div><div className="branch-info"><div className="card-title-row"><h3><Link to={`/sedes/${index===0?'villa-urquiza':'belgrano'}`}>{branch.name}</Link></h3><span className="badge badge-info">Abierta</span></div><p><Icon name="pin"/>{branch.address}</p><p><Icon name="clock"/>{branch.hours}</p><p><Icon name="phone"/>{branch.phone}</p><a className="button button-secondary directions" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}`} target="_blank" rel="noreferrer"><Icon name="map"/> Cómo llegar</a></div></article>)}</div> }

function BranchesPage() { const mapsKey=import.meta.env.VITE_GOOGLE_MAPS_API_KEY; return <div className="public-page"><SectionTitle title="Sedes"/><p className="page-intro">M-TEAM tiene dos sedes en CABA. La misma cuota te habilita en las dos.</p><div className="maps-grid">{BRANCHES.map(branch=>{const place=encodeURIComponent(branch.address);const src=mapsKey?`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${place}`:`https://maps.google.com/maps?q=${place}&output=embed`;return <iframe key={branch.name} className="branch-map" title={`Google Maps: ${branch.name}`} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>})}</div><BranchCards/></div> }

function BranchDetailsPage({slug}:{slug:string}) { const branchIndex=slug==='villa-urquiza'?0:slug==='belgrano'?1:-1; const branch=BRANCHES[branchIndex]; if(!branch)return <div className="public-page"><SectionTitle title="Sede no encontrada"/><Link className="text-link" to="/sedes">Volver a sedes</Link></div>; const mapsKey=import.meta.env.VITE_GOOGLE_MAPS_API_KEY; const place=encodeURIComponent(branch.address); const mapSrc=mapsKey?`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${place}`:`https://maps.google.com/maps?q=${place}&output=embed`; return <div className="public-page branch-detail-page"><Link className="text-link" to="/sedes">← Volver a sedes</Link><SectionTitle title={branch.name}/><div className="branch-detail-grid"><article className="branch-card"><div className="media-placeholder"><Icon name="image"/></div><div className="branch-info"><div className="card-title-row"><h3>{branch.name}</h3><span className="badge badge-info">Abierta</span></div><p><Icon name="pin"/>{branch.address}</p><p><Icon name="clock"/>{branch.hours}</p><p><Icon name="phone"/>{branch.phone}</p><a className="button button-secondary directions" href={`https://www.google.com/maps/search/?api=1&query=${place}`} target="_blank" rel="noreferrer"><Icon name="map"/> Cómo llegar</a></div></article><section className="branch-detail-info surface-card"><h2>Información de la sede</h2><p>La descripción completa de esta sede se cargará cuando esté disponible el servicio de sedes.</p><h2>Clases programadas</h2><p>El cronograma de esta sede requiere el servicio de clases.</p></section></div><iframe className="branch-map branch-detail-map" title={`Google Maps: ${branch.name}`} src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></div> }

function eventState(event: typeof EVENTS[number]) { if (event.status === 'Cancelado') return 'Cancelado'; if (new Date(event.startsAt).getTime() < Date.now()) return 'Finalizado'; return 'Próximo' }
function EventsPage() { const [filter,setFilter]=useState('Próximos'); const shown=EVENTS.map(event=>({...event,state:eventState(event)})).filter(event=>filter==='Próximos'?event.state==='Próximo':filter==='Finalizados'?event.state==='Finalizado':event.state==='Cancelado').sort((a,b)=>new Date(a.startsAt).getTime()-new Date(b.startsAt).getTime()); return <div className="public-page"><SectionTitle title="Eventos"/><p className="page-intro">Torneos, clases abiertas y charlas. Algunos son abiertos al público.</p><div className="filter-pills">{['Próximos','Finalizados','Cancelados'].map(item=><button key={item} className={filter===item?'selected':''} onClick={()=>setFilter(item)}>{item}</button>)}</div><div className="event-grid event-list">{shown.map(event => <EventCard key={event.title} event={event}/>)}</div></div> }

function EventCard({ event }: { event: typeof EVENTS[number] & { state: string } }) { return <article className="event-card"><div className="media-placeholder"><Icon name="trophy"/></div><div className="event-info"><span className={`badge ${event.state === 'Próximo' ? 'badge-primary' : event.state === 'Cancelado' ? 'badge-disabled' : 'badge-neutral'}`}>{event.state}</span><h3>{event.title}</h3><p><Icon name="calendar"/>{event.date}</p><p><Icon name="pin"/>{event.place}</p></div></article> }

function NewsPage() { return <div className="public-page"><SectionTitle title="Novedades"/><p className="page-intro">Información y novedades de M-TEAM.</p><div className="news-list">{NEWS.map(item => <article className="news-card" key={item.title}><div className="news-date"><span>{item.date.slice(0,2)}</span><small>{item.date.slice(3)}</small></div><div><div className="news-meta"><span className="badge badge-info">{item.audience}</span><time>{item.date}</time></div><h3>{item.title}</h3><p>{item.content}</p></div></article>)}</div></div> }
