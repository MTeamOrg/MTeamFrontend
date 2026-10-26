import { useState } from 'react'

export function UserAvatar({ firstName, lastName, photoUrl, className = '' }: {
  firstName: string
  lastName: string
  photoUrl?: string | null
  className?: string
}) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null)
  const fullName = `${firstName} ${lastName}`
  return <span className={`app-avatar user-avatar ${className}`}>
    {photoUrl && failedPhotoUrl !== photoUrl
      ? <img src={photoUrl} alt={`Foto de perfil de ${fullName}`} onError={() => setFailedPhotoUrl(photoUrl)}/>
      : <span role="img" aria-label={`Iniciales de ${fullName}`}>{firstName.slice(0, 1)}{lastName.slice(0, 1)}</span>}
  </span>
}
