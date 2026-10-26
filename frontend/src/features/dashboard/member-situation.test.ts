import { describe, expect, it } from 'vitest'
import type { MedicalCertificate, OwnMedicalCertificateView, OwnMembership } from '../../service/backend-api'
import {
  describeAccess,
  describeFee,
  describeMedical,
  describeMembership,
  readSource,
  type Source,
} from './member-situation'

const membership = (overrides: Partial<OwnMembership> = {}): OwnMembership => ({
  currentPrice: '32000',
  lastPaymentAt: '2026-10-01',
  expiresAt: '2026-10-31',
  daysRemaining: 9,
  status: 'CURRENT',
  ...overrides,
})

const certificate = (status: MedicalCertificate['status']): MedicalCertificate => ({
  id: 'certificate-1',
  memberId: 'member-1',
  status,
  uploadedAt: '2026-10-01',
  reviewedAt: status === 'PENDING' ? null : '2026-10-02',
  reviewComment: null,
  member: { id: 'member-1', firstName: 'Ana', lastName: 'Prueba', documentNumber: '1', email: 'ana@example.com' },
  reviewedBy: null,
})

const medical = (current: MedicalCertificate | null, isActive = false, startsAt: string | null = null): OwnMedicalCertificateView => ({
  current,
  history: [],
  initialPeriod: { startsAt, expiresAt: null, daysRemaining: 4, isActive },
  page: 1,
  limit: 20,
  total: current ? 1 : 0,
})

const ready = <T,>(data: T): Source<T> => ({ state: 'ready', data })

describe('readSource', () => {
  it('prioritizes loading and errors over any previous data', () => {
    expect(readSource({ data: membership(), loading: true, error: 'old error' })).toEqual({ state: 'loading' })
    expect(readSource({ data: membership(), loading: false, error: 'request failed' })).toEqual({ state: 'error', message: 'request failed' })
  })

  it('treats an empty successful response as an error and preserves valid data', () => {
    expect(readSource({ data: null, loading: false, error: '' })).toEqual({ state: 'error', message: expect.any(String) })
    expect(readSource({ data: membership(), loading: false, error: '' })).toEqual({ state: 'ready', data: membership() })
  })
})

describe('describeMembership and describeFee', () => {
  it.each([
    ['CURRENT', 'Al día', 'blue'],
    ['EXPIRING_SOON', 'Por vencer', 'purple'],
    ['EXPIRED', 'Vencida', 'pink'],
  ] as const)('maps membership status %s', (status, label, tone) => {
    expect(describeMembership(ready(membership({ status })))).toMatchObject({ value: label, tone })
  })

  it('describes loading, error, unknown status, and missing expiry', () => {
    expect(describeMembership({ state: 'loading' })).toMatchObject({ value: 'Cargando…', tone: 'black' })
    expect(describeMembership({ state: 'error', message: 'offline' })).toMatchObject({ value: 'No disponible', sub: 'No se pudo consultar tu cuota' })
    expect(describeMembership(ready(membership({ status: 'UNKNOWN' as OwnMembership['status'] })))).toMatchObject({ sub: 'No se reconoce el estado de tu cuota' })
    expect(describeMembership(ready(membership({ expiresAt: null, status: 'EXPIRED' })))).toMatchObject({ sub: 'Todavía no tenés pagos acreditados' })
    expect(describeMembership(ready(membership({ expiresAt: null })))).toMatchObject({ sub: 'Sin vencimiento informado' })
  })

  it('formats expiration wording and fee with and without a prior payment', () => {
    expect(describeMembership(ready(membership({ status: 'EXPIRED' })))).toMatchObject({ sub: expect.stringContaining('Venció el') })
    expect(describeMembership(ready(membership({ daysRemaining: 1 })))).toMatchObject({ sub: expect.stringContaining('1 día') })
    expect(describeFee({ state: 'loading' })).toMatchObject({ value: 'Cargando…' })
    expect(describeFee({ state: 'error', message: 'offline' })).toMatchObject({ value: 'No disponible' })
    expect(describeFee(ready(membership({ lastPaymentAt: null })))).toMatchObject({ sub: 'Todavía no tenés pagos acreditados' })
    expect(describeFee(ready(membership()))).toMatchObject({ value: expect.stringMatching(/\$\s32\.000/), sub: expect.stringContaining('Último pago acreditado:') })
  })
})

describe('describeMedical', () => {
  it('handles loading, error, no certificate, and unrecognized status', () => {
    expect(describeMedical({ state: 'loading' })).toMatchObject({ value: 'Cargando…' })
    expect(describeMedical({ state: 'error', message: 'offline' })).toMatchObject({ value: 'No disponible' })
    expect(describeMedical(ready(medical(null)))).toMatchObject({ value: 'Sin cargar', tone: 'purple' })
    expect(describeMedical(ready(medical(certificate('UNKNOWN' as MedicalCertificate['status']))))).toMatchObject({ sub: 'No se reconoce el estado de tu apto médico' })
  })

  it.each([
    ['APPROVED', 'Aprobado', 'sin vencimiento'],
    ['PENDING', 'Pendiente', 'En revisión'],
    ['REJECTED', 'Rechazado', 'Revisado el'],
  ] as const)('describes %s certificate', (status, label, sub) => {
    expect(describeMedical(ready(medical(certificate(status))))).toMatchObject({ value: label, sub: expect.stringContaining(sub) })
  })

  it('uses the upload date when a rejected certificate has not been reviewed yet', () => {
    expect(describeMedical(ready(medical({ ...certificate('REJECTED'), reviewedAt: null })))).toMatchObject({
      sub: expect.stringContaining('Cargado el'),
    })
  })
})

describe('describeAccess', () => {
  const currentMembership = ready(membership())
  const approvedMedical = ready(medical(certificate('APPROVED')))

  it('denies inactive accounts before reading other sources', () => {
    expect(describeAccess({ accountActive: false, membership: { state: 'loading' }, medical: { state: 'loading' } })).toMatchObject({ value: 'No habilitado', sub: 'Tu cuenta está deshabilitada.', to: undefined })
  })

  it('keeps unknown access state while membership is loading, failed, or invalid', () => {
    expect(describeAccess({ accountActive: true, membership: { state: 'loading' }, medical: approvedMedical })).toMatchObject({ value: 'Verificando…' })
    expect(describeAccess({ accountActive: true, membership: { state: 'error', message: 'offline' }, medical: approvedMedical })).toMatchObject({ value: 'Sin determinar', to: '/socio/acceso' })
    expect(describeAccess({ accountActive: true, membership: ready(membership({ status: 'UNKNOWN' as OwnMembership['status'] })), medical: approvedMedical })).toMatchObject({ value: 'Sin determinar' })
  })

  it('denies expired membership and links to payments', () => {
    expect(describeAccess({ accountActive: true, membership: ready(membership({ status: 'EXPIRED' })), medical: approvedMedical })).toMatchObject({ value: 'No habilitado', sub: 'Tu cuota está vencida.', to: '/socio/pagos' })
  })

  it('handles medical loading, error, invalid status, and approved certificate', () => {
    expect(describeAccess({ accountActive: true, membership: currentMembership, medical: { state: 'loading' } })).toMatchObject({ value: 'Verificando…' })
    expect(describeAccess({ accountActive: true, membership: currentMembership, medical: { state: 'error', message: 'offline' } })).toMatchObject({ value: 'Sin determinar' })
    expect(describeAccess({ accountActive: true, membership: currentMembership, medical: ready(medical(certificate('UNKNOWN' as MedicalCertificate['status']))) })).toMatchObject({ value: 'Sin determinar' })
    expect(describeAccess({ accountActive: true, membership: currentMembership, medical: approvedMedical })).toMatchObject({ value: 'Habilitado', tone: 'blue', to: '/socio/acceso' })
  })

  it('allows access during the initial period with singular and plural day counts', () => {
    const oneDay = ready({ ...medical(null, true), initialPeriod: { startsAt: '2026-10-01', expiresAt: '2026-10-20', daysRemaining: 1, isActive: true } })
    const manyDays = ready(medical(null, true, '2026-10-01'))
    expect(describeAccess({ accountActive: true, membership: currentMembership, medical: oneDay })).toMatchObject({ value: 'Habilitado', sub: expect.stringContaining('1 día restante') })
    expect(describeAccess({ accountActive: true, membership: currentMembership, medical: manyDays })).toMatchObject({ value: 'Habilitado', sub: expect.stringContaining('4 días restantes') })
  })

  it('denies missing, pending, and rejected certificates and links to medical records', () => {
    expect(describeAccess({ accountActive: true, membership: currentMembership, medical: ready(medical(null)) })).toMatchObject({ value: 'No habilitado', sub: expect.stringContaining('Necesitás un apto médico aprobado'), to: '/socio/apto-medico' })
    expect(describeAccess({ accountActive: true, membership: currentMembership, medical: ready(medical(null, false, '2026-10-01')) })).toMatchObject({ sub: expect.stringContaining('Terminó tu período inicial de 20 días.') })
    expect(describeAccess({ accountActive: true, membership: currentMembership, medical: ready(medical(certificate('PENDING'))) })).toMatchObject({ sub: expect.stringContaining('Tu apto médico está pendiente de revisión.') })
    expect(describeAccess({ accountActive: true, membership: currentMembership, medical: ready(medical(certificate('REJECTED'))) })).toMatchObject({ sub: expect.stringContaining('Tu apto médico fue rechazado.') })
  })
})
