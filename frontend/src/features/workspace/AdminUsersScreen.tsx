import { useCallback, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { UserRole, UserStatus } from '../authentication/auth-types'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type CreateUserInput, type UserListItem } from '../../service/backend-api'
import { describeApiError } from '../../service/api-errors'
import { gymDate } from '../../service/date-time'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'
import { UserAvatar } from './UserAvatar'

const ROLE_LABEL: Record<UserRole, string> = { MEMBER: 'Socio', TRAINER: 'Entrenador', ADMIN: 'Administrador' }
type UserField = keyof CreateUserInput
const FIELD_LABELS: Record<string, string> = { firstName: 'Nombre', lastName: 'Apellido', documentNumber: 'Documento', birthDate: 'Fecha de nacimiento', email: 'Correo electrónico', phone: 'Teléfono', password: 'Contraseña temporal', emergencyContactName: 'Contacto de emergencia', emergencyContactPhone: 'Teléfono de emergencia', specialty: 'Especialidad', description: 'Descripción' }
const BASE_REQUIRED: UserField[] = ['firstName', 'lastName', 'documentNumber', 'birthDate', 'email', 'phone', 'password']
const REQUIRED_FIELDS: Record<UserRole, UserField[]> = { MEMBER: BASE_REQUIRED, ADMIN: BASE_REQUIRED, TRAINER: [...BASE_REQUIRED, 'specialty', 'description'] }
const EMPTY_USER: CreateUserInput = { firstName: '', lastName: '', documentNumber: '', birthDate: '', email: '', phone: '', password: '', role: 'MEMBER' }

export function AdminUsersScreen() {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [role, setRole] = useState<UserRole | ''>(() => (searchParams.get('role') as UserRole | null) ?? '')
  const [status, setStatus] = useState<UserStatus | ''>(() => (searchParams.get('status') as UserStatus | null) ?? '')
  const [membershipStatus, setMembershipStatus] = useState<'' | 'CURRENT' | 'EXPIRING_SOON' | 'EXPIRED'>(() => (searchParams.get('membershipStatus') as 'CURRENT' | 'EXPIRING_SOON' | 'EXPIRED' | null) ?? '')
  const [initialPeriod, setInitialPeriod] = useState(() => searchParams.get('initialPeriod') === 'true')
  const [page, setPage] = useState(() => Number(searchParams.get('page')) || 1)
  const [createOpen, setCreateOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const loader = useCallback(() => backendApi.listUsers({ search: search.trim() || undefined, role: role || undefined, status: status || undefined, membershipStatus: membershipStatus || undefined, initialPeriod: initialPeriod || undefined, page, limit: 20 }), [initialPeriod, membershipStatus, page, role, search, status])
  const { data, loading, error, reload } = useApiResource(loader)
  const resetPage = (action: () => void) => { setPage(1); action() }

  return <div className="app-page admin-users-screen">
    <PageHeader title="Usuarios" description="Socios, entrenadores y administradores en un solo listado. Filtrá por rol para administrarlos."/>
    <div className="admin-list-main">
      <button type="button" className="button button-primary admin-users-mobile-create" onClick={() => setCreateOpen(true)}><Icon name="plus" size={20}/>Crear cuenta</button>
      <div className="toolbar admin-list-toolbar admin-users-toolbar">
        <label className="search-shell"><Icon name="search" size={18}/><input aria-label="Buscar usuarios" placeholder="Buscar por nombre, documento o correo" value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))}/></label>
        <button type="button" className="admin-users-filter-toggle" aria-label="Mostrar filtros" aria-controls="admin-users-filter-fields" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}><Icon name="filter" size={18}/></button>
        <div id="admin-users-filter-fields" className={`admin-users-filter-fields${filtersOpen ? ' is-open' : ''}`}>
          <select aria-label="Filtrar por rol" value={role} onChange={(event) => resetPage(() => setRole(event.target.value as UserRole | ''))}><option value="">Rol: todos</option><option value="MEMBER">Socios</option><option value="TRAINER">Entrenadores</option><option value="ADMIN">Administradores</option></select>
          <select aria-label="Filtrar por estado" value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as UserStatus | ''))}><option value="">Estado: todos</option><option value="ACTIVE">Activas</option><option value="INACTIVE">Desactivadas</option></select>
          <select aria-label="Filtrar por estado de cuota" value={membershipStatus} onChange={(event) => resetPage(() => setMembershipStatus(event.target.value as typeof membershipStatus))}><option value="">Cuota: todas</option><option value="CURRENT">Al día</option><option value="EXPIRING_SOON">Próximas a vencer</option><option value="EXPIRED">Vencidas</option></select>
          <label className="checkbox"><input type="checkbox" checked={initialPeriod} onChange={(event) => resetPage(() => setInitialPeriod(event.target.checked))}/>Período inicial de 20 días</label>
        </div>
        <button type="button" className="button button-primary admin-users-desktop-create" onClick={() => setCreateOpen(true)}><Icon name="plus" size={20}/>Crear cuenta</button>
      </div>
      {loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No hay usuarios que coincidan con los filtros."/> : <>
        <div className="admin-users-table-wrap">
          <div className="table-scroll admin-users-table-scroll" tabIndex={0} aria-label="Tabla de usuarios; desplazamiento horizontal disponible">
            <table className="data-table admin-users-table">
              <colgroup><col className="admin-users-column-user"/><col className="admin-users-column-document"/><col className="admin-users-column-email"/><col className="admin-users-column-role"/><col className="admin-users-column-membership"/><col className="admin-users-column-status"/><col className="admin-users-column-action"/></colgroup>
              <thead><tr><th scope="col">Usuario</th><th scope="col">Documento</th><th scope="col">Correo</th><th scope="col">Rol</th><th scope="col">Cuota</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead>
              <tbody>{data.items.map((user) => <AdminUserTableRow key={user.id} user={user} href={`/admin/usuarios/${user.id}${buildUsersQuery({ search, role, status, membershipStatus, initialPeriod, page })}`}/>)}</tbody>
            </table>
          </div>
          <div className="admin-users-mobile-list">{data.items.map((user) => <AdminUserMobileCard key={user.id} user={user} href={`/admin/usuarios/${user.id}${buildUsersQuery({ search, role, status, membershipStatus, initialPeriod, page })}`}/>)}</div>
        </div>
        <Pagination page={page} limit={data.limit} total={data.total} setPage={setPage}/>
      </>}
    </div>
    {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void reload() }}/>}
  </div>
}

function AdminUserTableRow({ user, href }: { user: UserListItem; href: string }) {
  const fullName = `${user.firstName} ${user.lastName}`
  return <tr>
    <td><div className="admin-user-identity"><UserAvatar firstName={user.firstName} lastName={user.lastName} className="admin-users-avatar"/><span className="admin-users-cell-text" title={fullName} aria-label={fullName}>{fullName}</span></div></td>
    <td><span className="admin-users-cell-text" title={user.documentNumber} aria-label={user.documentNumber}>{user.documentNumber}</span></td>
    <td><span className="admin-users-cell-text" title={user.email} aria-label={user.email}>{user.email}</span></td>
    <td><span className="admin-users-cell-text" title={ROLE_LABEL[user.role]} aria-label={ROLE_LABEL[user.role]}>{ROLE_LABEL[user.role]}</span></td>
    <td><MembershipStatusBadge role={user.role}/></td>
    <td><span className={`badge ${user.status === 'ACTIVE' ? 'badge-info' : 'badge-disabled'}`}>{user.status === 'ACTIVE' ? 'Activa' : 'Desactivada'}</span></td>
    <td className="admin-users-action-cell"><Link className="button button-secondary admin-user-detail-link" aria-label={`Editar usuario ${fullName}`} title={`Editar usuario ${fullName}`} to={href}>Editar</Link></td>
  </tr>
}

function AdminUserMobileCard({ user, href }: { user: UserListItem; href: string }) {
  const fullName = `${user.firstName} ${user.lastName}`
  return <article className="admin-user-mobile-card">
    <UserAvatar firstName={user.firstName} lastName={user.lastName} className="admin-users-avatar"/>
    <div className="admin-user-mobile-copy"><strong title={fullName}>{fullName}</strong><span title={`${ROLE_LABEL[user.role]} · ${user.documentNumber}`}>{ROLE_LABEL[user.role]} · {user.documentNumber}</span><small title={user.email}>{user.email}</small><MembershipStatusBadge role={user.role}/></div>
    <div className="admin-user-mobile-actions"><span className={`badge ${user.status === 'ACTIVE' ? 'badge-info' : 'badge-disabled'}`}>{user.status === 'ACTIVE' ? 'Activa' : 'Desactivada'}</span><Link className="button button-secondary admin-user-mobile-link" aria-label={`Editar usuario ${fullName}`} to={href}>Editar</Link></div>
  </article>
}

function MembershipStatusBadge({ role }: { role: UserRole }) {
  return <span className="admin-users-membership-empty" aria-label={role === 'MEMBER' ? 'Estado de cuota no informado' : 'Cuota no corresponde'}>—</span>
}

function buildUsersQuery({ search, role, status, membershipStatus, initialPeriod, page }: { search: string; role: UserRole | ''; status: UserStatus | ''; membershipStatus: '' | 'CURRENT' | 'EXPIRING_SOON' | 'EXPIRED'; initialPeriod: boolean; page: number }) {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (role) params.set('role', role)
  if (status) params.set('status', status)
  if (membershipStatus) params.set('membershipStatus', membershipStatus)
  if (initialPeriod) params.set('initialPeriod', 'true')
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `?${query}` : ''
}

function Pagination({ page, limit, total, setPage }: { page: number; limit: number; total: number; setPage: (page: number) => void }) {
  const firstResult = total === 0 ? 0 : (page - 1) * limit + 1
  const lastResult = Math.min(page * limit, total)
  return <div className="form-actions admin-users-pagination"><span>Mostrando {firstResult}–{lastResult} de {total} usuarios</span><div className="admin-users-pagination-controls"><button type="button" className="button button-secondary" aria-label="Página anterior" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page}</span><button type="button" className="button button-secondary" aria-label="Página siguiente" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
}

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateUserInput>(EMPTY_USER)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const change = (field: keyof CreateUserInput, value: string) => setForm((current) => ({ ...current, [field]: value }))
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    const blank = REQUIRED_FIELDS[form.role].filter((field) => !(form[field] ?? '').trim())
    if (blank.length) { setError(`Completá los campos obligatorios: ${blank.map((field) => FIELD_LABELS[field]).join(', ')}.`); return }
    if (!/\d/.test(form.documentNumber)) { setError('El documento debe contener al menos un número.'); return }
    setSaving(true)
    try {
      const optional = (value: string | undefined) => value?.trim() ? value.trim() : undefined
      await backendApi.createUser({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), documentNumber: form.documentNumber.trim(), birthDate: form.birthDate, email: form.email.trim(), phone: form.phone.trim(), password: form.password, role: form.role, ...(form.role === 'MEMBER' ? { emergencyContactName: optional(form.emergencyContactName), emergencyContactPhone: optional(form.emergencyContactPhone) } : {}), ...(form.role === 'TRAINER' ? { specialty: form.specialty?.trim(), description: form.description?.trim() } : {}) })
      onCreated()
    } catch (value) { setError(describeApiError(value, 'No se pudo crear la cuenta.', FIELD_LABELS)) } finally { setSaving(false) }
  }
  return <Dialog title="Crear una cuenta" onClose={onClose}><form onSubmit={(event) => void submit(event)}><div className="dialog-fields"><Input label="Nombre" value={form.firstName} maxLength={100} onChange={(value) => change('firstName', value)}/><Input label="Apellido" value={form.lastName} maxLength={100} onChange={(value) => change('lastName', value)}/><Input label="Documento" value={form.documentNumber} maxLength={30} onChange={(value) => change('documentNumber', value)}/><Input label="Fecha de nacimiento" type="date" value={form.birthDate} max={gymDate()} onChange={(value) => change('birthDate', value)}/><Input label="Correo electrónico" type="email" value={form.email} maxLength={255} onChange={(value) => change('email', value)}/><Input label="Teléfono" type="tel" value={form.phone} maxLength={30} onChange={(value) => change('phone', value)}/><Input label="Contraseña temporal" type="password" value={form.password} minLength={8} maxLength={72} hint="Entre 8 y 72 caracteres." onChange={(value) => change('password', value)}/><label className="read-field"><span>Rol</span><select value={form.role} onChange={(event) => change('role', event.target.value)}><option value="MEMBER">Socio</option><option value="TRAINER">Entrenador</option><option value="ADMIN">Administrador</option></select></label>{form.role === 'MEMBER' && <><Input label="Contacto de emergencia" required={false} maxLength={200} value={form.emergencyContactName ?? ''} onChange={(value) => change('emergencyContactName', value)}/><Input label="Teléfono de emergencia" type="tel" required={false} maxLength={30} value={form.emergencyContactPhone ?? ''} onChange={(value) => change('emergencyContactPhone', value)}/></>}{form.role === 'TRAINER' && <><Input label="Especialidad" maxLength={150} value={form.specialty ?? ''} onChange={(value) => change('specialty', value)}/><Input label="Descripción" value={form.description ?? ''} onChange={(value) => change('description', value)}/></>}</div>{error && <p className="error-message" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Creando…' : 'Crear cuenta'}</button></div></form></Dialog>
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="dialog-backdrop" role="presentation"><section className="workspace-dialog" role="dialog" aria-modal="true" aria-label={title}><button type="button" className="dialog-close" aria-label="Cerrar" onClick={onClose}>×</button><span className="eyebrow">M-TEAM</span><h2>{title}</h2>{children}</section></div>
}

function Input({ label, value, onChange, type = 'text', required = true, minLength, maxLength, max, hint }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number; maxLength?: number; max?: string; hint?: string }) {
  return <label className="read-field"><span>{label}</span><input type={type} required={required} minLength={minLength} maxLength={maxLength} max={max} value={value} onChange={(event) => onChange(event.target.value)}/>{hint && <small className="field-hint">{hint}</small>}</label>
}
