import { useCallback, useMemo, useState } from 'react'
import { backendApi, type Event, type EventDisplayStatus } from '../../service/backend-api'
import { formatDateTime } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import { SafeImage } from '../workspace/SafeImage'
import './communications-viewer.css'

const EVENT_FILTERS: Array<{ value: EventDisplayStatus; label: string }> = [
  { value: 'UPCOMING', label: 'Próximos' },
  { value: 'FINISHED', label: 'Finalizados' },
  { value: 'CANCELLED', label: 'Cancelados' },
]

function eventStatusLabel(status: EventDisplayStatus) {
  if (status === 'FINISHED') return 'Finalizado'
  if (status === 'CANCELLED') return 'Cancelado'
  return 'Próximo'
}

function formatEventDate(value: string) {
  return formatDateTime(value)
}

function EventViewerCard({ event }: { event: Event }) {
  return <article className="viewer-event-card">
    <SafeImage src={event.imageUrl} alt="" className="viewer-event-media" fallbackIcon="trophy" />
    <div className="viewer-event-body">
      <span className={`viewer-event-status viewer-event-status-${event.displayStatus.toLowerCase()}`}>{eventStatusLabel(event.displayStatus)}</span>
      <h2>{event.title}</h2>
      <p className="viewer-event-meta"><Icon name="calendar" size={16} />{formatEventDate(event.startsAt)}</p>
      <p className="viewer-event-meta"><Icon name="pin" size={16} />{event.location}</p>
    </div>
  </article>
}

export function EventsViewer() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<EventDisplayStatus>('UPCOMING')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const loader = useCallback(() => backendApi.listEvents({ search: search.trim() || undefined, page: 1, limit: 50 }), [search])
  const { data, loading, error, reload } = useApiResource(loader)
  const visibleEvents = useMemo(() => (data?.items ?? []).filter((event) => event.status !== 'DRAFT' && event.displayStatus === filter), [data?.items, filter])

  return <div className="app-page communication-viewer-page viewer-events-screen">
    <PageHeader title="Eventos" description="Torneos, clases abiertas y charlas. Algunos son abiertos al público." />
    <div className="viewer-filter-bar">
      <label className="search-shell viewer-search"><Icon name="search" size={18} /><input aria-label="Buscar evento" placeholder="Buscar evento" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <button type="button" className={`viewer-filter-toggle${filtersOpen ? ' is-active' : ''}`} aria-expanded={filtersOpen} aria-controls="event-viewer-filters" aria-label="Mostrar filtros" onClick={() => setFiltersOpen((value) => !value)}><Icon name="filter" size={19} /></button>
      <div id="event-viewer-filters" className={`viewer-filter-options${filtersOpen ? ' is-open' : ''}`} aria-label="Filtrar eventos">
        {EVENT_FILTERS.map((option) => <button key={option.value} type="button" className={`viewer-filter-pill${filter === option.value ? ' is-selected' : ''}`} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>)}
      </div>
    </div>
    {loading ? <LoadingState message="Cargando eventos…" /> : error ? <ErrorState message={error} retry={() => void reload()} /> : !visibleEvents.length ? <EmptyState message="No hay eventos disponibles para este filtro." /> : <section className="viewer-events-grid" aria-label="Eventos disponibles">{visibleEvents.map((event) => <EventViewerCard key={event.id} event={event} />)}</section>}
  </div>
}
