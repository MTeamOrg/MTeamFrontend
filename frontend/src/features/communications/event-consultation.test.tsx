import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { backendApi, type Event } from '../../service/backend-api'
import { EventsScreen } from './EventsScreen'

const EVENTS: Event[] = [
  { id: 'upcoming', title: 'Encuentro de movilidad', description: 'Actividad abierta.', startsAt: '2030-10-01T15:00:00Z', location: 'Salón principal', imageUrl: '', status: 'PUBLISHED', displayStatus: 'UPCOMING', createdById: 'admin' },
  { id: 'finished', title: 'Encuentro anterior', description: 'Actividad anterior.', startsAt: '2020-10-01T15:00:00Z', location: 'Salón principal', imageUrl: 'https://example.com/event.jpg', status: 'PUBLISHED', displayStatus: 'FINISHED', createdById: 'admin' },
  { id: 'cancelled', title: 'Encuentro cancelado', description: 'Actividad cancelada.', startsAt: '2030-10-02T15:00:00Z', location: 'Patio', imageUrl: '', status: 'CANCELLED', displayStatus: 'CANCELLED', createdById: 'admin' },
]

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe.each(['MEMBER', 'TRAINER'] as const)('event consultation for %s', (role) => {
  function renderEvents() {
    renderWithSession(<EventsScreen/>, { user: testUser(role) })
  }

  it('filters display states, keeps real metadata and offers no administrative actions', async () => {
    stubApi([{ path: '/events', handler: () => ({ body: { items: EVENTS, page: 1, limit: 100, total: 3 } }) }])
    renderEvents()
    expect(await screen.findByRole('heading', { name: EVENTS[0].title })).toBeInTheDocument()
    expect(screen.getByText('01/10/2030 12:00')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: `Imagen del evento ${EVENTS[0].title}` })).toHaveClass('media-fallback')
    expect(screen.queryByRole('button', { name: /Nuevo evento|Publicar|Editar|Cancelar evento/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Finalizados' }))
    expect(screen.getByRole('heading', { name: EVENTS[1].title })).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', EVENTS[1].imageUrl)
    expect(screen.getByRole('button', { name: 'Finalizados' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('heading', { name: EVENTS[0].title })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelados' }))
    expect(screen.getByRole('heading', { name: EVENTS[2].title })).toBeInTheDocument()
  })

  it('uses API search and shows a successful empty result', async () => {
    const fetchStub = stubApi([{ path: '/events', handler: (url) => ({ body: { items: url.searchParams.has('search') ? [] : EVENTS, page: 1, limit: 100, total: url.searchParams.has('search') ? 0 : 3 } }) }])
    renderEvents()
    await screen.findByRole('heading', { name: EVENTS[0].title })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar evento' }), { target: { value: '  sin coincidencias  ' } })
    expect(await screen.findByText('No hay eventos para los filtros seleccionados.')).toBeInTheDocument()
    const { url } = requestsTo(fetchStub, 'GET', '/events').at(-1)!
    expect(url.searchParams.get('search')).toBe('sin coincidencias')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('loads every API page before filtering', async () => {
    const fetchStub = stubApi([{ path: '/events', handler: (url) => ({ body: { items: url.searchParams.get('page') === '1' ? Array.from({ length: 100 }, (_, index) => ({ ...EVENTS[0], id: String(index) })) : [EVENTS[2]], page: Number(url.searchParams.get('page')), limit: 100, total: 101 } }) }])
    renderEvents()
    await screen.findByText('Página 1 de 9')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelados' }))
    expect(screen.getByRole('heading', { name: EVENTS[2].title })).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'GET', '/events')).toHaveLength(2)
    expect(screen.queryByText('Página 1 de 9')).not.toBeInTheDocument()
  })

  it('reports a later-page failure as an error, supports retry and never shows a partial list', async () => {
    let hasFailed = true
    stubApi([{ path: '/events', handler: (url) => url.searchParams.get('page') === '2' && hasFailed ? { status: 500, body: { message: 'Consulta fallida' } } : { body: { items: url.searchParams.get('page') === '1' ? [EVENTS[0]] : [], page: Number(url.searchParams.get('page')), limit: 100, total: 101 } } }])
    renderEvents()
    expect(await screen.findByRole('alert')).toHaveTextContent('Consulta fallida')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByText('No hay eventos para los filtros seleccionados.')).not.toBeInTheDocument()
    hasFailed = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: EVENTS[0].title })).toBeInTheDocument()
  })

  it('keeps the loading state while the query is pending', async () => {
    let resolveEvents!: (value: { items: Event[]; page: number; limit: number; total: number }) => void
    vi.spyOn(backendApi, 'listEvents').mockImplementation(() => new Promise((resolve) => { resolveEvents = resolve }))
    renderEvents()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando eventos…')
    await waitFor(() => expect(backendApi.listEvents).toHaveBeenCalled())
    resolveEvents({ items: [], page: 1, limit: 100, total: 0 })
    expect(await screen.findByText('No hay eventos para los filtros seleccionados.')).toBeInTheDocument()
  })

  it('offers an accessible mobile filter panel with Escape and focus restoration', async () => {
    stubApi([{ path: '/events', handler: () => ({ body: { items: EVENTS, page: 1, limit: 100, total: 3 } }) }])
    renderEvents()
    await screen.findByRole('heading', { name: EVENTS[0].title })
    const button = screen.getByRole('button', { name: 'Filtrar eventos: Próximos' })
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('radio', { name: 'Próximos' })).not.toHaveFocus()
    fireEvent.click(screen.getByRole('radio', { name: 'Cancelados' }))
    expect(screen.getByRole('heading', { name: EVENTS[2].title })).toBeInTheDocument()
    expect(button).toHaveFocus()
    fireEvent.click(button)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Cancelados' }), { key: 'Escape' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})
