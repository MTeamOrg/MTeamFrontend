import { useState } from 'react'
import { backendApi } from '../../service/backend-api'
import { Icon } from './Icon'

export function MedicalCertificateFileButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function openFile() {
    setLoading(true)
    setError('')
    try {
      const { signedUrl } = await backendApi.getMedicalCertificateFile(id)
      const openedWindow = window.open(signedUrl, '_blank', 'noopener,noreferrer')
      if (!openedWindow) setError('No se pudo abrir la URL temporal del archivo.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo abrir el documento.')
    } finally {
      setLoading(false)
    }
  }

  return <span className="medical-file-link">
    <button type="button" className="button button-secondary" onClick={() => void openFile()} disabled={loading}>
      <Icon name="eye" size={16}/>{loading ? 'Abriendo…' : compact ? 'Ver archivo' : 'Ver documento'}
    </button>
    {error && <small className="error-message" role="alert">{error}</small>}
  </span>
}
