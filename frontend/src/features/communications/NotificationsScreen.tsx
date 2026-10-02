import { useCallback, useState } from 'react'
import { backendApi, type Notification } from '../../service/backend-api'
import { formatDateTime } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import './communications.css'

function typeLabel(notification: Notification) {
  const labels: Record<Notification['type'], string> = { MEMBERSHIP_PRICE_CHANGED: 'Cuota', MEMBERSHIP_EXPIRING: 'Cuota', MEMBERSHIP_EXPIRED: 'Cuota', MEDICAL_CERTIFICATE_REVIEWED: 'Apto médico', CLASS_CHANGED: 'Clases', EVENT_CANCELLED: 'Eventos', GENERAL: 'General' }
  return labels[notification.type]
}

export function NotificationsScreen() {
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState('')
  const loader = useCallback(() => backendApi.listNotifications({ page, limit: 20 }), [page])
  const { data, loading, error, reload } = useApiResource(loader)

  async function markRead(notification: Notification) {
    if (notification.readAt) return
    setActionError('')
    try {
      await backendApi.markNotificationAsRead(notification.id)
      await reload()
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'No se pudo marcar la notificación como leída.')
    }
  }

  async function markAllRead() {
    setActionError('')
    try {
      await backendApi.markAllNotificationsAsRead()
      await reload()
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'No se pudieron marcar las notificaciones como leídas.')
    }
  }

  return <div className="app-page communications-page"><PageHeader title="Notificaciones" description="Avisos de tu cuenta y novedades operativas."><button type="button" className="button button-secondary" onClick={() => void markAllRead()} disabled={!data?.items.some((item) => !item.readAt)}><Icon name="check" size={16}/>Marcar todas como leídas</button></PageHeader>{actionError && <p className="error-message" role="alert">{actionError}</p>}{loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No tenés notificaciones para mostrar."/> : <div className="notification-list">{data.items.map((notification) => <article key={notification.id} className={`notification-item ${notification.readAt ? '' : 'is-unread'}`}><span className="notification-icon"><Icon name={notification.type === 'EVENT_CANCELLED' ? 'trophy' : notification.type === 'CLASS_CHANGED' ? 'calendar' : notification.type === 'MEDICAL_CERTIFICATE_REVIEWED' ? 'file' : 'bell'} size={18}/></span><div><div className="notification-meta"><span>{typeLabel(notification)}</span><time>{formatDateTime(notification.createdAt)}</time></div><h2>{notification.title}</h2><p>{notification.message}</p>{!notification.readAt && <button type="button" className="text-link" onClick={() => void markRead(notification)}>Marcar como leída</button>}</div></article>)}</div>}{data && data.total > data.limit && <div className="table-pagination"><span>Página {page} de {Math.ceil(data.total / data.limit)}</span><div><button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>}</div>
}
