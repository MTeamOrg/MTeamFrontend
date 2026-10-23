import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { AdminPaymentsScreen } from './AdminPaymentsScreen'

const page = (items: unknown[] = [], total = items.length) => ({ items, page: 1, limit: 20, total })

function stubPaymentsApi(priceHandler: () => { status?: number; body?: unknown } = () => ({ status: 201, body: { id: 'price-2' } })) {
  return stubApi([
    { path: '/payments', handler: () => ({ body: page([{ id: 'pay-1', amount: '32000', method: 'Efectivo', receiptNumber: '0001-0456', status: 'ACCREDITED', accreditedAt: '2026-10-05T14:00:00-03:00', expiresAt: '2026-11-04T14:00:00-03:00', voidedAt: null, voidReason: null, member: { id: 'member-1', firstName: 'Juan Manuel', lastName: 'Pérez', documentNumber: '40123456', email: 'juan@example.com' } }]) }) },
    { path: '/payments/summary', handler: () => ({ body: { from: '', to: '', paymentCount: 4, totalAmount: '128000', days: [] } }) },
    { path: '/membership-prices/current', handler: () => ({ body: { id: 'price-1', amount: '32000', effectiveFrom: '2026-09-01T00:00:00-03:00', createdAt: '', createdById: 'admin-1' } }) },
    { path: '/membership-prices', handler: () => ({ body: page([{ id: 'price-1', amount: '32000', effectiveFrom: '2026-09-01T00:00:00-03:00', createdAt: '', createdById: 'admin-1' }]) }) },
    { path: '/admin/dashboard/metrics', handler: () => ({ body: { activeMembers: 184, inactiveMembers: 0, currentMemberships: 141, expiringMemberships: 23, expiredMemberships: 20, pendingMedicalCertificates: 0, rejectedMedicalCertificates: 0, initialPeriodMembers: 0 } }) },
    { path: '/members', handler: () => ({ body: page([{ id: 'member-1', firstName: 'Juan Manuel', lastName: 'Pérez', documentNumber: '40123456', email: 'juan@example.com', status: 'ACTIVE', membershipStatus: 'CURRENT', lastPaymentAt: '2026-09-05T14:00:00-03:00', expiresAt: '2026-10-05T14:00:00-03:00' }]) }) },
    { method: 'POST', path: '/payments/previews', handler: () => ({ body: { member: { id: 'member-1', firstName: 'Juan Manuel', lastName: 'Pérez', documentNumber: '40123456', email: 'juan@example.com' }, currentPrice: '32000', amount: '32000', method: 'Efectivo', receiptNumber: '0001-0456', estimatedAccreditedAt: '2026-10-05T14:00:00-03:00', estimatedExpiresAt: '2026-11-04T14:00:00-03:00' } }) },
    { method: 'POST', path: '/payments', handler: () => ({ status: 201, body: { id: 'pay-2' } }) },
    { method: 'POST', path: '/membership-prices', handler: priceHandler },
  ])
}

describe('pagos y cuota del administrador', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('muestra las métricas, la tabla y los paneles definidos en Figma', async () => {
    stubPaymentsApi()
    renderWithSession(<AdminPaymentsScreen />, { user: testUser('ADMIN') })
    expect((await screen.findAllByText('VALOR VIGENTE')).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Pagos y cuota' })).toBeInTheDocument()
    expect((await screen.findAllByText('RECAUDADO HOY')).length).toBeGreaterThan(0)
    expect(screen.getByText('SOCIOS SIN PAGO')).toBeInTheDocument()
    expect(screen.getByText('Juan Manuel Pérez')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cambiar el valor de la cuota' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Historial de valores' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Estado de las cuotas' })).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Últimos pagos' })).toBeInTheDocument()
  })

  it('aclara que solo los aumentos notifican a los socios activos', async () => {
    stubPaymentsApi()
    renderWithSession(<AdminPaymentsScreen />, { user: testUser('ADMIN') })

    expect(await screen.findByText(/Solo los aumentos notifican a los socios activos/)).toBeInTheDocument()
    expect(screen.queryByText(/Se notifica a \d+ socios activos/)).not.toBeInTheDocument()
  })

  it('reuses the idempotency key after a failed price request is retried unchanged', async () => {
    let attempts = 0
    const fetchStub = stubPaymentsApi(() => {
      attempts += 1
      return attempts === 1
        ? { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Error temporal' } }
        : { status: 201, body: { id: 'price-2' } }
    })
    renderWithSession(<AdminPaymentsScreen />, { user: testUser('ADMIN') })
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Nuevo valor' }), { target: { value: '35000' } })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar nuevo valor' }))
    expect(await screen.findByText('Error temporal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nuevo valor' }))
    await waitFor(() => expect(attempts).toBe(2))

    const priceRequests = fetchStub.mock.calls.filter(([input, init]) => {
      const url = new URL(String(input))
      return url.pathname.endsWith('/membership-prices') && (init?.method ?? 'GET').toUpperCase() === 'POST'
    })
    expect(priceRequests).toHaveLength(2)
    const keys = priceRequests.map(([, init]) => new Headers(init?.headers).get('Idempotency-Key'))
    expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(keys[1]).toBe(keys[0])
  })

  it('previsualiza y acredita un pago desde el modal', async () => {
    const fetchStub = stubPaymentsApi()
    renderWithSession(<AdminPaymentsScreen />, { user: testUser('ADMIN') })
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }))
    expect(screen.getByRole('heading', { name: 'Registrar y acreditar un pago' })).toBeInTheDocument()
    await screen.findByRole('option', { name: /Juan Manuel/ })
    fireEvent.change(screen.getByRole('combobox', { name: 'Socio' }), { target: { value: 'member-1' } })
    const reviewButton = screen.getByRole('button', { name: 'Revisar y acreditar' })
    await waitFor(() => expect(reviewButton).toBeEnabled())
    fireEvent.click(reviewButton)
    expect(await screen.findByText('Nuevo vencimiento')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Confirmar y acreditar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y acreditar' }))
    await waitFor(() => expect(requestsTo(fetchStub, 'POST', '/payments')).toHaveLength(1))
    const paymentRequest = fetchStub.mock.calls.find(([input, init]) => {
      const url = new URL(String(input))
      return url.pathname.endsWith('/payments') && (init?.method ?? 'GET').toUpperCase() === 'POST'
    })
    expect(new Headers(paymentRequest?.[1]?.headers).get('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('reuses the payment idempotency key when the same confirmation is retried', async () => {
    let attempts = 0
    const fetchStub = stubApi([
      { path: '/payments', handler: () => ({ body: page([]) }) },
      { path: '/payments/summary', handler: () => ({ body: { from: '', to: '', paymentCount: 0, totalAmount: '0', days: [] } }) },
      { path: '/membership-prices/current', handler: () => ({ body: { id: 'price-1', amount: '32000', effectiveFrom: '', createdAt: '', createdById: 'admin-1' } }) },
      { path: '/membership-prices', handler: () => ({ body: page([]) }) },
      { path: '/admin/dashboard/metrics', handler: () => ({ body: { activeMembers: 1, inactiveMembers: 0, currentMemberships: 1, expiringMemberships: 0, expiredMemberships: 0, pendingMedicalCertificates: 0, rejectedMedicalCertificates: 0, initialPeriodMembers: 0 } }) },
      { path: '/members', handler: () => ({ body: page([{ id: 'member-1', firstName: 'Juan', lastName: 'PÃ©rez', documentNumber: '40123456', email: 'juan@example.com', status: 'ACTIVE', membershipStatus: 'CURRENT', lastPaymentAt: null, expiresAt: null }]) }) },
      { method: 'POST', path: '/payments/previews', handler: () => ({ body: { member: { id: 'member-1', firstName: 'Juan', lastName: 'PÃ©rez', documentNumber: '40123456', email: 'juan@example.com' }, currentPrice: '32000', amount: '32000', method: 'Efectivo', receiptNumber: null, estimatedAccreditedAt: '', estimatedExpiresAt: '' } }) },
      { method: 'POST', path: '/payments', handler: () => {
        attempts += 1
        return attempts === 1
          ? { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Error temporal' } }
          : { status: 201, body: { id: 'pay-2' } }
      } },
    ])
    renderWithSession(<AdminPaymentsScreen />, { user: testUser('ADMIN') })
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }))
    await screen.findByRole('option', { name: /Juan PÃ©rez/ })
    fireEvent.change(screen.getByRole('combobox', { name: 'Socio' }), { target: { value: 'member-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar y acreditar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y acreditar' }))
    expect(await screen.findByText('Error temporal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y acreditar' }))
    await waitFor(() => expect(attempts).toBe(2))

    const paymentRequests = fetchStub.mock.calls.filter(([input, init]) => {
      const url = new URL(String(input))
      return url.pathname.endsWith('/payments') && (init?.method ?? 'GET').toUpperCase() === 'POST'
    })
    const keys = paymentRequests.map(([, init]) => new Headers(init?.headers).get('Idempotency-Key'))
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(keys[1]).toBe(keys[0])
  })
})
