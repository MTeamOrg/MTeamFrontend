import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../service/api-client'
import { AuthLayout } from './AuthLayout'
import { PasswordField } from './PasswordField'
import { RecoveryDialog } from './RecoveryDialog'
import { authService } from './auth-service'

export function ResetPasswordPage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isTokenRejected, setIsTokenRejected] = useState(!/^[a-f0-9]{64}$/.test(token))
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || isTokenRejected) return
    if (newPassword !== confirmation) { setError('Las contraseñas nuevas no coinciden.'); return }
    setIsSubmitting(true)
    setError('')
    try {
      await authService.completeRecovery(token, newPassword)
      setIsComplete(true)
      setNewPassword('')
      setConfirmation('')
      window.history.replaceState(window.history.state, '', window.location.pathname)
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'No pudimos actualizar la contraseña. Intentá nuevamente.')
      if (caughtError instanceof ApiError && ['INVALID_RECOVERY_TOKEN', 'EXPIRED_RECOVERY_TOKEN'].includes(caughtError.code)) setIsTokenRejected(true)
    } finally { setIsSubmitting(false) }
  }

  return (
    <AuthLayout>
      <div className="auth-heading"><h2>Restablecer contraseña</h2><p>Elegí una contraseña de entre 8 y 72 caracteres.</p></div>
      <form className="auth-card" onSubmit={handleSubmit}>
        {isComplete ? <div className="success-message" role="status">Contraseña actualizada. Ya podés iniciar sesión con tu nueva contraseña.</div> : <>
          {error && <div className="error-message" role="alert">{error}</div>}
          {isTokenRejected ? <>
            {!error && <p role="alert">El enlace es inválido o está incompleto. Solicitá uno nuevo.</p>}
            <button className="primary-button" type="button" onClick={() => setIsRecoveryOpen(true)}>Solicitar otro enlace</button>
          </> : <>
            <PasswordField label="Nueva contraseña" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required disabled={isSubmitting} />
            <PasswordField label="Confirmar nueva contraseña" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required disabled={isSubmitting} />
            <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Guardar contraseña'}</button>
          </>}
        </>}
        <Link to="/iniciar-sesion">Volver a iniciar sesión</Link>
      </form>
      {isRecoveryOpen && <RecoveryDialog initialEmail="" onClose={() => setIsRecoveryOpen(false)} />}
    </AuthLayout>
  )
}
