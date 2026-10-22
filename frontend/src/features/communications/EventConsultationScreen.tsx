import { useCallback, useId, useRef, useState } from 'react'
import { backendApi, type Event, type EventDisplayStatus } from '../../service/backend-api'
import { formatDateTime } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import { SafeImage } from '../workspace/SafeImage'
import './event-consultation.css'

const STATUS_OPTIONS: { value: EventDisplayStatus; label: string; badge: string }[] = [
  { value: 'UPCOMING', label: 'Próximos', badge: 'Próximo' },
  { value: 'FINISHED', label: 'Finalizados', badge: 'Finalizado' },
  { value: 'CANCELLED', label: 'Cancelados', badge: 'Cancelado' },
]
const PAGE_SIZE = 12

// The API exposes displayStatus but only applies its status query to administrators.
// Read every result page before filtering so past/cancelled events are never lost.
async function loadEvents(search: string) {
  const query = search.trim() ? { search: search.trim() } : {}
  const firstPage = await backendApi.listEvents({ ...query, page: 1, limit: 100 })
  const items = [...firstPage.items]
  const lastPage = Math.ceil(firstPage.total / firstPage.limit)
  for (let page = 2; page <= lastPage; page += 1) {
    const nextPage = await backendApi.listEvents({ ...query, page, limit: 100 })
    items.push(...nextPage.items)
  }
  return items
}

export function EventConsultationScreen() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EventDisplayStatus>('UPCOMING')
  const [page, setPage] = useState(1)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterId = useId()
  const filterButton = useRef<HTMLButtonElement>(null)
  const loader = useCallback(() => loadEvents(search), [search])
  const { data, loading: isLoading, error, reload } = useApiResource(loader)
  const events = data?.filter((event) => event.displayStatus === status) ?? []
  const lastPage = Math.max(1, Math.ceil(events.length / PAGE_SIZE))
  const currentPage = Math.min(page, lastPage)

  function selectStatus(nextStatus: EventDisplayStatus) {
    setStatus(nextStatus)
    setPage(1)
    setIsFilterOpen(false)
    filterButton.current?.focus()
  }

  return <div className="app-page event-consultation-page">
    <PageHeader title="Eventos" description="Actividades especiales de M-TEAM, ordenadas por fecha."/>
    <div className="event-status-tabs" role="group" aria-label="Estado de los eventos">
      {STATUS_OPTIONS.map((option) => <button key={option.value} type="button" aria-pressed={status === option.value} onClick={() => selectStatus(option.value)}>{option.label}</button>)}
    </div>
    <div className="event-search-toolbar">
      <label className="event-search"><Icon name="search" size={18}/><span className="visually-hidden">Buscar evento</span><input type="search" maxLength={100} placeholder="Buscar evento" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }}/></label>
      <button ref={filterButton} type="button" className="event-filter-button" aria-label={`Filtrar eventos: ${STATUS_OPTIONS.find((option) => option.value === status)?.label}`} aria-expanded={isFilterOpen} aria-controls={filterId} onClick={() => setIsFilterOpen(!isFilterOpen)}><Icon name="filter" size={20}/></button>
      {isFilterOpen && <fieldset id={filterId} className="event-filter-panel" onKeyDown={(event) => { if (event.key === 'Escape') { setIsFilterOpen(false); filterButton.current?.focus() } }}>
        <legend>Estado de los eventos</legend>
        {STATUS_OPTIONS.map((option) => <label key={option.value}><input autoFocus={status === option.value} type="radio" name={filterId} value={option.value} checked={status === option.value} onChange={() => selectStatus(option.value)}/>{option.label}</label>)}
      </fieldset>}
    </div>
    {isLoading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !events.length ? <EmptyState message="No hay eventos para los filtros seleccionados."/> : <>
      <div className="event-consultation-grid">{events.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((event) => <ConsultationEventCard key={event.id} event={event}/>)}</div>
      {lastPage > 1 && <nav className="table-pagination" aria-label="Páginas de eventos"><span>Página {currentPage} de {lastPage}</span><div><button type="button" className="button button-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Siguiente</button></div></nav>}
    </>}
  </div>
}

function ConsultationEventCard({ event }: { event: Event }) {
  return <article className="event-consultation-card">
    <SafeImage className="event-consultation-image" src={event.imageUrl} alt={`Imagen del evento ${event.title}`} fallbackIcon="trophy"/>
    <div className="event-consultation-body">
      <span className={`event-status-badge event-status-${event.displayStatus.toLowerCase()}`}>{STATUS_OPTIONS.find((option) => option.value === event.displayStatus)?.badge}</span>
      <h2>{event.title}</h2>
      <p><Icon name="calendar" size={15}/><time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time></p>
      <p><Icon name="pin" size={15}/><span>{event.location}</span></p>
    </div>
  </article>
}
