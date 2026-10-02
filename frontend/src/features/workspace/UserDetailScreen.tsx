import { useCallback, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import {
  backendApi,
  type AdminUserDetail,
} from '../../service/backend-api'
import { formatDate, formatDateTime } from '../../service/date-time'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { MedicalCertificateFileButton } from './MedicalCertificateFileButton'
import { PageHeader } from './PageHeader'
import { SafeImage } from './SafeImage'
import { StatusCard } from './StatusCard'

const ROLE_LABEL = {
  MEMBER: 'Socio',
  TRAINER: 'Entrenador',
  ADMIN: 'Administrador',
} as const

const CERTIFICATE_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
}

const CERTIFICATE_CLASS: Record<string, string> = {
  PENDING: 'badge-secondary',
  APPROVED: 'badge-info',
  REJECTED: 'badge-primary',
}

const ACTION_LABEL: Record<string, string> = {
  CREATED: 'Cuenta creada',
  UPDATED: 'Datos modificados',
  ACTIVATED: 'Cuenta reactivada',
  DEACTIVATED: 'Cuenta desactivada',
  PASSWORD_RESET: 'Contraseña restablecida',
}

export function UserDetailScreen({ id }: { id: string }) {
  const location = useLocation()
  const loader = useCallback(() => backendApi.getUser(id), [id])
  const { data, loading, error, reload, setData } = useApiResource(loader)
  const [editorOpen, setEditorOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const backHref = `/admin/usuarios${location.search}`

  async function toggleStatus() {
    if (!data) return
    const nextStatus = data.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    if (!window.confirm(`¿Confirmás ${nextStatus === 'ACTIVE' ? 'la reactivación' : 'la desactivación'} de esta cuenta?`)) return
    setActionError('')
    setActionMessage('')
    try {
      await backendApi.updateUserStatus(data.id, nextStatus)
      setData(await backendApi.getUser(data.id))
      setActionMessage('Estado de la cuenta actualizado.')
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'No se pudo cambiar el estado.')
    }
  }

  function handleUpdated(updated: AdminUserDetail, message: string) {
    setData(updated)
    setEditorOpen(false)
    setActionMessage(message)
    setActionError('')
  }

  const header = data ? <PageHeader title={`${data.firstName} ${data.lastName}`} description={`${ROLE_LABEL[data.role]} · Documento ${data.documentNumber}`}>
    <div className="user-detail-actions user-detail-desktop-actions">
      {data.role === 'MEMBER' && <Link className="button button-primary" to="/admin/pagos"><Icon name="plus" size={18}/>Registrar pago</Link>}
      <button type="button" className="button button-secondary" onClick={() => setPasswordOpen(true)}><Icon name="lock" size={18}/>Restablecer contraseña</button>
      <button type="button" className="button button-secondary" onClick={() => setEditorOpen(true)}><Icon name="edit" size={18}/>Editar datos</button>
      <button type="button" className="button button-danger" onClick={() => void toggleStatus()}><Icon name={data.status === 'ACTIVE' ? 'close' : 'check'} size={18}/>{data.status === 'ACTIVE' ? 'Desactivar cuenta' : 'Reactivar cuenta'}</button>
    </div>
  </PageHeader> : <PageHeader title="Detalle de usuario"/>

  if (loading) return <div className="app-page user-detail-screen">{header}<section className="surface-card"><LoadingState message="Cargando detalle del usuario…"/></section></div>
  if (error || !data) return <div className="app-page user-detail-screen">{header}<Link className="user-detail-back" to={backHref}><Icon name="back" size={18}/>Volver a usuarios</Link><section className="surface-card"><ErrorState message={error || 'No se encontró el usuario.'} retry={() => void reload()}/></section></div>

  const latestCertificate = data.medicalCertificates[0]
  return <div className="app-page user-detail-screen">
    {header}
    <Link className="user-detail-back" to={backHref}><Icon name="back" size={18}/>Volver a usuarios</Link>
    {actionMessage && <p className="success-message" role="status">{actionMessage}</p>}
    {actionError && <p className="error-message" role="alert">{actionError}</p>}
    <div className="user-detail-mobile-summary">
      <IdentityCard user={data}/>
      <StatusSummary user={data}/>
      <MobileActions user={data} onEdit={() => setEditorOpen(true)} onToggle={() => void toggleStatus()}/>
    </div>
    <div className="user-detail-status-desktop"><StatusSummary user={data}/></div>
    <div className="user-detail-grid">
      <main className="user-detail-main">
        <PaymentsCard payments={data.payments}/>
        <AuditHistory userId={data.id}/>
      </main>
      <aside className="user-detail-aside user-detail-desktop-aside">
        <IdentityCard user={data}/>
        <PersonalCard user={data}/>
        <MedicalCard certificates={latestCertificate ? [latestCertificate] : []}/>
        {data.role === 'TRAINER' && <TrainerCard user={data}/>}
        {data.role === 'ADMIN' && <section className="surface-card user-detail-note"><h2>Información administrativa</h2><p>La cuenta tiene permisos de administrador según el rol informado por el backend.</p></section>}
      </aside>
    </div>
    {editorOpen && <UserEditorDialog user={data} onClose={() => setEditorOpen(false)} onUpdated={(updated) => handleUpdated(updated, 'Datos actualizados correctamente.')}/>}
    {passwordOpen && <PasswordDialog userId={data.id} onClose={() => setPasswordOpen(false)} onSaved={() => { setPasswordOpen(false); setActionMessage('Contraseña temporal asignada. El usuario deberá cambiarla al ingresar.'); setActionError('') }}/>}
  </div>
}

function IdentityCard({ user }: { user: AdminUserDetail }) {
  return <section className="surface-card user-detail-identity" aria-label="Resumen del usuario">
    <div className="user-detail-avatar">{user.photoUrl ? <SafeImage className="user-detail-photo" src={user.photoUrl} alt={`Foto de ${user.firstName} ${user.lastName}`} fallbackIcon="user"/> : <span>{user.firstName[0]}{user.lastName[0]}</span>}</div>
    <div className="user-detail-identity-copy"><span className="eyebrow">{ROLE_LABEL[user.role]}</span><h2>{user.firstName} {user.lastName}</h2><p>Alta: {formatDate(user.createdAt)} · Cuenta {user.status === 'ACTIVE' ? 'activa' : 'desactivada'}</p></div>
    <span className={`badge ${user.status === 'ACTIVE' ? 'badge-info' : 'badge-disabled'}`}>{user.status === 'ACTIVE' ? 'Activa' : 'Desactivada'}</span>
  </section>
}

function StatusSummary({ user }: { user: AdminUserDetail }) {
  const latestCertificate = user.medicalCertificates[0]
  const accreditedPayments = user.payments.filter((payment) => payment.status === 'ACCREDITED')
  const membershipValue = user.membership ? user.membership.status === 'ACTIVE' ? 'Al día' : 'Vencida' : user.status === 'ACTIVE' ? 'Activa' : 'Inactiva'
  const membershipTone = user.membership?.status === 'EXPIRED' || user.status === 'INACTIVE' ? 'pink' : 'blue'
  const medicalValue = latestCertificate ? CERTIFICATE_LABEL[latestCertificate.status] ?? latestCertificate.status : 'Sin cargar'
  const medicalTone = latestCertificate?.status === 'REJECTED' ? 'pink' : latestCertificate?.status === 'APPROVED' ? 'blue' : 'black'
  return <div className="status-grid user-detail-status-grid">
    <StatusCard label="Estado de cuenta" value={membershipValue} tone={membershipTone} sub={user.membership ? `Vence el ${formatDate(user.membership.expiresAt)}` : 'Sin cuota acreditada'}/>
    <StatusCard label="Apto médico" value={medicalValue} tone={medicalTone} sub={latestCertificate ? `Revisado el ${formatDate(latestCertificate.reviewedAt ?? latestCertificate.uploadedAt)}` : 'No disponible'}/>
    <StatusCard label="Pagos acreditados" value={`${accreditedPayments.length} pagos`} tone="black" sub={accreditedPayments[0] ? `Último: ${formatDate(accreditedPayments[0].accreditedAt)}` : 'Sin pagos acreditados'}/>
    <StatusCard label="Último acceso" value="No disponible" tone="black" sub="Dato no disponible en la API"/>
  </div>
}

function MobileActions({ user, onEdit, onToggle }: { user: AdminUserDetail; onEdit: () => void; onToggle: () => void }) {
  return <div className="user-detail-mobile-actions">
    {user.role === 'MEMBER' && <Link className="button button-primary" to="/admin/pagos"><Icon name="plus" size={18}/>Registrar pago</Link>}
    <button type="button" className="button button-secondary" onClick={onEdit}><Icon name="edit" size={18}/>Editar datos</button>
    <button type="button" className="button button-danger" onClick={onToggle}><Icon name={user.status === 'ACTIVE' ? 'close' : 'check'} size={18}/>{user.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}</button>
  </div>
}

function PersonalCard({ user }: { user: AdminUserDetail }) {
  return <section className="surface-card user-detail-card" aria-labelledby="personal-data-title"><div className="user-detail-card-heading"><h2 id="personal-data-title">Datos personales</h2><Icon name="user" size={20}/></div><dl className="user-detail-list"><InfoRow label="Documento" value={user.documentNumber}/><InfoRow label="Fecha de nacimiento" value={formatDate(user.birthDate)}/><InfoRow label="Correo" value={user.email}/><InfoRow label="Teléfono" value={user.phone}/>{user.memberProfile && <><InfoRow label="Contacto de emergencia" value={user.memberProfile.emergencyContactName || 'Sin registrar'}/><InfoRow label="Teléfono de emergencia" value={user.memberProfile.emergencyContactPhone || 'Sin registrar'}/></>}</dl></section>
}

function PaymentsCard({ payments }: { payments: AdminUserDetail['payments'] }) {
  return <section className="surface-card user-detail-card user-detail-list-card" aria-labelledby="payments-title"><div className="user-detail-card-heading"><h2 id="payments-title">Historial de pagos</h2></div>{payments.length ? <div className="user-detail-payment-list">{payments.slice(0, 8).map((payment) => <div className="user-detail-payment-row" key={payment.id}><span className="user-detail-payment-icon"><Icon name="wallet" size={17}/></span><div><strong>{formatDateTime(payment.accreditedAt)}</strong><small>{payment.method}{payment.receiptNumber ? ` · Comprobante ${payment.receiptNumber}` : ''}</small></div><strong>{money(payment.amount)}</strong><span className={`badge ${payment.status === 'VOIDED' ? 'badge-disabled' : 'badge-info'}`}>{payment.status === 'VOIDED' ? 'Anulado' : 'Acreditado'}</span></div>)}</div> : <EmptyState message="No hay pagos registrados."/>}</section>
}

function MedicalCard({ certificates }: { certificates: AdminUserDetail['medicalCertificates'] }) {
  return <section className="surface-card user-detail-card user-detail-list-card" aria-labelledby="medical-title"><div className="user-detail-card-heading"><h2 id="medical-title">Apto médico</h2><Icon name="file" size={20}/></div>{certificates.length ? <div className="user-detail-medical-list">{certificates.map((certificate) => <div className="user-detail-medical-row" key={certificate.id}><div><strong>{CERTIFICATE_LABEL[certificate.status] ?? certificate.status}</strong><small>Cargado el {formatDate(certificate.uploadedAt)}{certificate.reviewedAt ? ` · Revisado el ${formatDate(certificate.reviewedAt)}` : ''}</small>{certificate.reviewComment && <small>Observación: {certificate.reviewComment}</small>}</div><span className={`badge ${CERTIFICATE_CLASS[certificate.status] ?? 'badge-neutral'}`}>{CERTIFICATE_LABEL[certificate.status] ?? certificate.status}</span><div className="user-detail-medical-actions"><MedicalCertificateFileButton id={certificate.id} compact/><Link className="text-link" to={`/admin/aptos/${certificate.id}`}>{certificate.status === 'PENDING' ? 'Revisar' : 'Ver detalle'}</Link></div></div>)}</div> : <EmptyState message="No hay aptos médicos cargados."/>}</section>
}

function TrainerCard({ user }: { user: AdminUserDetail }) {
  return <><section className="surface-card user-detail-card" aria-labelledby="trainer-data-title"><div className="user-detail-card-heading"><h2 id="trainer-data-title">Perfil de entrenador</h2><Icon name="dumbbell" size={20}/></div><dl className="user-detail-list"><InfoRow label="Especialidad" value={user.trainerProfile?.specialty || 'Sin informar'}/><InfoRow label="Descripción" value={user.trainerProfile?.description || 'Sin informar'}/></dl><h3 className="user-detail-subheading">Sedes asignadas</h3>{user.trainerBranches.length ? <ul className="user-detail-simple-list">{user.trainerBranches.map((branch) => <li key={branch.id}><strong>{branch.name}</strong><span>{branch.address}</span></li>)}</ul> : <EmptyState message="No hay sedes asignadas."/>}</section><section className="surface-card user-detail-card user-detail-list-card" aria-labelledby="classes-title"><div className="user-detail-card-heading"><h2 id="classes-title">Clases asignadas</h2><span className="badge badge-neutral">{user.classes.length}</span></div>{user.classes.length ? <div className="user-detail-class-list">{user.classes.map((scheduledClass) => <div className="user-detail-class-row" key={scheduledClass.id}><Icon name="calendar" size={18}/><div><strong>{scheduledClass.activity}</strong><small>{formatDateTime(scheduledClass.startsAt)} · {scheduledClass.branch.name}</small></div></div>)}</div> : <EmptyState message="No hay clases asignadas."/>}</section></>
}

function AuditHistory({ userId }: { userId: string }) {
  const loader = useCallback(() => backendApi.listUserAuditLogs(userId, 1, 10), [userId])
  const { data, loading, error, reload } = useApiResource(loader)
  return <section className="surface-card user-detail-card user-detail-list-card" aria-labelledby="audit-title"><div className="user-detail-card-heading"><h2 id="audit-title"><span className="desktop-only">Historial de acciones sobre la cuenta</span><span className="mobile-only">Acciones sobre la cuenta</span></h2><Icon name="clock" size={20}/></div>{loading ? <LoadingState message="Cargando historial…"/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No hay acciones registradas."/> : <div className="user-detail-audit-list">{data.items.map((item) => <div className="user-detail-audit-row" key={item.id}><strong>{ACTION_LABEL[item.action] ?? item.action}</strong><span>{formatDateTime(item.occurredAt)}</span><small>{item.performedBy.firstName} {item.performedBy.lastName}{item.reason ? ` · ${item.reason}` : ''}</small></div>)}</div>}</section>
}

function UserEditorDialog({ user, onClose, onUpdated }: { user: AdminUserDetail; onClose: () => void; onUpdated: (user: AdminUserDetail) => void }) {
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(() => user.trainerBranches.map((branch) => branch.id))
  const branchLoader = useCallback(() => user.role === 'TRAINER' ? backendApi.listAdminBranches({ isActive: true, page: 1, limit: 100 }) : Promise.resolve({ items: [], page: 1, limit: 100, total: 0 }), [user.role])
  const branches = useApiResource(branchLoader)

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      onUpdated(await backendApi.updateUser(user.id, { email: email.trim(), phone: phone.trim() }))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo actualizar el usuario.')
    } finally {
      setSaving(false)
    }
  }

  async function saveBranches() {
    setSaving(true)
    setError('')
    try {
      onUpdated(await backendApi.updateTrainerBranches(user.id, selectedBranchIds))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudieron actualizar las sedes del entrenador.')
    } finally {
      setSaving(false)
    }
  }

  return <Dialog title="Editar datos" onClose={onClose}><p className="dialog-help">El documento, la fecha de nacimiento y el rol se consultan desde el backend y no se modifican desde este editor.</p><form onSubmit={(event) => void save(event)}><div className="dialog-fields"><Input label="Correo electrónico" type="email" value={email} onChange={setEmail}/><Input label="Teléfono" type="tel" value={phone} onChange={setPhone}/></div>{user.role === 'TRAINER' && <section className="trainer-branch-assignment"><h3>Sedes del entrenador</h3>{branches.loading ? <LoadingState message="Cargando sedes…"/> : branches.error ? <ErrorState message={branches.error} retry={() => void branches.reload()}/> : <><div className="trainer-branch-options">{branches.data?.items.map((branch) => <label key={branch.id} className="checkbox"><input type="checkbox" checked={selectedBranchIds.includes(branch.id)} onChange={(event) => setSelectedBranchIds((current) => event.target.checked ? [...current, branch.id] : current.filter((id) => id !== branch.id))}/>{branch.name}</label>)}</div><button type="button" className="button button-secondary" disabled={saving} onClick={() => void saveBranches()}>Guardar sedes</button></>}</section>}{error && <p className="error-message" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar datos'}</button></div></form></Dialog>
}

function PasswordDialog({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await backendApi.resetUserPassword(userId, password)
      onSaved()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo restablecer la contraseña.')
    } finally {
      setSaving(false)
    }
  }
  return <Dialog title="Restablecer contraseña" onClose={onClose}><p className="dialog-help">La nueva contraseña será temporal y el usuario deberá cambiarla al ingresar.</p><form onSubmit={(event) => void submit(event)}><Input label="Nueva contraseña temporal" type="password" value={password} minLength={8} maxLength={72} hint="Entre 8 y 72 caracteres." onChange={setPassword}/>{error && <p className="error-message" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={saving || password.length < 8}>{saving ? 'Guardando…' : 'Restablecer'}</button></div></form></Dialog>
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="dialog-backdrop" role="presentation"><section className="workspace-dialog" role="dialog" aria-modal="true" aria-label={title}><button className="dialog-close" aria-label="Cerrar" onClick={onClose}>×</button><span className="eyebrow">M-TEAM</span><h2>{title}</h2>{children}</section></div>
}

function Input({ label, value, onChange, type = 'text', required = true, minLength, maxLength, hint }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number; maxLength?: number; hint?: string }) {
  return <label className="read-field"><span>{label}</span><input type={type} required={required} minLength={minLength} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)}/>{hint && <small className="field-hint">{hint}</small>}</label>
}

function InfoRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return <div><dt>{label}</dt><dd className={valueClass}>{value}</dd></div>
}

function money(value: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value))
}
