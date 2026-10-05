import { useCallback, useMemo } from 'react'
import { backendApi, type NewsPost } from '../../service/backend-api'
import { formatDate } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { PageHeader } from '../workspace/PageHeader'
import { SafeImage } from '../workspace/SafeImage'
import './communications-viewer.css'

function formatNewsDate(value: string | null) {
  return value ? formatDate(value) : 'Sin fecha'
}

function NewsViewerCard({ post }: { post: NewsPost }) {
  return <article className="viewer-news-card">
    <SafeImage src={post.imageUrl} alt="" className="viewer-news-icon" fallbackIcon="megaphone" />
    <div className="viewer-news-content"><h2>{post.title}</h2><p>{post.content}</p></div>
    <time dateTime={post.publishedAt ?? undefined}>{formatNewsDate(post.publishedAt)}</time>
  </article>
}

export function NewsViewer() {
  const loader = useCallback(() => backendApi.listNewsPosts({ page: 1, limit: 50 }), [])
  const { data, loading, error, reload } = useApiResource(loader)
  const visiblePosts = useMemo(() => (data?.items ?? []).filter((post) => post.status === 'PUBLISHED'), [data?.items])

  return <div className="app-page communication-viewer-page viewer-news-screen">
    <PageHeader title="Novedades" description="Cambios de horario, feriados y comunicaciones de M-TEAM." />
    {loading ? <LoadingState message="Cargando novedades…" /> : error ? <ErrorState message={error} retry={() => void reload()} /> : !visiblePosts.length ? <EmptyState message="No hay novedades disponibles para mostrar." /> : <section className="viewer-news-list" aria-label="Novedades disponibles">{visiblePosts.map((post) => <NewsViewerCard key={post.id} post={post} />)}</section>}
  </div>
}
