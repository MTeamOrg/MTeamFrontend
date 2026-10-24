import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type AdminMedicalCertificate, type MedicalCertificateStatus } from '../../service/backend-api'
import { addDays, formatDate, formatDateTime, gymDate } from '../../service/date-time'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'

const STATUS_LABEL: Record<MedicalCertificateStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
}

const STATUS_CLASS: Record<MedicalCertificateStatus, string> = {
  PENDING: 'badge-secondary',
  APPROVED: 'badge-info',
  REJECTED: 'badge-primary',
}

function certificateMember(certificate: AdminMedicalCertificate) {
  return `${certificate.member.firstName} ${certificate.member.lastName}`
}

const APPROVED_STATUS: MedicalCertificateStatus = 'APPROVED'
type UploadPeriod = '' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS'

function initialStatus(searchParams: URLSearchParams): MedicalCertificateStatus | '' {
  const value = searchParams.get('status')
  return value === 'APPROVED' || value === 'REJECTED' || value === 'PENDING' ? value : 'PENDING'
}

function getUploadDateRange(period: UploadPeriod) {
  if (!period) return { from: undefined, to: undefined }
  const to = gymDate()
  const days = period === 'TODAY' ? 0 : period === 'LAST_7_DAYS' ? 6 : 29
  return { from: addDays(to, -days), to }
}

interface MedicalCertificateMetrics {
  pending: number | null
  approved: number | null
  rejected: number | null
  initialPeriodMembers: number | null
}

export function AdminMedicalCertificatesScreen() {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<MedicalCertificateStatus | ''>(() => initialStatus(searchParams))
  const [uploadPeriod, setUploadPeriod] = useState<UploadPeriod>('')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const loader = useCallback(() => {
    const dateRange = getUploadDateRange(uploadPeriod)
    return backendApi.listAdminMedicalCertificates({
      search: search || undefined,
      status: status || undefined,
      ...dateRange,
      page,
      limit: 20,
    })
  }, [page, search, status, uploadPeriod])
  const { data, loading, error, reload } = useApiResource(loader)
  const metricsLoader = useCallback(async () => {
    const [dashboardResult, approvedResult] = await Promise.allSettled([
      backendApi.getAdminDashboardMetrics(),
      backendApi.listAdminMedicalCertificates({ status: APPROVED_STATUS, page: 1, limit: 1 }),
    ])
    const dashboard = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null
    return {
      pending: dashboard?.pendingMedicalCertificates ?? null,
      approved: approvedResult.status === 'fulfilled' ? approvedResult.value.total : null,
      rejected: dashboard?.rejectedMedicalCertificates ?? null,
      initialPeriodMembers: dashboard?.initialPeriodMembers ?? null,
    } satisfies MedicalCertificateMetrics
  }, [])
  const metrics = useApiResource(metricsLoader)

  function updateSearch(value: string) {
    setPage(1)
    setSearch(value)
  }

  function updateStatus(value: MedicalCertificateStatus | '') {
    setPage(1)
    setStatus(value)
  }

  function updateUploadPeriod(value: UploadPeriod) {
    setPage(1)
    setUploadPeriod(value)
  }

  const header = <PageHeader title="Aptos médicos" description="Bandeja de revisión. Al aprobar o rechazar se notifica al socio y queda registrado quién revisó y cuándo."/>
  if (loading) return <div className="app-page medical-admin-screen">{header}<div className="app-card"><LoadingState/></div></div>
  if (error || !data) return <div className="app-page medical-admin-screen">{header}<div className="app-card"><ErrorState message={error || 'No se pudieron cargar los certificados médicos.'} retry={() => void reload()}/></div></div>

  return <div className="app-page medical-admin-screen">
    {header}
    <div className="medical-admin-stat-grid">
      <Metric label="Pendientes de revisión" mobileLabel="Pendientes" value={metrics.data?.pending ?? null} unit="aptos" tone="purple" detail="Para revisar" mobileDetail="Para revisar"/>
      <Metric label="Aprobados" mobileLabel="Aprobados" value={metrics.data?.approved ?? null} unit="aptos" tone="blue" detail="Sin fecha de vencimiento" mobileDetail="Sin vencimiento"/>
      <Metric label="Rechazados" value={metrics.data?.rejected ?? null} unit="aptos" tone="pink" detail="Esperando una nueva carga" isMobileHidden/>
      <Metric label="Socios en período inicial" value={metrics.data?.initialPeriodMembers ?? null} unit="socios" tone="purple" detail="Pueden ingresar sin apto" isMobileHidden/>
    </div>
    <div className="medical-filter-toolbar" aria-label="Filtros de aptos médicos">
      <label className="search-shell"><Icon name="search" size={18}/><input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Buscar por socio o documento" aria-label="Buscar por socio o documento"/></label>
      <button type="button" className="medical-filter-toggle" aria-label="Mostrar filtros" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}><Icon name="filter" size={18}/></button>
      <div className={`medical-filter-fields${filtersOpen ? ' is-open' : ''}`}>
        <select value={status} onChange={(event) => updateStatus(event.target.value as MedicalCertificateStatus | '')} aria-label="Filtrar por estado">
          <option value="PENDING">Estado: pendientes</option>
          <option value="">Estado: todos</option>
          <option value="APPROVED">Estado: aprobados</option>
          <option value="REJECTED">Estado: rechazados</option>
        </select>
        <select className="medical-upload-period-filter" value={uploadPeriod} onChange={(event) => updateUploadPeriod(event.target.value as UploadPeriod)} aria-label="Filtrar por fecha de carga">
          <option value="">Fecha de carga: todas</option>
          <option value="TODAY">Fecha de carga: hoy</option>
          <option value="LAST_7_DAYS">Fecha de carga: últimos 7 días</option>
          <option value="LAST_30_DAYS">Fecha de carga: últimos 30 días</option>
        </select>
      </div>
    </div>
    <section className="surface-card medical-list-panel" aria-labelledby="medical-list-title">
      <div className="dashboard-section-title medical-list-heading">
        <div><h2 id="medical-list-title">Listado de aptos</h2><p>Consultá el estado y revisá el archivo autorizado del socio.</p></div>
      </div>
      {data.items.length ? <>
        <div className="medical-table-wrap">
          <table className="data-table medical-table">
            <thead><tr><th>Socio</th><th>Documento</th><th>Archivo</th><th>Cargado</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{data.items.map((certificate) => <tr key={certificate.id}>
              <td><strong>{certificateMember(certificate)}</strong></td>
              <td>{certificate.member.documentNumber}</td>
              <td><span className="medical-table-file"><Icon name="file" size={16}/>Documento de apto médico</span></td>
              <td>{formatDateTime(certificate.uploadedAt)}</td>
              <td><span className={`badge ${STATUS_CLASS[certificate.status]}`}>{STATUS_LABEL[certificate.status]}</span></td>
              <td><Link className={`button ${certificate.status === 'PENDING' ? 'button-primary' : 'button-secondary'} medical-review-button`} to={`/admin/aptos/${certificate.id}`}>{certificate.status === 'PENDING' ? 'Revisar' : 'Ver'}</Link></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="medical-mobile-list">{data.items.map((certificate) => <article className="medical-mobile-item" key={certificate.id}>
          <span className="medical-member-avatar">{certificate.member.firstName.slice(0, 1)}{certificate.member.lastName.slice(0, 1)}</span>
          <div><strong>{certificateMember(certificate)}</strong><small>{certificate.member.documentNumber} · Documento de apto médico · {formatDate(certificate.uploadedAt)}</small></div>
          <span className={`badge ${STATUS_CLASS[certificate.status]}`}>{STATUS_LABEL[certificate.status]}</span>
          <Link className="medical-mobile-item-link" to={`/admin/aptos/${certificate.id}`} aria-label={`${certificate.status === 'PENDING' ? 'Revisar' : 'Ver'} ${certificateMember(certificate)}`}><Icon name="chevron" size={18}/></Link>
        </article>)}</div>
        <div className="table-pagination"><span>Mostrando {data.items.length} de {data.total}</span><div><button type="button" className="button button-secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div></div>
      </> : <EmptyState message="No hay certificados que coincidan con los filtros."/>}
    </section>
  </div>
}

function Metric({ label, mobileLabel, value, unit, tone, detail, mobileDetail, isMobileHidden = false }: { label: string; mobileLabel?: string; value: number | null; unit: string; tone: 'purple' | 'blue' | 'pink' | 'black'; detail: string; mobileDetail?: string; isMobileHidden?: boolean }) {
  return <article className={`status-card medical-admin-metric tone-${tone}${isMobileHidden ? ' medical-admin-metric-desktop-only' : ''}`}>
    <span className="status-card-label medical-metric-label-desktop">{label}</span>
    {mobileLabel && <span className="status-card-label medical-metric-label-mobile">{mobileLabel}</span>}
    <strong className={`status-card-value tone-${tone}`}>{value === null ? '—' : `${value} ${unit}`}</strong>
    <span className="status-card-sub medical-metric-detail-desktop">{value === null ? 'No disponible' : detail}</span>
    {mobileDetail && <span className="status-card-sub medical-metric-detail-mobile">{value === null ? 'No disponible' : mobileDetail}</span>}
  </article>
}
