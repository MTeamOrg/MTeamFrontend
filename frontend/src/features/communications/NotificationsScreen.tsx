import { useCallback, useRef, useState } from 'react'
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
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [failedNotification, setFailedNotification] = useState<Notification | 'all' | null>(null)
  const isSavingRef = useRef(false)
  const loader = useCallback(() => backendApi.listNotifications({ page, limit: 20 }), [page])
  const { data, loading, error, reload } = useApiResource(loader)
  const unreadLoader = useCallback(() => backendApi.listNotifications({ page: 1, limit: 1, isRead: false }), [])
  const { data: unreadData, loading: unreadLoading, error: unreadError, reload: reloadUnread } = useApiResource(unreadLoader)

  async function saveReadStatus(notification: Notification | 'all') {
    if (isSavingRef.current || (notification !== 'all' && notification.readAt)) return
    isSavingRef.current = true
    setIsSaving(true)
    setActionError('')
    setSuccessMessage('')
    setFailedNotification(null)
    try {
      if (notification === 'all') await backendApi.markAllNotificationsAsRead()
      else await backendApi.markNotificationAsRead(notification.id)
      setSuccessMessage(notification === 'all' ? 'Todas las notificaciones se marcaron como leídas.' : 'Notificación marcada como leída.')
      await Promise.all([reload(), reloadUnread()])
    } catch {
      setActionError('No se pudo guardar el estado de lectura. Intentá nuevamente.')
      setFailedNotification(notification)
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  return <div className="app-page communications-page"><PageHeader title="Notificaciones" description="Avisos de tu cuenta y novedades operativas."><button type="button" className="button button-secondary" onClick={() => void saveReadStatus('all')} disabled={isSaving || loading || unreadLoading || !!error || !!unreadError || (unreadData?.total ?? 0) === 0}><Icon name="check" size={16}/>Marcar todas como leídas</button></PageHeader>{actionError && <div className="notification-feedback error-message" role="alert"><p>{actionError}</p>{failedNotification && <button type="button" className="button button-secondary" disabled={isSaving} onClick={() => void saveReadStatus(failedNotification)}>Reintentar</button>}</div>}{successMessage && <p className="notification-feedback" role="status">{successMessage}</p>}{isSaving && <p role="status">Guardando estado de lectura…</p>}{loading ? <LoadingState message="Cargando notificaciones…"/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No tenés notificaciones para mostrar."/> : <div className="notification-list">{data.items.map((notification) => <article key={notification.id} className={`notification-item ${notification.readAt ? '' : 'is-unread'}`}><span className="notification-icon"><Icon name={notification.type === 'EVENT_CANCELLED' ? 'trophy' : notification.type === 'CLASS_CHANGED' ? 'calendar' : notification.type === 'MEDICAL_CERTIFICATE_REVIEWED' ? 'file' : 'bell'} size={18}/></span><div><div className="notification-meta"><span>{typeLabel(notification)}</span><span className="notification-read-status">{notification.readAt ? 'Leída' : 'No leída'}</span><time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time></div><h2>{notification.title}</h2><p>{notification.message}</p>{!notification.readAt && <button type="button" className="text-link" disabled={isSaving} onClick={() => void saveReadStatus(notification)}>Marcar como leída</button>}</div></article>)}</div>}{data && data.total > data.limit && <div className="table-pagination"><span>Página {page} de {Math.ceil(data.total / data.limit)}</span><div><button type="button" className="button button-secondary" disabled={isSaving || loading || page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={isSaving || loading || page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>}</div>
}
