import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import type { Event } from '../../service/backend-api'
import { EventsScreen } from './EventsScreen'

const eventRecord = (overrides: Partial<Event> = {}): Event => ({
  id: 'event-1',
  title: 'Jornada de entrenamiento',
  description: 'Una jornada abierta para socios.',
  startsAt: '2030-09-06T15:00:00.000Z',
  location: 'Sede Centro',
  imageUrl: 'https://example.com/event.jpg',
  status: 'PUBLISHED',
  displayStatus: 'UPCOMING',
  createdById: 'admin-id',
  ...overrides,
})

const eventPage = (items: Event[], page = 1, total = items.length, limit = 12) => ({ items, page, limit, total })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('EventsScreen', () => {
  it('muestra la tabla administrativa con las columnas, estados y acciones válidas', async () => {
    const events = [
      eventRecord({ id: 'published', title: 'Evento publicado', status: 'PUBLISHED' }),
      eventRecord({ id: 'draft', title: 'Evento borrador', status: 'DRAFT', location: 'Sede Norte' }),
      eventRecord({ id: 'finished', title: 'Evento finalizado', status: 'PUBLISHED', displayStatus: 'FINISHED' }),
      eventRecord({ id: 'cancelled', title: 'Evento cancelado', status: 'CANCELLED', displayStatus: 'CANCELLED' }),
    ]
    stubApi([{ path: '/events', handler: () => ({ body: eventPage(events) }) }])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })

    expect(await screen.findByRole('columnheader', { name: 'Evento' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Fecha y horario' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Ubicación' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument()
    expect(screen.getByText('Publicado')).toBeInTheDocument()
    expect(screen.getByText('Borrador')).toBeInTheDocument()
    expect(screen.getByText('Finalizado')).toBeInTheDocument()
    expect(screen.getByText('Cancelado')).toBeInTheDocument()

    const publishedRow = screen.getByRole('row', { name: /Evento publicado/ })
    expect(within(publishedRow).getByRole('button', { name: 'Editar' })).toHaveClass('button-secondary', 'admin-events-action-edit')
    expect(within(publishedRow).getByRole('button', { name: 'Cancelar' })).toHaveClass('button-danger', 'admin-events-action-cancel')
    expect(within(publishedRow).queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
    const draftRow = screen.getByRole('row', { name: /Evento borrador/ })
    expect(within(draftRow).getByRole('button', { name: 'Editar' })).toHaveClass('button-secondary', 'admin-events-action-edit')
    expect(within(draftRow).getByRole('button', { name: 'Publicar' })).toHaveClass('button-primary', 'admin-events-action-publish')
    expect(within(screen.getByRole('row', { name: /Evento finalizado/ })).getByRole('button', { name: 'Ver' })).toHaveClass('button-secondary', 'admin-events-action-view')
    expect(within(screen.getByRole('row', { name: /Evento cancelado/ })).getByRole('button', { name: 'Ver' })).toHaveClass('button-secondary', 'admin-events-action-view')
    expect(screen.queryByLabelText('Acciones de Evento publicado')).not.toBeInTheDocument()
  })

  it('conserva búsqueda, filtros de estado y sede y reinicia la paginación', async () => {
    const fetchStub = stubApi([{ path: '/events', handler: (url) => {
      const page = Number(url.searchParams.get('page') ?? '1')
      const status = url.searchParams.get('status')
      const search = url.searchParams.get('search')
      if (url.searchParams.get('limit') === '100') return { body: eventPage([eventRecord({ title: 'Evento de sede centro', location: 'Sede Centro', status: 'DRAFT' })], 1, 1, 100) }
      return { body: eventPage([eventRecord({ id: `event-${page}`, title: `${status ?? search ?? 'Evento'} ${page}` })], page, 24) }
    } }])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })

    expect(await screen.findByText('Evento 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Evento 2')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'DRAFT' } })
    expect(await screen.findByText('DRAFT 1')).toBeInTheDocument()
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/events').at(-1)?.url.searchParams.get('status')).toBe('DRAFT'))
    expect(requestsTo(fetchStub, 'GET', '/events').at(-1)?.url.searchParams.get('page')).toBe('1')

    fireEvent.change(screen.getByLabelText('Buscar evento'), { target: { value: 'norte' } })
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/events').at(-1)?.url.searchParams.get('search')).toBe('norte'))
    fireEvent.change(screen.getByLabelText('Filtrar por sede'), { target: { value: 'Sede Centro' } })
    expect(await screen.findByText('Evento de sede centro')).toBeInTheDocument()
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/events').at(-1)?.url.searchParams.get('limit')).toBe('100'))
  })

  it('ordena las ubicaciones con las reglas alfabéticas del español argentino', async () => {
    const events = ['Ñuñez', 'Caballito', 'Álvarez', 'Olivos', 'Núñez', 'Almagro']
      .map((location, index) => eventRecord({ id: `location-${index}`, location }))
    stubApi([{ path: '/events', handler: () => ({ body: eventPage(events) }) }])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })

    const locationFilter = await screen.findByLabelText('Filtrar por sede') as HTMLSelectElement
    await waitFor(() => expect(Array.from(locationFilter.options, (option) => option.textContent)).toEqual([
      'Sede: todas', 'Almagro', 'Álvarez', 'Caballito', 'Núñez', 'Ñuñez', 'Olivos',
    ]))
  })

  it('crea un borrador usando el horario local del gimnasio y recarga la lista', async () => {
    let savedEvent: Event | null = null
    const fetchStub = stubApi([
      { path: '/events', handler: () => ({ body: eventPage(savedEvent ? [savedEvent] : []) }) },
      { method: 'POST', path: '/events', handler: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Partial<Event>
        savedEvent = eventRecord({ ...body, id: 'event-new', status: 'DRAFT' })
        return { status: 201, body: savedEvent }
      } },
    ])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo evento' }))[0])
    const dialog = screen.getByRole('dialog', { name: 'Nuevo evento' })
    fireEvent.change(within(dialog).getByLabelText('Título'), { target: { value: 'Encuentro de socios' } })
    fireEvent.change(within(dialog).getByLabelText('Fecha y horario'), { target: { value: '2030-10-01T18:30' } })
    fireEvent.change(within(dialog).getByLabelText('Ubicación'), { target: { value: 'Sede Norte' } })
    fireEvent.change(within(dialog).getByLabelText('Imagen (URL)'), { target: { value: 'https://example.com/new.jpg' } })
    fireEvent.change(within(dialog).getByLabelText('Descripción'), { target: { value: 'Actividad abierta.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar borrador' }))

    expect(await screen.findByText('Encuentro de socios')).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'POST', '/events')[0]?.body).toMatchObject({
      title: 'Encuentro de socios', startsAt: '2030-10-01T18:30:00-03:00', status: 'DRAFT',
    })
  })

  it('edita un evento y conserva el formulario si el backend devuelve un error', async () => {
    const currentEvent = eventRecord({ status: 'DRAFT' })
    stubApi([
      { path: '/events', handler: () => ({ body: eventPage([currentEvent]) }) },
      { method: 'PATCH', path: '/events/event-1', handler: () => ({ status: 503, body: { message: 'No se pudo guardar el evento.' } }) },
    ])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })
    const row = (await screen.findByText(currentEvent.title)).closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Editar' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar evento' })
    fireEvent.change(within(dialog).getByLabelText('Título'), { target: { value: 'Título actualizado' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar borrador' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se pudo guardar el evento.')
    expect(within(dialog).getByLabelText('Título')).toHaveValue('Título actualizado')
  })

  it.each([
    ['DRAFT', 'Publicar', 'PUBLISHED', 'Publicado'],
    ['PUBLISHED', 'Cancelar', 'CANCELLED', 'Cancelado'],
  ] as const)('confirma el cambio de estado %s → %s y conserva el registro', async (status, action, nextStatus, label) => {
    let currentEvent = eventRecord({ status, displayStatus: status === 'PUBLISHED' ? 'UPCOMING' : 'UPCOMING' })
    const fetchStub = stubApi([
      { path: '/events', handler: () => ({ body: eventPage([currentEvent]) }) },
      { method: 'PATCH', path: '/events/event-1/status', handler: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Partial<Event>
        currentEvent = eventRecord({ ...currentEvent, ...body, displayStatus: nextStatus === 'CANCELLED' ? 'CANCELLED' : 'UPCOMING' })
        return { body: currentEvent }
      } },
    ])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })
    const row = (await screen.findByText(currentEvent.title)).closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: action }))

    await waitFor(() => expect(requestsTo(fetchStub, 'PATCH', '/events/event-1/status')[0]?.body).toEqual({ status: nextStatus }))
    expect(await screen.findByText(label)).toBeInTheDocument()
    expect(screen.getByText(currentEvent.title)).toBeInTheDocument()
  })

  it('consulta el detalle desde la acción de finalizado', async () => {
    const event = eventRecord({ status: 'PUBLISHED', displayStatus: 'FINISHED' })
    stubApi([
      { path: '/events', handler: () => ({ body: eventPage([event]) }) },
      { path: '/events/event-1', handler: () => ({ body: event }) },
    ])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })
    const row = (await screen.findByText(event.title)).closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Ver' }))
    expect(await screen.findByRole('dialog', { name: event.title })).toHaveTextContent(event.description)
  })

  it('reintenta una carga fallida y muestra el estado vacío', async () => {
    let failed = false
    stubApi([{ path: '/events', handler: () => {
      if (!failed) { failed = true; return { status: 503, body: { message: 'No se pudieron cargar los eventos.' } } }
      return { body: eventPage([]) }
    } }])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los eventos.')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No hay eventos para los filtros seleccionados.')).toBeInTheDocument()
  })

  it('en celular muestra tarjetas, búsqueda y filtros compactos sin tabla', async () => {
    setMobileViewport(true)
    const events = [eventRecord(), eventRecord({ id: 'event-2', title: 'Otra actividad', status: 'DRAFT' })]
    stubApi([{ path: '/events', handler: () => ({ body: eventPage(events) }) }])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })

    expect(await screen.findAllByRole('article')).toHaveLength(2)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Nuevo evento' }).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/Acciones de/)).toHaveLength(2)
    const filterButton = screen.getByRole('button', { name: 'Filtrar eventos' })
    expect(screen.queryByLabelText('Filtrar por sede')).not.toBeInTheDocument()
    fireEvent.click(filterButton)
    expect(screen.getByLabelText('Filtrar por sede')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar evento'), { target: { value: 'Otra' } })
  })

  it('no expone acciones administrativas ni filtros al socio', async () => {
    stubApi([{ path: '/events', handler: () => ({ body: eventPage([eventRecord()]) }) }])
    renderWithSession(<EventsScreen/>, { user: testUser('MEMBER') })

    expect(await screen.findByRole('heading', { name: 'Jornada de entrenamiento' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo evento' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Filtrar por estado')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Acciones de/ })).not.toBeInTheDocument()
  })
})
