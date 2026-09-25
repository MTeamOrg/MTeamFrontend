import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'

// Figma sample rows for A5; values are prototypes and must be replaced by payments API data.
const FIGMA_PREVIEW_PAYMENTS = [
  { member:'Ana Vidal',document:'45.112.003',date:'06/09/2026',time:'11:02',amount:32000,method:'Transferencia',receipt:'—',expiry:'06/10/2026',status:'Acreditado' },
  { member:'Pedro Lima',document:'42.667.310',date:'06/09/2026',time:'10:44',amount:32000,method:'Débito',receipt:'—',expiry:'06/10/2026',status:'Acreditado' },
  { member:'Lucas Torres',document:'44.870.910',date:'01/09/2026',time:'17:20',amount:32000,method:'Efectivo',receipt:'—',expiry:'01/10/2026',status:'Acreditado' },
  { member:'Juan Manuel Pérez',document:'40.123.456',date:'29/08/2026',time:'18:42',amount:32000,method:'Efectivo',receipt:'001-00421',expiry:'28/09/2026',status:'Acreditado' },
  { member:'Micaela Rossi',document:'38.554.201',date:'29/07/2026',time:'09:12',amount:30000,method:'Efectivo',receipt:'001-00350',expiry:'28/08/2026',status:'Acreditado' },
  { member:'Juan Manuel Pérez',document:'40.123.456',date:'12/07/2026',time:'18:58',amount:27500,method:'Débito',receipt:'001-00300',expiry:'—',status:'Anulado' },
]

export function AdminPaymentsScreen({ notice, onSubmit, onCancelPayment }: { notice:string; onSubmit:(event:FormEvent<HTMLFormElement>)=>void; onCancelPayment:(member:string)=>void }) {
  const [query,setQuery]=useState('')
  const [method,setMethod]=useState('Todos')
  const [status,setStatus]=useState('Todos')
  const [from,setFrom]=useState('')
  const [to,setTo]=useState('')
  const rows=useMemo(()=>FIGMA_PREVIEW_PAYMENTS.filter(item=>{
    const queryMatch=`${item.member} ${item.document}`.toLowerCase().includes(query.toLowerCase())
    const methodMatch=method==='Todos'||item.method===method
    const statusMatch=status==='Todos'||item.status===status
    const date=parseDate(item.date)
    const fromMatch=!from||date>=new Date(`${from}T00:00:00`)
    const toMatch=!to||date<=new Date(`${to}T23:59:59`)
    return queryMatch&&methodMatch&&statusMatch&&fromMatch&&toMatch
  }),[query,method,status,from,to])
  const total=rows.filter(item=>item.status==='Acreditado').reduce((sum,item)=>sum+item.amount,0)
  function handleRateSubmit(event:FormEvent<HTMLFormElement>){event.preventDefault();onSubmit(event)}
  return <>
    <div className="dashboard-stat-grid payment-stats"><Metric label="Valor vigente" value="$ 32.000" hint="Desde 01/09/2026"/><Metric label="Recaudado hoy" value="$ 128.000" hint="4 pagos acreditados"/><Metric label="Recaudado en el mes" value="$ 1.842.000" hint="Septiembre 2026"/><Metric label="Socios sin pago" value="20 socios" hint="Cuota vencida o sin registrar"/></div>
    <div className="admin-payments-layout"><section className="surface-card payment-list-panel"><div className="payment-list-heading"><div><h2>Pagos y cuota mensual</h2><p>La acreditación inicia una nueva vigencia de 30 días, sin acumular días anteriores.</p></div><Link className="button button-primary" to="/admin/registrar-pago"><span>+</span> Registrar pago</Link></div><div className="toolbar payment-filter-toolbar"><label className="search-shell"><Icon name="search"/><input placeholder="Buscar por socio o documento" value={query} onChange={event=>setQuery(event.target.value)}/></label><select value={method} onChange={event=>setMethod(event.target.value)} aria-label="Filtrar por medio de pago"><option>Todos</option><option>Efectivo</option><option>Transferencia</option><option>Débito</option></select><select value={status} onChange={event=>setStatus(event.target.value)} aria-label="Filtrar por estado de pago"><option>Todos</option><option>Acreditado</option><option>Anulado</option></select><label className="date-filter">Desde<input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label className="date-filter">Hasta<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Socio</th><th>Fecha y hora</th><th>Importe</th><th>Medio</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map((item,index)=><tr key={`${item.member}-${item.date}-${index}`}><td><strong>{item.member}</strong><small className="cell-subtext">DNI {item.document}</small></td><td>{item.date} · {item.time}</td><td>{formatCurrency(item.amount)}</td><td>{item.method}</td><td>{item.expiry}</td><td><span className={`badge ${item.status==='Anulado'?'badge-disabled':'badge-info'}`}>{item.status}</span></td><td>{item.status==='Acreditado'&&<button className="text-link" onClick={()=>onCancelPayment(item.member)}>Anular</button>}</td></tr>)}</tbody></table>{rows.length===0&&<div className="empty-state"><p>No hay pagos que coincidan con esos filtros.</p></div>}</div><div className="payment-range-total"><span>Total acreditado en el rango seleccionado</span><strong>{formatCurrency(total)}</strong></div></section>
      <aside className="admin-payment-side"><section className="surface-card"><h2>Cambiar el valor de la cuota</h2><form onSubmit={handleRateSubmit}><label className="read-field"><span>Nuevo valor</span><input type="number" min="0" step="0.01" placeholder="$ 34.000" required/></label><label className="read-field"><span>Vigente desde</span><input type="date" required/></label><p className="notice-inline">El cambio no modifica los pagos acreditados. El nuevo valor se comunica a los socios cuando la API lo confirme.</p>{notice&&<p className="notice-inline" role="status">{notice}</p>}<button className="button button-primary" type="submit">Guardar nuevo valor</button></form></section><section className="surface-card"><h2>Historial de valores</h2><div className="price-history"><p><span>Desde 01/09/2026</span><strong>$ 32.000</strong></p><p><span>Desde 01/06/2026</span><strong>$ 30.000</strong></p><p><span>Desde 01/03/2026</span><strong>$ 27.500</strong></p><p><span>Desde 01/12/2025</span><strong>$ 24.000</strong></p></div></section><section className="surface-card"><h2>Estado de las cuotas</h2><div className="fee-breakdown"><p>Al día <span className="badge badge-info">141</span></p><p>Próximas a vencer (≤5 días) <span className="badge badge-secondary">23</span></p><p>Vencidas <span className="badge badge-primary">20</span></p></div></section></aside></div>
  </>
}

function Metric({label,value,hint}:{label:string;value:string;hint:string}){return <article className="stat-card"><span className="stat-icon pink"><Icon name="wallet"/></span><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></article>}
function parseDate(date:string){const [day,month,year]=date.split('/');return new Date(`${year}-${month}-${day}T12:00:00`)}
function formatCurrency(value:number){return `$ ${value.toLocaleString('es-AR')}`}
