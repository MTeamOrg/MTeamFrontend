import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { TrainerDirectoryScreen } from './TrainerDirectoryScreen'

const trainer = (overrides: Record<string, unknown> = {}) => ({
  id: 'trainer-1', firstName: 'Tomás', lastName: 'Pérez', photoUrl: 'https://example.com/trainer.jpg',
  specialty: 'Musculación', description: 'Entrenador de fuerza.',
  branches: [{ id: 'branch-1', name: 'Belgrano', address: 'Calle 1' }], ...overrides,
})

const page = (items: unknown[], total = items.length, limit = 12) => ({ items, page: 1, limit, total })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('directorio de entrenadores', () => {
  it('muestra especialidad, descripción, sedes, foto y enlace para volver', async () => {
    stubApi([{ path: '/trainers', handler: () => ({ body: page([
      trainer(), trainer({ id: 'trainer-2', firstName: 'Lucía', lastName: 'Díaz', photoUrl: null, specialty: 'Yoga', description: 'Entrenadora personal.', branches: [] }),
    ]) }) }])
    renderWithSession(<TrainerDirectoryScreen/>, { user: testUser('MEMBER'), route: '/socio/entrenadores' })

    expect(await screen.findByText('Tomás Pérez')).toBeInTheDocument()
    expect(screen.getByText('Musculación')).toBeInTheDocument()
    expect(screen.getByText('Entrenador de fuerza.')).toBeInTheDocument()
    expect(screen.getByText('Sedes:')).toBeInTheDocument()
    expect(screen.getByText('Belgrano')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Tomás Pérez' })).toHaveAttribute('src', 'https://example.com/trainer.jpg')
    expect(screen.getByRole('img', { name: 'Lucía Díaz' })).toHaveClass('media-fallback')
    expect(screen.getByRole('link', { name: /Volver al inicio/ })).toHaveAttribute('href', '/socio')
    expect(screen.getAllByRole('article')[1]).not.toHaveTextContent('Sedes:')
  })

  it('usa un marcador si falla la imagen del entrenador', async () => {
    stubApi([{ path: '/trainers', handler: () => ({ body: page([trainer()]) }) }])
    renderWithSession(<TrainerDirectoryScreen/>, { user: testUser('MEMBER') })
    const image = await screen.findByRole('img', { name: 'Tomás Pérez' })
    fireEvent.error(image)
    expect(screen.getByRole('img', { name: 'Tomás Pérez' })).toHaveClass('media-fallback')
  })

  it('muestra el estado vacío y permite reintentar cuando falla la consulta', async () => {
    let failed = false
    stubApi([{ path: '/trainers', handler: () => {
      if (!failed) { failed = true; return { status: 503, body: { message: 'No se pudo cargar el directorio.' } } }
      return { body: page([]) }
    } }])
    renderWithSession(<TrainerDirectoryScreen/>, { user: testUser('MEMBER') })

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No hay entrenadores activos para mostrar.')).toBeInTheDocument()
  })

  it('consulta páginas de 12 elementos y deshabilita los controles en sus límites', async () => {
    const fetchStub = stubApi([{ path: '/trainers', handler: (url) => ({ body: {
      items: [trainer({ id: `trainer-${url.searchParams.get('page')}`, firstName: `Entrenador ${url.searchParams.get('page')}`, branches: undefined })],
      page: Number(url.searchParams.get('page') ?? 1), limit: 12, total: 25,
    } }) }])
    renderWithSession(<TrainerDirectoryScreen/>, { user: testUser('MEMBER') })
    expect((await screen.findAllByText(/Entrenador 1/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect((await screen.findAllByText(/Entrenador 2/)).length).toBeGreaterThan(0)
    expect(screen.getByText('Página 2')).toBeInTheDocument()
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/trainers').at(-1)?.url.searchParams.toString()).toBe('page=2&limit=12'))

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect((await screen.findAllByText(/Entrenador 3/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect((await screen.findAllByText(/Entrenador 2/)).length).toBeGreaterThan(0)
    expect(screen.getByText('Página 2')).toBeInTheDocument()
  })
})
