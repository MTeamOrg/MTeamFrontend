import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { backendApi, type Event, type EventStatus } from '../../service/backend-api'
import { formatDateTime, localDateTimeToGymOffset } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { useEnterSearch } from '../../hooks/use-enter-search'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import { ActionButton } from '../../components/ActionButton'
import './admin-events.css'

const PAGE_SIZE = 12
const EMPTY_FORM = { title: '', description: '', startsAt: '', location: '', imageUrl: '' }
const STATUS_LABELS: Record<EventStatus, string> = { DRAFT: 'Borrador', PUBLISHED: 'Publicado', CANCELLED: 'Cancelado' }
const STATUS_FILTER_LABELS: Record<EventStatus, string> = { DRAFT: 'Borradores', PUBLISHED: 'Publicados', CANCELLED: 'Cancelados' }

type EventFormValue = typeof EMPTY_FORM

function inputDateTime(value: string) {
  return value ? new Date(value).toISOString().slice(0, 16) : ''
}

function eventStatusLabel(event: Event) {
  if (event.status === 'DRAFT') return STATUS_LABELS.DRAFT
  if (event.status === 'CANCELLED') return STATUS_LABELS.CANCELLED
  return event.displayStatus === 'FINISHED' ? 'Finalizado' : STATUS_LABELS.PUBLISHED
}

function eventStatusClass(event: Event) {
  if (event.status === 'DRAFT') return 'admin-event-status--draft'
  if (event.status === 'CANCELLED') return 'admin-event-status--cancelled'
  return event.displayStatus === 'FINISHED' ? 'admin-event-status--finished' : 'admin-event-status--published'
}

function eventSummary(event: Event) {
  return `${formatDateTime(event.startsAt).replace(' ', ' · ')} · ${event.location}`
}

async function listAllMatchingEvents(filters: { search?: string; status?: EventStatus }) {
  const items: Event[] = []
  let page = 1
  let total: number
  do {
    const response = await backendApi.listEvents({ ...filters, page, limit: 100 })
    items.push(...response.items)
    total = response.total
    page += 1
  } while (items.length < total)
  return items
}

export function AdminEventsScreen() {
  const isMobile = useIsMobile()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<EventStatus | ''>('')
  const [location, setLocation] = useState('')
  const [editing, setEditing] = useState<Event | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [form, setForm] = useState<EventFormValue>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<{ id: string; status: 'PUBLISHED' | 'CANCELLED' } | null>(null)
  const [details, setDetails] = useState<Event | null>(null)
  const [detailsError, setDetailsError] = useState('')
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const filterId = useId()
  const filterButton = useRef<HTMLButtonElement>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const enterSearch = useEnterSearch()
  const { inputValue: search, setInputValue: setSearch, submittedValue: submittedSearch, requestKey: searchRequestKey, isSearchPending, submitSearch, syncLoading } = enterSearch
  useEffect(() => {
    if (!isFilterOpen) return
    function closeFilters(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsFilterOpen(false)
      filterButton.current?.focus()
    }
    document.addEventListener('keydown', closeFilters)
    return () => document.removeEventListener('keydown', closeFilters)
  }, [isFilterOpen])
  const loader = useCallback(async () => {
    void searchRequestKey
    const filters = { ...(submittedSearch.trim() ? { search: submittedSearch.trim() } : {}), ...(status ? { status } : {}) }
    if (!location) return backendApi.listEvents({ ...filters, page, limit: PAGE_SIZE })
    const allEvents = await listAllMatchingEvents(filters)
    const filteredItems = allEvents.filter((event) => event.location === location)
    return { items: filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, limit: PAGE_SIZE, total: filteredItems.length }
  }, [location, page, searchRequestKey, status, submittedSearch])
  const { data, loading: isLoading, error, reload } = useApiResource(loader)
  const isSearchLoading = isSearchPending || (isLoading && data !== null)
  useEffect(() => syncLoading(isLoading), [isLoading, syncLoading])

  const knownLocations = Array.from(new Set((data?.items ?? []).map((event) => event.location)))
    .sort((left, right) => left.localeCompare(right, 'es-AR', { sensitivity: 'base' }))

  function startCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setActionError('')
    setNotice('')
    setIsFilterOpen(false)
    setIsFormOpen(true)
  }

  function startEdit(event: Event) {
    setEditing(event)
    setForm({ title: event.title, description: event.description, startsAt: inputDateTime(event.startsAt), location: event.location, imageUrl: event.imageUrl })
    setFormError('')
    setActionError('')
    setNotice('')
    setIsFilterOpen(false)
    setIsFormOpen(true)
  }

  function cancelForm() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setIsFormOpen(false)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || updatingStatus) return
    setIsSaving(true)
    setFormError('')
    setNotice('')
    try {
      const body = { ...form, startsAt: localDateTimeToGymOffset(form.startsAt) }
      if (editing) await backendApi.updateEvent(editing.id, body)
      else await backendApi.createEvent({ ...body, status: 'DRAFT' })
      cancelForm()
      setNotice(editing ? 'Cambios guardados correctamente.' : 'Evento guardado como borrador.')
      await reload()
    } catch (value) {
      setFormError(value instanceof Error ? value.message : 'No se pudo guardar el evento.')
    } finally {
      setIsSaving(false)
    }
  }

  async function changeStatus(event: Event, nextStatus: 'PUBLISHED' | 'CANCELLED') {
    const question = nextStatus === 'CANCELLED'
      ? '¿Querés cancelar este evento? Se avisará a socios y entrenadores.'
      : '¿Querés publicar este evento?'
    if (!window.confirm(question)) return
    setUpdatingStatus({ id: event.id, status: nextStatus })
    setActionError('')
    setNotice('')
    try {
      await backendApi.updateEventStatus(event.id, nextStatus)
      setNotice(nextStatus === 'CANCELLED' ? 'Evento cancelado correctamente.' : 'Evento publicado correctamente.')
      await reload()
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'No se pudo actualizar el estado del evento.')
    } finally {
      setUpdatingStatus(null)
    }
  }

  async function openDetails(event: Event) {
    setDetails(event)
    setDetailsError('')
    setIsLoadingDetails(true)
    try {
      setDetails(await backendApi.getEvent(event.id))
    } catch (value) {
      setDetailsError(value instanceof Error ? value.message : 'No se pudo cargar el detalle del evento.')
    } finally {
      setIsLoadingDetails(false)
    }
  }

  function updateFilter(next: () => void) {
    next()
    setPage(1)
  }

  function submitTextSearch() {
    if (submitSearch()) setPage(1)
  }

  const filterFields = <div id={filterId} className="admin-events-filters">
    <label><span className="visually-hidden">Filtrar por estado</span><select aria-label="Filtrar por estado" value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value as EventStatus | ''))}><option value="">Estado: todos</option>{Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label><span className="visually-hidden">Filtrar por sede</span><select aria-label="Filtrar por sede" value={location} onChange={(event) => updateFilter(() => setLocation(event.target.value))}><option value="">Sede: todas</option>{knownLocations.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
  </div>

  const content = isLoading && !data ? <LoadingState message="Cargando eventos…"/> : !data ? <ErrorState message={error || 'No se pudieron cargar los eventos.'} retry={() => void reload()}/> : !data.items.length ? <EmptyState message="No hay eventos para los filtros seleccionados."/> : <>
    {isMobile ? <div className="admin-events-cards">{data.items.map((event) => <MobileEventCard key={event.id} event={event} disabled={Boolean(updatingStatus) || isSaving} statusAction={updatingStatus} onEdit={startEdit} onDetails={openDetails} onStatus={changeStatus}/>)}</div> : <EventTable events={data.items} disabled={Boolean(updatingStatus) || isSaving} statusAction={updatingStatus} onEdit={startEdit} onDetails={openDetails} onStatus={changeStatus}/>}
    <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={setPage}/>
  </>

  return <div className="app-page admin-events-page">
    <PageHeader title="Eventos" description="Guardá como borrador, publicá o cancelá. Un evento cancelado se conserva y genera una notificación."/>
    {isMobile && <button type="button" className="button button-primary admin-events-mobile-create" onClick={startCreate}><Icon name="plus" size={20}/>Nuevo evento</button>}
    {actionError && <p role="alert" className="error-message">{actionError}</p>}
    {notice && <p role="status" className="success-message">{notice}</p>}
    <section className="admin-events-list" aria-label="Eventos">
      <div className="admin-events-toolbar">
        <label className="admin-events-search"><Icon name="search" size={19}/><span className="visually-hidden">Buscar evento</span><input aria-label="Buscar evento" type="search" maxLength={100} placeholder="Buscar evento" value={search} aria-busy={isSearchLoading} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitTextSearch() } }}/></label>
        <button ref={filterButton} type="button" className="admin-events-filter-button" aria-label="Filtrar eventos" aria-expanded={isFilterOpen} aria-controls={filterId} onClick={() => setIsFilterOpen(!isFilterOpen)}><Icon name="filter" size={19}/></button>
        {(!isMobile || isFilterOpen) && filterFields}
        {!isMobile && <button type="button" className="button button-primary admin-events-desktop-create" onClick={startCreate}><Icon name="plus" size={19}/>Nuevo evento</button>}
      </div>
      {error && data && <p className="error-message" role="alert">{error} <button type="button" className="text-link" onClick={() => void reload()}>Reintentar</button></p>}
      {content}
    </section>
    {isFormOpen && <EventFormDialog editing={editing} form={form} error={formError} saving={isSaving} onChange={setForm} onCancel={cancelForm} onSubmit={save} titleInput={titleInput}/>} 
    {details && <EventDetailsDialog event={details} error={detailsError} loading={isLoadingDetails} onRetry={() => void openDetails(details)} onClose={() => setDetails(null)}/>} 
  </div>
}

function EventTable({ events, disabled, statusAction, onEdit, onDetails, onStatus }: { events: Event[]; disabled: boolean; statusAction: { id: string; status: 'PUBLISHED' | 'CANCELLED' } | null; onEdit: (event: Event) => void; onDetails: (event: Event) => void; onStatus: (event: Event, status: 'PUBLISHED' | 'CANCELLED') => void }) {
  return <div className="admin-events-table-wrap"><table className="admin-events-table"><thead><tr><th scope="col">Evento</th><th scope="col">Fecha y horario</th><th scope="col">Ubicación</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>{events.map((event) => <tr data-event-row key={event.id}><td><strong>{event.title}</strong></td><td><time dateTime={event.startsAt}>{formatDateTime(event.startsAt).replace(' ', ' · ')}</time></td><td>{event.location}</td><td><StatusBadge event={event}/></td><td><EventActions event={event} isMobile={false} disabled={disabled} statusAction={statusAction} onEdit={onEdit} onDetails={onDetails} onStatus={onStatus}/></td></tr>)}</tbody></table></div>
}

function MobileEventCard({ event, disabled, statusAction, onEdit, onDetails, onStatus }: { event: Event; disabled: boolean; statusAction: { id: string; status: 'PUBLISHED' | 'CANCELLED' } | null; onEdit: (event: Event) => void; onDetails: (event: Event) => void; onStatus: (event: Event, status: 'PUBLISHED' | 'CANCELLED') => void }) {
  return <article className="admin-event-card" data-event-card><div className="admin-event-card-content"><h2>{event.title}</h2><p>{eventSummary(event)}</p></div><StatusBadge event={event}/><EventActions event={event} isMobile disabled={disabled} statusAction={statusAction} onEdit={onEdit} onDetails={onDetails} onStatus={onStatus}/></article>
}

function StatusBadge({ event }: { event: Event }) {
  return <span className={`admin-event-status ${eventStatusClass(event)}`}>{eventStatusLabel(event)}</span>
}

function EventActions({ event, isMobile, disabled, statusAction, onEdit, onDetails, onStatus }: { event: Event; isMobile: boolean; disabled: boolean; statusAction: { id: string; status: 'PUBLISHED' | 'CANCELLED' } | null; onEdit: (event: Event) => void; onDetails: (event: Event) => void; onStatus: (event: Event, status: 'PUBLISHED' | 'CANCELLED') => void }) {
  const isFinished = event.status === 'PUBLISHED' && event.displayStatus === 'FINISHED'
  const isReadOnly = event.status === 'CANCELLED' || isFinished
  if (!isMobile) {
    return <div className="admin-events-action-buttons">
      {isReadOnly ? <button type="button" className="button button-secondary admin-events-action-view" disabled={disabled} onClick={() => onDetails(event)}>Ver</button> : <>
        <button type="button" className="button button-secondary admin-events-action-edit" disabled={disabled} onClick={() => onEdit(event)}>Editar</button>
        {event.status === 'DRAFT' && <ActionButton type="button" className="button button-primary admin-events-action-publish" isLoading={statusAction?.id === event.id && statusAction.status === 'PUBLISHED'} loadingLabel="Publicando…" disabled={disabled} onClick={() => void onStatus(event, 'PUBLISHED')}>Publicar</ActionButton>}
        {event.status === 'PUBLISHED' && <ActionButton type="button" className="button button-danger admin-events-action-cancel" isLoading={statusAction?.id === event.id && statusAction.status === 'CANCELLED'} loadingLabel="Cancelando…" disabled={disabled} onClick={() => void onStatus(event, 'CANCELLED')}>Cancelar</ActionButton>}
      </>}
    </div>
  }

  return <details className="admin-events-actions"><summary aria-label={`Acciones de ${event.title}`}><Icon name="more" size={20}/></summary><div>
    {isReadOnly ? <button type="button" disabled={disabled} onClick={(currentEvent) => { currentEvent.currentTarget.closest('details')?.removeAttribute('open'); onDetails(event) }}>Ver detalles</button> : <>
      <button type="button" disabled={disabled} onClick={(currentEvent) => { currentEvent.currentTarget.closest('details')?.removeAttribute('open'); onEdit(event) }}>Editar</button>
      {event.status === 'DRAFT' && <ActionButton type="button" isLoading={statusAction?.id === event.id && statusAction.status === 'PUBLISHED'} loadingLabel="Publicando…" disabled={disabled} onClick={() => void onStatus(event, 'PUBLISHED')}>Publicar</ActionButton>}
      {event.status === 'PUBLISHED' && <ActionButton type="button" isLoading={statusAction?.id === event.id && statusAction.status === 'CANCELLED'} loadingLabel="Cancelando…" disabled={disabled} onClick={() => void onStatus(event, 'CANCELLED')}>Cancelar</ActionButton>}
    </>}
  </div></details>
}

function Pagination({ page, limit, total, onPageChange }: { page: number; limit: number; total: number; onPageChange: (page: number) => void }) {
  const lastPage = Math.max(1, Math.ceil(total / limit))
  if (lastPage === 1) return null
  return <nav className="table-pagination" aria-label="Páginas de eventos"><span>Página {page} de {lastPage}</span><div><button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>Siguiente</button></div></nav>
}

function EventFormDialog({ editing, form, error, saving, onChange, onCancel, onSubmit, titleInput }: { editing: Event | null; form: EventFormValue; error: string; saving: boolean; onChange: (value: EventFormValue) => void; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; titleInput: RefObject<HTMLInputElement | null> }) {
  return <div className="admin-events-dialog-backdrop" role="presentation"><section className="admin-events-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-event-form-title"><button type="button" className="admin-events-dialog-close" aria-label="Cerrar formulario" onClick={onCancel}><Icon name="close" size={21}/></button><form className="admin-events-form" onSubmit={onSubmit}><h2 id="admin-event-form-title">{editing ? 'Editar evento' : 'Nuevo evento'}</h2><label>Título<input ref={titleInput} required maxLength={200} placeholder="Título del evento" value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })}/></label><label>Fecha y horario<input required type="datetime-local" value={form.startsAt} onChange={(event) => onChange({ ...form, startsAt: event.target.value })}/></label><label>Ubicación<input required maxLength={255} placeholder="Sede o ubicación" value={form.location} onChange={(event) => onChange({ ...form, location: event.target.value })}/></label><label>Imagen (URL)<input required type="url" value={form.imageUrl} onChange={(event) => onChange({ ...form, imageUrl: event.target.value })}/></label><label>Descripción<textarea required placeholder="Escribí la descripción del evento" value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })}/></label>{error && <p className="error-message" role="alert">{error}</p>}<div className="admin-events-form-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button><ActionButton type="submit" className="button button-primary" isLoading={saving} loadingLabel="Guardando…">Guardar borrador</ActionButton></div></form></section></div>
}

function EventDetailsDialog({ event, error, loading, onRetry, onClose }: { event: Event; error: string; loading: boolean; onRetry: () => void; onClose: () => void }) {
  return <div className="admin-events-dialog-backdrop" role="presentation"><section className="admin-events-dialog admin-events-details-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-event-details-title"><button type="button" className="admin-events-dialog-close" aria-label="Cerrar detalle" onClick={onClose}><Icon name="close" size={21}/></button><div className="admin-events-details"><span className="admin-events-details-eyebrow">Detalle del evento</span><h2 id="admin-event-details-title">{event.title}</h2>{loading ? <LoadingState message="Cargando detalle…"/> : error ? <ErrorState message={error} retry={onRetry}/> : <><StatusBadge event={event}/><p>{event.description}</p><dl><div><dt>Fecha y horario</dt><dd><time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time></dd></div><div><dt>Ubicación</dt><dd>{event.location}</dd></div></dl></>}</div></section></div>
}
