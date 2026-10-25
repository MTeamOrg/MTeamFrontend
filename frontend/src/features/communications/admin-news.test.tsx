import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { NewsScreen } from './NewsScreen'
import type { NewsPost } from '../../service/backend-api'

const POST: NewsPost = { id: 'news-1', title: 'Comunicado del equipo', content: 'Información para la comunidad.', imageUrl: 'https://example.com/existing.jpg', audience: 'ALL', status: 'DRAFT', publishedAt: null, createdById: 'admin' }
const DIALOG_SHOW_MODAL = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const DIALOG_CLOSE = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals()
  for (const [name, descriptor] of [['showModal', DIALOG_SHOW_MODAL], ['close', DIALOG_CLOSE]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
})

function renderNews() { renderWithSession(<NewsScreen isAdmin/>, { user: testUser('ADMIN') }) }
function publishButton() { return within(screen.getByLabelText('Título').closest('form')!).getByRole('button', { name: 'Publicar' }) }

it.each([POST.imageUrl, null])('removes image management and preserves the stored image when editing: %s', async (imageUrl) => {
  const currentPost = { ...POST, imageUrl }
  const fetchStub = stubApi([
    { path: '/news-posts', handler: () => ({ body: { items: [currentPost], page: 1, limit: 12, total: 1 } }) },
    { method: 'PATCH', path: '/news-posts/news-1', handler: () => ({ body: currentPost }) },
  ])
  renderNews()
  fireEvent.click(await screen.findByRole('button', { name: POST.title }))
  expect(screen.queryByLabelText(/Imagen/)).not.toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
  fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'Contenido actualizado' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  await waitFor(() => expect(requestsTo(fetchStub, 'PATCH', '/news-posts/news-1')).toHaveLength(1))
  expect(requestsTo(fetchStub, 'PATCH', '/news-posts/news-1')[0].body).toEqual({ title: POST.title, content: 'Contenido actualizado', audience: 'ALL', ...(imageUrl ? {} : { imageUrl: null }) })
})

it('creates a published post with imageUrl null only after confirmation', async () => {
  const fetchStub = stubApi([
    { path: '/news-posts', handler: () => ({ body: { items: [], page: 1, limit: 12, total: 0 } }) },
    { method: 'POST', path: '/news-posts', handler: () => ({ status: 201, body: { ...POST, imageUrl: null, status: 'PUBLISHED' } }) },
  ])
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  renderNews()
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: POST.title } })
  fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: POST.content } })
  fireEvent.click(screen.getByRole('radio', { name: 'Socios' }))
  fireEvent.click(publishButton())
  expect(requestsTo(fetchStub, 'POST', '/news-posts')).toHaveLength(0)
  confirm.mockReturnValue(true)
  fireEvent.click(publishButton())
  expect(await screen.findByText('Novedad publicada correctamente.')).toBeInTheDocument()
  expect(requestsTo(fetchStub, 'POST', '/news-posts')[0].body).toEqual({ title: POST.title, content: POST.content, audience: 'MEMBERS', imageUrl: null, status: 'PUBLISHED' })
})

it('keeps an edited draft if publishing fails and retries without creating another post', async () => {
  let hasFailed = true
  const fetchStub = stubApi([
    { path: '/news-posts', handler: () => ({ body: { items: [POST], page: 1, limit: 12, total: 1 } }) },
    { method: 'PATCH', path: '/news-posts/news-1', handler: () => ({ body: POST }) },
    { method: 'PATCH', path: '/news-posts/news-1/status', handler: () => hasFailed ? { status: 503, body: { message: 'No se pudo publicar.' } } : { body: { ...POST, status: 'PUBLISHED' } } },
  ])
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderNews()
  fireEvent.click(await screen.findByRole('button', { name: POST.title }))
  fireEvent.click(publishButton())
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo publicar.')
  expect(screen.getByLabelText('Título')).toHaveValue(POST.title)
  hasFailed = false
  fireEvent.click(publishButton())
  await screen.findByText('Novedad publicada correctamente.')
  expect(requestsTo(fetchStub, 'POST', '/news-posts')).toHaveLength(0)
  expect(requestsTo(fetchStub, 'PATCH', '/news-posts/news-1/status')).toHaveLength(2)
})

it('uses API search, audience and status filters', async () => {
  const fetchStub = stubApi([{ path: '/news-posts', handler: () => ({ body: { items: [POST], page: 1, limit: 12, total: 1 } }) }])
  renderNews()
  await screen.findByRole('button', { name: POST.title })
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' equipo ' } })
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter', code: 'Enter' })
  fireEvent.change(screen.getByLabelText('Filtrar por audiencia'), { target: { value: 'TRAINERS' } })
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'INACTIVE' } })
  await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/news-posts').at(-1)?.url.searchParams.get('status')).toBe('INACTIVE'))
  const url = requestsTo(fetchStub, 'GET', '/news-posts').at(-1)!.url
  expect(url.searchParams.get('search')).toBe('equipo')
  expect(url.searchParams.get('audience')).toBe('TRAINERS')
  expect(url.searchParams.get('page')).toBe('1')
})

it('shows mobile cards and opens a dialog without an image field', async () => {
  setMobileViewport(true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
  stubApi([{ path: '/news-posts', handler: () => ({ body: { items: [POST], page: 1, limit: 12, total: 1 } }) }])
  renderNews()
  expect(await screen.findByRole('article')).toHaveTextContent('Borrador')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Filtrar novedades' }))
  fireEvent.keyDown(screen.getByRole('button', { name: 'Filtrar novedades' }), { key: 'Escape' })
  expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Filtrar novedades' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Filtrar novedades' }))
  expect(screen.getByLabelText('Estado')).toBeInTheDocument()
  fireEvent.keyDown(screen.getByLabelText('Estado'), { key: 'Escape' })
  expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Filtrar novedades' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Publicar una novedad' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText('Título')).toHaveValue('')
  expect(screen.queryByLabelText(/Imagen/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
