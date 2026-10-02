import { useCallback, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { UserRole, UserStatus } from '../authentication/auth-types'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type CreateUserInput } from '../../service/backend-api'
import { describeApiError } from '../../service/api-errors'
import { gymDate } from '../../service/date-time'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'

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
  const loader = useCallback(() => backendApi.listUsers({ search: search.trim() || undefined, role: role || undefined, status: status || undefined, membershipStatus: membershipStatus || undefined, initialPeriod: initialPeriod || undefined, page, limit: 20 }), [initialPeriod, membershipStatus, page, role, search, status])
  const { data, loading, error, reload } = useApiResource(loader)
  const resetPage = (action: () => void) => { setPage(1); action() }

  return <div className="app-page">
    <PageHeader title="Usuarios" description="Consultá y administrá las cuentas de socios, entrenadores y administradores."><button type="button" className="button button-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={20}/>Crear cuenta</button></PageHeader>
    <div className="admin-list-main"><div className="toolbar admin-list-toolbar"><label className="search-shell"><Icon name="search" size={18}/><input aria-label="Buscar usuarios" placeholder="Nombre, documento o correo" value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))}/></label><select aria-label="Filtrar por rol" value={role} onChange={(event) => resetPage(() => setRole(event.target.value as UserRole | ''))}><option value="">Todos los roles</option><option value="MEMBER">Socios</option><option value="TRAINER">Entrenadores</option><option value="ADMIN">Administradores</option></select><select aria-label="Filtrar por estado" value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as UserStatus | ''))}><option value="">Todos los estados</option><option value="ACTIVE">Activas</option><option value="INACTIVE">Desactivadas</option></select><select aria-label="Filtrar por estado de cuota" value={membershipStatus} onChange={(event) => resetPage(() => setMembershipStatus(event.target.value as typeof membershipStatus))}><option value="">Todos los estados de cuota</option><option value="CURRENT">Al día</option><option value="EXPIRING_SOON">Próximas a vencer</option><option value="EXPIRED">Vencidas</option></select><label className="checkbox"><input type="checkbox" checked={initialPeriod} onChange={(event) => resetPage(() => setInitialPeriod(event.target.checked))}/>Período inicial de 20 días</label></div>
      {loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No hay usuarios que coincidan con los filtros."/> : <><div className="admin-users-table-wrap"><div className="table-scroll"><table className="data-table"><thead><tr><th>Usuario</th><th>Documento</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{data.items.map((user) => <tr key={user.id}><td>{user.firstName} {user.lastName}</td><td>{user.documentNumber}</td><td>{user.email}</td><td>{ROLE_LABEL[user.role]}</td><td><span className={`badge ${user.status === 'ACTIVE' ? 'badge-info' : 'badge-disabled'}`}>{user.status === 'ACTIVE' ? 'Activa' : 'Desactivada'}</span></td><td><Link className="button button-secondary admin-user-detail-link" aria-label={`Ver detalle de ${user.firstName} ${user.lastName}`} to={`/admin/usuarios/${user.id}${buildUsersQuery({ search, role, status, membershipStatus, initialPeriod, page })}`}>Ver detalle</Link></td></tr>)}</tbody></table></div><div className="admin-users-mobile-list">{data.items.map((user) => <article className="admin-user-mobile-card" key={user.id}><div className="admin-user-mobile-avatar">{user.firstName[0]}{user.lastName[0]}</div><div className="admin-user-mobile-copy"><strong>{user.firstName} {user.lastName}</strong><span>{ROLE_LABEL[user.role]} · {user.documentNumber}</span><small>{user.email}</small></div><span className={`badge ${user.status === 'ACTIVE' ? 'badge-info' : 'badge-disabled'}`}>{user.status === 'ACTIVE' ? 'Activa' : 'Desactivada'}</span><Link className="admin-user-mobile-link" aria-label={`Ver detalle de ${user.firstName} ${user.lastName}`} to={`/admin/usuarios/${user.id}${buildUsersQuery({ search, role, status, membershipStatus, initialPeriod, page })}`}><Icon name="chevron" size={18}/></Link></article>)}</div></div><Pagination page={page} limit={data.limit} total={data.total} setPage={setPage}/></>}
    </div>
    {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void reload() }}/>}
  </div>
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
  return <div className="form-actions"><button className="button button-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page}</span><button className="button button-secondary" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>Siguiente</button></div>
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
  return <Dialog title="Crear una cuenta" onClose={onClose}><form onSubmit={(event) => void submit(event)}><div className="dialog-fields"><Input label="Nombre" value={form.firstName} maxLength={100} onChange={(value) => change('firstName', value)}/><Input label="Apellido" value={form.lastName} maxLength={100} onChange={(value) => change('lastName', value)}/><Input label="Documento" value={form.documentNumber} maxLength={30} onChange={(value) => change('documentNumber', value)}/><Input label="Fecha de nacimiento" type="date" value={form.birthDate} max={gymDate()} onChange={(value) => change('birthDate', value)}/><Input label="Correo electrónico" type="email" value={form.email} maxLength={255} onChange={(value) => change('email', value)}/><Input label="Teléfono" type="tel" value={form.phone} maxLength={30} onChange={(value) => change('phone', value)}/><Input label="Contraseña temporal" type="password" value={form.password} minLength={8} maxLength={72} hint="Entre 8 y 72 caracteres." onChange={(value) => change('password', value)}/><label className="read-field"><span>Rol</span><select value={form.role} onChange={(event) => change('role', event.target.value)}><option value="MEMBER">Socio</option><option value="TRAINER">Entrenador</option><option value="ADMIN">Administrador</option></select></label>{form.role === 'MEMBER' && <><Input label="Contacto de emergencia" required={false} maxLength={200} value={form.emergencyContactName ?? ''} onChange={(value) => change('emergencyContactName', value)}/><Input label="Teléfono de emergencia" type="tel" required={false} maxLength={30} value={form.emergencyContactPhone ?? ''} onChange={(value) => change('emergencyContactPhone', value)}/></>}{form.role === 'TRAINER' && <><Input label="Especialidad" maxLength={150} value={form.specialty ?? ''} onChange={(value) => change('specialty', value)}/><Input label="Descripción" value={form.description ?? ''} onChange={(value) => change('description', value)}/></>}</div>{error && <p className="error-message" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Creando…' : 'Crear cuenta'}</button></div></form></Dialog>
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="dialog-backdrop" role="presentation"><section className="workspace-dialog" role="dialog" aria-modal="true" aria-label={title}><button className="dialog-close" aria-label="Cerrar" onClick={onClose}>×</button><span className="eyebrow">M-TEAM</span><h2>{title}</h2>{children}</section></div>
}

function Input({ label, value, onChange, type = 'text', required = true, minLength, maxLength, max, hint }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number; maxLength?: number; max?: string; hint?: string }) {
  return <label className="read-field"><span>{label}</span><input type={type} required={required} minLength={minLength} maxLength={maxLength} max={max} value={value} onChange={(event) => onChange(event.target.value)}/>{hint && <small className="field-hint">{hint}</small>}</label>
}
