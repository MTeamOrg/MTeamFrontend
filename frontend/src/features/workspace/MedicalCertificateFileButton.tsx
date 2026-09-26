import { useState } from 'react'
import { backendApi } from '../../service/backend-api'
import { Icon } from './Icon'

export function MedicalCertificateFileButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function openFile() {
    setError('')
    const tab = window.open('about:blank', '_blank')
    if (!tab) {
      setError('Permití abrir una pestaña nueva para ver el documento.')
      return
    }
    tab.opener = null
    setLoading(true)
    try {
      const { signedUrl } = await backendApi.getMedicalCertificateFile(id)
      if (!signedUrl) throw new Error('No se pudo obtener el acceso temporal al documento.')
      tab.location.href = signedUrl
    } catch (value) {
      tab.close()
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
