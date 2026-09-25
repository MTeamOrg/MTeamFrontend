import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from './Icon'

// The 5 MB limit appears in the exported medical-certificate screen; the scope document does not set a different limit.
const MAX_UPLOAD_SIZE_MB = 5
const ACCEPTED_MEDICAL_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

type Props = {
  title: string
  notice: string
  selectedName: string
  selectedStatus: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
  onAction: (label: string) => void
}

export function UnavailableForm({ title, notice, selectedName, selectedStatus, onSubmit, onClose, onAction }: Props) {
  const isPayment = title === 'Registrar pago'
  const isReview = title === 'Revisar apto médico'
  const isDetail = title === 'Detalle de usuario'
  const isAccount = title === 'Crear cuenta'
  const [role, setRole] = useState('Socio')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [receipt, setReceipt] = useState('')
  const [reviewDecision, setReviewDecision] = useState('')

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null
    setFileError('')
    if (!selectedFile) { setFile(null); setPreviewUrl(''); return }
    if (!ACCEPTED_MEDICAL_TYPES.includes(selectedFile.type)) {
      setFileError('El archivo debe ser PDF, JPG o PNG.')
      event.target.value = ''
      setFile(null)
      setPreviewUrl('')
      return
    }
    if (selectedFile.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      setFileError(`El archivo no puede superar ${MAX_UPLOAD_SIZE_MB} MB.`)
      event.target.value = ''
      setFile(null)
      setPreviewUrl('')
      return
    }
    setFile(selectedFile)
    setPreviewUrl(selectedFile.type.startsWith('image/') ? URL.createObjectURL(selectedFile) : '')
  }

  const expiration = paymentDate ? addDays(paymentDate, 30) : ''
  const heading = isPayment ? 'Registrar y acreditar un pago' : isReview ? 'Revisar apto médico' : isDetail ? selectedName || 'Detalle de usuario' : title
  const description = isPayment
    ? 'Revisá el resumen antes de confirmar: la acreditación inicia una nueva vigencia de 30 días.'
    : isReview
      ? 'Consultá el documento y registrá la decisión de revisión.'
      : isAccount
        ? 'Las cuentas de socios, entrenadores y administradores se crean desde el panel.'
        : isDetail
          ? 'Información personal y administrativa de la cuenta seleccionada.'
          : 'Completá los datos disponibles para esta operación.'

  return <section className="surface-card form-page"><form onSubmit={onSubmit}>
    <div className="section-heading"><div><h2>{heading}</h2><p>{description}</p></div>{isDetail && <div className="detail-actions"><button type="button" className="button button-secondary" onClick={()=>onAction('Restablecer contraseña temporal')}><Icon name="lock"/> Restablecer contraseña</button><button type="button" className="button button-secondary" onClick={()=>onAction('Editar usuario')}><Icon name="edit"/> Editar datos</button><button type="button" className="button button-danger-outline" onClick={()=>onAction(selectedStatus==='Desactivada'?'Activar cuenta':'Desactivar cuenta')}>{selectedStatus==='Desactivada'?'Activar cuenta':'Desactivar cuenta'}</button><button type="button" className="button button-secondary" onClick={onClose}>Volver</button></div>}</div>
    {isReview && <div className="document-preview"><Icon name="file" size={42}/><strong>Documento pendiente de carga</strong><span>La consulta del apto y su archivo requiere la integración del módulo médico.</span></div>}
    {isPayment && <div className="payment-summary"><span>Valor vigente de la cuota</span><strong>Dato pendiente de API</strong><span>Importe a acreditar</span><strong>{paymentAmount ? `$ ${Number(paymentAmount).toLocaleString('es-AR')}` : '—'}</strong><span>Nuevo vencimiento estimado</span><strong className="payment-expiration">{expiration ? formatDate(expiration) : 'Se calcula al seleccionar una fecha'}</strong><small>Vista previa; la fecha definitiva y la vigencia las confirma el backend.</small></div>}
    {isDetail && <><p className="notice-inline">Los campos actuales no están conectados a datos reales. La consulta del perfil, cuota, pagos, apto e historial de auditoría requiere el servicio de usuarios.</p><h3 className="detail-section-heading">Historial de pagos</h3><div className="empty-state"><p>El historial de pagos aparecerá cuando esté disponible el servicio de pagos.</p></div><h3 className="detail-section-heading">Historial de acciones sobre la cuenta</h3><div className="empty-state"><p>El historial de auditoría aparecerá cuando esté disponible el servicio de usuarios.</p></div></>}
    <div className="form-field-grid">
      {isPayment ? <>
        <FormField label="Socio" placeholder="Buscar por nombre o documento" required/>
        <FormField label="Fecha y hora de acreditación" type="datetime-local" value={paymentDate} onChange={setPaymentDate} required/>
        <FormField label="Importe" type="number" min="0" step="0.01" placeholder="Importe del pago" value={paymentAmount} onChange={setPaymentAmount} required/>
        <FormField label="Medio de pago" type="select" options={['Efectivo','Transferencia','Débito']} required/>
        <FormField label="Número de comprobante" value={receipt} onChange={setReceipt} required={false}/>
      </> : isReview ? <>
        <FormField label="Resultado de revisión" type="select" options={['Aprobado','Rechazado']} value={reviewDecision} onChange={setReviewDecision} required/>
        <FormField label="Observación" type="textarea" placeholder={reviewDecision==='Rechazado'?'Obligatoria para rechazar':'Opcional'} required={reviewDecision==='Rechazado'}/>
      </> : isDetail ? <>
        <FormField label="Nombre" placeholder="Dato pendiente de API"/>
        <FormField label="Apellido" placeholder="Dato pendiente de API"/>
        <FormField label="Documento" placeholder="Campo protegido" disabled/>
        <FormField label="Fecha de nacimiento" type="date"/>
        <FormField label="Correo electrónico" type="email" placeholder="Dato pendiente de API"/>
        <FormField label="Teléfono" type="tel" placeholder="Dato pendiente de API"/>
        <FormField label="Rol" type="select" options={['Socio','Entrenador','Administrador']}/>
        <FormField label="Estado de cuenta" type="select" options={['Activa','Desactivada']}/>
      </> : <>
        <FormField label="Nombre" required/>
        <FormField label="Apellido" required/>
        <FormField label="Documento" inputMode="numeric" required/>
        <FormField label="Fecha de nacimiento" type="date" required/>
        <FormField label="Correo electrónico" type="email" required/>
        <FormField label="Teléfono" type="tel" required/>
        <FormField label="Rol" type="select" options={['Socio','Entrenador','Administrador']} value={role} onChange={setRole} required/>
        {role === 'Socio' && <><FormField label="Contacto de emergencia"/><FormField label="Teléfono de emergencia" type="tel"/></>}
        {role === 'Entrenador' && <><FormField label="Especialidad" required/><FormField label="Descripción" type="textarea" required/><FormField label="Sedes asignadas" type="select" options={['Villa Urquiza','Belgrano']} required/></>}
        <p className="form-note">La contraseña temporal se generará al crear la cuenta y deberá cambiarse en el primer inicio de sesión.</p>
      </>}
    </div>
    {isReview && <div className="form-actions"><button className="button button-secondary" type="submit" name="decision" value="reject">Rechazar apto</button><button className="button button-primary" type="submit" name="decision" value="approve">Aprobar apto</button></div>}
    {title === 'Cargar apto médico' && <section className="medical-upload-panel"><label className="button button-primary"><Icon name="file"/> Elegir archivo<input className="visually-hidden" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange}/></label><span>PDF, JPG o PNG · Hasta {MAX_UPLOAD_SIZE_MB} MB</span>{fileError && <p className="error-message" role="alert">{fileError}</p>}{file && <div className="selected-file"><Icon name="file"/>{previewUrl && <img src={previewUrl} alt="Vista previa del apto médico"/>}<span>{file.name}</span><small>{(file.size/1024/1024).toFixed(2)} MB</small></div>}</section>}
    {notice && <div className="notice-inline" role="status">{notice}</div>}
    {!isReview && <div className="form-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">{isPayment?'Continuar con el resumen':isAccount?'Crear cuenta':isDetail?'Guardar cambios':'Enviar'}</button></div>}
  </form></section>
}

function FormField({ label, type = 'text', required = false, placeholder, value, onChange, options, min, step, disabled, inputMode }: { label: string; type?: string; required?: boolean; placeholder?: string; value?: string; onChange?: (value: string) => void; options?: string[]; min?: string; step?: string; disabled?: boolean; inputMode?: 'numeric' }) {
  const common = { required, disabled, placeholder, value, onChange: onChange ? (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) : undefined }
  return <label className="read-field"><span>{label}</span>{type==='select'?<select required={required} disabled={disabled} value={value} onChange={onChange?event=>onChange(event.target.value):undefined}><option value="">Seleccioná una opción</option>{options?.map(option=><option key={option}>{option}</option>)}</select>:type==='textarea'?<textarea rows={4} {...common}/>:<input type={type} min={min} step={step} inputMode={inputMode} {...common}/>}</label>
}

function addDays(date: string, days: number) { const value = new Date(date); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10) }
function formatDate(date: string) { return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`)) }
