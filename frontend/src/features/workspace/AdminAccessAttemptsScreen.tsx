import { useCallback, useEffect, useState } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import { useEnterSearch } from '../../hooks/use-enter-search'
import { addDays, formatDateTime, formatTime, gymDate } from '../../service/date-time'
import { backendApi, type AccessAttemptResult } from '../../service/backend-api'
import type { UserRole } from '../authentication/auth-types'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'

type AccessResult = '' | 'ALLOWED' | 'DENIED'
type AccessPeriod = 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'ALL'

interface AccessDateRange {
  from?: string
  to?: string
}

interface AccessSummary {
  total: number
  allowed: number
  denied: number
  distinctMembers: number
}

const EMPTY_LABEL = '\u2014'
const PAGE_SIZE = 20
const SUMMARY_PAGE_SIZE = 100
const ACCESS_DESCRIPTION = 'Consult\u00e1 los intentos de ingreso permitidos y rechazados, con su motivo.'
const PERIOD_OPTIONS: Array<{ value: AccessPeriod; label: string }> = [
  { value: 'TODAY', label: 'Hoy' },
  { value: 'LAST_7_DAYS', label: '\u00daltimos 7 d\u00edas' },
  { value: 'LAST_30_DAYS', label: '\u00daltimos 30 d\u00edas' },
  { value: 'ALL', label: 'Todo el historial' },
]
const ROLE_LABELS: Record<UserRole, string> = {
  MEMBER: 'Socio',
  TRAINER: 'Entrenador',
  ADMIN: 'Administrador',
}
const REASON_LABELS: Record<string, string> = {
  INVALID_QR: 'QR inv\u00e1lido',
  INACTIVE_USER: 'Cuenta desactivada',
  INACTIVE_BRANCH: 'Sede desactivada',
  INACTIVE_ACCESS_POINT: 'Punto desactivado',
  EXPIRED_MEMBERSHIP: 'Cuota vencida',
  MEDICAL_CERTIFICATE_REQUIRED: 'Apto m\u00e9dico requerido',
}

export function AdminAccessAttemptsScreen() {
  const enterSearch = useEnterSearch()
  const { inputValue: search, setInputValue: setSearch, submittedValue: submittedSearch, requestKey: searchRequestKey, isSearchPending, submitSearch, syncLoading } = enterSearch
  const [role, setRole] = useState<UserRole | ''>('')
  const [result, setResult] = useState<AccessResult>('')
  const [branchId, setBranchId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [period, setPeriod] = useState<AccessPeriod>('TODAY')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const loader = useCallback(() => {
    void searchRequestKey
    return backendApi.listAccessAttempts({
    page,
    limit: PAGE_SIZE,
    role: role || undefined,
    result: result || undefined,
    branchId: branchId || undefined,
    search: submittedSearch.trim() || undefined,
    ...getHistoryDateRange(period, from, to),
    })
  }, [branchId, from, page, period, result, role, searchRequestKey, submittedSearch, to])
  const summaryLoader = useCallback(() => loadAccessSummary(getAccessPeriodRange(period)), [period])
  const branchesLoader = useCallback(() => backendApi.listAdminBranches({ page: 1, limit: 100 }), [])
  const { data, loading, error, reload } = useApiResource(loader)
  const isSearchLoading = isSearchPending || (loading && data !== null)
  useEffect(() => syncLoading(loading), [loading, syncLoading])
  const summary = useApiResource(summaryLoader)
  const { data: branches } = useApiResource(branchesLoader)

  return <div className="app-page admin-access-screen">
    <PageHeader title="Accesos" description={ACCESS_DESCRIPTION}/>
    <AccessSummary summary={summary.data} loading={summary.loading} error={summary.error} period={period}/>
    <div className="toolbar access-history-filters">
      <label className="search-shell"><Icon name="search" size={18}/><input aria-label="Buscar por usuario o documento" placeholder="Buscar por usuario o documento" value={search} aria-busy={isSearchLoading} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (submitSearch()) setPage(1) } }}/></label>
      <button type="button" className="access-history-filter-toggle" aria-label="Mostrar filtros" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}><Icon name="filter" size={18}/></button>
      <div className={`access-filter-fields${filtersOpen ? ' is-open' : ''}`}>
        <label className="visually-hidden" htmlFor="access-branch">Sede</label><select id="access-branch" aria-label="Filtrar por sede" value={branchId} onChange={(event) => { setPage(1); setBranchId(event.target.value) }}><option value="">Sede: todas</option>{branches?.items.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        <label className="visually-hidden" htmlFor="access-role">Rol</label><select id="access-role" aria-label="Filtrar por rol" value={role} onChange={(event) => { setPage(1); setRole(event.target.value as UserRole | '') }}><option value="">Rol: todos</option><option value="MEMBER">Socio</option><option value="TRAINER">Entrenador</option><option value="ADMIN">Administrador</option></select>
        <label className="visually-hidden" htmlFor="access-result">Resultado</label><select id="access-result" aria-label="Filtrar por resultado" value={result} onChange={(event) => { setPage(1); setResult(event.target.value as AccessResult) }}><option value="">Resultado: todos</option><option value="ALLOWED">Permitidos</option><option value="DENIED">Rechazados</option></select>
        <label className="access-date-filter"><span>Desde</span><input aria-label="Desde" type="date" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value) }}/></label>
        <label className="access-date-filter"><span>Hasta</span><input aria-label="Hasta" type="date" value={to} onChange={(event) => { setPage(1); setTo(event.target.value) }}/></label>
      </div>
      <label className="access-period-filter"><span className="visually-hidden">Período</span><select aria-label="Filtrar por período" value={period} onChange={(event) => { setPage(1); setPeriod(event.target.value as AccessPeriod) }}>{PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    </div>
    {error && data && <p className="error-message" role="alert">{error} <button type="button" className="text-link" onClick={() => void reload()}>Reintentar</button></p>}
    {loading && !data ? <LoadingState message="Cargando accesos…"/> : !data ? <ErrorState message={error || 'No se pudieron cargar los accesos.'} retry={() => void reload()}/> : !data.items.length ? <EmptyState message="No hay intentos de ingreso que coincidan con los filtros."/> : <>
      <div className="table-scroll access-history-table-wrap">
        <table className="data-table access-history-table"><thead><tr><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Sede</th><th scope="col">Fecha y hora</th><th scope="col">Resultado</th></tr></thead><tbody>{data.items.map((attempt) => <AccessRow key={attempt.id} attempt={attempt}/>)}</tbody></table>
      </div>
      <div className="access-mobile-list">{data.items.map((attempt) => <AccessMobileCard key={attempt.id} attempt={attempt}/>)}</div>
      <div className="table-pagination access-history-pagination"><span>{data.total} {data.total === 1 ? 'intento' : 'intentos'}</span><div><button type="button" className="button button-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>{'P\u00e1gina'} {page}</span><button type="button" className="button button-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
    </>}
  </div>
}

async function loadAccessSummary(dateRange: AccessDateRange): Promise<AccessSummary> {
  const [all, allowed, denied] = await Promise.all([
    loadCompleteAccessAttempts(dateRange),
    backendApi.listAccessAttempts({ ...dateRange, page: 1, limit: 1, result: 'ALLOWED' }),
    backendApi.listAccessAttempts({ ...dateRange, page: 1, limit: 1, result: 'DENIED' }),
  ])
  return { total: all.total, allowed: allowed.total, denied: denied.total, distinctMembers: new Set(all.items.map((attempt) => attempt.userId)).size }
}

async function loadCompleteAccessAttempts(dateRange: AccessDateRange) {
  const firstPage = await backendApi.listAccessAttempts({ ...dateRange, page: 1, limit: SUMMARY_PAGE_SIZE })
  const totalPages = Math.ceil(firstPage.total / firstPage.limit)
  if (totalPages <= 1) return firstPage
  const remainingPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => backendApi.listAccessAttempts({ ...dateRange, page: index + 2, limit: SUMMARY_PAGE_SIZE })))
  return { ...firstPage, items: [firstPage, ...remainingPages].flatMap((page) => page.items) }
}

function AccessSummary({ summary, loading, error, period }: { summary: AccessSummary | null; loading: boolean; error: string; period: AccessPeriod }) {
  if (loading) return <div className="access-summary-grid" aria-label="Resumen de accesos" aria-busy="true"><SummaryCard label="Ingresos de hoy" value="Cargando\u2026" tone="black"/><SummaryCard label="Permitidos" value="Cargando\u2026" tone="blue" className="access-summary-card--allowed"/><SummaryCard label="Rechazados" value="Cargando\u2026" tone="pink"/><SummaryCard label="Socios distintos" value="Cargando\u2026" tone="black" className="access-summary-card--distinct"/></div>
  if (error || !summary) return <p className="access-summary-error" role="status">No se pudo cargar el resumen de hoy. El historial sigue disponible.</p>
  const allowedPercentage = summary.total ? `${((summary.allowed / summary.total) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}% del total` : 'Sin intentos registrados'
  const distinctDescription = period === 'TODAY' ? 'Ingresaron al menos una vez hoy' : `Ingresaron al menos una vez ${getPeriodDescription(period)}`
  return <div className="access-summary-grid" aria-label="Resumen de accesos"><SummaryCard label="Ingresos de hoy" value={`${summary.total} ${summary.total === 1 ? 'acceso' : 'accesos'}`} tone="black" sub="Todos los puntos de acceso" icon="qr"/><SummaryCard label="Permitidos" value={`${summary.allowed} ${summary.allowed === 1 ? 'acceso' : 'accesos'}`} tone="blue" sub={allowedPercentage} icon="check" className="access-summary-card--allowed"/><SummaryCard label="Rechazados" value={`${summary.denied} ${summary.denied === 1 ? 'acceso' : 'accesos'}`} tone="pink" sub="Con motivo cuando corresponde" icon="close"/><SummaryCard label="Socios distintos" value={`${summary.distinctMembers} ${summary.distinctMembers === 1 ? 'socio' : 'socios'}`} tone="black" sub={distinctDescription} icon="users" className="access-summary-card--distinct"/></div>
}

function SummaryCard({ label, value, tone, sub, icon, className = '' }: { label: string; value: string; tone: 'black' | 'blue' | 'pink'; sub?: string; icon?: 'qr' | 'check' | 'close' | 'users'; className?: string }) {
  return <article className={`access-summary-card tone-${tone} ${className}`}><span className="access-summary-card-label">{label}</span><strong className="access-summary-card-value">{value}</strong>{sub && <span className="access-summary-card-sub">{icon && <Icon name={icon} size={16}/>}<span>{sub}</span></span>}</article>
}

function getHistoryDateRange(period: AccessPeriod, from: string, to: string): AccessDateRange {
  if (from || to) return getInputDateRange(from, to)
  return getAccessPeriodRange(period)
}

function getInputDateRange(from: string, to: string): AccessDateRange {
  return {
    from: from ? `${from}T00:00:00-03:00` : undefined,
    to: to ? `${to}T23:59:59.999-03:00` : undefined,
  }
}

function getAccessPeriodRange(period: AccessPeriod): AccessDateRange {
  const today = gymDate()
  const start = period === 'LAST_7_DAYS' ? addDays(today, -6) : period === 'LAST_30_DAYS' ? addDays(today, -29) : period === 'TODAY' ? today : undefined
  return start ? getInputDateRange(start, today) : {}
}

function getPeriodDescription(period: AccessPeriod) {
  if (period === 'LAST_7_DAYS') return 'en los últimos 7 días'
  if (period === 'LAST_30_DAYS') return 'en los últimos 30 días'
  return 'en todo el historial'
}

function AccessRow({ attempt }: { attempt: AccessAttemptResult }) {
  const name = attempt.user ? `${attempt.user.firstName} ${attempt.user.lastName}` : EMPTY_LABEL
  return <tr><td><strong className="access-user-name">{name}</strong>{attempt.user?.documentNumber && <span className="cell-subtext">DNI {attempt.user.documentNumber}</span>}</td><td>{ROLE_LABELS[attempt.roleAtAttempt] ?? attempt.roleAtAttempt}</td><td>{attempt.branch?.name ?? EMPTY_LABEL}</td><td>{formatDateTime(attempt.attemptedAt)}</td><td><AccessResultBadge attempt={attempt}/></td></tr>
}

function AccessMobileCard({ attempt }: { attempt: AccessAttemptResult }) {
  const name = attempt.user ? `${attempt.user.firstName} ${attempt.user.lastName}` : EMPTY_LABEL
  const branch = attempt.branch?.name ?? EMPTY_LABEL
  return <article className="access-mobile-card"><span className="access-mobile-avatar" aria-hidden="true">{getInitials(attempt)}</span><div className="access-mobile-content"><strong>{name}</strong><span>{ROLE_LABELS[attempt.roleAtAttempt] ?? attempt.roleAtAttempt} · {branch} · {formatTime(attempt.attemptedAt)}</span></div><AccessResultBadge attempt={attempt}/></article>
}

function AccessResultBadge({ attempt }: { attempt: AccessAttemptResult }) {
  const isAllowed = attempt.result === 'ALLOWED'
  const label = isAllowed ? 'Permitido' : `Rechazado \u00b7 ${REASON_LABELS[attempt.denialReason ?? ''] ?? 'motivo no disponible'}`
  return <span className={`access-result-badge ${isAllowed ? 'is-allowed' : 'is-denied'}`}>{label}</span>
}

function getInitials(attempt: AccessAttemptResult) {
  if (!attempt.user) return EMPTY_LABEL
  return `${attempt.user.firstName[0] ?? ''}${attempt.user.lastName[0] ?? ''}`.toUpperCase()
}
