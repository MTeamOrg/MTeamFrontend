import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { RoleWorkspace } from './RoleWorkspace'

const userDetail = {
  id: 'user-1',
  firstName: 'Juan Manuel',
  lastName: 'Pérez',
  documentNumber: '40123456',
  birthDate: '1990-01-02',
  email: 'juan@example.com',
  phone: '1155556666',
  photoUrl: null,
  role: 'MEMBER' as const,
  status: 'ACTIVE' as const,
  isPasswordChangeRequired: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  memberProfile: { emergencyContactName: 'María Pérez', emergencyContactPhone: '1166667777' },
  trainerProfile: null,
  membership: { status: 'ACTIVE' as const, paymentId: 'payment-1', expiresAt: '2026-10-20T00:00:00.000Z' },
  payments: [{ id: 'payment-1', amount: '32000', method: 'Transferencia', receiptNumber: 'REC-1', status: 'ACCREDITED' as const, createdAt: '2026-09-20T00:00:00.000Z', accreditedAt: '2026-09-20T00:00:00.000Z', expiresAt: '2026-10-20T00:00:00.000Z', voidedAt: null, voidReason: null }],
  medicalCertificates: [{ id: 'certificate-1', fileUrl: 'private/path', status: 'APPROVED', uploadedAt: '2026-09-10T00:00:00.000Z', reviewedAt: '2026-09-11T00:00:00.000Z', reviewComment: null }],
  trainerBranches: [],
  classes: [],
}

function renderWorkspace(route: string) {
  return renderWithSession(<Routes><Route path="/admin/*" element={<RoleWorkspace role="ADMIN"/>}/></Routes>, { user: testUser('ADMIN'), route })
}

describe('detalle de usuarios del administrador', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('navega desde el listado, conserva los filtros y muestra datos reales del socio', async () => {
    stubApi([
      { path: '/users', handler: () => ({ body: { items: [{ id: 'user-1', firstName: 'Juan Manuel', lastName: 'Pérez', documentNumber: '40123456', email: 'juan@example.com', role: 'MEMBER', status: 'ACTIVE' }], page: 2, limit: 20, total: 21 } }) },
      { path: '/users/user-1', handler: () => ({ body: userDetail }) },
      { path: '/users/user-1/audit-logs', handler: () => ({ body: { items: [], page: 1, limit: 10, total: 0 } }) },
    ])
    renderWorkspace('/admin/usuarios?role=MEMBER&status=ACTIVE&page=2')

    fireEvent.click((await screen.findAllByRole('link', { name: 'Ver detalle de Juan Manuel Pérez' }, { timeout: 5000 }))[0])

    expect((await screen.findAllByRole('heading', { name: 'Juan Manuel Pérez' })).length).toBeGreaterThan(0)
    expect(screen.getByText('Historial de pagos')).toBeInTheDocument()
    expect(screen.getAllByText('Apto médico').length).toBeGreaterThan(0)
    expect(await screen.findByText('No hay acciones registradas.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a usuarios' })).toHaveAttribute('href', '/admin/usuarios?role=MEMBER&status=ACTIVE&page=2')
    expect(screen.getAllByRole('button', { name: 'Editar datos' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar datos' })[0])
    expect(await screen.findByRole('dialog', { name: 'Editar datos' })).toBeInTheDocument()
  })

  it('usa filtros compactos en celular sin alterar la consulta del listado', async () => {
    setMobileViewport(true)
    const fetchStub = stubApi([{ path: '/users', handler: (url) => ({ body: { items: [{ id: 'user-1', firstName: 'Juan Manuel', lastName: 'Pérez', documentNumber: '40123456', email: 'juan@example.com', role: 'MEMBER', status: 'ACTIVE' }], page: Number(url.searchParams.get('page') ?? 1), limit: 20, total: 1 } }) }])
    renderWorkspace('/admin/usuarios')

    const filterToggle = await screen.findByRole('button', { name: 'Mostrar filtros' }, { timeout: 5000 })
    expect(filterToggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.querySelector('.admin-users-filter-fields')).not.toHaveClass('is-open')
    fireEvent.click(filterToggle)
    expect(filterToggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.querySelector('.admin-users-filter-fields')).toHaveClass('is-open')
    fireEvent.change(screen.getByLabelText('Filtrar por rol'), { target: { value: 'TRAINER' } })
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/users').some(({ url }) => url.searchParams.get('role') === 'TRAINER')).toBe(true))
  })

  it('mantiene la cabecera móvil, la búsqueda completa y el acceso al detalle', async () => {
    setMobileViewport(true)
    stubApi([{ path: '/users', handler: () => ({ body: { items: [{ id: 'user-1', firstName: 'Juan Manuel', lastName: 'Pérez', documentNumber: '40123456', email: 'juan@example.com', role: 'MEMBER', status: 'ACTIVE' }], page: 1, limit: 20, total: 1 } }) }])
    renderWorkspace('/admin/usuarios')

    expect((await screen.findAllByRole('heading', { name: 'Usuarios' })).length).toBeGreaterThan(0)
    expect(document.querySelector('.admin-users-mobile-create')).toBeInTheDocument()
    expect(document.querySelector('.admin-users-toolbar .search-shell input')).toBeInTheDocument()
    expect(document.querySelector('.admin-users-filter-toggle')).toBeInTheDocument()
    expect(document.querySelector('.admin-user-mobile-link[href*="/admin/usuarios/user-1"]')).toBeInTheDocument()
  })

  it('mantiene estados de error del detalle y permite reintentar', async () => {
    let attempts = 0
    stubApi([
      { path: '/users/user-404', handler: () => { attempts += 1; return attempts === 1 ? { status: 404, body: { code: 'NOT_FOUND', message: 'El usuario no existe', details: null } } : { body: userDetail } } },
      { path: '/users/user-1/audit-logs', handler: () => ({ body: { items: [], page: 1, limit: 10, total: 0 } }) },
    ])
    renderWorkspace('/admin/usuarios/user-404')

    expect(await screen.findByText('El usuario no existe')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Juan Manuel Pérez' }).length).toBeGreaterThan(0))
  })
})
