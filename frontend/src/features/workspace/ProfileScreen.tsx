import { useCallback, useState, type FormEvent } from 'react'
import type { UserRole } from '../authentication/auth-types'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type OwnProfile } from '../../service/backend-api'
import { formatDate } from '../../service/date-time'
import { ErrorState, LoadingState } from './ApiStates'
import { PageHeader } from './PageHeader'

export function ProfileScreen({ role, onPasswordChange }: { role: UserRole; onPasswordChange: () => void }) {
  const loader = useCallback(() => backendApi.getOwnProfile(), [])
  const { data, loading, error, reload, setData } = useApiResource(loader)
  return <div className="app-page">
    <PageHeader title="Mi perfil" description="Consultá tus datos y actualizá tu información de contacto."/>
    {loading
      ? <div className="app-card"><LoadingState/></div>
      : error || !data
        ? <div className="app-card"><ErrorState message={error || 'No se pudo cargar el perfil.'} retry={() => void reload()}/></div>
        : <ProfileForm key={data.id} profile={data} role={role} onPasswordChange={onPasswordChange} onUpdated={setData}/>}
  </div>
}

function ProfileForm({ profile, role, onPasswordChange, onUpdated }: { profile: OwnProfile; role: UserRole; onPasswordChange: () => void; onUpdated: (profile: OwnProfile) => void }) {
  const [email, setEmail] = useState(profile.email)
  const [phone, setPhone] = useState(profile.phone)
  const [emergencyName, setEmergencyName] = useState(profile.memberProfile?.emergencyContactName ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(profile.memberProfile?.emergencyContactPhone ?? '')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    setError('')
    try {
      const updated = await backendApi.updateOwnProfile({
        email,
        phone,
        ...(role === 'MEMBER' ? {
          emergencyContactName: emergencyName,
          emergencyContactPhone: emergencyPhone,
        } : {}),
      })
      onUpdated(updated)
      setNotice('Perfil actualizado correctamente.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo actualizar el perfil.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="surface-card profile-card"><div className="profile-head"><span className="profile-avatar">{profile.firstName[0]}{profile.lastName[0]}</span><div><h2>{profile.firstName} {profile.lastName}</h2><p>{role === 'TRAINER' ? 'Entrenador' : role === 'ADMIN' ? 'Administrador' : 'Socio M-TEAM'}</p></div></div><form onSubmit={submit}><div className="profile-fields"><Field label="Nombre y apellido" value={`${profile.firstName} ${profile.lastName}`} readOnly/><Field label="Documento" value={profile.documentNumber} readOnly/><Field label="Fecha de nacimiento" value={formatDate(profile.birthDate)} readOnly/><Field label="Correo electrónico" value={email} onChange={setEmail}/><Field label="Teléfono" value={phone} onChange={setPhone}/>{role === 'MEMBER' && <><Field label="Contacto de emergencia" value={emergencyName} onChange={setEmergencyName}/><Field label="Teléfono de emergencia" value={emergencyPhone} onChange={setEmergencyPhone}/></>}{role === 'TRAINER' && <><Field label="Especialidad" value={profile.trainerProfile?.specialty ?? 'Sin informar'} readOnly/><Field label="Descripción" value={profile.trainerProfile?.description ?? 'Sin informar'} readOnly/></>}</div>{notice && <p className="success-message" role="status">{notice}</p>}{error && <p className="error-message" role="alert">{error}</p>}<div className="profile-actions"><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button><button type="button" className="button button-secondary" onClick={onPasswordChange}>Cambiar contraseña</button></div></form></section>
}

function Field({ label, value, onChange, readOnly = false }: { label: string; value: string; onChange?: (value: string) => void; readOnly?: boolean }) {
  return <label className="read-field"><span>{label}</span><input readOnly={readOnly} value={value} onChange={(event) => onChange?.(event.target.value)}/></label>
}
