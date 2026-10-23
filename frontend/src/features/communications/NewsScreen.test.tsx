import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestsTo, renderWithSession, stubApi, testUser } from '../../test/test-utils'
import type { NewsPost } from '../../service/backend-api'
import { NewsScreen } from './NewsScreen'

const post = (overrides: Partial<NewsPost> = {}): NewsPost => ({
  id: 'news-1',
  title: 'Horario de feriado',
  content: 'La sede abrirá en horario reducido.',
  imageUrl: null,
  audience: 'MEMBERS',
  status: 'PUBLISHED',
  publishedAt: '2030-09-01T12:00:00.000Z',
  createdById: 'admin-id',
  ...overrides,
})

const page = (items: NewsPost[], total = items.length, limit = 12) => ({ items, page: 1, limit, total })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('NewsScreen', () => {
  it('muestra novedades publicadas al usuario y oculta controles administrativos', async () => {
    stubApi([{ path: '/news-posts', handler: () => ({ body: page([post()]) }) }])
    renderWithSession(<NewsScreen/>, { user: testUser('MEMBER') })

    expect(await screen.findByRole('heading', { name: 'Horario de feriado' })).toBeInTheDocument()
    expect(screen.getByText(post().content)).toBeInTheDocument()
    expect(screen.queryByText('Socios')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nueva novedad/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument()
  })

  it('muestra la tabla administrativa con estado, fecha y acciones soportadas', async () => {
    const draft = post({ id: 'news-2', title: 'Borrador de actividad', audience: 'ALL', status: 'DRAFT', publishedAt: null })
    stubApi([{ path: '/news-posts', handler: () => ({ body: page([post(), draft]) }) }])
    renderWithSession(<NewsScreen isAdmin/>, { user: testUser('ADMIN') })

    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Título', 'Audiencia', 'Publicada', 'Estado', 'Acciones'])
    const rows = within(table).getAllByRole('row')
    expect(within(rows[1]).getByText('Publicada')).toBeInTheDocument()
    expect(within(rows[1]).getByText('01/09/2030')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Borrador')).toBeInTheDocument()
    expect(within(rows[2]).getByText('—')).toBeInTheDocument()

    fireEvent.click(within(rows[1]).getByLabelText('Acciones de Horario de feriado'))
    expect(within(rows[1]).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(within(rows[1]).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument()
    expect(within(rows[1]).queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
  })

  it('muestra vacío y permite reintentar cuando falla la carga', async () => {
    let failed = false
    stubApi([{ path: '/news-posts', handler: () => {
      if (!failed) { failed = true; return { status: 503, body: { message: 'No se pudo cargar.' } } }
      return { body: page([]) }
    } }])
    renderWithSession(<NewsScreen isAdmin/>, { user: testUser('ADMIN') })

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No hay novedades para los filtros seleccionados.')).toBeInTheDocument()
  })

  it('filtra por estado, pagina resultados y vuelve a la primera página al cambiar el filtro', async () => {
    const fetchStub = stubApi([{ path: '/news-posts', handler: (url) => ({ body: {
      items: [post({ id: `news-${url.searchParams.get('page')}`, title: `Novedad ${url.searchParams.get('page')}` })],
      page: Number(url.searchParams.get('page') ?? '1'),
      limit: 12,
      total: 24,
    } }) }])
    renderWithSession(<NewsScreen isAdmin/>, { user: testUser('ADMIN') })
    expect(await screen.findByText('Novedad 1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Novedad 2')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'DRAFT' } })
    expect(await screen.findByText('Novedad 1')).toBeInTheDocument()
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/news-posts').at(-1)?.url.searchParams.toString()).toContain('status=DRAFT'))
    expect(requestsTo(fetchStub, 'GET', '/news-posts').at(-1)?.url.searchParams.get('page')).toBe('1')
  })

  it('crea un borrador, convierte la URL vacía de imagen en null y recarga la lista', async () => {
    let created: NewsPost | undefined
    const fetchStub = stubApi([
      { path: '/news-posts', handler: () => ({ body: page(created ? [created] : []) }) },
      { method: 'POST', path: '/news-posts', handler: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Partial<NewsPost>
        created = post({ ...body, id: 'created-news', status: 'DRAFT', publishedAt: null })
        return { status: 201, body: created }
      } },
    ])
    renderWithSession(<NewsScreen isAdmin/>, { user: testUser('ADMIN') })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nueva actividad' } })
    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'Información importante.' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Entrenadores' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    expect(await screen.findByRole('heading', { name: 'Nueva actividad' })).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'POST', '/news-posts')[0]?.body).toEqual({
      title: 'Nueva actividad', content: 'Información importante.', imageUrl: null, audience: 'TRAINERS', status: 'DRAFT',
    })
    expect(screen.queryByRole('heading', { name: 'Editar novedad' })).not.toBeInTheDocument()
  })

  it('mantiene el formulario y muestra el error si no se puede guardar', async () => {
    stubApi([
      { path: '/news-posts', handler: () => ({ body: page([]) }) },
      { method: 'POST', path: '/news-posts', handler: () => ({ status: 400, body: { message: 'El título ya existe.' } }) },
    ])
    renderWithSession(<NewsScreen isAdmin/>, { user: testUser('ADMIN') })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Duplicada' } })
    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'Contenido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El título ya existe.')
    expect(screen.getByLabelText('Título')).toHaveValue('Duplicada')
  })

  it('edita una publicación existente y cancela el formulario sin modificarla', async () => {
    let currentPost = post()
    const fetchStub = stubApi([
      { path: '/news-posts', handler: () => ({ body: page([currentPost]) }) },
      { method: 'PATCH', path: '/news-posts/news-1', handler: (_url, init) => {
        currentPost = post({ ...currentPost, ...(JSON.parse(String(init?.body)) as Partial<NewsPost>) })
        return { body: currentPost }
      } },
    ])
    renderWithSession(<NewsScreen isAdmin/>, { user: testUser('ADMIN') })
    const card = (await screen.findByRole('heading', { name: 'Horario de feriado' })).closest('[data-news-post]') as HTMLElement
    fireEvent.click(within(card).getByLabelText('Acciones de Horario de feriado'))
    fireEvent.click(within(card).getByRole('button', { name: 'Editar' }))
    expect(screen.getByRole('heading', { name: 'Editar novedad' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Horario actualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('heading', { name: 'Editar novedad' })).not.toBeInTheDocument()

    fireEvent.click(within(card).getByLabelText('Acciones de Horario de feriado'))
    fireEvent.click(within(card).getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Horario actualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('heading', { name: 'Horario actualizado' })).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'PATCH', '/news-posts/news-1')[0]?.body).toMatchObject({ title: 'Horario actualizado' })
  })

  it.each([
    ['DRAFT', 'Publicar', 'PUBLISHED', '¿Querés publicar esta novedad?'],
    ['PUBLISHED', 'Desactivar', 'INACTIVE', '¿Querés desactivar esta novedad?'],
  ] as const)('%s requiere confirmación para pasar a %s', async (currentStatus, action, nextStatus, confirmation) => {
    let current = post({ status: currentStatus })
    const fetchStub = stubApi([
      { path: '/news-posts', handler: () => ({ body: page([current]) }) },
      { method: 'PATCH', path: '/news-posts/news-1/status', handler: (_url, init) => {
        current = post({ ...current, ...(JSON.parse(String(init?.body)) as Partial<NewsPost>) })
        return { body: current }
      } },
    ])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithSession(<NewsScreen isAdmin/>, { user: testUser('ADMIN') })
    const card = (await screen.findByRole('heading', { name: 'Horario de feriado' })).closest('[data-news-post]') as HTMLElement
    fireEvent.click(within(card).getByLabelText('Acciones de Horario de feriado'))
    fireEvent.click(within(card).getByRole('button', { name: action }))

    expect(confirm).toHaveBeenCalledWith(confirmation)
    await waitFor(() => expect(requestsTo(fetchStub, 'PATCH', '/news-posts/news-1/status')[0]?.body).toEqual({ status: nextStatus }))
    expect(await within(card).findByText(nextStatus === 'PUBLISHED' ? 'Publicada' : 'Desactivada')).toBeInTheDocument()
  })

  it('no actualiza el estado cuando se cancela la confirmación y muestra errores del servidor', async () => {
    const fetchStub = stubApi([
      { path: '/news-posts', handler: () => ({ body: page([post({ status: 'DRAFT' })]) }) },
      { method: 'PATCH', path: '/news-posts/news-1/status', handler: () => ({ status: 503, body: { message: 'No se pudo publicar.' } }) },
    ])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderWithSession(<NewsScreen isAdmin/>, { user: testUser('ADMIN') })
    const card = (await screen.findByRole('heading', { name: 'Horario de feriado' })).closest('[data-news-post]') as HTMLElement

    fireEvent.click(within(card).getByLabelText('Acciones de Horario de feriado'))
    fireEvent.click(within(card).getByRole('button', { name: 'Publicar' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(requestsTo(fetchStub, 'PATCH', '/news-posts/news-1/status')).toHaveLength(0)

    confirm.mockReturnValue(true)
    fireEvent.click(within(card).getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo publicar.')
  })
})
