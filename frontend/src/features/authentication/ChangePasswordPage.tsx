import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../service/api-client'
import { AuthLayout } from './AuthLayout'
import { PasswordField } from './PasswordField'
import { useAuth } from './use-auth'

export function ChangePasswordPage({ optional = false }: { optional?: boolean }) {
  const { session, changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword !== confirmation) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      await changePassword({ currentPassword, newPassword })
      const roleHome = session?.user.role === 'ADMIN' ? '/admin' : session?.user.role === 'TRAINER' ? '/entrenador' : '/socio'
      navigate(roleHome, { replace: true })
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'No fue posible cambiar la contraseña.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="auth-heading"><span className="eyebrow">SEGURIDAD DE LA CUENTA</span><h2>{optional?'Cambiar contraseña':'Creá una nueva contraseña'}</h2><p>{optional?'Ingresá tu contraseña actual y elegí una nueva.':'Antes de continuar, reemplazá la contraseña temporal.'}</p></div>
      <form className="auth-card" onSubmit={handleSubmit}>
        {error && <div className="error-message" role="alert">{error}</div>}
        <PasswordField label="Contraseña actual" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
        <PasswordField label="Nueva contraseña" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
        <PasswordField label="Confirmar nueva contraseña" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required />
        <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Guardar contraseña'}</button>
        <button className="secondary-button" type="button" onClick={() => void logout()}>Cerrar sesión</button>
      </form>
    </AuthLayout>
  )
}
