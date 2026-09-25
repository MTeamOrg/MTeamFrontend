import { useCallback, useState } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi } from '../../service/backend-api'
import { formatDate, formatDateTime } from '../../service/date-time'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'

const money=(value:string|null)=>value===null?'Sin configurar':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(Number(value))
const statusLabel={CURRENT:'Al día',EXPIRING_SOON:'Próxima a vencer',EXPIRED:'Vencida'} as const

export function MemberPaymentsScreen(){
  const [page,setPage]=useState(1)
  const loader=useCallback(()=>Promise.all([backendApi.getOwnMembership(),backendApi.listOwnPayments(page,20)]),[page])
  const {data,loading,error,reload}=useApiResource(loader)
  if(loading)return <LoadingState/>
  if(error||!data)return <ErrorState message={error||'No se pudo cargar la información.'} retry={()=>void reload()}/>
  const [membership,payments]=data
  return <section className="member-payments-screen"><p className="page-intro">Consultá el valor vigente, la última acreditación y el historial de pagos de tu cuota.</p><div className="dashboard-stat-grid member-payment-stats"><Metric label="Valor vigente" value={money(membership.currentPrice)} icon="wallet"/><Metric label="Estado" value={statusLabel[membership.status]} icon="check"/><Metric label="Último pago" value={formatDate(membership.lastPaymentAt)} icon="calendar"/><Metric label="Vencimiento" value={formatDate(membership.expiresAt)} icon="clock" hint={`${membership.daysRemaining} días restantes`}/></div><section className="surface-card member-payment-history"><h2>Historial de pagos</h2>{!payments.items.length?<EmptyState message="Todavía no hay pagos registrados."/>:<div className="table-scroll"><table className="data-table"><thead><tr><th>Fecha</th><th>Importe</th><th>Medio</th><th>Comprobante</th><th>Vencimiento</th><th>Estado</th></tr></thead><tbody>{payments.items.map(payment=><tr key={payment.id}><td>{formatDateTime(payment.accreditedAt)}</td><td>{money(payment.amount)}</td><td>{payment.method}</td><td>{payment.receiptNumber??'—'}</td><td>{formatDate(payment.expiresAt)}</td><td><span className={`badge ${payment.status==='VOIDED'?'badge-disabled':'badge-info'}`}>{payment.status==='VOIDED'?'Anulado':'Acreditado'}</span></td></tr>)}</tbody></table></div>}<div className="form-actions"><button className="button button-secondary" disabled={page===1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>Página {page}</span><button className="button button-secondary" disabled={page*payments.limit>=payments.total} onClick={()=>setPage(value=>value+1)}>Siguiente</button></div></section></section>
}

function Metric({label,value,icon,hint}:{label:string;value:string;icon:'wallet'|'check'|'calendar'|'clock';hint?:string}){return <article className="stat-card"><span className="stat-icon blue"><Icon name={icon}/></span><div><span>{label}</span><strong>{value}</strong>{hint&&<small>{hint}</small>}</div></article>}
