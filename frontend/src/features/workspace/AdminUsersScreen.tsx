import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { UserRole, UserStatus } from '../authentication/auth-types'
import { useApiResource } from '../../hooks/use-api-resource'
import { useEnterSearch } from '../../hooks/use-enter-search'
import { ActionButton } from '../../components/ActionButton'
import { backendApi, type CreateUserInput, type MembershipStatus, type UserListItem } from '../../service/backend-api'
import { describeApiError } from '../../service/api-errors'
import { gymDate } from '../../service/date-time'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'
import { UserAvatar } from './UserAvatar'

const ROLE_LABEL: Record<UserRole, string> = { MEMBER: 'Socio', TRAINER: 'Entrenador', ADMIN: 'Administrador' }
const ROLE_OPTIONS: ReadonlyArray<{ value: UserRole; label: string; mobileLabel: string }> = [
  { value: 'MEMBER', label: 'Socio', mobileLabel: 'Socio' },
  { value: 'TRAINER', label: 'Entrenador', mobileLabel: 'Entrenador' },
  { value: 'ADMIN', label: 'Administrador', mobileLabel: 'Admin' },
]
type UserField = keyof CreateUserInput
const FIELD_LABELS: Record<string, string> = { firstName: 'Nombre', lastName: 'Apellido', documentNumber: 'Documento', birthDate: 'Fecha de nacimiento', email: 'Correo electrónico', phone: 'Teléfono', password: 'Contraseña temporal', emergencyContactName: 'Contacto de emergencia', emergencyContactPhone: 'Teléfono de emergencia', specialty: 'Especialidad', description: 'Descripción' }
const BASE_REQUIRED: UserField[] = ['firstName', 'lastName', 'documentNumber', 'birthDate', 'email', 'phone', 'password']
const REQUIRED_FIELDS: Record<UserRole, UserField[]> = { MEMBER: BASE_REQUIRED, ADMIN: BASE_REQUIRED, TRAINER: [...BASE_REQUIRED, 'specialty', 'description'] }
type UserMetadata = { photoUrl: string | null; membershipStatus?: MembershipStatus }
type UserMetadataMap = Record<string, UserMetadata>

const EMPTY_USER: CreateUserInput = { firstName: '', lastName: '', documentNumber: '', birthDate: '', email: '', phone: '', password: '', role: 'MEMBER' }
const EMPTY_USERS: UserListItem[] = []
const EMPTY_METADATA: UserMetadataMap = {}
const MEMBERSHIP_LABEL: Record<MembershipStatus, string> = { CURRENT: 'Al día', EXPIRING_SOON: 'Próxima a vencer', EXPIRED: 'Vencida' }
const MEMBERSHIP_BADGE_CLASS: Record<MembershipStatus, string> = { CURRENT: 'badge-info', EXPIRING_SOON: 'badge-purple', EXPIRED: 'badge-pink' }

export function AdminUsersScreen() {
  const [searchParams] = useSearchParams()
  const enterSearch = useEnterSearch(searchParams.get('search') ?? '')
  const { inputValue: search, setInputValue: setSearch, submittedValue: submittedSearch, requestKey: searchRequestKey, isSearchPending, submitSearch, syncLoading } = enterSearch
  const [role, setRole] = useState<UserRole | ''>(() => (searchParams.get('role') as UserRole | null) ?? '')
  const [status, setStatus] = useState<UserStatus | ''>(() => (searchParams.get('status') as UserStatus | null) ?? '')
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | ''>(() => (searchParams.get('membershipStatus') as MembershipStatus | null) ?? '')
  const [page, setPage] = useState(() => Number(searchParams.get('page')) || 1)
  const [createOpen, setCreateOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const loader = useCallback(() => {
    void searchRequestKey
    return backendApi.listUsers({ search: submittedSearch.trim() || undefined, role: role || undefined, status: status || undefined, membershipStatus: membershipStatus || undefined, page, limit: 20 })
  }, [membershipStatus, page, role, searchRequestKey, status, submittedSearch])
  const { data, loading, error, reload } = useApiResource(loader)
  const isSearchLoading = isSearchPending || (loading && data !== null)
  useEffect(() => syncLoading(loading), [loading, syncLoading])
  const users = data?.items ?? EMPTY_USERS
  const { metadata, loading: metadataLoading } = useUserMetadata(users)
  const resetPage = (action: () => void) => { setPage(1); action() }
  const usersQuery = buildUsersQuery({ search: submittedSearch, role, status, membershipStatus, page })

  return <div className="app-page admin-users-screen">
    <PageHeader title="Usuarios" description="Socios, entrenadores y administradores en un solo listado. Filtrá por rol para administrarlos."/>
    <div className="admin-list-main">
      <button type="button" className="button button-primary admin-users-mobile-create" aria-label="Crear cuenta" onClick={() => setCreateOpen(true)}><Icon name="plus" size={20} aria-hidden="true"/><span className="visually-hidden">Crear cuenta</span></button>
      <div className="toolbar admin-list-toolbar admin-users-toolbar">
        <label className="search-shell"><Icon name="search" size={18}/><input aria-label="Buscar usuarios" placeholder="Buscar por nombre, documento o correo" value={search} aria-busy={isSearchLoading} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (submitSearch()) setPage(1) } }}/></label>
        <button type="button" className="admin-users-filter-toggle" aria-label="Mostrar filtros" aria-controls="admin-users-filter-fields" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}><Icon name="filter" size={18}/></button>
        <div id="admin-users-filter-fields" className={`admin-users-filter-fields${filtersOpen ? ' is-open' : ''}`}>
          <select aria-label="Filtrar por rol" value={role} onChange={(event) => resetPage(() => setRole(event.target.value as UserRole | ''))}><option value="">Rol: todos</option><option value="MEMBER">Socios</option><option value="TRAINER">Entrenadores</option><option value="ADMIN">Administradores</option></select>
          <select aria-label="Filtrar por estado" value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as UserStatus | ''))}><option value="">Estado: todos</option><option value="ACTIVE">Activas</option><option value="INACTIVE">Desactivadas</option></select>
          <select aria-label="Filtrar por estado de cuota" value={membershipStatus} onChange={(event) => resetPage(() => setMembershipStatus(event.target.value as typeof membershipStatus))}><option value="">Cuota: todas</option><option value="CURRENT">Al día</option><option value="EXPIRING_SOON">Próximas a vencer</option><option value="EXPIRED">Vencidas</option></select>
        </div>
        <button type="button" className="button button-primary admin-users-desktop-create" onClick={() => setCreateOpen(true)}><Icon name="plus" size={20}/>Crear cuenta</button>
      </div>
      {loading && !data ? <LoadingState message="Cargando usuarios…"/> : !data ? <ErrorState message={error || 'No se pudieron cargar los usuarios.'} retry={() => void reload()}/> : <>
        {error && <p className="error-message" role="alert">{error} <button type="button" className="text-link" onClick={() => void reload()}>Reintentar</button></p>}
        {data.items.length ? <><div className="admin-users-table-wrap">
          <div className="table-scroll admin-users-table-scroll" tabIndex={0} aria-label="Tabla de usuarios; desplazamiento horizontal disponible">
            <table className="data-table admin-users-table">
              <colgroup><col className="admin-users-column-user"/><col className="admin-users-column-document"/><col className="admin-users-column-email"/><col className="admin-users-column-role"/><col className="admin-users-column-membership"/><col className="admin-users-column-status"/><col className="admin-users-column-action"/></colgroup>
              <thead><tr><th scope="col">Usuario</th><th scope="col">Documento</th><th scope="col">Correo</th><th scope="col">Rol</th><th scope="col">Cuota</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead>
              <tbody>{users.map((user) => <AdminUserTableRow key={user.id} user={user} metadata={metadata[user.id]} metadataLoading={metadataLoading} href={`/admin/usuarios/${user.id}${usersQuery}`}/>)}</tbody>
            </table>
          </div>
          <div className="admin-users-mobile-list">{users.map((user) => <AdminUserMobileCard key={user.id} user={user} metadata={metadata[user.id]} metadataLoading={metadataLoading} href={`/admin/usuarios/${user.id}${usersQuery}`}/>)}</div>
        </div>
        <Pagination page={page} limit={data.limit} total={data.total} setPage={setPage}/></> : <EmptyState message="No hay usuarios que coincidan con los filtros."/>}
      </>}
    </div>
    {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void reload() }}/>}
  </div>
}

function useUserMetadata(users: UserListItem[]) {
  const [state, setState] = useState<{ users: UserListItem[] | null; metadata: UserMetadataMap }>({ users: null, metadata: EMPTY_METADATA })

  useEffect(() => {
    let isActive = true
    if (!users.length) return () => { isActive = false }

    void Promise.all(users.map(async (user) => {
      const [detailResult, membershipResult] = await Promise.allSettled([
        backendApi.getUser(user.id),
        user.role === 'MEMBER'
          ? backendApi.listMembers({ search: user.documentNumber, page: 1, limit: 1 })
          : Promise.resolve(null),
      ])
      const detail = detailResult.status === 'fulfilled' ? detailResult.value : null
      const member = membershipResult.status === 'fulfilled'
        ? membershipResult.value?.items.find((item) => item.id === user.id)
        : undefined
      return [user.id, { photoUrl: detail?.photoUrl ?? null, membershipStatus: member?.membershipStatus }] as const
    })).then((entries) => {
      if (isActive) setState({ users, metadata: Object.fromEntries(entries) })
    })

    return () => { isActive = false }
  }, [users])

  return {
    metadata: state.users === users ? state.metadata : EMPTY_METADATA,
    loading: users.length > 0 && state.users !== users,
  }
}

function AdminUserTableRow({ user, metadata, metadataLoading, href }: { user: UserListItem; metadata?: UserMetadata; metadataLoading: boolean; href: string }) {
  const fullName = `${user.firstName} ${user.lastName}`
  return <tr>
    <td><div className="admin-user-identity"><UserAvatar firstName={user.firstName} lastName={user.lastName} photoUrl={metadata?.photoUrl} className="admin-users-avatar"/><span className="admin-users-cell-text" title={fullName} aria-label={fullName}>{fullName}</span></div></td>
    <td><span className="admin-users-cell-text" title={user.documentNumber} aria-label={user.documentNumber}>{user.documentNumber}</span></td>
    <td><span className="admin-users-cell-text" title={user.email} aria-label={user.email}>{user.email}</span></td>
    <td><span className="admin-users-cell-text" title={ROLE_LABEL[user.role]} aria-label={ROLE_LABEL[user.role]}>{ROLE_LABEL[user.role]}</span></td>
    <td><MembershipStatusBadge role={user.role} status={metadata?.membershipStatus} loading={metadataLoading}/></td>
    <td><span className={`badge ${user.status === 'ACTIVE' ? 'badge-info' : 'badge-disabled'}`}>{user.status === 'ACTIVE' ? 'Activa' : 'Desactivada'}</span></td>
    <td className="admin-users-action-cell"><Link className="button button-secondary admin-user-detail-link" aria-label={`Editar usuario ${fullName}`} title={`Editar usuario ${fullName}`} to={href}>Editar</Link></td>
  </tr>
}

function AdminUserMobileCard({ user, metadata, metadataLoading, href }: { user: UserListItem; metadata?: UserMetadata; metadataLoading: boolean; href: string }) {
  const fullName = `${user.firstName} ${user.lastName}`
  const membershipSuffix = user.role === 'MEMBER' && !metadataLoading && metadata?.membershipStatus
    ? ` · cuota ${MEMBERSHIP_LABEL[metadata.membershipStatus].toLocaleLowerCase('es-AR')}`
    : ''
  const secondaryLabel = `${ROLE_LABEL[user.role]} · ${user.documentNumber}${membershipSuffix}`
  return <Link className="admin-user-mobile-card admin-user-mobile-link" aria-label={`Editar usuario ${fullName}`} to={href}>
    <UserAvatar firstName={user.firstName} lastName={user.lastName} className="admin-users-avatar"/>
    <div className="admin-user-mobile-copy"><strong title={fullName}>{fullName}</strong><span title={secondaryLabel}>{secondaryLabel}</span></div>
    <span className={`badge admin-user-mobile-account-status ${user.status === 'ACTIVE' ? 'is-active' : 'is-inactive'}`}>{user.status === 'ACTIVE' ? 'Activa' : 'Desactivada'}</span>
  </Link>
}

function MembershipStatusBadge({ role, status, loading }: { role: UserRole; status?: MembershipStatus; loading: boolean }) {
  if (role !== 'MEMBER') return <span className="admin-users-membership-empty" aria-label="Cuota no corresponde">—</span>
  if (loading) return <span className="admin-users-membership-pending" aria-label="Cargando estado de cuota">Cargando…</span>
  if (!status) return <span className="admin-users-membership-empty" aria-label="Estado de cuota no disponible">No disponible</span>
  return <span className={`badge ${MEMBERSHIP_BADGE_CLASS[status]}`} aria-label={`Estado de cuota: ${MEMBERSHIP_LABEL[status]}`}>{MEMBERSHIP_LABEL[status]}</span>
}

function buildUsersQuery({ search, role, status, membershipStatus, page }: { search: string; role: UserRole | ''; status: UserStatus | ''; membershipStatus: MembershipStatus | ''; page: number }) {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (role) params.set('role', role)
  if (status) params.set('status', status)
  if (membershipStatus) params.set('membershipStatus', membershipStatus)
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
    if (saving) return
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
  return <Dialog title="Crear cuenta" description="Las cuentas de entrenador y administrador solo se crean desde acá." onClose={onClose}>
    <form className="admin-create-account-form" onSubmit={(event) => void submit(event)}>
      <div className="admin-create-account-fields">
        <Input className="admin-create-account-first-name" label="Nombre" value={form.firstName} maxLength={100} onChange={(value) => change('firstName', value)} />
        <Input className="admin-create-account-last-name" label="Apellido" value={form.lastName} maxLength={100} onChange={(value) => change('lastName', value)} />
        <Input className="admin-create-account-document" label="Documento" value={form.documentNumber} maxLength={30} onChange={(value) => change('documentNumber', value)} />
        <Input className="admin-create-account-birth-date" label="Fecha de nacimiento" type="date" value={form.birthDate} max={gymDate()} onChange={(value) => change('birthDate', value)} />
        <Input className="admin-create-account-email" label="Correo electrónico" type="email" autoComplete="email" value={form.email} maxLength={255} onChange={(value) => change('email', value)} />
        <Input className="admin-create-account-phone" label="Teléfono" type="tel" autoComplete="tel" value={form.phone} maxLength={30} onChange={(value) => change('phone', value)} />
      </div>

      <fieldset className="admin-create-account-role">
        <legend>Rol</legend>
        <div className="admin-create-account-role-options" role="group" aria-label="Rol">
          {ROLE_OPTIONS.map((option) => <button key={option.value} type="button" className="admin-create-account-role-option" aria-label={option.label} aria-pressed={form.role === option.value} onClick={() => change('role', option.value)}><span className="admin-create-account-role-label">{option.label}</span><span className="admin-create-account-role-mobile-label">{option.mobileLabel}</span></button>)}
        </div>
      </fieldset>

      <Input className="admin-create-account-password" label="Contraseña temporal" type="password" autoComplete="new-password" value={form.password} minLength={8} maxLength={72} hint="Entre 8 y 72 caracteres." onChange={(value) => change('password', value)} />
      <div className="admin-create-account-notice" role="note"><Icon name="alert" size={18} aria-hidden="true" /><p>La contraseña será temporal y el usuario deberá cambiarla en su primer inicio de sesión.</p></div>

      {form.role === 'MEMBER' && <div className="admin-create-account-extra-fields"><Input label="Contacto de emergencia" required={false} maxLength={200} value={form.emergencyContactName ?? ''} onChange={(value) => change('emergencyContactName', value)} /><Input label="Teléfono de emergencia" type="tel" autoComplete="tel" required={false} maxLength={30} value={form.emergencyContactPhone ?? ''} onChange={(value) => change('emergencyContactPhone', value)} /></div>}
      {form.role === 'TRAINER' && <div className="admin-create-account-extra-fields"><Input label="Especialidad" maxLength={150} value={form.specialty ?? ''} onChange={(value) => change('specialty', value)} /><Input label="Descripción" value={form.description ?? ''} onChange={(value) => change('description', value)} /></div>}

      {error && <p className="error-message admin-create-account-error" role="alert">{error}</p>}
      <div className="dialog-actions admin-create-account-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={onClose}>Cancelar</button><ActionButton type="submit" className="button button-primary" isLoading={saving} loadingLabel="Creando cuenta…">Crear cuenta</ActionButton></div>
    </form>
  </Dialog>
}

function Dialog({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  return <div className="dialog-backdrop" role="presentation"><section className="workspace-dialog admin-create-account-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-create-account-title" aria-describedby="admin-create-account-description"><header className="admin-create-account-header"><div><h2 id="admin-create-account-title">{title}</h2><p id="admin-create-account-description">{description}</p></div><button type="button" className="dialog-close" aria-label="Cerrar" onClick={onClose}><Icon name="close" size={20} aria-hidden="true" /></button></header>{children}</section></div>
}

function Input({ label, value, onChange, type = 'text', required = true, minLength, maxLength, max, hint, autoComplete, className = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number; maxLength?: number; max?: string; hint?: string; autoComplete?: string; className?: string }) {
  return <label className={`read-field ${className}`.trim()}><span>{label}</span><span className="admin-create-account-control"><input type={type} required={required} minLength={minLength} maxLength={maxLength} max={max} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} /></span>{hint && <small className="field-hint">{hint}</small>}</label>
}
