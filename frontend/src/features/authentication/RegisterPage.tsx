import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../../service/api-client'
import { AuthLayout } from './AuthLayout'
import { PasswordField } from './PasswordField'
import { authService } from './auth-service'
import type { RegisterInput } from './auth-types'
import { useAuth } from './use-auth'

const initialForm: RegisterInput = { firstName: '', lastName: '', documentNumber: '', birthDate: '', email: '', phone: '', password: '' }

export function RegisterPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  if (session) return <Navigate to="/inicio" replace />

  function updateField(field: keyof RegisterInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      await authService.register(form)
      navigate('/iniciar-sesion', { replace: true, state: { accountCreated: true } })
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'No fue posible crear la cuenta.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="auth-heading compact-heading"><span className="eyebrow">SUMATE A M-TEAM</span><h2>Crear cuenta</h2><p>Completá tus datos para comenzar.</p></div>
      <form className="auth-card register-card" onSubmit={handleSubmit}>
        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="field-grid">
          <label className="field"><span>Nombre</span><input value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} required /></label>
          <label className="field"><span>Apellido</span><input value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} required /></label>
          <label className="field"><span>DNI</span><input inputMode="numeric" value={form.documentNumber} onChange={(event) => updateField('documentNumber', event.target.value)} required /></label>
          <label className="field"><span>Fecha de nacimiento</span><input type="date" value={form.birthDate} onChange={(event) => updateField('birthDate', event.target.value)} required /></label>
        </div>
        <label className="field"><span>Correo electrónico</span><input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} autoComplete="email" required /></label>
        <label className="field"><span>Teléfono</span><input type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} autoComplete="tel" required /></label>
        <PasswordField label="Contraseña" value={form.password} onChange={(event) => updateField('password', event.target.value)} autoComplete="new-password" minLength={8} required />
        <PasswordField label="Confirmar contraseña" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required />
        <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}</button>
        <p className="form-footer">¿Ya tenés cuenta? <Link to="/iniciar-sesion">Iniciar sesión</Link></p>
      </form>
    </AuthLayout>
  )
}
