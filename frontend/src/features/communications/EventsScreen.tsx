import { useCallback, useState } from 'react'
import { backendApi, type Event, type EventStatus } from '../../service/backend-api'
import { formatDateTime, localDateTimeToGymOffset } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { ErrorState, EmptyState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import { SafeImage } from '../workspace/SafeImage'
import './communications.css'

const EMPTY_FORM = { title: '', description: '', startsAt: '', location: '', imageUrl: '' }

function inputDateTime(value: string) {
  return value ? new Date(value).toISOString().slice(0, 16) : ''
}

function eventStatusLabel(event: Event) {
  if (event.displayStatus === 'CANCELLED') return 'Cancelado'
  if (event.displayStatus === 'FINISHED') return 'Finalizado'
  return 'Próximo'
}

export function EventsScreen({ isAdmin = false }: { isAdmin?: boolean }) {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<EventStatus | ''>('')
  const [editing, setEditing] = useState<Event | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const loader = useCallback(() => backendApi.listEvents({ page, limit: 12, ...(status ? { status } : {}) }), [page, status])
  const { data, loading, error, reload } = useApiResource(loader)

  function startCreate() {
    setEditing(null)
    setFormOpen(true)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  function startEdit(event: Event) {
    setEditing(event)
    setFormOpen(true)
    setForm({ title: event.title, description: event.description, startsAt: inputDateTime(event.startsAt), location: event.location, imageUrl: event.imageUrl })
    setFormError('')
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const body = { ...form, startsAt: localDateTimeToGymOffset(form.startsAt) }
      if (editing) await backendApi.updateEvent(editing.id, body)
      else await backendApi.createEvent({ ...body, status: 'DRAFT' })
      setFormOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      await reload()
    } catch (value) {
      setFormError(value instanceof Error ? value.message : 'No se pudo guardar el evento.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(event: Event, nextStatus: 'PUBLISHED' | 'CANCELLED') {
    const question = nextStatus === 'CANCELLED' ? '¿Querés cancelar este evento? Se avisará a socios y entrenadores.' : '¿Querés publicar este evento?'
    if (!window.confirm(question)) return
    try {
      await backendApi.updateEventStatus(event.id, nextStatus)
      await reload()
    } catch (value) {
      setFormError(value instanceof Error ? value.message : 'No se pudo actualizar el estado del evento.')
    }
  }

  return <div className="app-page communications-page">
    <PageHeader title="Eventos" description={isAdmin ? 'Creá, editá y publicá los eventos de M-Team.' : 'Consultá los próximos eventos y su estado.'}>
      {isAdmin && <button type="button" className="button button-primary" onClick={startCreate}><Icon name="plus" size={17}/>Nuevo evento</button>}
    </PageHeader>
    {isAdmin && <div className="communications-toolbar"><label>Estado<select value={status} onChange={(event) => { setStatus(event.target.value as EventStatus | ''); setPage(1) }}><option value="">Todos</option><option value="DRAFT">Borradores</option><option value="PUBLISHED">Publicados</option><option value="CANCELLED">Cancelados</option></select></label></div>}
    {isAdmin && formOpen && <EventForm editing={editing} form={form} error={formError} saving={saving} onChange={setForm} onCancel={() => setFormOpen(false)} onSubmit={save}/>}
    {isAdmin && !formOpen && formError && <p className="error-message" role="alert">{formError}</p>}
    {!isAdmin && formError && <p className="error-message" role="alert">{formError}</p>}
    {loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message={isAdmin ? 'No hay eventos para los filtros seleccionados.' : 'No hay eventos publicados para mostrar.'}/> : <div className="communications-grid">{data.items.map((event) => <EventCard key={event.id} event={event} isAdmin={isAdmin} onEdit={startEdit} onStatus={changeStatus}/>)}</div>}
    {data && <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={setPage}/>}
  </div>
}

function EventForm({ editing, form, error, saving, onChange, onCancel, onSubmit }: { editing: Event | null; form: typeof EMPTY_FORM; error: string; saving: boolean; onChange: (value: typeof EMPTY_FORM) => void; onCancel: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <form className="surface-card communication-form" onSubmit={onSubmit}>
    <h2>{editing ? 'Editar evento' : 'Nuevo evento'}</h2>
    <div className="communication-form-grid">
      <label>Título<input required maxLength={200} value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })}/></label>
      <label>Fecha y horario<input required type="datetime-local" value={form.startsAt} onChange={(event) => onChange({ ...form, startsAt: event.target.value })}/></label>
      <label>Ubicación<input required maxLength={255} value={form.location} onChange={(event) => onChange({ ...form, location: event.target.value })}/></label>
      <label>Imagen (URL)<input required type="url" value={form.imageUrl} onChange={(event) => onChange({ ...form, imageUrl: event.target.value })}/></label>
      <label className="communication-form-wide">Descripción<textarea required value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })}/></label>
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="communication-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar borrador'}</button></div>
  </form>
}

function EventCard({ event, isAdmin, onEdit, onStatus }: { event: Event; isAdmin: boolean; onEdit: (event: Event) => void; onStatus: (event: Event, status: 'PUBLISHED' | 'CANCELLED') => void }) {
  return <article className="communication-card">
    <SafeImage className="communication-image" src={event.imageUrl} alt={`Imagen del evento ${event.title}`} fallbackIcon="calendar"/>
    <div className="communication-card-body"><div className="communication-card-meta"><span className={`badge ${event.displayStatus === 'CANCELLED' ? 'badge-primary' : event.displayStatus === 'FINISHED' ? 'badge-neutral' : 'badge-info'}`}>{eventStatusLabel(event)}</span>{event.status === 'DRAFT' && <span className="badge badge-secondary">Borrador</span>}</div><h2>{event.title}</h2><p>{event.description}</p><dl><div><dt><Icon name="calendar" size={15}/>Fecha</dt><dd>{formatDateTime(event.startsAt)}</dd></div><div><dt><Icon name="pin" size={15}/>Ubicación</dt><dd>{event.location}</dd></div></dl>{isAdmin && <div className="communication-actions"><button type="button" className="button button-secondary" onClick={() => onEdit(event)}><Icon name="edit" size={16}/>Editar</button>{event.status === 'DRAFT' && <button type="button" className="button button-primary" onClick={() => onStatus(event, 'PUBLISHED')}>Publicar</button>}{event.status === 'PUBLISHED' && <button type="button" className="button button-danger" onClick={() => onStatus(event, 'CANCELLED')}>Cancelar evento</button>}</div>}</div>
  </article>
}

function Pagination({ page, limit, total, onPageChange }: { page: number; limit: number; total: number; onPageChange: (page: number) => void }) {
  const lastPage = Math.max(1, Math.ceil(total / limit))
  if (lastPage === 1) return null
  return <div className="table-pagination"><span>Página {page} de {lastPage}</span><div><button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>Siguiente</button></div></div>
}
