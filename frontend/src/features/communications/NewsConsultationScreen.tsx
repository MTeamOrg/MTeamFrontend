import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { backendApi, type NewsPost } from '../../service/backend-api'
import { formatDateTime } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { useAuth } from '../authentication/use-auth'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import { hrefFor } from '../workspace/navigation'
import './news-consultation.css'

export function NewsConsultationScreen() {
  const { session } = useAuth()
  const [page, setPage] = useState(1)
  // Audience and publication visibility are enforced by the authenticated API.
  const loader = useCallback(() => backendApi.listNewsPosts({ page, limit: 12 }), [page])
  const { data, loading: isLoading, error, reload } = useApiResource(loader)
  const role = session?.user.role

  return <div className="app-page news-consultation-page">
    <PageHeader title="Novedades" description="Comunicaciones internas de M-TEAM para el equipo y los socios."/>
    {(role === 'MEMBER' || role === 'TRAINER') && <nav className="news-section-switcher" aria-label="Comunicaciones">
      <Link to={hrefFor(role, 'novedades')} aria-current="page">Novedades</Link>
      <Link to={hrefFor(role, 'eventos')}>Eventos</Link>
    </nav>}
    {isLoading ? <LoadingState message="Cargando novedades…"/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No hay novedades publicadas para mostrar."/> : <>
      <div className="news-consultation-list">{data.items.map((post) => <ConsultationNewsCard key={post.id} post={post}/>)}</div>
      {data.total > data.limit && <nav className="table-pagination news-pagination" aria-label="Páginas de novedades">
        <span>Página {data.page} de {Math.ceil(data.total / data.limit)}</span>
        <div><button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button></div>
      </nav>}
    </>}
  </div>
}

function ConsultationNewsCard({ post }: { post: NewsPost }) {
  return <article className="news-consultation-card">
    <span className="news-consultation-icon" aria-hidden="true"><Icon name="megaphone" size={22}/></span>
    <div className="news-consultation-body">
      <div className="news-consultation-heading"><h2>{post.title}</h2>{post.publishedAt ? <time dateTime={post.publishedAt} title={formatDateTime(post.publishedAt)}>{formatDateTime(post.publishedAt).split(' ')[0]}</time> : <span className="news-publication-date">Fecha no informada</span>}</div>
      <p>{post.content}</p>
    </div>
  </article>
}
