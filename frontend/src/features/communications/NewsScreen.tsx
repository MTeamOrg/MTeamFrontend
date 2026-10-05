import { useCallback, useState, type FormEvent } from 'react'
import { backendApi, type NewsPost, type PublicationAudience, type PublicationStatus } from '../../service/backend-api'
import { useApiResource } from '../../hooks/use-api-resource'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import { NewsViewer } from './NewsViewer'
import './communications.css'

const EMPTY_FORM = { title: '', content: '', audience: 'ALL' as PublicationAudience }

function audienceLabel(audience: PublicationAudience) { return audience === 'ALL' ? 'Todos' : audience === 'MEMBERS' ? 'Socios' : 'Entrenadores' }
function formatPublishedDate(value: string | null) { if (!value) return '—'; const parts = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date(value)); const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''; return `${get('day')}/${get('month')}/${get('year')}` }

export function NewsScreen({ isAdmin = false }: { isAdmin?: boolean }) {
  return isAdmin ? <AdminNewsScreen /> : <NewsViewer />
}

function AdminNewsScreen() {
  const isAdmin = true
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [audience, setAudience] = useState<PublicationAudience | ''>('')
  const [status, setStatus] = useState<PublicationStatus | ''>('')
  const [editing, setEditing] = useState<NewsPost | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const loader = useCallback(() => backendApi.listNewsPosts({ search: search.trim() || undefined, audience: audience || undefined, status: status || undefined, page, limit: 20 }), [audience, page, search, status])
  const { data, loading, error, reload } = useApiResource(loader)

  function resetPage(action: () => void) { setPage(1); action() }
  function startCreate() { setEditing(null); setForm(EMPTY_FORM); setFormError('') }
  function startEdit(post: NewsPost) { setEditing(post); setForm({ title: post.title, content: post.content, audience: post.audience }); setFormError('') }

  async function save(event: FormEvent<HTMLFormElement>, nextStatus: 'DRAFT' | 'PUBLISHED') {
    event.preventDefault(); setFormError(''); setSaving(true)
    try {
      if (editing) {
        await backendApi.updateNewsPost(editing.id, { ...form, imageUrl: editing.imageUrl })
        if (editing.status === 'DRAFT' && nextStatus === 'PUBLISHED') await backendApi.updateNewsPostStatus(editing.id, 'PUBLISHED')
      } else await backendApi.createNewsPost({ ...form, imageUrl: null, status: nextStatus })
      setEditing(null); setForm(EMPTY_FORM); await reload()
    } catch (value) { setFormError(value instanceof Error ? value.message : 'No se pudo guardar la novedad.') } finally { setSaving(false) }
  }

  async function changeStatus(post: NewsPost, nextStatus: 'PUBLISHED' | 'INACTIVE') {
    const question = nextStatus === 'INACTIVE' ? '¿Querés desactivar esta novedad?' : '¿Querés publicar esta novedad?'
    if (!window.confirm(question)) return
    try { await backendApi.updateNewsPostStatus(post.id, nextStatus); await reload() } catch (value) { setFormError(value instanceof Error ? value.message : 'No se pudo actualizar la novedad.') }
  }

  return <div className="app-page communications-page news-admin-screen">
    <PageHeader title="Novedades" description="Cada publicación puede dirigirse a todos, solo a socios o solo a entrenadores.">{isAdmin && <button type="button" className="button button-primary" onClick={startCreate}><Icon name="plus" size={20}/>Nueva novedad</button>}</PageHeader>
    {isAdmin && <div className="communications-toolbar" aria-label="Filtros de novedades"><label className="search-shell"><Icon name="search" size={19}/><input aria-label="Buscar novedad" placeholder="Buscar novedad" value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))}/></label><select aria-label="Filtrar novedades por audiencia" value={audience} onChange={(event) => resetPage(() => setAudience(event.target.value as PublicationAudience | ''))}><option value="">Audiencia: todas</option><option value="ALL">Todos</option><option value="MEMBERS">Socios</option><option value="TRAINERS">Entrenadores</option></select><select aria-label="Filtrar novedades por estado" value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as PublicationStatus | ''))}><option value="">Estado: todos</option><option value="DRAFT">Borradores</option><option value="PUBLISHED">Publicadas</option><option value="INACTIVE">Desactivadas</option></select></div>}
    {isAdmin && formError && <p className="error-message" role="alert">{formError}</p>}
    <div className={isAdmin ? 'news-admin-layout' : undefined}><section className="news-list-panel">{loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message={isAdmin ? 'No hay novedades para los filtros seleccionados.' : 'No hay novedades publicadas para mostrar.'}/> : <><div className="news-table-wrap"><table className="communications-table news-table"><thead><tr><th>Título</th><th>Audiencia</th><th>Publicada</th>{isAdmin && <th>Acciones</th>}</tr></thead><tbody>{data.items.map((post) => <NewsRow key={post.id} post={post} isAdmin={isAdmin} onEdit={startEdit} onStatus={changeStatus}/>)}</tbody></table></div><div className="news-mobile-list">{data.items.map((post) => <NewsMobileCard key={post.id} post={post} isAdmin={isAdmin} onEdit={startEdit} onStatus={changeStatus}/>)}</div></>}</section>{data && <div className="table-pagination news-pagination"><span>{data.total} publicación{data.total === 1 ? '' : 'es'}</span>{data.total > data.limit && <div><button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button></div>}</div>}{isAdmin && <NewsEditor editing={editing} form={form} error={formError} saving={saving} onChange={setForm} onReset={startCreate} onSubmit={save}/>}</div>
  </div>
}

function statusLabel(status: PublicationStatus) { return status === 'PUBLISHED' ? 'Publicada' : status === 'INACTIVE' ? 'Desactivada' : 'Borrador' }
function NewsActions({ post, isAdmin, onEdit, onStatus }: { post: NewsPost; isAdmin: boolean; onEdit: (post: NewsPost) => void; onStatus: (post: NewsPost, status: 'PUBLISHED' | 'INACTIVE') => void }) { if (!isAdmin) return null; return <div className="row-actions"><button type="button" className="button button-secondary" onClick={() => onEdit(post)}>Editar</button>{post.status === 'DRAFT' && <button type="button" className="button button-primary" onClick={() => onStatus(post, 'PUBLISHED')}>Publicar</button>}{post.status === 'PUBLISHED' && <button type="button" className="button button-danger" onClick={() => onStatus(post, 'INACTIVE')}>Desactivar</button>}</div> }
function NewsRow({ post, isAdmin, onEdit, onStatus }: { post: NewsPost; isAdmin: boolean; onEdit: (post: NewsPost) => void; onStatus: (post: NewsPost, status: 'PUBLISHED' | 'INACTIVE') => void }) { return <tr><td className="news-title-cell">{post.title}</td><td>{audienceLabel(post.audience)}</td><td>{formatPublishedDate(post.publishedAt)}</td>{isAdmin && <td><NewsActions post={post} isAdmin={isAdmin} onEdit={onEdit} onStatus={onStatus}/></td>}</tr> }
function NewsMobileCard({ post, isAdmin, onEdit, onStatus }: { post: NewsPost; isAdmin: boolean; onEdit: (post: NewsPost) => void; onStatus: (post: NewsPost, status: 'PUBLISHED' | 'INACTIVE') => void }) { return <article className="news-mobile-card"><div><h2>{post.title}</h2><p>{audienceLabel(post.audience)} · {formatPublishedDate(post.publishedAt)}</p></div><span className={`communication-status news-status-${post.status.toLowerCase()}`}>{statusLabel(post.status)}</span><NewsActions post={post} isAdmin={isAdmin} onEdit={onEdit} onStatus={onStatus}/></article> }

function NewsEditor({ editing, form, error, saving, onChange, onReset, onSubmit }: { editing: NewsPost | null; form: typeof EMPTY_FORM; error: string; saving: boolean; onChange: (value: typeof EMPTY_FORM) => void; onReset: () => void; onSubmit: (event: FormEvent<HTMLFormElement>, status: 'DRAFT' | 'PUBLISHED') => void }) {
  return <aside className="surface-card news-editor"><div className="editor-heading"><h2>{editing ? 'Editar novedad' : 'Nueva novedad'}</h2>{editing && <button type="button" className="icon-action" aria-label="Cerrar edición" onClick={onReset}><Icon name="close" size={18}/></button>}</div><form onSubmit={(event) => void onSubmit(event, 'PUBLISHED')}><label className="read-field"><span>Título</span><input required maxLength={200} placeholder="Ej.: Feriado del 8 de septiembre" value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })}/></label><label className="read-field"><span>Contenido</span><textarea required placeholder="Escribí acá el texto que van a leer los usuarios…" value={form.content} onChange={(event) => onChange({ ...form, content: event.target.value })}/></label><fieldset><legend>Audiencia</legend><div className="audience-options">{(['ALL', 'MEMBERS', 'TRAINERS'] as const).map((value) => <label key={value}><input type="radio" name="news-audience" value={value} checked={form.audience === value} onChange={() => onChange({ ...form, audience: value })}/><span>{audienceLabel(value)}</span></label>)}</div></fieldset>{error && <p className="error-message" role="alert">{error}</p>}<div className="news-editor-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={() => void onSubmit({ preventDefault: () => undefined } as FormEvent<HTMLFormElement>, 'DRAFT')}>Guardar borrador</button><button className="button button-primary" disabled={saving}>{saving ? 'Publicando…' : 'Publicar'}</button></div></form></aside>
}
