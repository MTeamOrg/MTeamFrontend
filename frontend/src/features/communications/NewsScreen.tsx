import { useCallback, useState } from 'react'
import { backendApi, type NewsPost, type PublicationAudience, type PublicationStatus } from '../../service/backend-api'
import { formatDate } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import { SafeImage } from '../workspace/SafeImage'
import './communications.css'

const EMPTY_FORM = { title: '', content: '', imageUrl: '', audience: 'ALL' as PublicationAudience }

export function NewsScreen({ isAdmin = false }: { isAdmin?: boolean }) {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<PublicationStatus | ''>('')
  const [editing, setEditing] = useState<NewsPost | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const loader = useCallback(() => backendApi.listNewsPosts({ page, limit: 12, ...(status ? { status } : {}) }), [page, status])
  const { data, loading, error, reload } = useApiResource(loader)

  function startCreate() { setEditing(null); setFormOpen(true); setForm(EMPTY_FORM); setFormError('') }
  function startEdit(post: NewsPost) { setEditing(post); setFormOpen(true); setForm({ title: post.title, content: post.content, imageUrl: post.imageUrl ?? '', audience: post.audience }); setFormError('') }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError(''); setSaving(true)
    try {
      const body = { ...form, imageUrl: form.imageUrl || null }
      if (editing) await backendApi.updateNewsPost(editing.id, body)
      else await backendApi.createNewsPost({ ...body, status: 'DRAFT' })
      setFormOpen(false); setEditing(null); setForm(EMPTY_FORM); await reload()
    } catch (value) { setFormError(value instanceof Error ? value.message : 'No se pudo guardar la novedad.') } finally { setSaving(false) }
  }

  async function changeStatus(post: NewsPost, nextStatus: 'PUBLISHED' | 'INACTIVE') {
    const question = nextStatus === 'INACTIVE' ? '¿Querés desactivar esta novedad?' : '¿Querés publicar esta novedad?'
    if (!window.confirm(question)) return
    try { await backendApi.updateNewsPostStatus(post.id, nextStatus); await reload() } catch (value) { setFormError(value instanceof Error ? value.message : 'No se pudo actualizar la novedad.') }
  }

  return <div className="app-page communications-page">
    <PageHeader title="Novedades" description={isAdmin ? 'Administrá las comunicaciones y su audiencia.' : 'Información y comunicaciones de M-Team.'}>{isAdmin && <button type="button" className="button button-primary" onClick={startCreate}><Icon name="plus" size={17}/>Nueva novedad</button>}</PageHeader>
    {isAdmin && <div className="communications-toolbar"><label>Estado<select value={status} onChange={(event) => { setStatus(event.target.value as PublicationStatus | ''); setPage(1) }}><option value="">Todas</option><option value="DRAFT">Borradores</option><option value="PUBLISHED">Publicadas</option><option value="INACTIVE">Desactivadas</option></select></label></div>}
    {isAdmin && formOpen && <NewsForm editing={editing} form={form} error={formError} saving={saving} onChange={setForm} onCancel={() => setFormOpen(false)} onSubmit={save}/>}
    {isAdmin && !formOpen && formError && <p className="error-message" role="alert">{formError}</p>}
    {!isAdmin && formError && <p className="error-message" role="alert">{formError}</p>}
    {loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message={isAdmin ? 'No hay novedades para los filtros seleccionados.' : 'No hay novedades publicadas para mostrar.'}/> : <div className="news-list communication-news-list">{data.items.map((post) => <NewsCard key={post.id} post={post} isAdmin={isAdmin} onEdit={startEdit} onStatus={changeStatus}/>)}</div>}
    {data && <div className="table-pagination"><span>{data.total} publicación{data.total === 1 ? '' : 'es'}</span>{data.total > data.limit && <div><button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button></div>}</div>}
  </div>
}

function NewsForm({ editing, form, error, saving, onChange, onCancel, onSubmit }: { editing: NewsPost | null; form: typeof EMPTY_FORM; error: string; saving: boolean; onChange: (value: typeof EMPTY_FORM) => void; onCancel: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <form className="surface-card communication-form" onSubmit={onSubmit}><h2>{editing ? 'Editar novedad' : 'Nueva novedad'}</h2><div className="communication-form-grid"><label>Título<input required maxLength={200} value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })}/></label><label>Audiencia<select value={form.audience} onChange={(event) => onChange({ ...form, audience: event.target.value as PublicationAudience })}><option value="ALL">Todos</option><option value="MEMBERS">Solo socios</option><option value="TRAINERS">Solo entrenadores</option></select></label><label>Imagen (URL)<input type="url" value={form.imageUrl} onChange={(event) => onChange({ ...form, imageUrl: event.target.value })}/></label><label className="communication-form-wide">Contenido<textarea required value={form.content} onChange={(event) => onChange({ ...form, content: event.target.value })}/></label></div>{error && <p className="error-message" role="alert">{error}</p>}<div className="communication-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar borrador'}</button></div></form>
}

function NewsCard({ post, isAdmin, onEdit, onStatus }: { post: NewsPost; isAdmin: boolean; onEdit: (post: NewsPost) => void; onStatus: (post: NewsPost, status: 'PUBLISHED' | 'INACTIVE') => void }) {
  const audience = post.audience === 'ALL' ? 'Todos' : post.audience === 'MEMBERS' ? 'Socios' : 'Entrenadores'
  return <article className="news-card communication-news-card">{post.imageUrl ? <SafeImage className="communication-news-image" src={post.imageUrl} alt={`Imagen de ${post.title}`} fallbackIcon="megaphone"/> : <div className="communication-news-image media-placeholder"><Icon name="megaphone" size={25}/></div>}<div className="communication-news-content"><div className="communication-card-meta"><span className={`badge ${post.status === 'PUBLISHED' ? 'badge-info' : post.status === 'INACTIVE' ? 'badge-neutral' : 'badge-secondary'}`}>{post.status === 'PUBLISHED' ? 'Publicada' : post.status === 'INACTIVE' ? 'Desactivada' : 'Borrador'}</span><span className="badge badge-neutral">{audience}</span></div><h2>{post.title}</h2><p>{post.content}</p><time>{formatDate(post.publishedAt)}</time>{isAdmin && <div className="communication-actions"><button type="button" className="button button-secondary" onClick={() => onEdit(post)}><Icon name="edit" size={16}/>Editar</button>{post.status === 'DRAFT' && <button type="button" className="button button-primary" onClick={() => onStatus(post, 'PUBLISHED')}>Publicar</button>}{post.status === 'PUBLISHED' && <button type="button" className="button button-danger" onClick={() => onStatus(post, 'INACTIVE')}>Desactivar</button>}</div>}</div></article>
}
