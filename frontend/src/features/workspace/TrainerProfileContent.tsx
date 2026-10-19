import { useCallback, useState } from 'react'
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
      <section className="surface-card profile-section trainer-professional-section" aria-labelledby="professional-title">
        <h2 id="professional-title">Perfil profesional</h2>
        <div className="profile-read-grid">
          <ProfileField label="Nombre" value={profile.firstName}/>
          <ProfileField label="Apellido" value={profile.lastName}/>
          <ProfileField label="Especialidad" value={profile.trainerProfile?.specialty}/>
          <ProfileField label="Descripción" value={profile.trainerProfile?.description}/>
        </div>
        <p className="profile-help">El perfil profesional y las sedes los modifica la administración.</p>
      </section>
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
