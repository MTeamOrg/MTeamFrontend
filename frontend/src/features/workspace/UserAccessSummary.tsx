import { useCallback } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type AccessAttemptResult } from '../../service/backend-api'
import { formatDateTime } from '../../service/date-time'
import { useAuth } from '../authentication/use-auth'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'

const DENIAL_LABELS: Record<string, string> = {
  INVALID_QR: 'QR inválido',
  INACTIVE_USER: 'Cuenta desactivada',
  INACTIVE_BRANCH: 'Sede desactivada',
  INACTIVE_ACCESS_POINT: 'Punto de acceso desactivado',
  EXPIRED_MEMBERSHIP: 'Cuota vencida',
  MEDICAL_CERTIFICATE_REQUIRED: 'Apto médico requerido',
}

export function UserAccessSummary({ userId }: { userId: string }) {
  const { session } = useAuth()
  if (session?.user.role !== 'ADMIN') return null
  return <section className="surface-card user-detail-card" aria-label="Ingresos al gimnasio">
    <AccessRecord key={`${userId}-allowed`} userId={userId} isAllowedOnly/>
    <AccessRecord key={`${userId}-latest`} userId={userId} isAllowedOnly={false}/>
  </section>
}

function AccessRecord({ userId, isAllowedOnly }: { userId: string; isAllowedOnly: boolean }) {
  const loader = useCallback(async () => {
    const response = await backendApi.listAccessAttempts({ userId, page: 1, limit: 1, ...(isAllowedOnly ? { result: 'ALLOWED' as const } : {}) })
    return response.items[0] ?? null
  }, [userId, isAllowedOnly])
  const { data, loading: isLoading, error, reload } = useApiResource(loader)
  const title = isAllowedOnly ? 'Último ingreso permitido' : 'Último intento de acceso'
  return <section className="user-access-record" aria-label={title}>
    <h2>{title}</h2>
    {isLoading ? <LoadingState message="Cargando accesos…"/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data ? <EmptyState message={isAllowedOnly ? 'No hay ingresos registrados' : 'No hay intentos de acceso registrados'}/> : <AccessRecordDetails attempt={data}/>}
  </section>
}

function AccessRecordDetails({ attempt }: { attempt: AccessAttemptResult }) {
  const isAllowed = attempt.result === 'ALLOWED'
  return <dl className="user-detail-list">
    <div><dt>Fecha y hora</dt><dd><time dateTime={attempt.attemptedAt}>{formatDateTime(attempt.attemptedAt)}</time></dd></div>
    <div><dt>Resultado</dt><dd>{isAllowed ? 'Permitido' : 'Rechazado'}</dd></div>
    {attempt.branch && <div><dt>Sede</dt><dd>{attempt.branch.name}</dd></div>}
    {attempt.accessPoint && <div><dt>Punto de acceso</dt><dd>{attempt.accessPoint.name}</dd></div>}
    {!isAllowed && attempt.denialReason && <div><dt>Motivo del rechazo</dt><dd>{DENIAL_LABELS[attempt.denialReason] ?? 'Motivo no reconocido'}</dd></div>}
  </dl>
}
