import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { AdminPaymentsScreen } from './AdminPaymentsScreen'

const page = (items: unknown[] = [], total = items.length) => ({ items, page: 1, limit: 20, total })

function stubPaymentsApi() {
  return stubApi([
    { path: '/payments', handler: () => ({ body: page([{ id: 'pay-1', amount: '32000', method: 'Efectivo', receiptNumber: '0001-0456', status: 'ACCREDITED', accreditedAt: '2026-10-05T14:00:00-03:00', expiresAt: '2026-11-04T14:00:00-03:00', voidedAt: null, voidReason: null, member: { id: 'member-1', firstName: 'Juan Manuel', lastName: 'Pérez', documentNumber: '40123456', email: 'juan@example.com' } }]) }) },
    { path: '/payments/summary', handler: () => ({ body: { from: '', to: '', paymentCount: 4, totalAmount: '128000', days: [] } }) },
    { path: '/membership-prices/current', handler: () => ({ body: { id: 'price-1', amount: '32000', effectiveFrom: '2026-09-01T00:00:00-03:00', createdAt: '', createdById: 'admin-1' } }) },
    { path: '/membership-prices', handler: () => ({ body: page([{ id: 'price-1', amount: '32000', effectiveFrom: '2026-09-01T00:00:00-03:00', createdAt: '', createdById: 'admin-1' }]) }) },
    { path: '/admin/dashboard/metrics', handler: () => ({ body: { activeMembers: 184, inactiveMembers: 0, currentMemberships: 141, expiringMemberships: 23, expiredMemberships: 20, pendingMedicalCertificates: 0, rejectedMedicalCertificates: 0, initialPeriodMembers: 0 } }) },
    { path: '/members', handler: () => ({ body: page([{ id: 'member-1', firstName: 'Juan Manuel', lastName: 'Pérez', documentNumber: '40123456', email: 'juan@example.com', status: 'ACTIVE', membershipStatus: 'CURRENT', lastPaymentAt: '2026-09-05T14:00:00-03:00', expiresAt: '2026-10-05T14:00:00-03:00' }]) }) },
    { method: 'POST', path: '/payments/previews', handler: () => ({ body: { member: { id: 'member-1', firstName: 'Juan Manuel', lastName: 'Pérez', documentNumber: '40123456', email: 'juan@example.com' }, currentPrice: '32000', amount: '32000', method: 'Efectivo', receiptNumber: '0001-0456', estimatedAccreditedAt: '2026-10-05T14:00:00-03:00', estimatedExpiresAt: '2026-11-04T14:00:00-03:00' } }) },
    { method: 'POST', path: '/payments', handler: () => ({ status: 201, body: { id: 'pay-2' } }) },
  ])
}

describe('pagos y cuota del administrador', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('muestra las métricas, la tabla y los paneles definidos en Figma', async () => {
    stubPaymentsApi()
    renderWithSession(<AdminPaymentsScreen />, { user: testUser('ADMIN') })
    expect(await screen.findByText('VALOR VIGENTE')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pagos y cuota' })).toBeInTheDocument()
    expect(screen.getByText('RECAUDADO HOY')).toBeInTheDocument()
    expect(screen.getByText('SOCIOS SIN PAGO')).toBeInTheDocument()
    expect(screen.getByText('Juan Manuel Pérez')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cambiar el valor de la cuota' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Historial de valores' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Estado de las cuotas' })).toBeInTheDocument()
  })

  it('previsualiza y acredita un pago desde el modal', async () => {
    const fetchStub = stubPaymentsApi()
    renderWithSession(<AdminPaymentsScreen />, { user: testUser('ADMIN') })
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }))
    expect(screen.getByRole('heading', { name: 'Registrar y acreditar un pago' })).toBeInTheDocument()
    const memberFields = await screen.findAllByLabelText('Socio')
    fireEvent.change(memberFields.at(-1) as HTMLSelectElement, { target: { value: 'member-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar y acreditar' }))
    expect(await screen.findByText('Nuevo vencimiento')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Confirmar y acreditar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y acreditar' }))
    await waitFor(() => expect(requestsTo(fetchStub, 'POST', '/payments')).toHaveLength(1))
  })
})
