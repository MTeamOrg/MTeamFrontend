import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import mailIcon from '../../assets/icons/mail.svg'
import { ApiError } from '../../service/api-client'
import { AuthLayout } from './AuthLayout'
import { PasswordField } from './PasswordField'
import { RecoveryDialog } from './RecoveryDialog'
import { useAuth } from './use-auth'

export function LoginPage() {
  const { session, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)

  if (session) {
    const roleHome = session.user.role === 'ADMIN' ? '/admin' : session.user.role === 'TRAINER' ? '/entrenador' : '/socio'
    return <Navigate to={session.user.isPasswordChangeRequired ? '/cambiar-contrasena' : roleHome} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const nextSession = await login({ email, password }, remember)
      const roleHome = nextSession.user.role === 'ADMIN' ? '/admin' : nextSession.user.role === 'TRAINER' ? '/entrenador' : '/socio'
      navigate(nextSession.user.isPasswordChangeRequired ? '/cambiar-contrasena' : roleHome, { replace: true })
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'No fue posible iniciar sesión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="auth-heading">
        <h2>Iniciar sesión</h2>
        <p>Ingresá con el correo con el que te registraste.</p>
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        {location.state?.accountCreated && <div className="success-message">Cuenta creada. Ya podés iniciar sesión.</div>}
        {error && <div className="error-message" role="alert">{error}</div>}
        <label className="field">
          <span>Correo electrónico</span>
          <span className="input-shell"><img src={mailIcon} alt="" /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@correo.com" autoComplete="email" required /></span>
        </label>
        <PasswordField label="Contraseña" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ingresá tu contraseña" autoComplete="current-password" required />
        <div className="form-options">
          <label className="checkbox"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Mantener la sesión iniciada</label>
          <button className="muted-link recovery-link" type="button" onClick={() => { setIsRecoveryOpen(true) }}>¿Olvidaste tu contraseña?</button>
        </div>
        <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}</button>
        <div className="form-divider"><span>o</span></div>
        <p className="form-footer">¿Todavía no tenés cuenta? <Link to="/crear-cuenta">Crear cuenta</Link></p>
      </form>
      {isRecoveryOpen && <RecoveryDialog initialEmail={email} onClose={() => setIsRecoveryOpen(false)} />}
    </AuthLayout>
  )
}
