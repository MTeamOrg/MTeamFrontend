import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import mailIcon from '../../assets/icons/mail.svg'
import { ApiError } from '../../service/api-client'
import { AuthLayout } from './AuthLayout'
import { PasswordField } from './PasswordField'
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

  if (session) return <Navigate to={session.user.isPasswordChangeRequired ? '/cambiar-contrasena' : '/inicio'} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const nextSession = await login({ email, password }, remember)
      navigate(nextSession.user.isPasswordChangeRequired ? '/cambiar-contrasena' : '/inicio', { replace: true })
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'No fue posible iniciar sesión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="auth-heading">
        <span className="eyebrow">ACCESO A TU CUENTA</span>
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
          <label className="checkbox"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Recordarme</label>
          <span className="muted-link" title="La recuperación de contraseña se implementará en una próxima etapa">¿Olvidaste tu contraseña?</span>
        </div>
        <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}</button>
        <div className="form-divider"><span>o</span></div>
        <p className="form-footer">¿Todavía no tenés cuenta? <Link to="/crear-cuenta">Crear cuenta</Link></p>
      </form>
    </AuthLayout>
  )
}
