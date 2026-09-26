import { useCallback, useRef, useState } from 'react'
import { backendApi, type MedicalCertificate, type MedicalCertificateStatus } from '../../service/backend-api'
import { formatDate } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'
import { MEDICAL_CERTIFICATE_ACCEPT, validateMedicalCertificateFile } from './medical-certificate-validation'

const STATUS_LABEL: Record<MedicalCertificateStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
}

function statusClass(status: MedicalCertificateStatus) {
  return status === 'APPROVED' ? 'badge-info' : status === 'REJECTED' ? 'badge-primary' : 'badge-secondary'
}

function CertificateFile({ certificate, compact = false }: { certificate: MedicalCertificate; compact?: boolean }) {
  return <div className={compact ? 'medical-history-row' : 'medical-current-file'}>
    <span className="medical-file-icon" aria-hidden="true"><Icon name="file" size={compact ? 18 : 28}/></span>
    <div>
      <strong>{certificate.fileName}</strong>
      <span>{compact ? `Cargado ${formatDate(certificate.uploadedAt)}` : `Cargado el ${formatDate(certificate.uploadedAt)}`}</span>
      {!compact && certificate.reviewedAt && <span>Revisado el {formatDate(certificate.reviewedAt)}</span>}
      {compact && certificate.status === 'REJECTED' && certificate.reviewComment && <small>Rechazado: “{certificate.reviewComment}”</small>}
    </div>
    {compact && <span className={`badge ${statusClass(certificate.status)}`}>{STATUS_LABEL[certificate.status]}</span>}
    {!compact && <div className="medical-file-actions">
      <a className="button button-secondary" href={certificate.fileUrl} target="_blank" rel="noreferrer"><Icon name="eye" size={16}/>Ver documento</a>
      <span className={`badge ${statusClass(certificate.status)}`}>{STATUS_LABEL[certificate.status]}</span>
    </div>}
  </div>
}

export function MemberMedicalCertificateScreen() {
  const loader = useCallback(() => backendApi.getOwnMedicalCertificate(), [])
  const { data, loading, error, reload } = useApiResource(loader)
  const fileInput = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function selectFile(file: File | undefined) {
    if (!file) return
    const nextError = validateMedicalCertificateFile(file)
    setValidationError(nextError)
    setSubmitError('')
    setSelectedFile(nextError ? null : file)
  }

  async function submitFile() {
    if (!selectedFile) {
      setValidationError('Elegí un archivo antes de enviarlo.')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      await backendApi.uploadOwnMedicalCertificate(selectedFile)
      setSelectedFile(null)
      setValidationError('')
      await reload()
    } catch (value) {
      setSubmitError(value instanceof Error ? value.message : 'No se pudo cargar el certificado.')
    } finally {
      setSubmitting(false)
    }
  }

  const header = <PageHeader title="Apto médico" description="Subí el certificado firmado por tu médico. Un administrador lo revisa y, una vez aprobado, no vence."/>
  if (loading) return <div className="app-page medical-screen">{header}<div className="app-card"><LoadingState/></div></div>
  if (error || !data) return <div className="app-page medical-screen">{header}<div className="app-card"><ErrorState message={error || 'No se pudo cargar tu certificado médico.'} retry={() => void reload()}/></div></div>

  return <div className="app-page medical-screen">
    {header}
    <div className="medical-member-grid">
      <div className="medical-member-main">
        <section className="surface-card medical-current-card" aria-labelledby="current-certificate-title">
          <div className="dashboard-section-title">
            <h2 id="current-certificate-title">Certificado actual</h2>
            {data.current && <span className={`badge ${statusClass(data.current.status)}`}>{STATUS_LABEL[data.current.status]}</span>}
          </div>
          {data.current ? <CertificateFile certificate={data.current}/> : <EmptyState message="Todavía no cargaste un certificado médico."/>}
        </section>

        <section className="surface-card medical-upload-card" aria-labelledby="upload-certificate-title">
          <h2 id="upload-certificate-title">{data.current ? 'Reemplazar certificado' : 'Cargar un nuevo certificado'}</h2>
          <button type="button" className="medical-dropzone" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={28}/>
            <strong>{selectedFile ? selectedFile.name : 'Arrastrá el archivo o hacé clic para buscarlo'}</strong>
            <span>PDF, JPG o PNG · hasta 5 MB</span>
            <span className="button button-primary"><Icon name="upload" size={18}/>Elegir archivo</span>
            <input
              ref={fileInput}
              className="medical-hidden-file-input"
              type="file"
              accept={MEDICAL_CERTIFICATE_ACCEPT}
              capture="environment"
              onChange={(event) => selectFile(event.target.files?.[0])}
              aria-label="Seleccionar certificado médico"
            />
          </button>
          <div className="medical-upload-actions">
            <button type="button" className="button button-secondary medical-camera-button" onClick={() => fileInput.current?.click()}><Icon name="camera" size={18}/>Tomar una foto</button>
            <button type="button" className="button button-primary" disabled={!selectedFile || submitting} onClick={() => void submitFile()}>{submitting ? 'Enviando…' : 'Enviar certificado'}</button>
          </div>
          {validationError && <p className="error-message" role="alert">{validationError}</p>}
          {submitError && <p className="error-message" role="alert">{submitError}</p>}
        </section>

        <section className="surface-card medical-history" aria-labelledby="history-title">
          <h2 id="history-title">Historial de aptos</h2>
          {data.history.length ? data.history.map((certificate) => <CertificateFile key={certificate.id} certificate={certificate} compact/>) : <EmptyState message="No hay certificados anteriores."/>}
        </section>
      </div>

      <aside className="medical-member-aside">
        {data.initialPeriod && <section className="surface-card medical-initial-period">
          <h2><Icon name="clock" size={18}/>Período inicial</h2>
          <p>Durante los primeros 20 días desde tu primer pago podés ingresar aunque el apto todavía no esté aprobado.</p>
          <dl>
            <div><dt>Estado</dt><dd>{data.initialPeriod.status === 'COMPLETED' ? 'Finalizado' : 'Activo'}</dd></div>
            <div><dt>Comenzó</dt><dd>{formatDate(data.initialPeriod.startsAt)}</dd></div>
          </dl>
        </section>}
        <section className="surface-card medical-requirements">
          <h2>Qué tiene que decir el certificado</h2>
          <ul>
            <li>Nombre completo y documento</li>
            <li>Fecha de emisión</li>
            <li>Aptitud para actividad física</li>
            <li>Firma y sello del profesional</li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
}
