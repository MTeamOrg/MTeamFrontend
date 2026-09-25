import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemberPaymentsScreen } from './MemberPaymentsScreen'

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

const membership = {
  currentPrice: '12345.67',
  lastPaymentAt: '2026-09-20T15:00:00.000Z',
  expiresAt: '2026-10-20T15:00:00.000Z',
  daysRemaining: 25,
  status: 'CURRENT',
}

const payment = {
  id: 'payment-1',
  amount: '12345.67',
  method: 'TRANSFERENCIA',
  receiptNumber: 'REC-1',
  status: 'ACCREDITED',
  accreditedAt: '2026-09-20T15:00:00.000Z',
  expiresAt: '2026-10-20T15:00:00.000Z',
  voidedAt: null,
  voidReason: null,
}

describe('pagos del socio', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/membership')) return Promise.resolve(json(membership))
      const page = url.includes('page=2') ? 2 : 1
      return Promise.resolve(json({ items: [payment], page, limit: 20, total: 21 }))
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('muestra importes decimales recibidos del backend', async () => {
    render(<MemberPaymentsScreen/>)
    expect(await screen.findAllByText(/12\.345,67/)).toHaveLength(2)
    expect(screen.getByText('TRANSFERENCIA')).toBeInTheDocument()
  })

  it('solicita la página siguiente al paginar', async () => {
    render(<MemberPaymentsScreen/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('page=2'), expect.anything()))
    expect(await screen.findByText('Página 2')).toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay pagos', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/membership')) return Promise.resolve(json(membership))
      return Promise.resolve(json({ items: [], page: 1, limit: 20, total: 0 }))
    })
    render(<MemberPaymentsScreen/>)
    expect(await screen.findByText('Todavía no hay pagos registrados.')).toBeInTheDocument()
  })
})
