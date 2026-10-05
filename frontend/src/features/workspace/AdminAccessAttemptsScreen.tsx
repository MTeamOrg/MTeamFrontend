import { useCallback, useState } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import type { UserRole } from '../authentication/auth-types'
import { backendApi, type AccessAttemptResult } from '../../service/backend-api'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { PageHeader } from './PageHeader'

export function AdminAccessAttemptsScreen() {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [result, setResult] = useState<'' | 'ALLOWED' | 'DENIED'>('')
  const [branchId, setBranchId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const loader = useCallback(() => backendApi.listAccessAttempts({
    page, limit: 20, role: role || undefined, result: result || undefined,
    branchId: branchId || undefined, search: search.trim() || undefined,
    from: from ? `${from}T00:00:00-03:00` : undefined,
    to: to ? `${to}T23:59:59.999-03:00` : undefined,
  }), [page, role, result, branchId, search, from, to])
  const { data, loading, error, reload } = useApiResource(loader)
  const { data: branches } = useApiResource(() => backendApi.listAdminBranches({ page: 1, limit: 100 }))

  return <div className="app-page">
    <PageHeader title="Accesos" description="Consultá los intentos de ingreso permitidos y rechazados, con su motivo."/>
    <div className="toolbar access-history-filters">
      <label className="search-shell"><input aria-label="Buscar por usuario o documento" placeholder="Buscar por usuario o documento" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
      <label className="visually-hidden" htmlFor="access-role">Rol</label><select id="access-role" aria-label="Filtrar por rol" value={role} onChange={(event) => { setPage(1); setRole(event.target.value as UserRole | '') }}><option value="">Rol: todos</option><option value="MEMBER">Socio</option><option value="TRAINER">Entrenador</option></select>
      <label className="visually-hidden" htmlFor="access-branch">Sede</label><select id="access-branch" aria-label="Filtrar por sede" value={branchId} onChange={(event) => { setPage(1); setBranchId(event.target.value) }}><option value="">Sede: todas</option>{branches?.items.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
      <label className="visually-hidden" htmlFor="access-result">Resultado</label><select id="access-result" aria-label="Filtrar por resultado" value={result} onChange={(event) => { setPage(1); setResult(event.target.value as typeof result) }}><option value="">Resultado: todos</option><option value="ALLOWED">Permitidos</option><option value="DENIED">Rechazados</option></select>
      <label className="access-date-filter">Desde<input aria-label="Desde" type="date" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value) }}/></label>
      <label className="access-date-filter">Hasta<input aria-label="Hasta" type="date" value={to} onChange={(event) => { setPage(1); setTo(event.target.value) }}/></label>
    </div>
    {loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No hay intentos de ingreso que coincidan con los filtros."/> : <>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Usuario</th><th>Documento</th><th>Rol</th><th>Sede</th><th>Punto de acceso</th><th>Fecha y hora</th><th>Resultado</th></tr></thead><tbody>{data.items.map((attempt) => <AccessRow key={attempt.id} attempt={attempt}/>)}</tbody></table></div>
      <div className="table-pagination"><span>{data!.total} intentos</span><div><button type="button" className="button button-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page}</span><button type="button" className="button button-secondary" disabled={page * data!.limit >= data!.total} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
    </>}
  </div>
}

const reasonLabels: Record<string, string> = {
  INVALID_QR: 'QR inválido', INACTIVE_USER: 'Cuenta desactivada', INACTIVE_BRANCH: 'Sede desactivada',
  INACTIVE_ACCESS_POINT: 'Punto desactivado', EXPIRED_MEMBERSHIP: 'Cuota vencida',
  MEDICAL_CERTIFICATE_REQUIRED: 'Apto médico requerido',
}

function AccessRow({ attempt }: { attempt: AccessAttemptResult }) {
  const allowed = attempt.result === 'ALLOWED'
  return <tr><td>{attempt.user ? `${attempt.user.firstName} ${attempt.user.lastName}` : '—'}</td><td>{attempt.user?.documentNumber ?? '—'}</td><td>{attempt.roleAtAttempt === 'MEMBER' ? 'Socio' : 'Entrenador'}</td><td>{attempt.branch?.name ?? '—'}</td><td>{attempt.accessPoint?.name ?? '—'}</td><td>{new Date(attempt.attemptedAt).toLocaleString('es-AR')}</td><td><span className={`table-status${allowed ? '' : ' danger'}`}>{allowed ? 'Permitido' : `Rechazado · ${reasonLabels[attempt.denialReason ?? ''] ?? 'motivo no disponible'}`}</span></td></tr>
}
