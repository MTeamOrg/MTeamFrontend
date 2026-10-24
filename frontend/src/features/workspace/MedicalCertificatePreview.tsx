import { useCallback } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi } from '../../service/backend-api'
import { ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { MedicalCertificateFileButton } from './MedicalCertificateFileButton'

export function MedicalCertificatePreview({ id }: { id: string }) {
  const loader = useCallback(() => backendApi.getMedicalCertificateFile(id), [id])
  const { data, loading, error, reload } = useApiResource(loader)

  return <section className="surface-card medical-preview-card" aria-label="Vista previa del certificado">
    <div className="medical-preview-heading">
      <h2>Documento de apto médico</h2>
      <MedicalCertificateFileButton id={id} label="Abrir en pestaña" signedUrl={data?.signedUrl}/>
    </div>
    <div className="medical-preview-canvas">
      {loading && <LoadingState message="Cargando vista previa…"/>}
      {!loading && error && <ErrorState message={error} retry={() => void reload()}/>}
      {!loading && !error && data?.signedUrl && <iframe src={data.signedUrl} title="Vista previa del certificado" referrerPolicy="no-referrer"/>}
      {!loading && !error && !data?.signedUrl && <div className="medical-preview-message"><Icon name="file" size={48}/><p>No se pudo obtener una vista previa del documento.</p><button type="button" className="button button-secondary" onClick={() => void reload()}>Reintentar</button></div>}
    </div>
    {!loading && !error && data?.signedUrl && <p className="medical-preview-help">Si el formato no se puede previsualizar, abrilo en una pestaña nueva.</p>}
  </section>
}
