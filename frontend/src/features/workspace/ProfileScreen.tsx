import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { UserRole } from '../authentication/auth-types'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type OwnMedicalCertificateView, type OwnMembership, type OwnProfile, type Page, type Payment } from '../../service/backend-api'
import { formatDate, formatDateTime } from '../../service/date-time'
import { formatMoney } from '../dashboard/dashboard-data'
import { ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'
import { SafeImage } from './SafeImage'
import './profile.css'

interface MemberProfileData {
  membership: OwnMembership
  payments: Page<Payment>
  medical: OwnMedicalCertificateView
}

interface ProfilePageData {
  profile: OwnProfile
  member: MemberProfileData | null
}

async function loadMemberProfileData(): Promise<MemberProfileData> {
  const [membership, payments, medical] = await Promise.all([
    backendApi.getOwnMembership(),
    backendApi.listOwnPayments(1, 20),
    backendApi.getOwnMedicalCertificates(),
  ])
  return { membership, payments, medical }
}

export function ProfileScreen({ role, onPasswordChange }: { role: UserRole; onPasswordChange: () => void }) {
  const loader = useCallback(async (): Promise<ProfilePageData> => {
    const [profile, member] = await Promise.all([
      backendApi.getOwnProfile(),
      role === 'MEMBER' ? loadMemberProfileData() : Promise.resolve(null),
    ])
    return { profile, member }
  }, [role])
  const { data, loading, error, reload, setData } = useApiResource(loader)

  return <div className="app-page profile-page">
    <PageHeader title="Mi perfil" description="Tus datos, el estado de tu cuota y el historial de pagos, todo en un solo lugar."/>
    {loading
      ? <div className="app-card"><LoadingState/></div>
      : error || !data
        ? <div className="app-card"><ErrorState message={error || 'No se pudo cargar el perfil.'} retry={() => void reload()}/></div>
        : <ProfileContent
          profile={data.profile}
          member={data.member}
          role={role}
          onPasswordChange={onPasswordChange}
          onUpdated={(profile) => setData((current) => current ? { ...current, profile } : current)}
        />}
  </div>
}

function ProfileContent({ profile, member, role, onPasswordChange, onUpdated }: { profile: OwnProfile; member: MemberProfileData | null; role: UserRole; onPasswordChange: () => void; onUpdated: (profile: OwnProfile) => void }) {
  const isMember = role === 'MEMBER'
  return <div className="profile-layout">
    <main className="profile-primary">
      <PersonalDataCard profile={profile}/>
      <ContactDataCard profile={profile} role={role} onUpdated={onUpdated}/>
      {isMember && <MemberQuotaCard membership={member?.membership} loading={!member}/>}
      {isMember && <PaymentHistoryCard payments={member?.payments} loading={!member}/>}
    </main>
    <aside className="profile-secondary">
      <ProfileIdentityCard profile={profile} role={role} onUpdated={onUpdated}/>
      <SecurityCard onPasswordChange={onPasswordChange}/>
      {isMember && <MedicalSummaryCard medical={member?.medical} loading={!member}/>}
    </aside>
  </div>
}

function PersonalDataCard({ profile }: { profile: OwnProfile }) {
  return <section className="surface-card profile-section profile-personal-section" aria-labelledby="personal-data-title">
    <h2 id="personal-data-title">Datos personales</h2>
    <div className="profile-read-grid">
      <ReadOnlyField label="Nombre" value={profile.firstName}/>
      <ReadOnlyField label="Apellido" value={profile.lastName}/>
      <ReadOnlyField label="Documento" value={profile.documentNumber}/>
      <ReadOnlyField label="Fecha de nacimiento" value={formatDate(profile.birthDate)}/>
    </div>
    <p className="profile-help">El documento y la fecha de nacimiento solo pueden modificarlos un administrador.</p>
  </section>
}

function ContactDataCard({ profile, role, onUpdated }: { profile: OwnProfile; role: UserRole; onUpdated: (profile: OwnProfile) => void }) {
  const [email, setEmail] = useState(profile.email)
  const [phone, setPhone] = useState(profile.phone)
  const [emergencyName, setEmergencyName] = useState(profile.memberProfile?.emergencyContactName ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(profile.memberProfile?.emergencyContactPhone ?? '')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    setError('')
    try {
      const updated = await backendApi.updateOwnProfile({
        email,
        phone,
        ...(role === 'MEMBER' ? { emergencyContactName: emergencyName, emergencyContactPhone: emergencyPhone } : {}),
      })
      onUpdated(updated)
      setNotice('Cambios guardados correctamente.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setEmail(profile.email)
    setPhone(profile.phone)
    setEmergencyName(profile.memberProfile?.emergencyContactName ?? '')
    setEmergencyPhone(profile.memberProfile?.emergencyContactPhone ?? '')
    setNotice('')
    setError('')
  }

  return <section className="surface-card profile-section profile-contact-section" aria-labelledby="contact-data-title">
    <h2 id="contact-data-title">Datos de contacto</h2>
    <form onSubmit={submit}>
      <div className="profile-edit-grid">
        <EditableField label="Correo electrónico" value={email} type="email" onChange={setEmail}/>
        <EditableField label="Teléfono" value={phone} type="tel" onChange={setPhone}/>
      </div>
      {role === 'MEMBER' && <div className="profile-emergency-block"><h3>Contacto de emergencia</h3><div className="profile-edit-grid"><EditableField label="Nombre y apellido" value={emergencyName} onChange={setEmergencyName}/><EditableField label="Teléfono" value={emergencyPhone} type="tel" onChange={setEmergencyPhone}/></div></div>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="profile-form-actions">
        <button type="button" className="button button-secondary" onClick={cancel}>Cancelar</button>
        <button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
      {role === 'MEMBER' && <Link className="button button-secondary profile-mobile-medical-button" to="/socio/apto-medico"><Icon name="file" size={18}/>Apto médico</Link>}
    </form>
  </section>
}

function ProfileIdentityCard({ profile, role, onUpdated }: { profile: OwnProfile; role: UserRole; onUpdated: (profile: OwnProfile) => void }) {
  const [photoSaving, setPhotoSaving] = useState(false)
  const [error, setError] = useState('')

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('La foto debe estar en formato JPG o PNG.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La foto no puede superar los 5 MB.')
      return
    }
    setPhotoSaving(true)
    try {
      onUpdated(await backendApi.updateOwnPhoto(file))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo actualizar la foto de perfil.')
    } finally {
      setPhotoSaving(false)
    }
  }

  return <section className="surface-card profile-section profile-identity-section" aria-label="Resumen del perfil">
    <div className="profile-identity-avatar">{profile.photoUrl ? <SafeImage className="profile-photo" src={profile.photoUrl} alt={`Foto de ${profile.firstName} ${profile.lastName}`} fallbackIcon="user"/> : <span>{profile.firstName[0]}{profile.lastName[0]}</span>}</div>
    <h2>{profile.firstName} {profile.lastName}</h2>
    <span className="member-status">{role === 'MEMBER' ? 'Socio' : role === 'TRAINER' ? 'Entrenador' : 'Administrador'} · Cuenta {profile.status === 'ACTIVE' ? 'activa' : 'inactiva'}</span>
    <label className="button button-secondary profile-photo-action" htmlFor="profile-photo"><Icon name="image" size={18}/>{photoSaving ? 'Subiendo…' : 'Cambiar fotografía'}</label>
    <input id="profile-photo" className="sr-only" type="file" accept="image/jpeg,image/png" onChange={changePhoto} disabled={photoSaving}/>
    <small className="field-hint">JPG o PNG · máximo 5 MB</small>
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}

function SecurityCard({ onPasswordChange }: { onPasswordChange: () => void }) {
  return <section className="surface-card profile-section profile-security-section" aria-labelledby="security-title">
    <h2 id="security-title">Seguridad</h2>
    <p>Protegé tu cuenta con una contraseña segura.</p>
    <button type="button" className="button button-secondary" onClick={onPasswordChange}><Icon name="lock" size={18}/>Cambiar contraseña</button>
  </section>
}

function MedicalSummaryCard({ medical, loading }: { medical: OwnMedicalCertificateView | undefined; loading: boolean }) {
  const current = medical?.current
  const label = loading ? 'Cargando…' : current?.status === 'APPROVED' ? 'Aprobado' : current?.status === 'PENDING' ? 'Pendiente' : current?.status === 'REJECTED' ? 'Rechazado' : 'Sin cargar'
  return <section className="surface-card profile-section profile-medical-section" aria-labelledby="profile-medical-title">
    <div className="profile-section-title"><h2 id="profile-medical-title"><Icon name="file" size={18}/>Apto médico</h2>{!loading && <span className={`badge ${current?.status === 'APPROVED' ? 'badge-info' : current?.status === 'REJECTED' ? 'badge-primary' : 'badge-secondary'}`}>{label}</span>}</div>
    <dl className="profile-detail-list">
      <div><dt>Estado</dt><dd>{label}</dd></div>
      {current?.reviewedAt && <div><dt>Revisado</dt><dd>{formatDate(current.reviewedAt)}</dd></div>}
    </dl>
    <Link className="button button-secondary" to="/socio/apto-medico">Ver mi apto médico</Link>
  </section>
}

function MemberQuotaCard({ membership, loading }: { membership: OwnMembership | undefined; loading: boolean }) {
  return <section className="surface-card profile-section profile-quota-section" aria-labelledby="profile-quota-title">
    <div className="profile-section-title"><h2 id="profile-quota-title">Mi cuota</h2><Link className="text-link" to="/socio/pagos">Ver pagos</Link></div>
    {loading || !membership ? <LoadingState message="Cargando cuota…"/> : <div className="profile-quota-grid">
      <QuotaMetric label="Valor de la cuota" value={membership.currentPrice ? formatMoney(membership.currentPrice) : 'Sin configurar'} icon="wallet"/>
      <QuotaMetric label="Estado" value={membership.status === 'CURRENT' ? 'Acreditada' : membership.status === 'EXPIRING_SOON' ? 'Por vencer' : 'Vencida'} hint={membership.lastPaymentAt ? `Último pago: ${formatDateTime(membership.lastPaymentAt)}` : 'Sin pagos acreditados'} icon="check"/>
      <QuotaMetric label="Vence el" value={membership.expiresAt ? formatDate(membership.expiresAt) : 'Sin vencimiento'} hint={membership.expiresAt ? `Quedan ${membership.daysRemaining} días de vigencia` : undefined} icon="calendar"/>
    </div>}
  </section>
}

function QuotaMetric({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon: 'wallet' | 'check' | 'calendar' }) {
  return <article className="profile-quota-metric"><span className="profile-quota-icon"><Icon name={icon} size={18}/></span><div><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div></article>
}

function PaymentHistoryCard({ payments, loading }: { payments: Page<Payment> | undefined; loading: boolean }) {
  return <section className="surface-card profile-section profile-payments-section" aria-labelledby="profile-payments-title">
    <div className="profile-section-title"><h2 id="profile-payments-title">Historial de pagos</h2>{payments && <span className="profile-section-meta">{payments.total} pagos</span>}</div>
    {loading ? <LoadingState message="Cargando pagos…"/> : !payments?.items.length ? <p className="profile-empty-copy">Todavía no hay pagos registrados.</p> : <div className="profile-payment-list">{payments.items.map((payment) => <article className="profile-payment-row" key={payment.id}>
      <span className="profile-payment-icon"><Icon name="wallet" size={18}/></span>
      <div className="profile-payment-main"><strong>{formatDateTime(payment.accreditedAt)}</strong><span>{payment.method}{payment.receiptNumber ? ` · comprobante ${payment.receiptNumber}` : ''}</span><small>{payment.status === 'VOIDED' ? `Anulado${payment.voidReason ? ` · ${payment.voidReason}` : ''}` : `Vence el ${formatDate(payment.expiresAt)}`}</small></div>
      <strong className="profile-payment-amount">{formatMoney(payment.amount)}</strong>
      <span className={`badge ${payment.status === 'VOIDED' ? 'badge-primary' : 'badge-info'}`}>{payment.status === 'VOIDED' ? 'Anulado' : 'Acreditado'}</span>
    </article>)}</div>}
  </section>
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div className="profile-read-field"><span>{label}</span><strong>{value}</strong></div>
}

function EditableField({ label, value, type = 'text', onChange }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return <label className="read-field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)}/></label>
}
