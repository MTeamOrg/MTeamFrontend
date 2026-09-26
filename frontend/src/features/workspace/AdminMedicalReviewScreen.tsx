import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type AdminMedicalCertificate, type MedicalCertificateStatus } from '../../service/backend-api'
import { formatDate, formatDateTime } from '../../service/date-time'
import { ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
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

function membershipLabel(status: AdminMedicalCertificate['membership'] extends infer T ? T extends { status: infer S } ? S : never : never) {
  return status === 'ACTIVE' ? 'Activa' : 'Vencida'
}

export function AdminMedicalReviewScreen({ id }: { id: string }) {
  const loader = useCallback(() => backendApi.getAdminMedicalCertificate(id), [id])
  const { data, loading, error, reload, setData } = useApiResource(loader)
  const [reviewComment, setReviewComment] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function approve() {
    setSubmitting(true)
    setActionError('')
    setActionMessage('')
    try {
      const updated = await backendApi.approveMedicalCertificate(id)
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
    setSubmitting(true)
    setActionError('')
    setActionMessage('')
    try {
      const updated = await backendApi.rejectMedicalCertificate(id, comment)
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
  return <div className="app-page medical-review-screen">
    <div className="medical-review-desktop-header">
      <PageHeader title="Revisar apto médico" description="Verificá la documentación del socio antes de aprobarla."/>
      <Link className="button button-secondary" to="/admin/aptos"><Icon name="back" size={18}/>Volver a aptos</Link>
    </div>
    {actionMessage && <p className="success-message" role="status">{actionMessage}</p>}
    {actionError && <p className="error-message" role="alert">{actionError}</p>}
    <div className="medical-review-grid">
      <div className="medical-review-main">
        <section className="surface-card medical-member-detail">
          <h2>{memberName}</h2>
          <p>DNI {data.member.documentNumber} · cargado el {formatDateTime(data.uploadedAt)}</p>
          <span className={`badge ${STATUS_CLASS[data.status]}`}>{STATUS_LABEL[data.status]}</span>
        </section>
        <section className="surface-card medical-preview-card" aria-label="Vista previa del certificado">
          <div className="medical-preview-canvas"><Icon name="file" size={48}/><span>{data.fileName}</span><a href={data.fileUrl} target="_blank" rel="noreferrer">Abrir archivo</a></div>
        </section>
      </div>
      <aside className="medical-review-side">
        <section className="surface-card medical-situation-card">
          <h2>Situación del socio</h2>
          <dl>
            <div><dt>Cuota</dt><dd>{data.membership ? membershipLabel(data.membership.status) : 'Sin datos'}</dd></div>
            <div><dt>Período inicial</dt><dd>{data.initialPeriod ? data.initialPeriod.daysRemaining ? `Quedan ${data.initialPeriod.daysRemaining} días` : data.initialPeriod.status === 'COMPLETED' ? 'Finalizado' : 'Activo' : 'Sin datos'}</dd></div>
            {data.membership?.expiresAt && <div><dt>Vencimiento</dt><dd>{formatDate(data.membership.expiresAt)}</dd></div>}
          </dl>
        </section>
        {canReview && <button type="button" className="button button-primary medical-approve-button" disabled={submitting} onClick={() => void approve()}><Icon name="check" size={20}/>{submitting ? 'Guardando…' : 'Aprobar apto médico'}</button>}
        <section className="surface-card medical-reject-card">
          <h2>Rechazar</h2>
          {canReview ? <form onSubmit={(event) => void reject(event)} noValidate>
            <label className="medical-comment-field"><span className="sr-only">Observación para el socio</span><textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Observación para el socio (obligatoria)…" required aria-label="Observación para el socio"/></label>
            <button type="submit" className="button button-danger" disabled={submitting}><Icon name="close" size={20}/>{submitting ? 'Guardando…' : 'Rechazar apto médico'}</button>
          </form> : data.reviewComment && <p className="medical-review-comment">“{data.reviewComment}”</p>}
        </section>
      </aside>
    </div>
  </div>
}
