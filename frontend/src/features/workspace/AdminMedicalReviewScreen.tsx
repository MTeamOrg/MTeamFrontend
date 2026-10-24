import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type MedicalCertificateStatus } from '../../service/backend-api'
import { formatDateTime } from '../../service/date-time'
import { ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { MedicalCertificatePreview } from './MedicalCertificatePreview'
import { PageHeader } from './PageHeader'

const STATUS_LABEL: Record<MedicalCertificateStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
}

const STATUS_CLASS: Record<MedicalCertificateStatus, string> = {
  PENDING: 'badge-secondary',
  APPROVED: 'badge-info',
  REJECTED: 'badge-primary',
}

function membershipLabel(status: 'ACTIVE' | 'EXPIRED') {
  return status === 'ACTIVE' ? 'Activa' : 'Vencida'
}

function membershipBadgeClass(status: 'ACTIVE' | 'EXPIRED' | undefined) {
  return status === 'ACTIVE' ? 'badge-purple' : status === 'EXPIRED' ? 'badge-pink' : 'badge-disabled'
}

function accountLabel(status: 'ACTIVE' | 'INACTIVE' | undefined) {
  return status === 'ACTIVE' ? 'Activa' : status === 'INACTIVE' ? 'Inactiva' : 'Sin datos disponibles'
}

function accountBadgeClass(status: 'ACTIVE' | 'INACTIVE' | undefined) {
  return status === 'INACTIVE' ? 'badge-pink' : 'badge-disabled'
}

export function AdminMedicalReviewScreen({ id }: { id: string }) {
  const loader = useCallback(() => backendApi.getAdminMedicalCertificate(id), [id])
  const { data, loading, error, reload, setData } = useApiResource(loader)
  const memberId = data?.memberId
  const memberLoader = useCallback(() => memberId ? backendApi.getUser(memberId) : Promise.resolve(null), [memberId])
  const member = useApiResource(memberLoader)
  const [reviewComment, setReviewComment] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function approve() {
    setSubmitting(true)
    setActionError('')
    setActionMessage('')
    try {
      const updated = await backendApi.reviewMedicalCertificate(id, 'APPROVED')
      setData(updated)
      setActionMessage('El certificado fue aprobado.')
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'No se pudo aprobar el certificado.')
    } finally {
      setSubmitting(false)
    }
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const comment = reviewComment.trim()
    if (!comment) {
      setActionError('La observación es obligatoria para rechazar el certificado.')
      return
    }
    if (comment.length > 1000) {
      setActionError('La observación no puede superar los 1000 caracteres.')
      return
    }
    setSubmitting(true)
    setActionError('')
    setActionMessage('')
    try {
      const updated = await backendApi.reviewMedicalCertificate(id, 'REJECTED', comment)
      setData(updated)
      setActionMessage('El certificado fue rechazado.')
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'No se pudo rechazar el certificado.')
    } finally {
      setSubmitting(false)
    }
  }

  const header = <PageHeader title="Revisar apto médico" description="Verificá la documentación del socio antes de aprobarla."/> 
  if (loading) return <div className="app-page medical-review-screen">{header}<div className="app-card"><LoadingState/></div></div>
  if (error || !data) return <div className="app-page medical-review-screen">{header}<div className="app-card"><ErrorState message={error || 'No se pudo cargar el certificado médico.'} retry={() => void reload()}/></div></div>

  const memberName = `${data.member.firstName} ${data.member.lastName}`
  const canReview = data.status === 'PENDING'
  const title = canReview ? 'Revisar apto médico' : 'Ver apto médico'
  const description = `${memberName} · DNI ${data.member.documentNumber} · cargado el ${formatDateTime(data.uploadedAt)}`
  return <div className="app-page medical-review-screen">
    <div className="medical-review-desktop-header">
      <PageHeader title={title} description={description}/>
      <Link className="button button-secondary" to="/admin/aptos"><Icon name="back" size={18}/>Volver a aptos</Link>
    </div>
    {actionMessage && <p className="success-message" role="status">{actionMessage}</p>}
    {actionError && <p className="error-message" role="alert">{actionError}</p>}
    <div className="medical-review-grid">
      <div className="medical-review-main">
        <section className="surface-card medical-member-detail">
          <h2>{memberName}</h2>
          <p>DNI {data.member.documentNumber} · cargado el {formatDateTime(data.uploadedAt)}</p>
          {data.reviewedAt && <p>Revisado el {formatDateTime(data.reviewedAt)}{data.reviewedBy ? ` por ${data.reviewedBy.firstName} ${data.reviewedBy.lastName}` : ''}</p>}
          <span className={`badge ${STATUS_CLASS[data.status]}`}>{STATUS_LABEL[data.status]}</span>
        </section>
        <MedicalCertificatePreview id={data.id}/>
      </div>
      <aside className="medical-review-side">
        <section className="surface-card medical-situation-card">
          <h2>Situación del socio</h2>
          <dl>
            <div><dt>Cuota</dt><dd><span className={`badge medical-situation-badge ${membershipBadgeClass(member.data?.membership?.status)}`}>{member.loading ? 'Cargando…' : member.data?.membership ? membershipLabel(member.data.membership.status) : 'Sin datos disponibles'}</span></dd></div>
            <div><dt>Período inicial</dt><dd><span className="badge medical-situation-badge badge-disabled">No disponible</span></dd></div>
            {member.data && <div><dt>Cuenta</dt><dd><span className={`badge medical-situation-badge ${accountBadgeClass(member.data.status)}`}>{accountLabel(member.data.status)}</span></dd></div>}
          </dl>
          <p className="medical-situation-help">Pasados los 20 días vas a necesitar un apto aprobado para poder ingresar.</p>
        </section>
        {canReview ? <section className="surface-card medical-decision-card">
          <h2>Decisión</h2>
          <button type="button" className="button button-primary medical-approve-button" disabled={submitting} onClick={() => void approve()}><Icon name="check" size={20}/>{submitting ? 'Guardando…' : 'Aprobar apto médico'}</button>
          <p className="medical-decision-help">Una vez aprobado, el apto no vence.</p>
          <div className="medical-decision-divider"/>
          <h3>Rechazar</h3>
          <form onSubmit={(event) => void reject(event)} noValidate>
            <label className="medical-comment-field"><span className="sr-only">Observación para el socio</span><textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Observación para el socio (obligatoria)…" required maxLength={1000} aria-label="Observación para el socio"/></label>
            <button type="submit" className="button button-danger" disabled={submitting}><Icon name="close" size={20}/>{submitting ? 'Guardando…' : 'Rechazar apto médico'}</button>
          </form>
        </section> : <section className="surface-card medical-decision-card medical-read-only-card">
          <h2>Resultado</h2>
          <span className={`badge ${STATUS_CLASS[data.status]}`}>{STATUS_LABEL[data.status]}</span>
          {data.reviewComment && <p className="medical-review-comment">Observación: “{data.reviewComment}”</p>}
          {data.reviewedAt && <p className="medical-review-comment">Revisado el {formatDateTime(data.reviewedAt)}{data.reviewedBy ? ` por ${data.reviewedBy.firstName} ${data.reviewedBy.lastName}` : ''}.</p>}
          {!data.reviewComment && !data.reviewedAt && !data.reviewedBy && <p className="medical-review-comment">La API no informó datos adicionales de la decisión.</p>}
        </section>}
      </aside>
    </div>
  </div>
}
