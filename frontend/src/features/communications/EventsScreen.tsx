import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { backendApi, type Event, type EventStatus } from '../../service/backend-api'
import { localDateTimeToGymOffset } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import { EventsViewer } from './EventsViewer'
import './communications.css'

const EMPTY_FORM = { title: '', description: '', startsAt: '', location: '', imageUrl: '' }

function inputDateTime(value: string) {
  return value ? new Date(value).toISOString().slice(0, 16) : ''
}

function formatEventDateTime(value: string) {
  const parts = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} · ${get('hour')}:${get('minute')}`
}

function eventStatusLabel(event: Event) {
  if (event.status === 'DRAFT') return 'Borrador'
  if (event.displayStatus === 'CANCELLED') return 'Cancelado'
  if (event.displayStatus === 'FINISHED') return 'Finalizado'
  return 'Publicado'
}

function eventStatusClass(event: Event) {
  if (event.status === 'DRAFT') return 'status-draft'
  if (event.displayStatus === 'CANCELLED') return 'status-cancelled'
  if (event.displayStatus === 'FINISHED') return 'status-finished'
  return 'status-published'
}

export function EventsScreen({ isAdmin = false }: { isAdmin?: boolean }) {
  return isAdmin ? <AdminEventsScreen /> : <EventsViewer />
}

function AdminEventsScreen() {
  const isAdmin = true
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EventStatus | ''>('')
  const [location, setLocation] = useState('')
  const [editing, setEditing] = useState<Event | null>(null)
  const [viewing, setViewing] = useState<Event | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const loader = useCallback(() => backendApi.listEvents({ search: search.trim() || undefined, page, limit: 20, ...(status ? { status } : {}) }), [page, search, status])
  const { data, loading, error, reload } = useApiResource(loader)
  const locations = useMemo(() => Array.from(new Set((data?.items ?? []).map((event) => event.location))).sort(), [data?.items])
  const visibleEvents = useMemo(() => location ? (data?.items ?? []).filter((event) => event.location === location) : data?.items ?? [], [data?.items, location])

  function resetPage(action: () => void) { setPage(1); action() }
  function startCreate() { setEditing(null); setFormOpen(true); setForm(EMPTY_FORM); setFormError('') }
  function startEdit(event: Event) { setEditing(event); setFormOpen(true); setForm({ title: event.title, description: event.description, startsAt: inputDateTime(event.startsAt), location: event.location, imageUrl: event.imageUrl }); setFormError('') }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError(''); setSaving(true)
    try {
      const body = { ...form, startsAt: localDateTimeToGymOffset(form.startsAt) }
      if (editing) await backendApi.updateEvent(editing.id, body)
      else await backendApi.createEvent({ ...body, status: 'DRAFT' })
      setFormOpen(false); setEditing(null); setForm(EMPTY_FORM); await reload()
    } catch (value) { setFormError(value instanceof Error ? value.message : 'No se pudo guardar el evento.') } finally { setSaving(false) }
  }

  async function changeStatus(event: Event, nextStatus: 'PUBLISHED' | 'CANCELLED') {
    const question = nextStatus === 'CANCELLED' ? '¿Querés cancelar este evento? Se avisará a socios y entrenadores.' : '¿Querés publicar este evento?'
    if (!window.confirm(question)) return
    try { await backendApi.updateEventStatus(event.id, nextStatus); await reload() } catch (value) { setFormError(value instanceof Error ? value.message : 'No se pudo actualizar el estado del evento.') }
  }

  async function viewDetails(event: Event) {
    try { setViewing(await backendApi.getEvent(event.id)) } catch (value) { setFormError(value instanceof Error ? value.message : 'No se pudieron cargar los detalles del evento.') }
  }

  return <div className="app-page communications-page events-admin-screen">
    <PageHeader title="Eventos" description="Guardá como borrador, publicá o cancelá. Un evento cancelado se conserva y genera una notificación.">{isAdmin && <button type="button" className="button button-primary" onClick={startCreate}><Icon name="plus" size={20}/>Nuevo evento</button>}</PageHeader>
    {isAdmin && <div className="communications-toolbar" aria-label="Filtros de eventos"><label className="search-shell"><Icon name="search" size={19}/><input aria-label="Buscar evento" placeholder="Buscar evento" value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))}/></label><select aria-label="Filtrar eventos por estado" value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as EventStatus | ''))}><option value="">Estado: todos</option><option value="DRAFT">Estado: borradores</option><option value="PUBLISHED">Estado: publicados</option><option value="CANCELLED">Estado: cancelados</option></select><select aria-label="Filtrar eventos por sede" value={location} onChange={(event) => setLocation(event.target.value)}><option value="">Sede: todas</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>}
    {isAdmin && formOpen && <EventForm editing={editing} form={form} error={formError} saving={saving} onChange={setForm} onCancel={() => { setFormOpen(false); setFormError('') }} onSubmit={save}/>}
    {isAdmin && !formOpen && formError && <p className="error-message" role="alert">{formError}</p>}
    {!isAdmin && formError && <p className="error-message" role="alert">{formError}</p>}
    {loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !visibleEvents.length ? <EmptyState message={isAdmin ? 'No hay eventos para los filtros seleccionados.' : 'No hay eventos publicados para mostrar.'}/> : <><div className="events-table-wrap"><table className="communications-table"><thead><tr><th>Evento</th><th>Fecha y horario</th><th>Ubicación</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visibleEvents.map((event) => <EventRow key={event.id} event={event} isAdmin={isAdmin} onEdit={startEdit} onStatus={changeStatus} onView={viewDetails}/>)}</tbody></table></div><div className="events-mobile-list">{visibleEvents.map((event) => <EventMobileCard key={event.id} event={event} isAdmin={isAdmin} onEdit={startEdit} onStatus={changeStatus} onView={viewDetails}/>)}</div></>}
    {data && <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={setPage}/>} {viewing && <EventDetails event={viewing} onClose={() => setViewing(null)}/>}
  </div>
}

function EventStatusBadge({ event }: { event: Event }) { return <span className={`communication-status ${eventStatusClass(event)}`}>{eventStatusLabel(event)}</span> }

function EventActions({ event, isAdmin, onEdit, onStatus, onView }: { event: Event; isAdmin: boolean; onEdit: (event: Event) => void; onStatus: (event: Event, status: 'PUBLISHED' | 'CANCELLED') => void; onView: (event: Event) => void }) {
  if (!isAdmin) return null
  if (event.status === 'DRAFT') return <div className="row-actions"><button type="button" className="button button-secondary" onClick={() => onEdit(event)}>Editar</button><button type="button" className="button button-primary" onClick={() => onStatus(event, 'PUBLISHED')}>Publicar</button></div>
  if (event.status === 'PUBLISHED' && event.displayStatus === 'UPCOMING') return <div className="row-actions"><button type="button" className="button button-secondary" onClick={() => onEdit(event)}>Editar</button><button type="button" className="button button-danger" onClick={() => onStatus(event, 'CANCELLED')}>Cancelar</button></div>
  return <div className="row-actions"><button type="button" className="button button-secondary" onClick={() => onView(event)}>Ver</button></div>
}

function EventRow({ event, isAdmin, onEdit, onStatus, onView }: { event: Event; isAdmin: boolean; onEdit: (event: Event) => void; onStatus: (event: Event, status: 'PUBLISHED' | 'CANCELLED') => void; onView: (event: Event) => void }) { return <tr><td className="event-title-cell">{event.title}</td><td>{formatEventDateTime(event.startsAt)}</td><td>{event.location}</td><td><EventStatusBadge event={event}/></td><td><EventActions event={event} isAdmin={isAdmin} onEdit={onEdit} onStatus={onStatus} onView={onView}/></td></tr> }
function EventMobileCard({ event, isAdmin, onEdit, onStatus, onView }: { event: Event; isAdmin: boolean; onEdit: (event: Event) => void; onStatus: (event: Event, status: 'PUBLISHED' | 'CANCELLED') => void; onView: (event: Event) => void }) { return <article className="event-mobile-card"><div className="event-mobile-heading"><h2>{event.title}</h2><EventStatusBadge event={event}/></div><p>{formatEventDateTime(event.startsAt)} · {event.location}</p><EventActions event={event} isAdmin={isAdmin} onEdit={onEdit} onStatus={onStatus} onView={onView}/></article> }

function EventForm({ editing, form, error, saving, onChange, onCancel, onSubmit }: { editing: Event | null; form: typeof EMPTY_FORM; error: string; saving: boolean; onChange: (value: typeof EMPTY_FORM) => void; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <form className="surface-card communication-editor-form" onSubmit={onSubmit}><div className="editor-heading"><h2>{editing ? 'Editar evento' : 'Nuevo evento'}</h2><button type="button" className="icon-action" aria-label="Cerrar formulario" onClick={onCancel}><Icon name="close" size={18}/></button></div><div className="communication-form-grid"><label className="read-field"><span>Título</span><input required maxLength={200} value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })}/></label><label className="read-field"><span>Fecha y horario</span><input required type="datetime-local" value={form.startsAt} onChange={(event) => onChange({ ...form, startsAt: event.target.value })}/></label><label className="read-field"><span>Ubicación</span><input required maxLength={255} value={form.location} onChange={(event) => onChange({ ...form, location: event.target.value })}/></label><label className="read-field"><span>Imagen (URL)</span><input required type="url" value={form.imageUrl} onChange={(event) => onChange({ ...form, imageUrl: event.target.value })}/></label><label className="read-field communication-form-wide"><span>Descripción</span><textarea required value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })}/></label></div>{error && <p className="error-message" role="alert">{error}</p>}<div className="communication-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar borrador'}</button></div></form> }
function EventDetails({ event, onClose }: { event: Event; onClose: () => void }) { return <div className="communication-dialog-backdrop" role="presentation"><section className="communication-dialog" role="dialog" aria-modal="true" aria-label={`Detalle de ${event.title}`}><button type="button" className="icon-action communication-dialog-close" aria-label="Cerrar detalle" onClick={onClose}><Icon name="close" size={18}/></button><EventStatusBadge event={event}/><h2>{event.title}</h2><p>{event.description}</p><dl><div><dt>Fecha y horario</dt><dd>{formatEventDateTime(event.startsAt)}</dd></div><div><dt>Ubicación</dt><dd>{event.location}</dd></div></dl></section></div> }
function Pagination({ page, limit, total, onPageChange }: { page: number; limit: number; total: number; onPageChange: (page: number) => void }) { const lastPage = Math.max(1, Math.ceil(total / limit)); if (lastPage === 1) return null; return <div className="table-pagination"><span>Página {page} de {lastPage}</span><div><button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>Siguiente</button></div></div> }
