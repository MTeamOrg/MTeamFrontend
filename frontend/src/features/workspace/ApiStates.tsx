import { Icon } from './Icon'
import { PageHeader } from './PageHeader'

export function LoadingState({ message = 'Cargando datos…' }: { message?: string }) {
  return <div className="empty-state" role="status"><p>{message}</p></div>
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="empty-state" role="alert"><h3>No se pudieron cargar los datos</h3><p>{message}</p>{retry && <button type="button" className="button button-secondary" onClick={retry}>Reintentar</button>}</div>
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state"><p>{message}</p></div>
}

export function UnavailableState({ module }: { module: string }) {
  return <section className="app-card unavailable-card">
    <span className="unavailable-icon" aria-hidden="true"><Icon name="info" size={20}/></span>
    <h2>{module} no disponible</h2>
    <p>El backend actual todavía no expone una API implementada para este módulo. No se muestran datos simulados.</p>
  </section>
}

export function UnavailableScreen({ title, module }: { title: string; module: string }) {
  return <div className="app-page">
    <PageHeader title={title}/>
    <UnavailableState module={module}/>
  </div>
}
