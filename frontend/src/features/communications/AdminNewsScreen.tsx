import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { backendApi, type NewsPost, type PublicationAudience, type PublicationStatus } from '../../service/backend-api'
import { formatDateTime } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { useEnterSearch } from '../../hooks/use-enter-search'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import { ActionButton } from '../../components/ActionButton'
import './admin-news.css'

const EMPTY_FORM = { title: '', content: '', audience: 'ALL' as PublicationAudience }
const AUDIENCE_LABELS: Record<PublicationAudience, string> = { ALL: 'Todos', MEMBERS: 'Socios', TRAINERS: 'Entrenadores' }
const STATUS_LABELS: Record<PublicationStatus, string> = { DRAFT: 'Borrador', PUBLISHED: 'Publicada', INACTIVE: 'Desactivada' }

export function AdminNewsScreen() {
  const isMobile = useIsMobile()
  const [page, setPage] = useState(1)
  const enterSearch = useEnterSearch()
  const { inputValue: search, setInputValue: setSearch, submittedValue: submittedSearch, requestKey: searchRequestKey, isSearchPending, submitSearch, syncLoading } = enterSearch
  const [audience, setAudience] = useState<PublicationAudience | ''>('')
  const [status, setStatus] = useState<PublicationStatus | ''>('')
  const [editing, setEditing] = useState<NewsPost | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savingAction, setSavingAction] = useState<'save' | 'publish' | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<{ id: string; status: 'PUBLISHED' | 'INACTIVE' } | null>(null)
  const filterId = useId()
  const filterButton = useRef<HTMLButtonElement>(null)
  const formTitle = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!isFilterOpen) return
    function closeFilters(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsFilterOpen(false)
      filterButton.current?.focus()
    }
    document.addEventListener('keydown', closeFilters)
    return () => document.removeEventListener('keydown', closeFilters)
  }, [isFilterOpen])
  const loader = useCallback(() => {
    void searchRequestKey
    return backendApi.listNewsPosts({ page, limit: 12, ...(submittedSearch.trim() ? { search: submittedSearch.trim() } : {}), ...(audience ? { audience } : {}), ...(status ? { status } : {}) })
  }, [audience, page, searchRequestKey, status, submittedSearch])
  const { data, loading: isLoading, error, reload } = useApiResource(loader)
  const isSearchLoading = isSearchPending || (isLoading && data !== null)
  useEffect(() => syncLoading(isLoading), [isLoading, syncLoading])

  function startCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(''); setNotice(''); setIsFormOpen(true); setIsFilterOpen(false)
  }

  function startEdit(post: NewsPost) {
    setEditing(post); setForm({ title: post.title, content: post.content, audience: post.audience }); setFormError(''); setNotice(''); setIsFormOpen(true); setIsFilterOpen(false)
    if (!isMobile) formTitle.current?.focus()
  }

  function cancelForm() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(''); setIsFormOpen(false)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || updatingStatus) return
    const shouldPublish = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'publish'
    if (shouldPublish && !window.confirm('¿Querés publicar esta novedad?')) return
    setIsSaving(true); setSavingAction(shouldPublish ? 'publish' : 'save'); setFormError(''); setNotice('')
    try {
      // PATCH imageUrl:null removes a stored image, so preserve it by omitting the field.
      const body = { ...form, ...(editing?.imageUrl ? {} : { imageUrl: null }) }
      if (editing) {
        const updated = await backendApi.updateNewsPost(editing.id, body)
        setEditing(updated)
        if (shouldPublish) await backendApi.updateNewsPostStatus(updated.id, 'PUBLISHED')
      } else {
        await backendApi.createNewsPost({ ...body, imageUrl: null, status: shouldPublish ? 'PUBLISHED' : 'DRAFT' })
      }
      cancelForm()
      setNotice(shouldPublish ? 'Novedad publicada correctamente.' : 'Cambios guardados correctamente.')
      await reload()
    } catch (value) {
      setFormError(value instanceof Error ? value.message : 'No se pudo guardar la novedad.')
    } finally { setIsSaving(false); setSavingAction(null) }
  }

  async function changeStatus(post: NewsPost, nextStatus: 'PUBLISHED' | 'INACTIVE') {
    if (!window.confirm(nextStatus === 'INACTIVE' ? '¿Querés desactivar esta novedad?' : '¿Querés publicar esta novedad?')) return
    setUpdatingStatus({ id: post.id, status: nextStatus }); setActionError(''); setNotice('')
    try {
      const updated = await backendApi.updateNewsPostStatus(post.id, nextStatus)
      if (editing?.id === post.id) setEditing(updated)
      await reload()
    } catch (value) { setActionError(value instanceof Error ? value.message : 'No se pudo actualizar la novedad.') }
    finally { setUpdatingStatus(null) }
  }

  const formContent = <form className="admin-news-form" onSubmit={(event) => void save(event)}>
    <h2>{editing ? 'Editar novedad' : 'Nueva novedad'}</h2>
    <label>Título<input ref={formTitle} required maxLength={200} placeholder="Título de la novedad" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label>
    <label>Contenido<textarea required placeholder="Escribí acá el texto que van a leer los usuarios…" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })}/></label>
    <fieldset className="admin-news-audience"><legend>Audiencia</legend>{Object.entries(AUDIENCE_LABELS).map(([value, label]) => <label key={value}><input type="radio" name="news-audience" value={value} checked={form.audience === value} onChange={() => setForm({ ...form, audience: value as PublicationAudience })}/><span>{label}</span></label>)}</fieldset>
    {formError && <p className="error-message" role="alert">{formError}</p>}
    <div className="admin-news-form-actions">
      <ActionButton type="submit" className="button button-secondary" isLoading={isSaving && savingAction === 'save'} loadingLabel="Guardando…" disabled={isSaving || Boolean(updatingStatus)}>{editing && editing.status !== 'DRAFT' ? 'Guardar cambios' : 'Guardar borrador'}</ActionButton>
      {editing?.status !== 'PUBLISHED' && <ActionButton type="submit" value="publish" className="button button-primary" isLoading={isSaving && savingAction === 'publish'} loadingLabel="Publicando…" disabled={isSaving || Boolean(updatingStatus)}>Publicar</ActionButton>}
    </div>
    {(editing || isMobile) && <button type="button" className="text-link admin-news-cancel" disabled={isSaving} onClick={cancelForm}>Cancelar</button>}
  </form>

  function postActions(post: NewsPost) {
    return <details className="admin-news-actions"><summary aria-label={`Acciones de ${post.title}`}><Icon name="more" size={20}/></summary><div>
      <button type="button" disabled={isSaving || Boolean(updatingStatus)} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); startEdit(post) }}>Editar</button>
      {post.status !== 'PUBLISHED' && <ActionButton type="button" isLoading={updatingStatus?.id === post.id && updatingStatus.status === 'PUBLISHED'} loadingLabel="Publicando…" disabled={isSaving || Boolean(updatingStatus)} onClick={() => void changeStatus(post, 'PUBLISHED')}>Publicar</ActionButton>}
      {post.status === 'PUBLISHED' && <ActionButton type="button" isLoading={updatingStatus?.id === post.id && updatingStatus.status === 'INACTIVE'} loadingLabel="Desactivando…" disabled={isSaving || Boolean(updatingStatus)} onClick={() => void changeStatus(post, 'INACTIVE')}>Desactivar</ActionButton>}
    </div></details>
  }

  return <div className="app-page admin-news-page">
    <PageHeader title="Novedades" description="Cada publicación puede dirigirse a todos, solo a socios o solo a entrenadores."/>
    <button type="button" className="button button-primary admin-news-mobile-create" onClick={startCreate}><Icon name="plus" size={20}/>Publicar una novedad</button>
    {actionError && <p role="alert" className="error-message">{actionError}</p>}
    {notice && <p role="status" className="success-message">{notice}</p>}
    <div className="admin-news-layout"><section className="admin-news-list" aria-label="Publicaciones">
      <div className="admin-news-toolbar">
        <label className="admin-news-search"><Icon name="search" size={18}/><span className="visually-hidden">Buscar novedad</span><input type="search" maxLength={100} placeholder="Buscar novedad" value={search} aria-busy={isSearchLoading} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (submitSearch()) setPage(1) } }}/></label>
        <button ref={filterButton} type="button" className="admin-news-filter-button" aria-label="Filtrar novedades" aria-expanded={isFilterOpen} aria-controls={filterId} onClick={() => setIsFilterOpen(!isFilterOpen)}><Icon name="filter" size={19}/></button>
        {(!isMobile || isFilterOpen) && <div id={filterId} className="admin-news-filters">
          <label><span className="visually-hidden">Filtrar por audiencia</span><select value={audience} onChange={(event) => { setAudience(event.target.value as PublicationAudience | ''); setPage(1) }}><option value="">Audiencia: todas</option>{Object.entries(AUDIENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="visually-hidden">Estado</span><select value={status} onChange={(event) => { setStatus(event.target.value as PublicationStatus | ''); setPage(1) }}><option value="">Estado: todos</option><option value="DRAFT">Borradores</option><option value="PUBLISHED">Publicadas</option><option value="INACTIVE">Desactivadas</option></select></label>
        </div>}
      </div>
      {error && data && <p className="error-message" role="alert">{error} <button type="button" className="text-link" onClick={() => void reload()}>Reintentar</button></p>}
      {isLoading && !data ? <LoadingState message="Cargando novedades…"/> : !data ? <ErrorState message={error || 'No se pudieron cargar las novedades.'} retry={() => void reload()}/> : !data.items.length ? <EmptyState message="No hay novedades para los filtros seleccionados."/> : <>
        {isMobile ? <div className="admin-news-cards">{data.items.map((post) => <article data-news-post key={post.id} className="admin-news-mobile-card"><div><h2><button type="button" onClick={() => startEdit(post)}>{post.title}</button></h2><p>{AUDIENCE_LABELS[post.audience]} · {post.publishedAt ? `publicada el ${publicationDate(post.publishedAt)}` : 'sin publicar'}</p></div><span className={`badge ${post.status === 'PUBLISHED' ? 'badge-info' : post.status === 'DRAFT' ? 'badge-secondary' : 'badge-neutral'}`}>{STATUS_LABELS[post.status]}</span>{postActions(post)}</article>)}</div> :
          <div className="admin-news-table-wrap"><table className="admin-news-table"><thead><tr><th scope="col">Título</th><th scope="col">Audiencia</th><th scope="col">Publicada</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>{data.items.map((post) => <tr data-news-post key={post.id}><td><div className="admin-news-title-cell"><h2><button type="button" onClick={() => startEdit(post)}>{post.title}</button></h2></div></td><td>{AUDIENCE_LABELS[post.audience]}</td><td>{post.publishedAt ? <time dateTime={post.publishedAt}>{publicationDate(post.publishedAt)}</time> : '—'}</td><td><span className={`admin-news-status admin-news-status-${post.status.toLowerCase()}`}>{STATUS_LABELS[post.status]}</span></td><td className="admin-news-actions-cell">{postActions(post)}</td></tr>)}</tbody></table></div>}
        {data.total > data.limit && <nav className="table-pagination" aria-label="Páginas de novedades"><span>Página {data.page} de {Math.ceil(data.total / data.limit)}</span><div><button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button></div></nav>}
      </>}
    </section>
    {isMobile ? isFormOpen && <NewsFormDialog onClose={cancelForm}>{formContent}</NewsFormDialog> : <aside className="admin-news-editor" aria-label="Editor de novedades">{formContent}</aside>}
    </div>
  </div>
}

function publicationDate(value: string) { return formatDateTime(value).split(' ')[0] }

function NewsFormDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const element = dialog.current
    element?.showModal()
    return () => { element?.close(); previousFocus?.focus() }
  }, [])
  return <dialog ref={dialog} className="admin-news-dialog" aria-label="Formulario de novedad" onCancel={onClose}><button type="button" className="admin-news-dialog-close" aria-label="Cerrar formulario" onClick={onClose}><Icon name="close" size={22}/></button>{children}</dialog>
}
