import { useCallback, useState, type FormEvent } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { backendApi, type OwnProfile } from '../../service/backend-api'
import { ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { ContactDataCard, ProfileIdentityCard, SecurityCard } from './ProfileEditorCards'

interface TrainerProfileContentProps {
  profile: OwnProfile
  onUpdated: (profile: OwnProfile) => void
  onPasswordChange: () => void
}

export function TrainerProfileContent({ profile, onUpdated, onPasswordChange }: TrainerProfileContentProps) {
  const isMobile = useIsMobile()
  const [isEditing, setIsEditing] = useState(false)
  return <div className="profile-layout trainer-profile-layout">
    <div className="profile-primary">
      <TrainerProfessionalCard profile={profile} onUpdated={onUpdated}/>
      {!isMobile || isEditing
        ? <ContactDataCard profile={profile} role="TRAINER" onUpdated={onUpdated} onCancel={() => setIsEditing(false)}/>
        : <section className="surface-card profile-section profile-contact-section" aria-labelledby="contact-title">
          <h2 id="contact-title">Datos de contacto</h2>
          <div className="profile-read-grid"><ProfileField label="Correo" value={profile.email}/><ProfileField label="Teléfono" value={profile.phone}/></div>
        </section>}
    </div>
    <aside className="profile-secondary">
      <ProfileIdentityCard profile={profile} role="TRAINER" onUpdated={onUpdated}/>
      <TrainerBranchesCard userId={profile.id}/>
      <SecurityCard onPasswordChange={onPasswordChange}/>
    </aside>
    {isMobile && !isEditing && <button type="button" className="button button-secondary trainer-edit-contact" onClick={() => setIsEditing(true)}><Icon name="edit" size={18}/>Editar mi perfil</button>}
  </div>
}

function ProfileField({ label, value }: { label: string; value?: string }) {
  return <div className="profile-read-field"><span>{label}</span><strong>{value || 'No informado'}</strong></div>
}

function TrainerBranchesCard({ userId }: { userId: string }) {
  const branches = useApiResource(useCallback(async () => {
    let page = 1
    while (true) {
      const trainers = await backendApi.listTrainers(page, 100)
      const trainer = trainers.items.find((item) => item.id === userId)
      if (trainer) return trainer.branches ?? null
      if (page * trainers.limit >= trainers.total || !trainers.items.length) return null
      page += 1
    }
  }, [userId]))
  return <section className="surface-card profile-section trainer-branches-section" aria-labelledby="trainer-branches-title">
    <h2 id="trainer-branches-title">Sedes donde trabajás</h2>
    {branches.loading ? <LoadingState message="Cargando tus sedes…"/>
      : branches.error ? <ErrorState message={branches.error} retry={() => void branches.reload()}/>
        : branches.data === null ? <p>No hay información disponible sobre tus sedes asignadas.</p>
          : !branches.data.length ? <p>No hay sedes activas asignadas para mostrar.</p>
            : <ul className="trainer-profile-branches">{branches.data.map((branch) => <li key={branch.id}>
              <div><h3>{branch.name}</h3><p>{branch.address || 'Dirección no informada'}</p></div><span className="badge badge-info">Activa</span>
            </li>)}</ul>}
    <p className="profile-help">Las sedes las asigna un administrador. Solo se muestran las sedes activas disponibles en el directorio.</p>
  </section>
}

function TrainerProfessionalCard({ profile, onUpdated }: Pick<TrainerProfileContentProps, 'profile' | 'onUpdated'>) {
  const [isEditing, setIsEditing] = useState(false)
  const [specialty, setSpecialty] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function startEditing() {
    setSpecialty(profile.trainerProfile?.specialty ?? '')
    setDescription(profile.trainerProfile?.description ?? '')
    setError('')
    setNotice('')
    setIsEditing(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!specialty.trim() || !description.trim()) {
      setError('Completá la especialidad y la descripción.')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const updated = await backendApi.updateOwnProfile({ specialty: specialty.trim(), description: description.trim() })
      onUpdated(updated)
      setIsEditing(false)
      setNotice('Perfil profesional actualizado correctamente.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo guardar el perfil profesional.')
    } finally {
      setIsSaving(false)
    }
  }

  return <section className="surface-card profile-section trainer-professional-section" aria-labelledby="professional-title">
    <h2 id="professional-title">Perfil profesional</h2>
    {isEditing ? <form onSubmit={submit} aria-label="Editar perfil profesional" aria-busy={isSaving}>
      <fieldset className="trainer-professional-fields" disabled={isSaving}>
        <label className="read-field"><span>Especialidad</span><input required maxLength={150} value={specialty} onChange={(event) => setSpecialty(event.target.value)}/></label>
        <label className="read-field"><span>Descripción</span><textarea required rows={5} value={description} onChange={(event) => setDescription(event.target.value)}/></label>
        <div className="profile-form-actions">
          <button type="button" className="button button-secondary" onClick={() => { setIsEditing(false); setError('') }}>Cancelar</button>
          <button className="button button-primary">{isSaving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </fieldset>
    </form> : <>
      <div className="profile-read-grid">
        <ProfileField label="Nombre" value={profile.firstName}/>
        <ProfileField label="Apellido" value={profile.lastName}/>
        <ProfileField label="Especialidad" value={profile.trainerProfile?.specialty}/>
        <ProfileField label="Descripción" value={profile.trainerProfile?.description}/>
      </div>
      <button type="button" className="button button-secondary" onClick={startEditing}><Icon name="edit" size={18}/>Editar perfil profesional</button>
    </>}
    {notice && <p className="success-message" role="status">{notice}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}
