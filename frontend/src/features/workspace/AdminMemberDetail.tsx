import { useCallback, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type AdminUserDetail } from '../../service/backend-api'
import { formatDate, formatDateTime } from '../../service/date-time'
import { Icon } from './Icon'
import { SafeImage } from './SafeImage'
import { StatusCard } from './StatusCard'
import './admin-member-detail.css'

const CERTIFICATE_LABELS: Record<string, string> = { APPROVED: 'Aprobado', PENDING: 'Pendiente', REJECTED: 'Rechazado' }

export function AdminMemberDetail({ user, backHref, onEdit, onPassword, onStatus, payments, audit, medical, children }: {
  user: AdminUserDetail; backHref: string; onEdit: () => void; onPassword: () => void; onStatus: () => void
  payments: ReactNode; audit: ReactNode; medical: ReactNode; children: ReactNode
}) {
  const loader = useCallback(async () => {
    const result = await backendApi.listAccessAttempts({ userId: user.id, result: 'ALLOWED', page: 1, limit: 1 })
    const attempt = result.items[0]
    if (attempt && attempt.result !== 'ALLOWED') throw new Error('El acceso no es permitido.')
    return attempt ?? null
  }, [user.id])
  const access = useApiResource(loader)
  const name = `${user.firstName} ${user.lastName}`
  const isActive = user.status === 'ACTIVE'
  const certificate = user.medicalCertificates[0]
  const accredited = user.payments.filter((payment) => payment.status === 'ACCREDITED')
  const total = accredited.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const location = [access.data?.branch?.name, access.data?.accessPoint?.name].filter(Boolean).join(' · ')
  const timestamp = access.data ? formatDateTime(access.data.attemptedAt) : ''
  const accessContent = access.loading ? <span role="status">Cargando acceso…</span> : access.error ? <span role="alert">No se pudo cargar. <button type="button" className="button button-secondary" onClick={() => void access.reload()}>Reintentar</button></span> : access.data ? <><time dateTime={access.data.attemptedAt} title={timestamp}>{timestamp.slice(0, 5)} · {timestamp.slice(-5)}</time>{location && <small>{location}</small>}</> : <span>Sin accesos registrados</span>
  const identity = <>
    <div className="member-detail-avatar">{user.photoUrl ? <SafeImage src={user.photoUrl} alt={`Foto de ${name}`} fallbackIcon="user"/> : `${user.firstName[0]}${user.lastName[0]}`}</div>
    <div className="member-detail-identity-copy"><h2>{name}</h2><p>Socio · Documento {user.documentNumber}</p><span className={`badge ${isActive ? 'badge-info' : 'badge-disabled'}`}>Cuenta {isActive ? 'activa' : 'desactivada'}</span></div>
  </>
  return <div className="app-page member-detail-screen">
    <header className="member-detail-heading"><h1>{name}</h1><p>Socio · Documento {user.documentNumber} · alta el {formatDate(user.createdAt)}</p></header>
    <Link className="member-detail-back" to={backHref}>Volver a usuarios</Link>
    <section className="surface-card member-detail-mobile-identity" aria-label="Resumen del socio">{identity}<div className="member-detail-inline-access"><span>Último acceso: </span>{accessContent}</div></section>
    <div className="member-detail-summary">
      <StatusCard label="Estado de cuota" value={user.membership ? user.membership.status === 'ACTIVE' ? 'Al día' : 'Vencida' : 'Sin cuota'} tone={user.membership?.status === 'ACTIVE' ? 'blue' : 'pink'} sub={user.membership ? `Vence el ${formatDate(user.membership.expiresAt)}` : 'Sin cuota acreditada'}/>
      <StatusCard label="Apto médico" value={certificate ? CERTIFICATE_LABELS[certificate.status] ?? certificate.status : 'Sin cargar'} tone={certificate?.status === 'APPROVED' ? 'blue' : certificate?.status === 'REJECTED' ? 'pink' : 'black'} sub={certificate?.reviewedAt ? `Revisado el ${formatDate(certificate.reviewedAt)}` : 'Sin revisión registrada'}/>
      <div className="member-detail-desktop-stat"><StatusCard label="Pagos acreditados" value={`${accredited.length} pagos`} tone="black" sub={`${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(total)} en total`}/></div>
      <article className="status-card member-detail-desktop-stat member-detail-access" aria-label="Último acceso"><span className="status-card-label">Último acceso</span><div>{accessContent}</div></article>
    </div>
    <div className="member-detail-actions">
      <Link className="button button-primary member-detail-pay" to="/admin/pagos"><Icon name="plus" size={18}/>Registrar pago</Link>
      <button type="button" className="button button-secondary member-detail-reset" onClick={onPassword}><Icon name="lock" size={18}/>Restablecer contraseña</button>
      <button type="button" aria-label="Editar datos" className="button button-secondary member-detail-edit" onClick={onEdit}><Icon name="edit" size={18}/><span className="member-desktop-label">Editar datos</span><span className="member-mobile-label">Editar</span></button>
      <button type="button" aria-label={isActive ? 'Desactivar cuenta' : 'Reactivar cuenta'} className={`button ${isActive ? 'button-danger' : 'button-secondary'} member-detail-state`} onClick={onStatus}><Icon name={isActive ? 'close' : 'check'} size={18}/>{isActive ? 'Desactivar' : 'Reactivar'}<span className="member-desktop-label"> cuenta</span></button>
    </div>
    <div className="member-detail-content">
      <main className="member-detail-main">{payments}{audit}</main>
      <aside className="member-detail-aside"><section className="surface-card member-detail-desktop-identity" aria-label="Tarjeta del socio">{identity}</section><MemberPersonalCard user={user}/>{medical}</aside>
    </div>
    {children}
  </div>
}

function MemberPersonalCard({ user }: { user: AdminUserDetail }) {
  return <section className="surface-card user-detail-card">
    <div className="user-detail-card-heading"><h2>Datos personales</h2></div>
    <dl className="user-detail-list"><MemberDataRow label="Documento" value={user.documentNumber}/><MemberDataRow label="Nacimiento" value={formatDate(user.birthDate)}/><MemberDataRow label="Correo" value={user.email}/><MemberDataRow label="Teléfono" value={user.phone}/></dl>
    <h3 className="member-emergency-title">Contacto de emergencia</h3>
    <dl className="user-detail-list"><MemberDataRow label={user.memberProfile?.emergencyContactName || 'Sin registrar'} value={user.memberProfile?.emergencyContactPhone || 'Sin teléfono registrado'}/></dl>
  </section>
}

function MemberDataRow({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}
