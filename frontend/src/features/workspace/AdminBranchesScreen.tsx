import { useCallback, useState, type FormEvent } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type Branch, type BranchInput } from '../../service/backend-api'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'

const EMPTY_BRANCH: BranchInput = {
  name: '',
  imageUrl: '',
  address: '',
  openingHours: '',
  phone: '',
  description: '',
}

type BranchFilter = 'all' | 'active' | 'inactive'

export function AdminBranchesScreen() {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<BranchFilter>('all')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Branch | 'new' | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const loader = useCallback(() => backendApi.listAdminBranches({
    search: search.trim() || undefined,
    isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
    page,
    limit: 20,
  }), [activeFilter, page, search])
  const { data, loading, error, reload } = useApiResource(loader)

  return <div className="app-page admin-branches-screen">
    <PageHeader title="Sedes" description="Administrá las sedes reales del gimnasio. Las sedes desactivadas no aparecen en el sitio público.">
      <button type="button" className="button button-primary admin-branches-desktop-create" onClick={() => setEditing('new')}><Icon name="plus" size={20}/>Nueva sede</button>
    </PageHeader>
    <button type="button" className="button button-primary admin-branches-mobile-create" onClick={() => setEditing('new')}><Icon name="plus" size={20}/>Nueva sede</button>
    <div className="admin-list-main">
      <div className="toolbar admin-list-toolbar admin-branches-toolbar">
        <label className="search-shell"><Icon name="search" size={18}/><input aria-label="Buscar sedes" placeholder="Buscar por nombre o dirección" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }}/></label>
        <button type="button" className="admin-branches-filter-toggle" aria-label="Mostrar filtros" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}><Icon name="filter" size={18}/></button>
        <div className={`admin-branches-filter-fields${filtersOpen ? ' is-open' : ''}`}>
          <select aria-label="Filtrar sedes por estado" value={activeFilter} onChange={(event) => { setPage(1); setActiveFilter(event.target.value as BranchFilter) }}>
            <option value="all">Estado: todas</option>
            <option value="active">Activas</option>
            <option value="inactive">Desactivadas</option>
          </select>
        </div>
      </div>
      {loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No hay sedes que coincidan con los filtros."/> : <>
        <div className="admin-branches-table-wrap">
          <table className="admin-branches-table">
            <thead><tr><th scope="col">Sede</th><th scope="col">Dirección</th><th scope="col">Horarios</th><th scope="col">Teléfono</th><th scope="col">Estado</th><th scope="col"><span className="visually-hidden">Acciones</span></th></tr></thead>
            <tbody>{data.items.map((branch) => <tr key={branch.id}>
              <td className="admin-branch-name">{branch.name}</td>
              <td>{branch.address}</td>
              <td>{branch.openingHours}</td>
              <td>{branch.phone}</td>
              <td><BranchStatusBadge isActive={branch.isActive}/></td>
              <td><BranchActions branch={branch} onEdit={() => setEditing(branch)} onToggle={() => void toggleStatus(branch)}/></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="admin-branches-mobile-list">{data.items.map((branch) => <article className="admin-branch-mobile-card" key={branch.id}>
          <div className="admin-branch-mobile-title"><h2>{branch.name}</h2><BranchStatusBadge isActive={branch.isActive}/></div>
          <p><Icon name="pin" size={16}/><span>{branch.address} · {branch.openingHours}</span></p>
          <BranchActions branch={branch} onEdit={() => setEditing(branch)} onToggle={() => void toggleStatus(branch)}/>
        </article>)}</div>
        <div className="form-actions admin-branches-pagination"><button type="button" className="button button-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page}</span><button type="button" className="button button-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button></div>
      </>}
    </div>
    {editing && (
      <BranchDialog branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload() }}/>
    )}
  </div>

  async function toggleStatus(branch: Branch) {
    const next = !branch.isActive
    if (!window.confirm(`¿Confirmás ${next ? 'la reactivación' : 'la desactivación'} de ${branch.name}?`)) return
    try {
      await backendApi.updateBranchStatus(branch.id, next)
      await reload()
    } catch (value) {
      window.alert(value instanceof Error ? value.message : 'No se pudo actualizar la sede.')
    }
  }
}

function BranchStatusBadge({ isActive }: { isActive?: boolean }) {
  return <span className={`badge ${isActive ? 'badge-info' : 'badge-disabled'}`}>{isActive ? 'Activa' : 'Desactivada'}</span>
}

function BranchActions({ branch, onEdit, onToggle }: { branch: Branch; onEdit: () => void; onToggle: () => void }) {
  return <div className="admin-branch-actions"><button type="button" className="button button-secondary" onClick={onEdit}>Editar</button><button type="button" className="button button-secondary" onClick={onToggle}>{branch.isActive ? 'Desactivar' : 'Reactivar'}</button></div>
}

function BranchDialog({ branch, onClose, onSaved }: { branch: Branch | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<BranchInput>(() => branch ? {
    name: branch.name,
    imageUrl: branch.imageUrl,
    address: branch.address,
    openingHours: branch.openingHours,
    phone: branch.phone,
    description: branch.description,
    latitude: branch.latitude === null || branch.latitude === undefined ? undefined : Number(branch.latitude),
    longitude: branch.longitude === null || branch.longitude === undefined ? undefined : Number(branch.longitude),
  } : EMPTY_BRANCH)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const change = (field: keyof BranchInput, value: string) => setForm((current) => ({
    ...current,
    [field]: field === 'latitude' || field === 'longitude' ? (value === '' ? undefined : Number(value)) : value,
  }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (branch) await backendApi.updateBranch(branch.id, form)
      else await backendApi.createBranch(form)
      onSaved()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo guardar la sede.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="dialog-backdrop" role="presentation"><section className="workspace-dialog" role="dialog" aria-modal="true" aria-label={branch ? 'Editar sede' : 'Nueva sede'}><button type="button" className="dialog-close" aria-label="Cerrar" onClick={onClose}>×</button><span className="eyebrow">M-TEAM</span><h2>{branch ? 'Editar sede' : 'Nueva sede'}</h2><form onSubmit={(event) => void submit(event)}><div className="dialog-fields"><Input label="Nombre" value={form.name} onChange={(value) => change('name', value)}/><Input label="Dirección" value={form.address} onChange={(value) => change('address', value)}/><Input label="Horarios" value={form.openingHours} onChange={(value) => change('openingHours', value)}/><Input label="Teléfono" value={form.phone} onChange={(value) => change('phone', value)}/><Input label="URL de imagen" type="url" value={form.imageUrl} onChange={(value) => change('imageUrl', value)}/><Input label="Descripción" value={form.description} onChange={(value) => change('description', value)}/><Input label="Latitud" type="number" required={false} value={form.latitude?.toString() ?? ''} onChange={(value) => change('latitude', value)}/><Input label="Longitud" type="number" required={false} value={form.longitude?.toString() ?? ''} onChange={(value) => change('longitude', value)}/></div>{error && <p className="error-message" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar sede'}</button></div></form></section></div>
}

function Input({ label, value, onChange, type = 'text', required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="read-field"><span>{label}</span><input type={type} step={type === 'number' ? '0.000001' : undefined} required={required} value={value} onChange={(event) => onChange(event.target.value)}/></label>
}
