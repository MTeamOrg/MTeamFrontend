import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../service/api-client'
import { authService } from './auth-service'
import './recovery-dialog.css'

export function RecoveryDialog({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [email, setEmail] = useState(initialEmail)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [canResend, setCanResend] = useState(true)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  useEffect(() => {
    if (canResend) return
    const timeout = window.setTimeout(() => setCanResend(true), 60_000)
    return () => window.clearTimeout(timeout)
  }, [canResend])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !canResend) return
    setIsSubmitting(true)
    setError('')
    setNotice('')
    try {
      const result = await authService.requestRecovery(email.trim().toLowerCase())
      setNotice(result.message)
      setCanResend(false)
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'No pudimos enviar la solicitud. Intentá nuevamente.')
      if (caughtError instanceof ApiError && caughtError.status === 429) setCanResend(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="workspace-dialog recovery-dialog" aria-labelledby="recovery-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <button className="dialog-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
      <span className="eyebrow">RECUPERAR ACCESO</span>
      <h2 id="recovery-title">Restablecer contraseña</h2>
      <p>Ingresá el correo de tu cuenta para recibir un enlace seguro. El enlace vence en 30 minutos y se puede usar una sola vez.</p>
      <form onSubmit={handleSubmit}>
        <label className="read-field"><span>Correo electrónico</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" maxLength={255} required disabled={isSubmitting} autoFocus /></label>
        {notice && <p className="notice-inline" role="status">{notice}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {!canResend && <p>Podés volver a solicitar un enlace en un minuto.</p>}
        <div className="dialog-actions">
          <button className="button button-secondary" type="button" onClick={onClose}>Volver</button>
          <button className="button button-primary" type="submit" disabled={isSubmitting || !canResend}>{isSubmitting ? 'Enviando…' : notice ? 'Enviar otro enlace' : 'Enviar enlace'}</button>
        </div>
      </form>
    </dialog>
  )
}
