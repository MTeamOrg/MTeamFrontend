import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ActionButton } from '../../components/ActionButton'
import { useDelayedLoading } from '../../hooks/use-delayed-loading'
import type { UserRole } from '../authentication/auth-types'
import { backendApi, type OwnProfile } from '../../service/backend-api'
import { Icon } from './Icon'
import { UserAvatar } from './UserAvatar'
const EMAIL_PATTERN = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/
const PHONE_PATTERN = /^(?:[1-9][0-9]{9}|\+54(?:9)?[1-9][0-9]{9})$/

function isValidPhone(value: string) {
  return /^[+0-9 ()-]+$/.test(value) && PHONE_PATTERN.test(value.replace(/[ ()-]/g, ''))
}

export function ContactDataCard({ profile, role, onUpdated, onCancel }: { profile: OwnProfile; role: UserRole; onUpdated: (profile: OwnProfile) => void; onCancel?: () => void }) {
  const [email, setEmail] = useState(profile.email)
  const [phone, setPhone] = useState(profile.phone)
  const [emergencyName, setEmergencyName] = useState(profile.memberProfile?.emergencyContactName ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(profile.memberProfile?.emergencyContactPhone ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (isSaving) return
    setNotice('')
    setError('')
    const errors: Record<string, string> = {}
    if (email.trim().length > 255 || !EMAIL_PATTERN.test(email.trim())) errors.email = 'Ingresá un correo completo con un dominio válido, por ejemplo nombre@ejemplo.com.'
    if (phone.trim().length > 30 || !isValidPhone(phone.trim())) errors.phone = 'Ingresá 10 dígitos o +54 (opcionalmente 9) seguido de 10 dígitos, sin letras.'
    if (role === 'MEMBER') {
      if (!emergencyName.trim() || emergencyName.trim().length > 200) errors.emergencyName = 'Ingresá el nombre del contacto de emergencia (hasta 200 caracteres).'
      if (emergencyPhone.trim().length > 30 || !isValidPhone(emergencyPhone.trim())) errors.emergencyPhone = 'Ingresá un teléfono de emergencia válido: 10 dígitos o +54 (opcionalmente 9) seguido de 10 dígitos.'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setIsSaving(true)
    try {
      const updated = await backendApi.updateOwnProfile({
        email: email.trim(),
        phone: phone.trim(),
        ...(role === 'MEMBER' ? { emergencyContactName: emergencyName.trim(), emergencyContactPhone: emergencyPhone.trim() } : {}),
      })
      onUpdated(updated)
      setNotice('Cambios guardados correctamente.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudieron guardar los cambios.')
    } finally {
      setIsSaving(false)
    }
  }

  function cancel() {
    setEmail(profile.email)
    setPhone(profile.phone)
    setEmergencyName(profile.memberProfile?.emergencyContactName ?? '')
    setEmergencyPhone(profile.memberProfile?.emergencyContactPhone ?? '')
    setNotice('')
    setError('')
    setFieldErrors({})
    onCancel?.()
  }

  return <section className="surface-card profile-section profile-contact-section" aria-labelledby="contact-data-title">
    <h2 id="contact-data-title">Datos de contacto</h2>
    <form onSubmit={submit} noValidate>
      <div className="profile-edit-grid">
        <EditableField label="Correo electrónico" error={fieldErrors.email} value={email} type="email" onChange={setEmail}/>
        <EditableField label="Teléfono" error={fieldErrors.phone} value={phone} type="tel" onChange={setPhone}/>
      </div>
      {role === 'MEMBER' && <div className="profile-emergency-block"><h3>Contacto de emergencia</h3><div className="profile-edit-grid"><EditableField label="Nombre y apellido" error={fieldErrors.emergencyName} value={emergencyName} onChange={setEmergencyName}/><EditableField label="Teléfono" error={fieldErrors.emergencyPhone} value={emergencyPhone} type="tel" onChange={setEmergencyPhone}/></div></div>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="profile-form-actions">
        <button type="button" className="button button-secondary" onClick={cancel}>Cancelar</button>
        <ActionButton type="submit" className="button button-primary" isLoading={isSaving} loadingLabel="Guardando…">Guardar cambios</ActionButton>
      </div>
      {role === 'MEMBER' && <Link className="button button-secondary profile-mobile-medical-button" to="/socio/apto-medico"><Icon name="file" size={18}/>Apto médico</Link>}
    </form>
  </section>
}

export function ProfileIdentityCard({ profile, role, onUpdated }: { profile: OwnProfile; role: UserRole; onUpdated: (profile: OwnProfile) => void }) {
  const [photoSaving, setPhotoSaving] = useState(false)
  const [error, setError] = useState('')
  const showPhotoLoadingFeedback = useDelayedLoading(photoSaving)

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('La foto debe estar en formato JPG o PNG.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La foto no puede superar los 5 MB.')
      return
    }
    setPhotoSaving(true)
    try {
      onUpdated(await backendApi.updateOwnPhoto(file))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo actualizar la foto de perfil.')
    } finally {
      setPhotoSaving(false)
    }
  }

  return <section className="surface-card profile-section profile-identity-section" aria-label="Resumen del perfil">
    <div className="profile-identity-avatar"><UserAvatar {...profile} className="profile-photo"/></div>
    <h2>{profile.firstName} {profile.lastName}</h2>
    {role === 'TRAINER' && <p className="trainer-profile-specialty">{profile.trainerProfile?.specialty || 'Especialidad no informada'}</p>}
    <span className="member-status">{role === 'MEMBER' ? 'Socio' : role === 'TRAINER' ? 'Entrenador' : 'Administrador'} · Cuenta {profile.status === 'ACTIVE' ? 'activa' : 'inactiva'}</span>
    <label className={`button button-secondary profile-photo-action${photoSaving ? ' action-button' : ''}`} htmlFor="profile-photo" aria-busy={photoSaving || undefined} aria-disabled={photoSaving || undefined}>{showPhotoLoadingFeedback ? <><span className="action-spinner" aria-hidden="true"/>Subiendo…</> : <><Icon name="image" size={18}/>Cambiar fotografía</>}</label>
    <input id="profile-photo" className="sr-only" type="file" accept="image/jpeg,image/png" onChange={changePhoto} disabled={photoSaving}/>
    <small className="field-hint">JPG o PNG · máximo 5 MB</small>
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}

export function SecurityCard({ onPasswordChange }: { onPasswordChange: () => void }) {
  return <section className="surface-card profile-section profile-security-section" aria-labelledby="security-title">
    <h2 id="security-title">Seguridad</h2>
    <p>Protegé tu cuenta con una contraseña segura.</p>
    <button type="button" className="button button-secondary" onClick={onPasswordChange}><Icon name="lock" size={18}/>Cambiar contraseña</button>
  </section>
}

function EditableField({ label, value, type = 'text', onChange, error }: { label: string; value: string; type?: string; onChange: (value: string) => void; error?: string }) {
  const errorId = useId()
  return <label className="read-field"><span>{label}</span><input type={type} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)}/>{error && <span id={errorId} className="error-message" role="alert">{error}</span>}</label>
}
