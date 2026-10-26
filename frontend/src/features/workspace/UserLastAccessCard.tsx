import { useCallback } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi } from '../../service/backend-api'
import { formatDateTime } from '../../service/date-time'
import { useAuth } from '../authentication/use-auth'

export function UserLastAccessCard({ userId }: { userId: string }) {
  const { session } = useAuth()
  if (session?.user.role !== 'ADMIN') return null
  return <LastAccessCard key={userId} userId={userId}/>
}

function LastAccessCard({ userId }: { userId: string }) {
  const loader = useCallback(async () => {
    const response = await backendApi.listAccessAttempts({ userId, result: 'ALLOWED', page: 1, limit: 1 })
    const attempt = response.items[0]
    if (attempt && attempt.result !== 'ALLOWED') throw new Error('El servidor devolvió un acceso no permitido.')
    return attempt ?? null
  }, [userId])
  const { data, loading: isLoading, error, reload } = useApiResource(loader)
  const timestamp = data ? formatDateTime(data.attemptedAt) : ''
  const compactTimestamp = timestamp ? `${timestamp.slice(0, 5)} · ${timestamp.slice(-5)}` : ''
  const location = [data?.branch?.name, data?.accessPoint?.name].filter(Boolean).join(' · ')
  return <article className="status-card user-last-access-card" aria-label="Último acceso" aria-busy={isLoading}>
    <span className="status-card-label">Último acceso</span>
    {isLoading ? <span className="status-card-sub" role="status">Cargando acceso…</span>
      : error ? <><span className="status-card-sub" role="alert">No se pudo consultar el último acceso.</span><button type="button" className="text-link" onClick={() => void reload()}>Reintentar</button></>
        : data ? <><strong className="status-card-value tone-black"><time dateTime={data.attemptedAt} title={timestamp}>{compactTimestamp}</time></strong>{location && <span className="status-card-sub">{location}</span>}</>
          : <span className="status-card-sub">Sin accesos registrados</span>}
  </article>
}
