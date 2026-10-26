import { afterEach, describe, expect, it, vi } from 'vitest'
import { backendApi } from './backend-api'

describe('contrato de certificados médicos', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['respuesta nula', null],
    ['lista de certificados inválida', { items: 'not-an-array', initialMedicalCertificatePeriod: {} }],
    ['período inicial ausente', { items: [], page: 1, limit: 20, total: 0 }],
  ])('rechaza %s en la respuesta del endpoint propio', async (_scenario, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    await expect(backendApi.getOwnMedicalCertificates()).rejects.toThrow(
      'El servidor devolvió una respuesta incompleta. Intentá nuevamente.',
    )
  })

  it('usa los seis endpoints reales y los métodos correctos', async () => {
    const requests: Array<{ path: string; method: string; body: BodyInit | undefined }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname.replace(/^\/api/, '')
      const method = init?.method ?? 'GET'
      requests.push({ path, method, body: init?.body ?? undefined })
      const payload = path === '/members/me/medical-certificates' && method === 'GET'
        ? { items: [], page: 1, limit: 20, total: 0, initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false } }
        : {}
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    await backendApi.getOwnMedicalCertificates()
    await backendApi.uploadOwnMedicalCertificate(new File(['%PDF'], 'apto.pdf', { type: 'application/pdf' }))
    await backendApi.listAdminMedicalCertificates({ status: 'PENDING', page: 1, limit: 1 })
    await backendApi.getAdminMedicalCertificate('cert-1')
    await backendApi.getMedicalCertificateFile('cert-1')
    await backendApi.reviewMedicalCertificate('cert-1', 'APPROVED')
    await backendApi.reviewMedicalCertificate('cert-1', 'REJECTED', 'Falta el sello')

    expect(requests.map(({ path, method }) => [method, path])).toEqual([
      ['GET', '/members/me/medical-certificates'],
      ['POST', '/members/me/medical-certificates'],
      ['GET', '/medical-certificates'],
      ['GET', '/medical-certificates/cert-1'],
      ['GET', '/medical-certificates/cert-1/file'],
      ['PATCH', '/medical-certificates/cert-1/review'],
      ['PATCH', '/medical-certificates/cert-1/review'],
    ])
    expect(requests[1].body).toBeInstanceOf(FormData)
    expect((requests[1].body as FormData).get('file')).toBeInstanceOf(File)
    expect(JSON.parse(String(requests[5].body))).toEqual({ status: 'APPROVED' })
    expect(JSON.parse(String(requests[6].body))).toEqual({ status: 'REJECTED', reviewComment: 'Falta el sello' })
  })
})
