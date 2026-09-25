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
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryNotice, setRecoveryNotice] = useState('')

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

  function handleRecoverySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRecoveryNotice('La solicitud está lista, pero todavía no puede enviarse desde la plataforma porque falta el servicio de recuperación. Contactá al administrador para pedir una contraseña temporal.')
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
          <button className="muted-link recovery-link" type="button" onClick={() => { setRecoveryNotice(''); setRecoveryOpen(true) }}>¿Olvidaste tu contraseña?</button>
        </div>
        <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}</button>
        <div className="form-divider"><span>o</span></div>
        <p className="form-footer">¿Todavía no tenés cuenta? <Link to="/crear-cuenta">Crear cuenta</Link></p>
      </form>
      {recoveryOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setRecoveryOpen(false)}}><section className="workspace-dialog recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title"><button className="dialog-close" type="button" aria-label="Cerrar" onClick={()=>setRecoveryOpen(false)}>×</button><span className="eyebrow">RECUPERAR ACCESO</span><h2 id="recovery-title">Solicitar contraseña temporal</h2><p>Ingresá el correo de tu cuenta. El restablecimiento lo gestiona un administrador; no se envían correos automáticos.</p><form onSubmit={handleRecoverySubmit}><label className="read-field"><span>Correo electrónico</span><input type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" required/></label>{recoveryNotice&&<p className="notice-inline" role="status">{recoveryNotice}</p>}<div className="dialog-actions"><button className="button button-secondary" type="button" onClick={()=>setRecoveryOpen(false)}>Volver</button><button className="button button-primary" type="submit">Solicitar restablecimiento</button></div></form></section></div>}
    </AuthLayout>
  )
}
