import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { backendApi, type NewsPost } from '../../service/backend-api'
import { NewsScreen } from './NewsScreen'

const POST: NewsPost = { id: 'news-1', title: 'Información de actividades', content: 'Consultá las actividades disponibles.\nTe esperamos en la sede.', imageUrl: 'https://example.com/photo.jpg', audience: 'ALL', status: 'PUBLISHED', publishedAt: '2030-09-04T12:00:00Z', createdById: 'admin' }

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe.each(['MEMBER', 'TRAINER'] as const)('news consultation for %s', (role) => {
  const base = role === 'MEMBER' ? '/socio' : '/entrenador'
  function renderNews() { renderWithSession(<NewsScreen/>, { user: testUser(role), route: `${base}/novedades` }) }

  it('uses the existing authenticated service without overriding audience and renders text without photos', async () => {
    const audience = role === 'MEMBER' ? 'MEMBERS' : 'TRAINERS'
    const fetchStub = stubApi([{ path: '/news-posts', handler: () => ({ body: { items: [POST, { ...POST, id: 'own', title: 'Comunicado del rol', audience }], total: 2, page: 1, limit: 12 } }) }])
    const list = vi.spyOn(backendApi, 'listNewsPosts')
    renderNews()
    expect(await screen.findByRole('heading', { name: POST.title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Comunicado del rol' })).toBeInTheDocument()
    expect(screen.getAllByText('04/09/2030')).toHaveLength(2)
    expect(document.querySelector('time')).toHaveAttribute('datetime', POST.publishedAt)
    expect(document.querySelector('time')).toHaveAttribute('title', '04/09/2030 09:00')
    expect(document.querySelector('img')).toBeNull()
    expect(screen.queryByRole('button', { name: /Nueva novedad|Publicar|Editar|Desactivar/ })).not.toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 12 })
    expect(requestsTo(fetchStub, 'GET', '/news-posts')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Novedades' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Eventos' })).toHaveAttribute('href', `${base}/eventos`)
  })

  it('shows empty state only for a successful empty response', async () => {
    stubApi([{ path: '/news-posts', handler: () => ({ body: { items: [], total: 0, page: 1, limit: 12 } }) }])
    renderNews()
    expect(await screen.findByText('No hay novedades publicadas para mostrar.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ends loading on failure and retries successfully', async () => {
    let hasFailed = true
    stubApi([{ path: '/news-posts', handler: () => hasFailed ? { status: 500, body: { message: 'No se pudieron consultar las novedades.' } } : { body: { items: [POST], total: 1, page: 1, limit: 12 } } }])
    renderNews()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron consultar las novedades.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('No hay novedades publicadas para mostrar.')).not.toBeInTheDocument()
    hasFailed = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: POST.title })).toBeInTheDocument()
  })

  it('keeps loading until the request resolves and paginates through the service', async () => {
    let resolvePage!: (value: { items: NewsPost[]; total: number; page: number; limit: number }) => void
    const list = vi.spyOn(backendApi, 'listNewsPosts').mockImplementation(() => new Promise((resolve) => { resolvePage = resolve }))
    renderNews()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando novedades…')
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
    resolvePage({ items: [POST], total: 13, page: 1, limit: 12 })
    await screen.findByRole('heading', { name: POST.title })
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(list).toHaveBeenCalledWith({ page: 2, limit: 12 }))
    resolvePage({ items: [{ ...POST, publishedAt: null }], total: 13, page: 2, limit: 12 })
    expect(await screen.findByText('Fecha no informada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })
})
