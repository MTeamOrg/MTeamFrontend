export function LoadingState({ message = 'Cargando datos…' }: { message?: string }) {
  return <div className="empty-state" role="status"><p>{message}</p></div>
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="empty-state" role="alert"><h3>No se pudieron cargar los datos</h3><p>{message}</p>{retry && <button className="button button-secondary" onClick={retry}>Reintentar</button>}</div>
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state"><p>{message}</p></div>
}

export function UnavailableState({ module }: { module: string }) {
  return <section className="surface-card"><div className="empty-state"><h2>{module} no disponible</h2><p>El backend actual todavía no expone una API implementada para este módulo. No se muestran datos simulados.</p></div></section>
}
