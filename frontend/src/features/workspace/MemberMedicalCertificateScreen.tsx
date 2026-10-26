import { useCallback, useEffect, useRef, useState } from 'react'
import { backendApi, type MedicalCertificate, type MedicalCertificateStatus } from '../../service/backend-api'
import { formatDate } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { ActionButton } from '../../components/ActionButton'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { MedicalCertificateFileButton } from './MedicalCertificateFileButton'
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
  const reviewLabel = certificate.status === 'APPROVED' ? 'aprobado' : 'revisado'

  return <div className={compact ? 'medical-history-row' : 'medical-current-file'}>
    <span className="medical-file-icon" aria-hidden="true"><Icon name="file" size={compact ? 18 : 28}/></span>
    <div>
      <strong>Documento de apto médico</strong>
      <span>{compact ? `Cargado ${formatDate(certificate.uploadedAt)}` : certificate.reviewedAt ? `Cargado ${formatDate(certificate.uploadedAt)} · ${reviewLabel} ${formatDate(certificate.reviewedAt)}` : `Cargado ${formatDate(certificate.uploadedAt)}`}</span>
      {certificate.reviewedBy && <small className="medical-reviewed-by">Revisado por {certificate.reviewedBy.firstName} {certificate.reviewedBy.lastName}</small>}
      {certificate.reviewComment && <small className="medical-review-comment">Observación: “{certificate.reviewComment}”</small>}
    </div>
    {compact && <span className={`badge ${statusClass(certificate.status)}`}>{STATUS_LABEL[certificate.status]}</span>}
    {!compact && <div className="medical-file-actions">
      <MedicalCertificateFileButton id={certificate.id}/>
    </div>}
  </div>
}

export function MemberMedicalCertificateScreen() {
  const loader = useCallback(() => backendApi.getOwnMedicalCertificates(), [])
  const { data, loading, error, reload } = useApiResource(loader)
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraVideo = useRef<HTMLVideoElement>(null)
  const cameraStream = useRef<MediaStream | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')

  function stopCamera() {
    cameraStream.current?.getTracks().forEach((track) => track.stop())
    cameraStream.current = null
  }

  useEffect(() => () => stopCamera(), [])

  async function openCamera() {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Tu navegador no permite acceder a la cámara. Elegí una foto desde tus archivos.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      cameraStream.current = stream
      setCameraOpen(true)
      if (cameraVideo.current) cameraVideo.current.srcObject = stream
    } catch {
      setCameraError('No se pudo abrir la cámara. Revisá los permisos del navegador e intentá nuevamente.')
    }
  }

  function capturePhoto() {
    const video = cameraVideo.current
    if (!video || !video.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('No se pudo tomar la foto. Intentá nuevamente.')
        return
      }
      selectFile(new File([blob], `apto-medico-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      setCameraOpen(false)
      stopCamera()
    }, 'image/jpeg', 0.92)
  }

  function selectFile(file: File | undefined) {
    if (!file) return
    const nextError = validateMedicalCertificateFile(file)
    setValidationError(nextError)
    setSubmitError('')
    setSelectedFile(nextError ? null : file)
  }

  async function submitFile() {
    if (submitting) return
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
  if (loading) return <div className="app-page medical-screen">{header}<div className="app-card"><LoadingState message="Cargando apto médico…"/></div></div>
  if (error || !data) return <div className="app-page medical-screen">{header}<div className="app-card"><ErrorState message={error || 'No se pudo cargar tu certificado médico.'} retry={() => void reload()}/></div></div>

  const canUpload = !data.current || data.current.status === 'REJECTED'

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
          <h2 id="upload-certificate-title" className="medical-upload-desktop-heading">{canUpload ? data.current ? 'Reemplazar certificado' : 'Cargar un nuevo certificado' : 'Estado del certificado'}</h2>
          {canUpload && <div className="medical-mobile-upload-heading">
            <Icon name="upload" size={28}/>
            <h2>{data.current ? 'Reemplazar certificado' : 'Cargar un nuevo certificado'}</h2>
            <p>PDF, JPG o PNG · hasta 5 MB</p>
          </div>}
          {canUpload ? <><button type="button" className={`medical-dropzone${dragging ? ' is-dragging' : ''}`} onClick={() => fileInput.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]) }}>
            <Icon name="upload" size={28}/>
            <strong className="medical-dropzone-file">{selectedFile ? selectedFile.name : 'Arrastrá el archivo o hacé clic para buscarlo'}</strong>
            <span>PDF, JPG o PNG · hasta 5 MB</span>
            <span className="button button-primary"><Icon name="upload" size={18}/>Elegir archivo</span>
            {selectedFile && <span className="medical-selected-file">Archivo seleccionado: {selectedFile.name}</span>}
          </button>
          <input ref={fileInput} className="medical-hidden-file-input" type="file" accept={MEDICAL_CERTIFICATE_ACCEPT} onChange={(event) => selectFile(event.target.files?.[0])} aria-label="Seleccionar certificado médico"/>
          <div className="medical-upload-actions">
            <button type="button" className="button button-secondary medical-camera-button" onClick={() => void openCamera()}><Icon name="camera" size={18}/>Sacar una foto</button>
            <ActionButton type="button" className={`button button-primary medical-submit-button${selectedFile ? '' : ' is-empty'}`} isLoading={submitting} loadingLabel="Enviando…" disabled={!selectedFile} onClick={() => void submitFile()}>Enviar certificado</ActionButton>
          </div>
          {validationError && <p className="error-message" role="alert">{validationError}</p>}
          {submitError && <p className="error-message" role="alert">{submitError}</p>}</> :
            <p role="status">{data.current?.status === 'PENDING' ? 'Pendiente de revisión. No podés cargar otro certificado todavía.' : 'Aprobado. El apto aprobado no vence y no requiere una nueva carga.'}</p>}
        </section>

        {cameraError && <p className="error-message" role="alert">{cameraError}</p>}
        {cameraOpen && <div className="medical-camera-dialog" role="dialog" aria-modal="true" aria-label="Tomar foto del certificado">
          <video ref={(element) => { cameraVideo.current = element; if (element && cameraStream.current) element.srcObject = cameraStream.current }} autoPlay playsInline aria-label="Vista previa de la cámara"/>
          <div className="medical-camera-dialog-actions">
            <button type="button" className="button button-secondary" onClick={() => { setCameraOpen(false); stopCamera() }}>Cancelar</button>
            <button type="button" className="button button-primary" onClick={capturePhoto}>Tomar foto</button>
          </div>
        </div>}

        <section className="surface-card medical-history" aria-labelledby="history-title">
          <h2 id="history-title">Historial de aptos</h2>
          {data.history.length ? data.history.map((certificate) => <CertificateFile key={certificate.id} certificate={certificate} compact/>) : <EmptyState message="No hay certificados anteriores."/>}
        </section>
      </div>

      <aside className="medical-member-aside">
        <section className="surface-card medical-initial-period">
          <h2><Icon name="clock" size={18}/>Período inicial</h2>
          {data.initialPeriod.startsAt ? <>
            <p>Durante los primeros 20 días desde tu primer pago podés ingresar aunque el apto todavía no esté aprobado.</p>
            <dl>
              <div><dt>Estado</dt><dd>{data.initialPeriod.isActive ? 'Activo' : 'Finalizado'}</dd></div>
              <div><dt>Comenzó</dt><dd>{formatDate(data.initialPeriod.startsAt)}</dd></div>
              <div><dt>Vence</dt><dd>{formatDate(data.initialPeriod.expiresAt)}</dd></div>
              <div><dt>Días restantes</dt><dd>{data.initialPeriod.daysRemaining}</dd></div>
            </dl>
          </> : <p>Tu período inicial aún no comenzó.</p>}
        </section>
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
