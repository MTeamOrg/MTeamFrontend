import type { MedicalCertificateStatus, MembershipStatus, OwnMedicalCertificateView, OwnMembership } from '../../service/backend-api'
import { formatDate } from '../../service/date-time'
import type { StatusTone } from '../workspace/StatusCard'
import { formatMoney } from './dashboard-data'

/** Where one request stands: still loading, failed, or answered. A failed request never keeps old data on screen. */
export type Source<T> =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; data: T }

export interface CardView {
  value: string
  tone: StatusTone
  sub: string
  to?: string
}

const PAYMENTS_PATH = '/socio/pagos'
const MEDICAL_PATH = '/socio/apto-medico'
const ACCESS_PATH = '/socio/acceso'

const MEMBERSHIP_STATUS: Record<MembershipStatus, { label: string; tone: StatusTone }> = {
  CURRENT: { label: 'Al día', tone: 'blue' },
  EXPIRING_SOON: { label: 'Por vencer', tone: 'purple' },
  EXPIRED: { label: 'Vencida', tone: 'pink' },
}

const MEDICAL_STATUS: Record<MedicalCertificateStatus, { label: string; tone: StatusTone }> = {
  APPROVED: { label: 'Aprobado', tone: 'blue' },
  PENDING: { label: 'Pendiente', tone: 'purple' },
  REJECTED: { label: 'Rechazado', tone: 'pink' },
}

export function readSource<T>({ data, loading, error }: { data: T | null; loading: boolean; error: string }): Source<T> {
  if (loading) return { state: 'loading' }
  if (error) return { state: 'error', message: error }
  if (!data) return { state: 'error', message: 'El servidor no devolvió información.' }
  return { state: 'ready', data }
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

function membershipStatusOf(membership: OwnMembership) {
  const known: { label: string; tone: StatusTone } | undefined = MEMBERSHIP_STATUS[membership.status]
  return known
}

function medicalStatusOf(status: MedicalCertificateStatus) {
  const known: { label: string; tone: StatusTone } | undefined = MEDICAL_STATUS[status]
  return known
}

export function describeMembership(source: Source<OwnMembership>): CardView {
  if (source.state === 'loading') return { value: 'Cargando…', tone: 'black', sub: 'Consultando tu cuota' }
  if (source.state === 'error') return { value: 'No disponible', tone: 'purple', sub: 'No se pudo consultar tu cuota' }
  const known = membershipStatusOf(source.data)
  if (!known) return { value: 'No disponible', tone: 'purple', sub: 'No se reconoce el estado de tu cuota' }
  const { expiresAt, daysRemaining, status } = source.data
  if (!expiresAt) return { value: known.label, tone: known.tone, sub: status === 'EXPIRED' ? 'Todavía no tenés pagos acreditados' : 'Sin vencimiento informado' }
  return {
    value: known.label,
    tone: known.tone,
    sub: status === 'EXPIRED'
      ? `Venció el ${formatDate(expiresAt)}`
      : `Vence el ${formatDate(expiresAt)} · ${plural(daysRemaining, 'día', 'días')}`,
  }
}

export function describeFee(source: Source<OwnMembership>): CardView {
  if (source.state === 'loading') return { value: 'Cargando…', tone: 'black', sub: 'Consultando tu cuota' }
  if (source.state === 'error') return { value: 'No disponible', tone: 'black', sub: 'No se pudo consultar tu cuota' }
  const { currentPrice, lastPaymentAt } = source.data
  return {
    value: formatMoney(currentPrice),
    tone: 'black',
    sub: lastPaymentAt ? `Último pago acreditado: ${formatDate(lastPaymentAt)}` : 'Todavía no tenés pagos acreditados',
  }
}

export function describeMedical(source: Source<OwnMedicalCertificateView>): CardView {
  if (source.state === 'loading') return { value: 'Cargando…', tone: 'black', sub: 'Consultando tu apto médico' }
  if (source.state === 'error') return { value: 'No disponible', tone: 'purple', sub: 'No se pudo consultar tu apto médico' }
  const { current } = source.data
  if (!current) return { value: 'Sin cargar', tone: 'purple', sub: 'Todavía no presentaste un apto médico' }
  const known = medicalStatusOf(current.status)
  if (!known) return { value: 'No disponible', tone: 'purple', sub: 'No se reconoce el estado de tu apto médico' }
  const reviewed = current.reviewedAt ? `Revisado el ${formatDate(current.reviewedAt)}` : ''
  const sub = current.status === 'APPROVED' ? [reviewed, 'sin vencimiento'].filter(Boolean).join(' · ')
    : current.status === 'PENDING' ? `En revisión · cargado el ${formatDate(current.uploadedAt)}`
      : reviewed || `Cargado el ${formatDate(current.uploadedAt)}`
  return { value: known.label, tone: known.tone, sub }
}

/**
 * Mirrors the rules the backend applies when the member scans the gym's QR (account, membership, then
 * approved medical certificate or the initial 20-day period). The backend has no read-only eligibility
 * endpoint, so this is a summary of real data and never replaces the decision taken at the scan.
 * Whenever a needed source is missing or unreadable the answer is "undetermined", never "enabled".
 */
export function describeAccess({ accountActive, membership, medical }: {
  accountActive: boolean
  membership: Source<OwnMembership>
  medical: Source<OwnMedicalCertificateView>
}): CardView {
  const denied = (sub: string, to?: string): CardView => ({ value: 'No habilitado', tone: 'pink', sub, to })
  const undetermined = (sub: string): CardView => ({ value: 'Sin determinar', tone: 'purple', sub, to: ACCESS_PATH })
  const checking = (sub: string): CardView => ({ value: 'Verificando…', tone: 'black', sub })

  if (!accountActive) return denied('Tu cuenta está deshabilitada.')
  if (membership.state === 'loading') return checking('Consultando tu cuota')
  if (membership.state === 'error') return undetermined('No pudimos consultar tu cuota.')
  if (!membershipStatusOf(membership.data)) return undetermined('No se reconoce el estado de tu cuota.')
  if (membership.data.status === 'EXPIRED') return denied('Tu cuota está vencida.', PAYMENTS_PATH)
  if (medical.state === 'loading') return checking('Consultando tu apto médico')
  if (medical.state === 'error') return undetermined('No pudimos verificar tu apto médico.')

  const { current, initialPeriod } = medical.data
  if (current && !medicalStatusOf(current.status)) return undetermined('No se reconoce el estado de tu apto médico.')
  if (current?.status === 'APPROVED') {
    return { value: 'Habilitado', tone: 'blue', sub: 'Podés solicitar acceso. Se valida al escanear el QR.', to: ACCESS_PATH }
  }
  if (initialPeriod.isActive) {
    return {
      value: 'Habilitado',
      tone: 'blue',
      sub: `Período inicial sin apto aprobado: ${plural(initialPeriod.daysRemaining, 'día restante', 'días restantes')}.`,
      to: ACCESS_PATH,
    }
  }
  const ended = initialPeriod.startsAt ? 'Terminó tu período inicial de 20 días. ' : ''
  if (!current) return denied(`${ended}Necesitás un apto médico aprobado.`, MEDICAL_PATH)
  return denied(`${ended}${current.status === 'PENDING' ? 'Tu apto médico está pendiente de revisión.' : 'Tu apto médico fue rechazado.'}`, MEDICAL_PATH)
}
