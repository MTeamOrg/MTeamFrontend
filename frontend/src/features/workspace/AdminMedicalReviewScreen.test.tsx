import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { AdminMedicalReviewScreen } from './AdminMedicalReviewScreen'

const pending = {
  id: 'cert-1', memberId: 'member-1', status: 'PENDING',
  uploadedAt: '2026-09-03T20:14:00Z', reviewedAt: null, reviewComment: null,
  member: { id: 'member-1', firstName: 'Lucas', lastName: 'Torres', documentNumber: '44.870.910', email: 'lucas@example.com' },
  reviewedBy: null,
} as const

const preview = { signedUrl: 'https://signed.example/cert-1', expiresIn: 300 }

describe('revisión administrativa de aptos médicos', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('exige una observación no vacía para rechazar', async () => {
    const fetchStub = stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { path: '/medical-certificates/cert-1/file', handler: () => ({ body: preview }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Lucas Torres')
    fireEvent.click(screen.getByRole('button', { name: /rechazar apto médico/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('obligatoria')
    expect(fetchStub.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
  })

  it('rechaza con comentario y envía el PATCH real', async () => {
    const rejected = { ...pending, status: 'REJECTED', reviewComment: 'La imagen está cortada.' }
    const fetchStub = stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { path: '/medical-certificates/cert-1/file', handler: () => ({ body: preview }) },
      { method: 'PATCH', path: '/medical-certificates/cert-1/review', handler: () => ({ body: rejected }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Lucas Torres')
    fireEvent.change(screen.getByRole('textbox', { name: 'Observación para el socio' }), { target: { value: 'La imagen está cortada.' } })
    fireEvent.click(screen.getByRole('button', { name: /rechazar apto médico/i }))
    await waitFor(() => expect(screen.getByText('El certificado fue rechazado.')).toBeInTheDocument())
    const reviewCall = fetchStub.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(reviewCall?.[1]?.body).toBe(JSON.stringify({ status: 'REJECTED', reviewComment: 'La imagen está cortada.' }))
  })

  it('aprueba y envía el PATCH con APPROVED', async () => {
    const approved = { ...pending, status: 'APPROVED' }
    const fetchStub = stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { path: '/medical-certificates/cert-1/file', handler: () => ({ body: preview }) },
      { method: 'PATCH', path: '/medical-certificates/cert-1/review', handler: () => ({ body: approved }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Lucas Torres')
    fireEvent.click(screen.getByRole('button', { name: /aprobar apto médico/i }))
    await waitFor(() => expect(screen.getByText('El certificado fue aprobado.')).toBeInTheDocument())
    const reviewCall = fetchStub.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(reviewCall?.[1]?.body).toBe(JSON.stringify({ status: 'APPROVED' }))
  })

  it('obtiene la URL temporal al abrir el archivo', async () => {
    const tab = { opener: window, location: { href: '' }, close: vi.fn() }
    const fetchStub = stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { path: '/medical-certificates/cert-1/file', handler: () => ({ body: preview }) },
    ])
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Lucas Torres')
    expect(await screen.findByTitle('Vista previa del certificado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /abrir en pestaña/i }))
    await waitFor(() => expect(fetchStub.mock.calls.some(([input]) => String(input).includes('/medical-certificates/cert-1/file'))).toBe(true))
    await waitFor(() => expect(tab.location.href).toBe('https://signed.example/cert-1'))
    expect(requestsTo(fetchStub, 'GET', '/medical-certificates/cert-1/file')).toHaveLength(1)
    expect(tab.opener).toBeNull()
  })

  it('cierra la pestaña y muestra el error si falla el acceso privado', async () => {
    const tab = { opener: window, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { path: '/medical-certificates/cert-1/file', handler: () => ({ status: 403, body: { code: 'FORBIDDEN', message: 'Sin permiso para abrir el archivo' } }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    fireEvent.click(await screen.findByRole('button', { name: /abrir en pestaña/i }))
    expect((await screen.findAllByRole('alert')).some((alert) => alert.textContent?.includes('Sin permiso para abrir el archivo'))).toBe(true)
    expect(tab.close).toHaveBeenCalledOnce()
    expect(tab.location.href).toBe('')
  })

  it('muestra la situación real del socio sin UUID ni mensajes técnicos', async () => {
    const fetchStub = stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { path: '/medical-certificates/cert-1/file', handler: () => ({ body: preview }) },
      { path: '/users/member-1', handler: () => ({ body: { status: 'ACTIVE', membership: { status: 'ACTIVE', expiresAt: '2026-10-20' } } }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    expect(await screen.findByText('Situación del socio')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('Activa')).toHaveLength(2))
    expect(screen.getByText('Cuenta')).toBeInTheDocument()
    expect(screen.getAllByText('Activa')).toHaveLength(2)
    expect(screen.queryByText('Período inicial')).not.toBeInTheDocument()
    expect(requestsTo(fetchStub, 'GET', '/users/member-1')).toHaveLength(1)
    expect(screen.queryByText('member-1')).not.toBeInTheDocument()
    expect(screen.queryByText(/El backend|La respuesta actual/)).not.toBeInTheDocument()
  })

  it.each(['PENDING', 'APPROVED', 'REJECTED'] as const)('mantiene visible el estado %s en detalle móvil', async (status) => {
    setMobileViewport(true)
    stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: { ...pending, status } }) },
      { path: '/medical-certificates/cert-1/file', handler: () => ({ body: preview }) },
      { path: '/users/member-1', handler: () => ({ body: { status: 'ACTIVE', membership: null } }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    const label = { PENDING: 'Pendiente', APPROVED: 'Aprobado', REJECTED: 'Rechazado' }[status]
    expect((await screen.findAllByText(label)).length).toBeGreaterThan(0)
  })

  it.each([
    ['APPROVED' as const, { reviewedAt: '2026-09-04T10:00:00Z', reviewedBy: { id: 'admin-1', firstName: 'Lara', lastName: 'Admin' } }],
    ['REJECTED' as const, { reviewedAt: '2026-09-04T10:00:00Z', reviewComment: 'Falta la firma del profesional.', reviewedBy: { id: 'admin-1', firstName: 'Lara', lastName: 'Admin' } }],
  ])('muestra los certificados %s en modo de solo lectura', async (status, decision) => {
    const resolved = {
      ...pending,
      status,
      ...decision,
    }
    stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: resolved }) },
      { path: '/medical-certificates/cert-1/file', handler: () => ({ body: preview }) },
      { path: '/users/member-1', handler: () => ({ body: { status: 'ACTIVE', membership: null } }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })

    expect(await screen.findByText('Ver apto médico')).toBeInTheDocument()
    expect(screen.getByText('Resultado')).toBeInTheDocument()
    expect(screen.getAllByText(status === 'APPROVED' ? 'Aprobado' : 'Rechazado')).toHaveLength(2)
    expect(screen.getAllByText(/Revisado el/)).toHaveLength(2)
    if (status === 'REJECTED') expect(screen.getByText(/Falta la firma/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /aprobar apto médico/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Observación para el socio' })).not.toBeInTheDocument()
  })

  it('permite reintentar la vista previa si falla el acceso autorizado', async () => {
    let attempts = 0
    stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { path: '/medical-certificates/cert-1/file', handler: () => {
        attempts += 1
        return attempts === 1 ? { status: 503, body: { message: 'No se pudo cargar la vista previa' } } : { body: preview }
      } },
      { path: '/users/member-1', handler: () => ({ body: { status: 'ACTIVE', membership: null } }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })

    expect(await screen.findByText('No se pudo cargar la vista previa')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByTitle('Vista previa del certificado')).toBeInTheDocument()
    expect(attempts).toBe(2)
  })
})
