import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import {
  backendApi,
  type AdminUserDetail,
} from '../../service/backend-api'
import { describeApiError } from '../../service/api-errors'
import { formatDate, formatDateTime, gymDate } from '../../service/date-time'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { MedicalCertificateFileButton } from './MedicalCertificateFileButton'
import { PageHeader } from './PageHeader'
import { SafeImage } from './SafeImage'
import { StatusCard } from './StatusCard'
import { AdminMemberDetail } from './AdminMemberDetail'
import { UserLastAccessCard } from './UserLastAccessCard'

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

export function UserDetailScreen({ id, onMemberLoaded }: { id: string; onMemberLoaded?: (user: AdminUserDetail | null) => void }) {
  const location = useLocation()
  const loader = useCallback(() => backendApi.getUser(id), [id])
  const { data, loading, error, reload, setData } = useApiResource(loader)
  useEffect(() => { onMemberLoaded?.(data?.role === 'MEMBER' ? data : null) }, [data, onMemberLoaded])
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [auditVersion, setAuditVersion] = useState(0)
  const [actionMessage, setActionMessage] = useState('')

  const backHref = `/admin/usuarios${location.search}`

  function handleUpdated(updated: AdminUserDetail, message: string) {
    setData(updated)
    setAuditVersion((current) => current + 1)
    setIsEditorOpen(false)
    setActionMessage(message)
  }

  function openAction(setIsOpen: (isOpen: boolean) => void) {
    setActionMessage('')
    setIsOpen(true)
  }

  const header = data ? <PageHeader title={`${data.firstName} ${data.lastName}`} description={`${ROLE_LABEL[data.role]} · Documento ${data.documentNumber}`}>
    <div className="user-detail-actions user-detail-desktop-actions">
      {data.role === 'MEMBER' && <Link className="button button-primary" to="/admin/pagos"><Icon name="plus" size={18}/>Registrar pago</Link>}
      <button type="button" className="button button-secondary" onClick={() => openAction(setIsPasswordOpen)}><Icon name="lock" size={18}/>Restablecer contraseña</button>
      <button type="button" className="button button-secondary" onClick={() => openAction(setIsEditorOpen)}><Icon name="edit" size={18}/>Editar datos</button>
      <button type="button" className="button button-danger" onClick={() => openAction(setIsStatusOpen)}><Icon name={data.status === 'ACTIVE' ? 'close' : 'check'} size={18}/>{data.status === 'ACTIVE' ? 'Desactivar cuenta' : 'Reactivar cuenta'}</button>
    </div>
  </PageHeader> : <PageHeader title="Detalle de usuario"/>

  if (loading) return <div className="app-page user-detail-screen">{header}<section className="surface-card"><LoadingState message="Cargando detalle del usuario…"/></section></div>
  if (error || !data) return <div className="app-page user-detail-screen">{header}<Link className="user-detail-back" to={backHref}><Icon name="back" size={18}/>Volver a usuarios</Link><section className="surface-card"><ErrorState message={error || 'No se encontró el usuario.'} retry={() => void reload()}/></section></div>

  const latestCertificate = data.medicalCertificates[0]
  if (data.role === 'MEMBER') return <AdminMemberDetail key={data.id} user={data} backHref={backHref} onEdit={() => openAction(setIsEditorOpen)} onPassword={() => openAction(setIsPasswordOpen)} onStatus={() => openAction(setIsStatusOpen)} payments={<PaymentsCard payments={data.payments} isMember/>} audit={<AuditHistory key={`${data.id}-${auditVersion}`} userId={data.id}/>} medical={<MedicalCard certificates={latestCertificate ? [latestCertificate] : []} isMember/>}>
    {actionMessage && <p className="success-message" role="status">{actionMessage}</p>}
    {isStatusOpen && <StatusDialog user={data} onClose={() => setIsStatusOpen(false)} onSaved={(updated) => { handleUpdated(updated, 'Estado de la cuenta actualizado.'); setIsStatusOpen(false) }}/>}
    {isEditorOpen && <UserEditorDialog key={data.id} user={data} onBranchesUpdated={(updated) => { setData(updated); setAuditVersion((current) => current + 1) }} onClose={() => setIsEditorOpen(false)} onUpdated={(updated) => handleUpdated(updated, 'Datos actualizados correctamente.')}/>}
    {isPasswordOpen && <PasswordDialog userId={data.id} onClose={() => { setIsPasswordOpen(false); void reload() }} onSaved={() => { setAuditVersion((current) => current + 1); setActionMessage('Contrase\u00f1a temporal generada. El usuario deber\u00e1 cambiarla al ingresar.') }}/>}
  </AdminMemberDetail>
  return <div className="app-page user-detail-screen">
    {header}
    <Link className="user-detail-back" to={backHref}><Icon name="back" size={18}/>Volver a usuarios</Link>
    {actionMessage && <p className="success-message" role="status">{actionMessage}</p>}
    <div className="user-detail-mobile-summary">
      <IdentityCard user={data}/>
      <MobileActions user={data} onEdit={() => openAction(setIsEditorOpen)} onToggle={() => openAction(setIsStatusOpen)} onPassword={() => openAction(setIsPasswordOpen)}/>
    </div>
    <div className="user-detail-summary"><StatusSummary user={data}/></div>
    <div className="user-detail-grid">
      <main className="user-detail-main">
        <AuditHistory key={`${data.id}-${auditVersion}`} userId={data.id}/>
      </main>
      <aside className="user-detail-aside">
        <div className="user-detail-desktop-identity"><IdentityCard user={data}/></div>
        <PersonalCard user={data}/>
        {data.role === 'TRAINER' && <TrainerCard user={data}/>}
        {data.role === 'ADMIN' && <section className="surface-card user-detail-note"><h2>Información administrativa</h2><p>La cuenta tiene permisos de administrador según el rol informado por el backend.</p></section>}
      </aside>
    </div>
    {isStatusOpen && <StatusDialog user={data} onClose={() => setIsStatusOpen(false)} onSaved={(updated) => { handleUpdated(updated, 'Estado de la cuenta actualizado.'); setIsStatusOpen(false) }}/>}
    {isEditorOpen && <UserEditorDialog key={data.id} user={data} onBranchesUpdated={(updated) => { setData(updated); setAuditVersion((current) => current + 1) }} onClose={() => setIsEditorOpen(false)} onUpdated={(updated) => handleUpdated(updated, 'Datos actualizados correctamente.')}/>}
    {isPasswordOpen && <PasswordDialog userId={data.id} onClose={() => { setIsPasswordOpen(false); void reload() }} onSaved={() => { setAuditVersion((current) => current + 1); setActionMessage('Contraseña temporal generada. El usuario deberá cambiarla al ingresar.') }}/>}
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
  if (user.role !== 'MEMBER') return <div className="status-grid user-detail-status-grid"><StatusCard label="Estado de cuenta" value={user.status === 'ACTIVE' ? 'Activa' : 'Desactivada'} tone={user.status === 'ACTIVE' ? 'blue' : 'pink'} sub={ROLE_LABEL[user.role]}/>{user.role === 'TRAINER' && <UserLastAccessCard userId={user.id}/>}</div>
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
    <UserLastAccessCard userId={user.id}/>
  </div>
}

function MobileActions({ user, onEdit, onToggle, onPassword }: { user: AdminUserDetail; onEdit: () => void; onToggle: () => void; onPassword: () => void }) {
  return <div className="user-detail-mobile-actions">
    {user.role === 'MEMBER' && <Link className="button button-primary" to="/admin/pagos"><Icon name="plus" size={18}/>Registrar pago</Link>}
    <button type="button" className="button button-secondary" onClick={onPassword}><Icon name="lock" size={18}/>Restablecer contraseña</button>
    <button type="button" className="button button-secondary" onClick={onEdit}><Icon name="edit" size={18}/>Editar datos</button>
    <button type="button" className="button button-danger" onClick={onToggle}><Icon name={user.status === 'ACTIVE' ? 'close' : 'check'} size={18}/>{user.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}</button>
  </div>
}

function PersonalCard({ user }: { user: AdminUserDetail }) {
  return <section className="surface-card user-detail-card" aria-labelledby="personal-data-title"><div className="user-detail-card-heading"><h2 id="personal-data-title">Datos personales</h2><Icon name="user" size={20}/></div><dl className="user-detail-list"><InfoRow label="Documento" value={user.documentNumber}/><InfoRow label="Fecha de nacimiento" value={formatDate(user.birthDate)}/><InfoRow label="Correo" value={user.email}/><InfoRow label="Teléfono" value={user.phone}/>{user.memberProfile && <><InfoRow label="Contacto de emergencia" value={user.memberProfile.emergencyContactName || 'Sin registrar'}/><InfoRow label="Teléfono de emergencia" value={user.memberProfile.emergencyContactPhone || 'Sin registrar'}/></>}</dl></section>
}

function PaymentsCard({ payments, isMember = false }: { payments: AdminUserDetail['payments']; isMember?: boolean }) {
  return <section className="surface-card user-detail-card user-detail-list-card" aria-labelledby="payments-title"><div className="user-detail-card-heading"><h2 id="payments-title">Historial de pagos</h2></div>{payments.length ? <div className="user-detail-payment-list">{payments.slice(0, 8).map((payment) => <div className="user-detail-payment-row" key={payment.id}><span className="user-detail-payment-icon"><Icon name="wallet" size={17}/></span><div><strong>{formatDateTime(payment.accreditedAt)}</strong><small>{payment.method}{payment.receiptNumber ? ` · Comprobante ${payment.receiptNumber}` : ''}</small>{isMember && <small className="member-payment-extra">{payment.status === 'VOIDED' ? payment.voidReason ? `Anulado: ${payment.voidReason}` : 'Pago anulado' : `Vence el ${formatDate(payment.expiresAt)}`}</small>}</div><strong>{money(payment.amount)}</strong><span className={`badge ${payment.status === 'VOIDED' ? 'badge-disabled' : 'badge-info'}`}>{payment.status === 'VOIDED' ? 'Anulado' : 'Acreditado'}</span></div>)}</div> : <EmptyState message="No hay pagos registrados."/>}</section>
}

function MedicalCard({ certificates, isMember = false }: { certificates: AdminUserDetail['medicalCertificates']; isMember?: boolean }) {
  return <section className="surface-card user-detail-card user-detail-list-card" aria-labelledby="medical-title"><div className="user-detail-card-heading"><h2 id="medical-title">Apto médico</h2><Icon name="file" size={20}/></div>{certificates.length ? <div className="user-detail-medical-list">{certificates.map((certificate) => <div className="user-detail-medical-row" key={certificate.id}><div><strong>{CERTIFICATE_LABEL[certificate.status] ?? certificate.status}</strong><small>Cargado el {formatDate(certificate.uploadedAt)}{certificate.reviewedAt ? ` · Revisado el ${formatDate(certificate.reviewedAt)}` : ''}</small>{certificate.reviewComment && <small>Observación: {certificate.reviewComment}</small>}</div><span className={`badge ${CERTIFICATE_CLASS[certificate.status] ?? 'badge-neutral'}`}>{CERTIFICATE_LABEL[certificate.status] ?? certificate.status}</span><div className="user-detail-medical-actions"><MedicalCertificateFileButton id={certificate.id} compact/><Link className={isMember ? 'button button-secondary' : 'text-link'} to={`/admin/aptos/${certificate.id}`}>{certificate.status === 'PENDING' ? 'Revisar' : 'Ver detalle'}</Link></div></div>)}</div> : <EmptyState message="No hay aptos médicos cargados."/>}</section>
}

function TrainerCard({ user }: { user: AdminUserDetail }) {
  return <><section className="surface-card user-detail-card" aria-labelledby="trainer-data-title"><div className="user-detail-card-heading"><h2 id="trainer-data-title">Perfil de entrenador</h2><Icon name="dumbbell" size={20}/></div><dl className="user-detail-list"><InfoRow label="Especialidad" value={user.trainerProfile?.specialty || 'Sin informar'}/><InfoRow label="Descripción" value={user.trainerProfile?.description || 'Sin informar'}/></dl><h3 className="user-detail-subheading">Sedes asignadas</h3>{user.trainerBranches.length ? <ul className="user-detail-simple-list">{user.trainerBranches.map((branch) => <li key={branch.id}><strong>{branch.name}</strong><span>{branch.address}</span></li>)}</ul> : <EmptyState message="No hay sedes asignadas."/>}</section><section className="surface-card user-detail-card user-detail-list-card" aria-labelledby="classes-title"><div className="user-detail-card-heading"><h2 id="classes-title">Clases asignadas</h2><span className="badge badge-neutral">{user.classes.length}</span></div>{user.classes.length ? <div className="user-detail-class-list">{user.classes.map((scheduledClass) => <div className="user-detail-class-row" key={scheduledClass.id}><Icon name="calendar" size={18}/><div><strong>{scheduledClass.activity}</strong><small>{formatDateTime(scheduledClass.startsAt)} · {scheduledClass.branch.name}</small></div></div>)}</div> : <EmptyState message="No hay clases asignadas."/>}</section></>
}

function AuditHistory({ userId }: { userId: string }) {
  const loader = useCallback(() => backendApi.listUserAuditLogs(userId, 1, 10), [userId])
  const { data, loading, error, reload } = useApiResource(loader)
  return <section className="surface-card user-detail-card user-detail-list-card" aria-labelledby="audit-title"><div className="user-detail-card-heading"><h2 id="audit-title"><span className="desktop-only">Historial de acciones sobre la cuenta</span><span className="mobile-only">Acciones sobre la cuenta</span></h2><Icon name="clock" size={20}/></div>{loading ? <LoadingState message="Cargando historial…"/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No hay acciones registradas."/> : <div className="user-detail-audit-list">{data.items.map((item) => <div className="user-detail-audit-row" key={item.id}><strong>{ACTION_LABEL[item.action] ?? item.action}</strong><span>{formatDateTime(item.occurredAt)}</span><small>{item.performedBy.firstName} {item.performedBy.lastName}{item.reason ? ` · ${item.reason}` : ''}</small></div>)}</div>}</section>
}

function UserEditorDialog({ user, onClose, onUpdated, onBranchesUpdated }: { user: AdminUserDetail; onClose: () => void; onUpdated: (user: AdminUserDetail) => void; onBranchesUpdated: (user: AdminUserDetail) => void }) {
  const [form, setForm] = useState(() => ({ firstName: user.firstName, lastName: user.lastName, documentNumber: user.documentNumber, birthDate: user.birthDate.slice(0, 10), email: user.email, phone: user.phone, emergencyContactName: user.memberProfile?.emergencyContactName ?? '', emergencyContactPhone: user.memberProfile?.emergencyContactPhone ?? '', specialty: user.trainerProfile?.specialty ?? '', description: user.trainerProfile?.description ?? '', reason: '' }))
  const change = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(() => user.trainerBranches.map((branch) => branch.id))
  const [branchMessage, setBranchMessage] = useState('')
  const branchLoader = useCallback(async () => {
    if (user.role !== 'TRAINER') return []
    const result = await backendApi.listAdminBranches({ page: 1, limit: 100 })
    const items = [...result.items]
    for (let page = 2; items.length < result.total; page += 1) {
      const next = await backendApi.listAdminBranches({ page, limit: 100 })
      if (!next.items.length) break
      items.push(...next.items)
    }
    return items
  }, [user.role])
  const branches = useApiResource(branchLoader)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError('')
    try {
      const common = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), documentNumber: form.documentNumber.trim(), birthDate: form.birthDate, email: form.email.trim(), phone: form.phone.trim() }
      if (Object.values(common).some((value) => !value) || (user.role === 'TRAINER' && (!form.specialty.trim() || !form.description.trim()))) throw new Error('Completá todos los campos obligatorios.')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(common.email)) throw new Error('Ingresá un correo electrónico válido.')
      if (!/\d/.test(common.documentNumber)) throw new Error('El documento debe contener al menos un número.')
      if (common.birthDate > gymDate()) throw new Error('La fecha de nacimiento no puede ser futura.')
      onUpdated(await backendApi.updateUser(user.id, { ...common, ...(user.role === 'MEMBER' ? { emergencyContactName: form.emergencyContactName.trim(), emergencyContactPhone: form.emergencyContactPhone.trim() } : {}), ...(user.role === 'TRAINER' ? { specialty: form.specialty.trim(), description: form.description.trim() } : {}), ...(form.reason.trim() ? { reason: form.reason.trim() } : {}) }))
    } catch (value) {
      setError(describeApiError(value, 'No se pudo actualizar el usuario.', { documentNumber: 'Documento', email: 'Correo electrónico', birthDate: 'Fecha de nacimiento' }))
    } finally {
      setIsSaving(false)
    }
  }

  async function saveBranches() {
    if (isSaving) return
    setIsSaving(true)
    setError('')
    setBranchMessage('')
    try {
      if (selectedBranchIds.length > 50) throw new Error('Podés asignar hasta 50 sedes.')
      onBranchesUpdated(await backendApi.updateTrainerBranches(user.id, selectedBranchIds))
      setBranchMessage('Sedes actualizadas correctamente. Los datos personales se guardan por separado.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudieron actualizar las sedes del entrenador.')
    } finally {
      setIsSaving(false)
    }
  }

  return <Dialog title="Editar datos" onClose={() => { if (!isSaving) onClose() }}><div className="admin-user-editor"><p className="dialog-help">{ROLE_LABEL[user.role]} · Cuenta {user.status === 'ACTIVE' ? 'activa' : 'desactivada'}. El rol y el estado se consultan aquí. Los campos marcados con * son obligatorios.</p><form noValidate onSubmit={(event) => void save(event)}><fieldset disabled={isSaving}><legend>Datos personales</legend><div className="dialog-fields">
    <Input label="Nombre *" value={form.firstName} maxLength={100} onChange={(value) => change('firstName', value)}/>
    <Input label="Apellido *" value={form.lastName} maxLength={100} onChange={(value) => change('lastName', value)}/>
    <Input label="Documento *" value={form.documentNumber} maxLength={30} onChange={(value) => change('documentNumber', value)}/>
    <Input label="Fecha de nacimiento *" type="date" value={form.birthDate} onChange={(value) => change('birthDate', value)}/>
    <Input label="Correo electrónico *" type="email" value={form.email} maxLength={255} onChange={(value) => change('email', value)}/>
    <Input label="Teléfono *" type="tel" value={form.phone} maxLength={30} onChange={(value) => change('phone', value)}/>
    </div></fieldset>
    {user.role === 'MEMBER' && <fieldset disabled={isSaving}><legend>Contacto de emergencia</legend><div className="dialog-fields"><Input label="Nombre del contacto" required={false} value={form.emergencyContactName} maxLength={200} onChange={(value) => change('emergencyContactName', value)}/><Input label="Teléfono de emergencia" required={false} type="tel" value={form.emergencyContactPhone} maxLength={30} onChange={(value) => change('emergencyContactPhone', value)}/></div></fieldset>}
    {user.role === 'TRAINER' && <fieldset disabled={isSaving}><legend>Perfil profesional</legend><p>La fotografía se consulta en el detalle. Su actualización está disponible desde la cuenta del entrenador.</p><div className="dialog-fields"><Input label="Especialidad *" value={form.specialty} maxLength={150} onChange={(value) => change('specialty', value)}/><label className="read-field"><span>Descripción *</span><textarea required rows={4} value={form.description} onChange={(event) => change('description', event.target.value)}/></label></div></fieldset>}
    <Input disabled={isSaving} label="Motivo de la modificación (opcional)" required={false} maxLength={500} value={form.reason} onChange={(value) => change('reason', value)}/>
    <p className="dialog-help">El historial registra la fecha y el administrador responsable.</p>
    {user.role === 'TRAINER' && <section className="trainer-branch-assignment"><h3>Sedes del entrenador</h3><p>Se guardan por separado de los datos personales.</p>{branchMessage && <p className="success-message" role="status">{branchMessage}</p>}{branches.loading ? <LoadingState message="Cargando sedes…"/> : branches.error ? <ErrorState message={branches.error} retry={() => void branches.reload()}/> : <><div className="trainer-branch-options">{[...(branches.data ?? []), ...user.trainerBranches.filter((assigned) => !branches.data?.some((branch) => branch.id === assigned.id))].map((branch) => <label key={branch.id} className="checkbox"><input type="checkbox" disabled={isSaving} checked={selectedBranchIds.includes(branch.id)} onChange={(event) => setSelectedBranchIds((current) => event.target.checked ? [...current, branch.id] : current.filter((id) => id !== branch.id))}/>{branch.name}</label>)}</div><button type="button" className="button button-secondary" disabled={isSaving} onClick={() => void saveBranches()}>Guardar sedes</button></>}</section>}{error && <p className="error-message" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" disabled={isSaving} onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar datos'}</button></div></form></div></Dialog>
}

function StatusDialog({ user, onClose, onSaved }: { user: AdminUserDetail; onClose: () => void; onSaved: (user: AdminUserDetail) => void }) {
  const [reason, setReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const isActive = user.status === 'ACTIVE'
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError('')
    try {
      await backendApi.updateUserStatus(user.id, isActive ? 'INACTIVE' : 'ACTIVE', reason.trim() || undefined)
      onSaved({ ...user, status: isActive ? 'INACTIVE' : 'ACTIVE' })
    } catch (value) { setError(describeApiError(value, 'No se pudo cambiar el estado.')) }
    finally { setIsSaving(false) }
  }
  return <Dialog title={isActive ? 'Desactivar cuenta' : 'Reactivar cuenta'} onClose={() => { if (!isSaving) onClose() }}><form onSubmit={(event) => void submit(event)}><p>¿Confirmás {isActive ? 'la desactivación' : 'la reactivación'} de la cuenta de {user.firstName} {user.lastName}?</p><Input label="Motivo (opcional)" required={false} value={reason} onChange={setReason}/>{error && <p className="error-message" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" disabled={isSaving} onClick={onClose}>Cancelar</button><button className={`button ${user.role === 'MEMBER' && isActive ? 'button-danger' : 'button-primary'}`} disabled={isSaving}>{isSaving ? 'Guardando…' : 'Confirmar cambio de estado'}</button></div></form></Dialog>
}

function PasswordDialog({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError('')
    try {
      const result = await backendApi.resetUserPassword(userId)
      setTemporaryPassword(result.temporaryPassword)
      onSaved()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo restablecer la contraseña.')
    } finally {
      setIsSaving(false)
    }
  }
  return <Dialog title="Restablecer contraseña" onClose={() => { if (!isSaving) onClose() }}>
    {!temporaryPassword ? <>
      <p className="dialog-help">Se generará una contraseña aleatoria. El usuario deberá cambiarla al ingresar.</p>
      <form onSubmit={(event) => void submit(event)}>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button-secondary" disabled={isSaving} onClick={onClose}>Cancelar</button>
          <button className="button button-primary" disabled={isSaving}>{isSaving ? 'Generando…' : 'Generar contraseña temporal'}</button>
        </div>
      </form>
    </> : <>
      <p className="dialog-help">Copiá esta contraseña y compartila directamente con el usuario. Solo se muestra ahora; no se incluye en notificaciones ni en el historial.</p>
      <label className="read-field"><span>Contraseña temporal</span><input aria-label="Contraseña temporal generada" type="text" readOnly value={temporaryPassword} onFocus={(event) => event.currentTarget.select()}/></label>
      {error && <p className="error-message" role="alert">{error}</p>}
      {isCopied && <p role="status">Contraseña copiada.</p>}
      <div className="dialog-actions">
        <button type="button" className="button button-secondary" onClick={() => void navigator.clipboard.writeText(temporaryPassword).then(() => { setIsCopied(true); setError('') }).catch(() => setError('No se pudo copiar. Seleccioná la contraseña y copiala manualmente.'))}>Copiar</button>
        <button type="button" className="button button-primary" onClick={onClose}>Cerrar</button>
      </div>
    </>}
  </Dialog>
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => previousFocus?.focus()
  }, [])
  return <div className="dialog-backdrop" role="presentation"><section ref={dialogRef} tabIndex={-1} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
    if (event.key !== 'Tab') return
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]') ?? []).filter((control) => !control.closest('fieldset:disabled'))
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus() }
  }} className="workspace-dialog" role="dialog" aria-modal="true" aria-label={title}><button className="dialog-close" aria-label="Cerrar" onClick={onClose}>×</button><span className="eyebrow">M-TEAM</span><h2>{title}</h2>{children}</section></div>
}

function Input({ label, value, onChange, type = 'text', required = true, minLength, maxLength, hint, disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number; maxLength?: number; hint?: string; disabled?: boolean }) {
  return <label className="read-field"><span>{label}</span><input disabled={disabled} type={type} required={required} minLength={minLength} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)}/>{hint && <small className="field-hint">{hint}</small>}</label>
}

function InfoRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return <div><dt>{label}</dt><dd className={valueClass}>{value}</dd></div>
}

function money(value: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value))
}
