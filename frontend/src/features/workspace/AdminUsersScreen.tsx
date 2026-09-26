import { useCallback, useState, type FormEvent, type ReactNode } from 'react'
import type { UserRole, UserStatus } from '../authentication/auth-types'
import { useApiResource } from '../../hooks/use-api-resource'
import {
  backendApi,
  type AdminUserDetail,
  type CreateUserInput,
} from '../../service/backend-api'
import { describeApiError } from '../../service/api-errors'
import { formatDate, formatDateTime, gymDate } from '../../service/date-time'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'

const ROLE_LABEL: Record<UserRole, string> = {
  MEMBER: 'Socio',
  TRAINER: 'Entrenador',
  ADMIN: 'Administrador',
}

type UserField = keyof CreateUserInput

const FIELD_LABELS: Record<string, string> = {
  firstName: 'Nombre',
  lastName: 'Apellido',
  documentNumber: 'Documento',
  birthDate: 'Fecha de nacimiento',
  email: 'Correo electrónico',
  phone: 'Teléfono',
  password: 'Contraseña temporal',
  emergencyContactName: 'Contacto de emergencia',
  emergencyContactPhone: 'Teléfono de emergencia',
  specialty: 'Especialidad',
  description: 'Descripción',
}

const BASE_REQUIRED: UserField[] = ['firstName', 'lastName', 'documentNumber', 'birthDate', 'email', 'phone', 'password']
const REQUIRED_FIELDS: Record<UserRole, UserField[]> = {
  MEMBER: BASE_REQUIRED,
  ADMIN: BASE_REQUIRED,
  TRAINER: [...BASE_REQUIRED, 'specialty', 'description'],
}

const EMPTY_USER: CreateUserInput = {
  firstName: '',
  lastName: '',
  documentNumber: '',
  birthDate: '',
  email: '',
  phone: '',
  password: '',
  role: 'MEMBER',
}

export function AdminUsersScreen() {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const loader = useCallback(
    () => backendApi.listUsers({
      search: search.trim() || undefined,
      role: role || undefined,
      status: status || undefined,
      page,
      limit: 20,
    }),
    [page, role, search, status],
  )
  const { data, loading, error, reload } = useApiResource(loader)

  function resetPage(action: () => void) {
    setPage(1)
    action()
  }

  return <div className="app-page">
    <PageHeader title="Usuarios" description="Consultá y administrá las cuentas de socios, entrenadores y administradores.">
      <button type="button" className="button button-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={20}/>Crear cuenta</button>
    </PageHeader>
    <div className="admin-list-main">
      <div className="toolbar admin-list-toolbar">
        <label className="search-shell"><Icon name="search" size={18}/><input aria-label="Buscar usuarios" placeholder="Nombre, documento o correo" value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))}/></label>
        <select aria-label="Filtrar por rol" value={role} onChange={(event) => resetPage(() => setRole(event.target.value as UserRole | ''))}>
          <option value="">Todos los roles</option>
          <option value="MEMBER">Socios</option>
          <option value="TRAINER">Entrenadores</option>
          <option value="ADMIN">Administradores</option>
        </select>
        <select aria-label="Filtrar por estado" value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as UserStatus | ''))}>
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activas</option>
          <option value="INACTIVE">Desactivadas</option>
        </select>
      </div>
      {loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No hay usuarios que coincidan con los filtros."/> : <>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Usuario</th><th>Documento</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{data.items.map((user) => <tr key={user.id}><td>{user.firstName} {user.lastName}</td><td>{user.documentNumber}</td><td>{user.email}</td><td>{ROLE_LABEL[user.role]}</td><td><span className={`badge ${user.status === 'ACTIVE' ? 'badge-info' : 'badge-disabled'}`}>{user.status === 'ACTIVE' ? 'Activa' : 'Desactivada'}</span></td><td><button className="text-link" onClick={() => setSelectedId(user.id)}>Ver detalle</button></td></tr>)}</tbody></table></div>
        <Pagination page={page} limit={data.limit} total={data.total} setPage={setPage}/>
      </>}
    </div>
    {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void reload() }}/>}
    {selectedId && (
      <UserDetailDialog
        id={selectedId}
        onClose={() => setSelectedId('')}
        onChanged={() => void reload()}
      />
    )}
  </div>
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
    event.preventDefault()
    setError('')
    const blank = REQUIRED_FIELDS[form.role].filter((field) => !(form[field] ?? '').trim())
    if (blank.length) {
      setError(`Completá los campos obligatorios: ${blank.map((field) => FIELD_LABELS[field]).join(', ')}.`)
      return
    }
    if (!/\d/.test(form.documentNumber)) {
      setError('El documento debe contener al menos un número.')
      return
    }
    setSaving(true)
    try {
      const optional = (value: string | undefined) => value?.trim() ? value.trim() : undefined
      const body: CreateUserInput = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        documentNumber: form.documentNumber.trim(),
        birthDate: form.birthDate,
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role: form.role,
        ...(form.role === 'MEMBER' ? {
          emergencyContactName: optional(form.emergencyContactName),
          emergencyContactPhone: optional(form.emergencyContactPhone),
        } : {}),
        ...(form.role === 'TRAINER' ? {
          specialty: form.specialty?.trim(),
          description: form.description?.trim(),
        } : {}),
      }
      await backendApi.createUser(body)
      onCreated()
    } catch (value) {
      setError(describeApiError(value, 'No se pudo crear la cuenta.', FIELD_LABELS))
    } finally {
      setSaving(false)
    }
  }

  return <Dialog title="Crear una cuenta" onClose={onClose}><form onSubmit={submit}><div className="dialog-fields"><Input label="Nombre" value={form.firstName} maxLength={100} onChange={(value) => change('firstName', value)}/><Input label="Apellido" value={form.lastName} maxLength={100} onChange={(value) => change('lastName', value)}/><Input label="Documento" value={form.documentNumber} maxLength={30} onChange={(value) => change('documentNumber', value)}/><Input label="Fecha de nacimiento" type="date" value={form.birthDate} max={gymDate()} onChange={(value) => change('birthDate', value)}/><Input label="Correo electrónico" type="email" value={form.email} maxLength={255} onChange={(value) => change('email', value)}/><Input label="Teléfono" type="tel" value={form.phone} maxLength={30} onChange={(value) => change('phone', value)}/><Input label="Contraseña temporal" type="password" value={form.password} minLength={8} maxLength={72} hint="Entre 8 y 72 caracteres." onChange={(value) => change('password', value)}/><label className="read-field"><span>Rol</span><select value={form.role} onChange={(event) => change('role', event.target.value)}><option value="MEMBER">Socio</option><option value="TRAINER">Entrenador</option><option value="ADMIN">Administrador</option></select></label>{form.role === 'MEMBER' && <><Input label="Contacto de emergencia" required={false} maxLength={200} value={form.emergencyContactName ?? ''} onChange={(value) => change('emergencyContactName', value)}/><Input label="Teléfono de emergencia" type="tel" required={false} maxLength={30} value={form.emergencyContactPhone ?? ''} onChange={(value) => change('emergencyContactPhone', value)}/></>}{form.role === 'TRAINER' && <><Input label="Especialidad" maxLength={150} value={form.specialty ?? ''} onChange={(value) => change('specialty', value)}/><Input label="Descripción" value={form.description ?? ''} onChange={(value) => change('description', value)}/></>}</div>{error && <p className="error-message" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Creando…' : 'Crear cuenta'}</button></div></form></Dialog>
}

function UserDetailDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const loader = useCallback(() => backendApi.getUser(id), [id])
  const { data, loading, error, reload, setData } = useApiResource(loader)
  if (loading) return <Dialog title="Detalle de usuario" onClose={onClose}><LoadingState/></Dialog>
  if (error || !data) return <Dialog title="Detalle de usuario" onClose={onClose}><ErrorState message={error || 'No se encontró el usuario.'} retry={() => void reload()}/></Dialog>
  return <Dialog title={`${data.firstName} ${data.lastName}`} onClose={onClose}><UserDetail user={data} onUpdated={(updated) => { setData(updated); onChanged() }}/></Dialog>
}

function UserDetail({ user, onUpdated }: { user: AdminUserDetail; onUpdated: (user: AdminUserDetail) => void }) {
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const updated = await backendApi.updateUser(user.id, { email, phone })
      onUpdated(updated)
      setNotice('Datos actualizados correctamente.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo actualizar el usuario.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus() {
    if (!window.confirm(`¿Confirmás ${user.status === 'ACTIVE' ? 'la desactivación' : 'la reactivación'} de esta cuenta?`)) return
    setError('')
    try {
      await backendApi.updateUserStatus(user.id, user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      const updated = await backendApi.getUser(user.id)
      onUpdated(updated)
      setNotice('Estado de la cuenta actualizado.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo cambiar el estado.')
    }
  }

  async function resetPassword() {
    setError('')
    setNotice('')
    try {
      await backendApi.resetUserPassword(user.id, temporaryPassword)
      setTemporaryPassword('')
      setNotice('Contraseña temporal asignada. El usuario deberá cambiarla al ingresar.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo restablecer la contraseña.')
    }
  }

  return <div><p><strong>{ROLE_LABEL[user.role]}</strong> · <span className={`badge ${user.status === 'ACTIVE' ? 'badge-info' : 'badge-disabled'}`}>{user.status === 'ACTIVE' ? 'Activa' : 'Desactivada'}</span></p><p>Documento: {user.documentNumber} · Alta: {formatDate(user.createdAt)}</p><form onSubmit={save}><div className="dialog-fields"><Input label="Correo electrónico" type="email" value={email} maxLength={255} onChange={setEmail}/><Input label="Teléfono" type="tel" value={phone} maxLength={30} onChange={setPhone}/></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={() => void toggleStatus()}>{user.status === 'ACTIVE' ? 'Desactivar cuenta' : 'Reactivar cuenta'}</button><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar datos'}</button></div></form><h3 className="detail-section-heading">Contraseña temporal</h3><div className="form-actions"><input aria-label="Nueva contraseña temporal" type="password" minLength={8} maxLength={72} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)}/><button className="button button-secondary" disabled={temporaryPassword.length < 8} onClick={() => void resetPassword()}>Restablecer</button></div>{user.membership && <p>Cuota: {user.membership.status === 'ACTIVE' ? 'vigente' : 'vencida'} hasta {formatDate(user.membership.expiresAt)}</p>}{user.trainerProfile && <p>{user.trainerProfile.specialty} · {user.trainerProfile.description}</p>}{user.payments.length > 0 && <><h3 className="detail-section-heading">Pagos recientes</h3>{user.payments.slice(0, 5).map((payment) => <p key={payment.id}>{formatDateTime(payment.accreditedAt)} · {money(payment.amount)} · {payment.status === 'VOIDED' ? 'Anulado' : 'Acreditado'}</p>)}</>}<AuditHistory userId={user.id}/>{notice && <p className="success-message" role="status">{notice}</p>}{error && <p className="error-message" role="alert">{error}</p>}</div>
}

function AuditHistory({ userId }: { userId: string }) {
  const loader = useCallback(() => backendApi.listUserAuditLogs(userId, 1, 10), [userId])
  const { data, loading, error, reload } = useApiResource(loader)
  const actionLabel: Record<string, string> = {
    CREATED: 'Cuenta creada',
    UPDATED: 'Datos modificados',
    ACTIVATED: 'Cuenta reactivada',
    DEACTIVATED: 'Cuenta desactivada',
    PASSWORD_RESET: 'Contraseña restablecida',
  }
  return <><h3 className="detail-section-heading">Historial de la cuenta</h3>{loading ? <LoadingState message="Cargando historial…"/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No hay acciones registradas."/> : data.items.map((item) => <p key={item.id}><strong>{actionLabel[item.action] ?? item.action}</strong> · {formatDateTime(item.occurredAt)}<span className="cell-subtext">{item.performedBy.firstName} {item.performedBy.lastName}{item.reason ? ` · ${item.reason}` : ''}</span></p>)}</>
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="dialog-backdrop" role="presentation"><section className="workspace-dialog" role="dialog" aria-modal="true" aria-label={title}><button className="dialog-close" aria-label="Cerrar" onClick={onClose}>×</button><span className="eyebrow">M-TEAM</span><h2>{title}</h2>{children}</section></div>
}

function Input({ label, value, onChange, type = 'text', required = true, minLength, maxLength, max, hint }: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  minLength?: number
  maxLength?: number
  max?: string
  hint?: string
}) {
  return <label className="read-field"><span>{label}</span><input type={type} required={required} minLength={minLength} maxLength={maxLength} max={max} value={value} onChange={(event) => onChange(event.target.value)}/>{hint && <small className="field-hint">{hint}</small>}</label>
}

function money(value: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value))
}
