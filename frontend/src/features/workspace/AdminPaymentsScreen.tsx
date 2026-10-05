import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type MemberListItem, type PaymentPreview, type PaymentStatus } from '../../service/backend-api'
import { addDays, formatDate, formatDateTime, gymDate } from '../../service/date-time'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'
import { StatusCard } from './StatusCard'

const money = (value: string | number | null | undefined) => value == null
  ? 'Sin configurar'
  : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value))
const gymInstant = (date: string) => `${date}T00:00:00-03:00`
const mobilePaymentDate = (date: string) => new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(date))

export function AdminPaymentsScreen() {
  const today = gymDate()
  const monthStart = `${today.slice(0, 8)}01`
  const tomorrow = addDays(today, 1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState<PaymentStatus | ''>('')
  const [from, setFrom] = useState(monthStart)
  const [to] = useState(tomorrow)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const loader = useCallback(async () => {
    const [payments, todaySummary, monthSummary, currentPrice, prices, metrics] = await Promise.all([
      backendApi.listPayments({ page, limit: 20, documentNumber: search.trim() || undefined, method: method || undefined, status: status || undefined, from: gymInstant(from), to: gymInstant(to) }),
      backendApi.getPaymentsSummary(gymInstant(today), gymInstant(tomorrow)),
      backendApi.getPaymentsSummary(gymInstant(monthStart), gymInstant(tomorrow)),
      backendApi.getCurrentPrice().catch(() => null),
      backendApi.listPrices(1, 5),
      backendApi.getAdminDashboardMetrics(),
    ])
    return { payments, todaySummary, monthSummary, currentPrice, prices, metrics }
  }, [from, method, monthStart, page, search, status, to, today, tomorrow])
  const { data, loading, error, reload } = useApiResource(loader)
  const setFilter = (action: () => void) => { setPage(1); action() }
  const header = <PageHeader title="Pagos y cuota" description="El valor vigente de la cuota y todos los pagos acreditados. Cada acreditación abre 30 días de vigencia." />
  const dialog = paymentOpen && <PaymentDialog currentPrice={data?.currentPrice?.amount ?? null} onClose={() => setPaymentOpen(false)} onSaved={() => { setPaymentOpen(false); void reload() }} />

  if (loading) return <div className="app-page admin-payments-screen">{header}<div className="app-card"><LoadingState /></div>{dialog}</div>
  if (error || !data) return <div className="app-page admin-payments-screen">{header}<div className="app-card"><ErrorState message={error || 'No se pudo cargar la información de pagos.'} retry={() => void reload()} /></div>{dialog}</div>

  return <div className="app-page admin-payments-screen">
    {header}
    <div className="status-grid payment-stats payment-desktop-stats">
      <StatusCard label="VALOR VIGENTE" value={money(data.currentPrice?.amount)} tone="pink" sub={data.currentPrice ? `Desde el ${formatDate(data.currentPrice.effectiveFrom)}` : 'Todavía no configurado'} />
      <StatusCard label="RECAUDADO HOY" value={money(data.todaySummary.totalAmount)} tone="black" sub={`${data.todaySummary.paymentCount} pagos acreditados`} />
      <StatusCard label="RECAUDADO EN EL MES" value={money(data.monthSummary.totalAmount)} tone="black" sub={new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(`${today}T12:00:00Z`))} />
      <StatusCard label="SOCIOS SIN PAGO" value={`${data.metrics.expiredMemberships} socios`} tone="pink" sub="Cuota vencida o sin registrar" />
    </div>

    <section className="payment-mobile-summary">
      <div className="payment-mobile-stats">
        <StatusCard label="VALOR VIGENTE" value={money(data.currentPrice?.amount)} tone="pink" sub={data.currentPrice ? `Desde el ${formatDate(data.currentPrice.effectiveFrom)}` : 'Todavía no configurado'} />
        <StatusCard label="RECAUDADO HOY" value={money(data.todaySummary.totalAmount)} tone="black" sub={`${data.todaySummary.paymentCount} pagos`} />
      </div>
      <button type="button" className="button button-primary payment-mobile-register" onClick={() => setPaymentOpen(true)}><Icon name="plus" size={20} />Registrar un pago</button>
      <section className="surface-card payment-mobile-membership">
        <h2>Estado de las cuotas</h2>
        <div className="membership-state-list">
          <p><span>Al día</span><strong className="state-count state-count-blue">{data.metrics.currentMemberships}</strong></p>
          <p><span>Próximas a vencer</span><strong className="state-count state-count-purple">{data.metrics.expiringMemberships}</strong></p>
          <p><span>Vencidas</span><strong className="state-count state-count-pink">{data.metrics.expiredMemberships}</strong></p>
        </div>
      </section>
      <section className="payment-mobile-history">
        <h2>Últimos pagos</h2>
        {!data.payments.items.length ? <div className="surface-card"><EmptyState message="Todavía no hay pagos registrados." /></div> : <div className="payment-mobile-list">{data.payments.items.slice(0, 4).map((payment) => <article className="payment-mobile-card" key={payment.id}>
          <span className="payment-mobile-icon"><Icon name="wallet" size={16} /></span>
          <div className="payment-mobile-detail"><strong>{payment.member.firstName} {payment.member.lastName} · {mobilePaymentDate(payment.accreditedAt)}</strong><span>{payment.method} · {payment.status === 'VOIDED' ? 'anulado' : `vence ${formatDate(payment.expiresAt)}`}</span></div>
          <div className="payment-mobile-value"><strong>{money(payment.amount)}</strong><span className={`badge ${payment.status === 'VOIDED' ? 'badge-disabled' : 'badge-info'}`}>{payment.status === 'VOIDED' ? 'Anulado' : 'Acreditado'}</span></div>
          {payment.status === 'ACCREDITED' && <button type="button" className="payment-mobile-void" aria-label={`Anular pago de ${payment.member.firstName} ${payment.member.lastName}`} onClick={() => void voidPayment(payment.id)}>Anular</button>}
        </article>)}</div>}
      </section>
    </section>

    <div className="toolbar payment-filter-toolbar">
      <label className="search-shell"><Icon name="search" /><input aria-label="Buscar por socio o documento" placeholder="Buscar por socio o documento" value={search} onChange={(event) => setFilter(() => setSearch(event.target.value))} /></label>
      <select aria-label="Filtrar por medio" value={method} onChange={(event) => setFilter(() => setMethod(event.target.value))}><option value="">Medio: todos</option><option value="Efectivo">Efectivo</option><option value="Débito">Débito</option><option value="Transferencia">Transferencia</option></select>
      <select aria-label="Filtrar por estado" value={status} onChange={(event) => setFilter(() => setStatus(event.target.value as PaymentStatus | ''))}><option value="">Estado: todos</option><option value="ACCREDITED">Acreditados</option><option value="VOIDED">Anulados</option></select>
      <label className="payment-date-filter" title="Fecha inicial"><span className="visually-hidden">Desde</span><Icon name="calendar" size={18} /><input aria-label="Desde" type="date" value={from} max={to} onChange={(event) => setFilter(() => setFrom(event.target.value))} /></label>
      <button type="button" className="button button-primary payment-register-button" onClick={() => setPaymentOpen(true)}><Icon name="plus" size={20} />Registrar pago</button>
    </div>

    <div className="admin-payments-layout">
      <section className="payment-list-panel">
        <div className="payment-desktop-history">
          {!data.payments.items.length ? <div className="surface-card"><EmptyState message="No hay pagos en el período o con los filtros seleccionados." /></div> : <div className="table-scroll payment-table-wrap"><table className="data-table payment-table"><thead><tr><th>Socio</th><th>Fecha y hora</th><th>Importe</th><th>Medio</th><th>Vencimiento</th><th>Estado</th><th><span className="visually-hidden">Acción</span></th></tr></thead><tbody>{data.payments.items.map((payment) => <tr key={payment.id}><td>{payment.member.firstName} {payment.member.lastName}</td><td>{formatDateTime(payment.accreditedAt)}</td><td>{money(payment.amount)}</td><td>{payment.method}</td><td>{formatDate(payment.expiresAt)}</td><td><span className={`badge ${payment.status === 'VOIDED' ? 'badge-disabled' : 'badge-info'}`}>{payment.status === 'VOIDED' ? 'Anulado' : 'Acreditado'}</span></td><td>{payment.status === 'ACCREDITED' && <button className="text-link" onClick={() => void voidPayment(payment.id)}>Anular</button>}</td></tr>)}</tbody></table></div>}
          <div className="table-pagination payment-pagination"><span>Página {page}</span><div><button className="button button-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><button className="button button-secondary" disabled={page * data.payments.limit >= data.payments.total} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
        </div>
      </section>
      <aside className="admin-payment-side">
        <PriceForm current={data.currentPrice?.amount ?? null} activeMembers={data.metrics.activeMembers} onSaved={() => void reload()} />
        <section className="surface-card payment-side-card"><h2>Historial de valores</h2><div className="price-history">{data.prices.items.length ? data.prices.items.map((price) => <p key={price.id}><span>Desde {formatDate(price.effectiveFrom)}</span><strong>{money(price.amount)}</strong></p>) : <EmptyState message="No hay valores registrados." />}</div></section>
        <section className="surface-card payment-side-card"><h2>Estado de las cuotas</h2><div className="membership-state-list"><p><span>Al día</span><strong className="state-count state-count-blue">{data.metrics.currentMemberships}</strong></p><p><span>Próximas a vencer (≤5 días)</span><strong className="state-count state-count-purple">{data.metrics.expiringMemberships}</strong></p><p><span>Vencidas</span><strong className="state-count state-count-pink">{data.metrics.expiredMemberships}</strong></p></div></section>
      </aside>
    </div>
    {dialog}
  </div>

  async function voidPayment(id: string) {
    const reason = window.prompt('Ingresá el motivo de la anulación:')?.trim()
    if (!reason) return
    try { await backendApi.voidPayment(id, reason); await reload() }
    catch (value) { window.alert(value instanceof Error ? value.message : 'No se pudo anular el pago.') }
  }
}

function PriceForm({ current, activeMembers, onSaved }: { current: string | null; activeMembers: number; onSaved: () => void }) {
  const [amount, setAmount] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(gymDate())
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setNotice('')
    try { await backendApi.createPrice(Number(amount), `${effectiveFrom}T00:00:00-03:00`); setAmount(''); setNotice('Nuevo valor registrado correctamente.'); onSaved() }
    catch (value) { setNotice(value instanceof Error ? value.message : 'No se pudo registrar el valor.') }
    finally { setSaving(false) }
  }
  return <section className="surface-card payment-price-card"><h2>Cambiar el valor de la cuota</h2><form onSubmit={submit}><label className="read-field"><span>Nuevo valor</span><input aria-label="Nuevo valor" type="number" min="0.01" max="9999999999.99" step="0.01" placeholder={current ? money(current) : '$ 0'} value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label className="read-field"><span>Vigente desde</span><input aria-label="Vigente desde" type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} required /></label><p className="payment-price-alert"><Icon name="alert" size={20} /><span>No modifica los pagos ya acreditados. Se notifica a los {activeMembers} socios activos.</span></p>{notice && <p className="notice-inline" role="status">{notice}</p>}<button className="button button-primary button-block" disabled={saving}>{saving ? 'Guardando…' : 'Guardar nuevo valor'}</button></form></section>
}

function PaymentDialog({ currentPrice, onClose, onSaved }: { currentPrice: string | null; onClose: () => void; onSaved: () => void }) {
  const [search, setSearch] = useState('')
  const memberLoader = useCallback(() => backendApi.listMembers({ search: search.trim() || undefined, page: 1, limit: 100 }), [search])
  const { data: members, loading, error, reload } = useApiResource(memberLoader)
  const [memberId, setMemberId] = useState('')
  const [amount, setAmount] = useState(currentPrice ?? '')
  const [method, setMethod] = useState('Efectivo')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [preview, setPreview] = useState<PaymentPreview | null>(null)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const selected = useMemo(() => members?.items.find((member) => member.id === memberId), [memberId, members])
  const body = () => ({ memberId, amount: Number(amount), method, ...(receiptNumber.trim() ? { receiptNumber: receiptNumber.trim() } : {}) })
  const invalidatePreview = () => { setPreview(null); setNotice('') }
  async function previewPayment(event: FormEvent) { event.preventDefault(); setNotice(''); try { setPreview(await backendApi.previewPayment(body())) } catch (value) { setNotice(value instanceof Error ? value.message : 'No se pudo generar el resumen.') } }
  async function confirmPayment() { setSaving(true); setNotice(''); try { await backendApi.createPayment(body()); onSaved() } catch (value) { setNotice(value instanceof Error ? value.message : 'No se pudo acreditar el pago.') } finally { setSaving(false) } }
  return <div className="dialog-backdrop payment-dialog-backdrop" role="presentation"><section className="workspace-dialog payment-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title"><header className="payment-dialog-header"><div><h2 id="payment-dialog-title">Registrar y acreditar un pago</h2><p>Revisá el resumen antes de confirmar: la acreditación genera una nueva vigencia de 30 días.</p></div><button type="button" className="dialog-close" aria-label="Cerrar" onClick={onClose}><Icon name="close" /></button></header><form onSubmit={previewPayment}><div className="payment-dialog-body"><label className="read-field payment-member-field"><span>Socio</span><span className="payment-member-search"><Icon name="search" size={20} /><input aria-label="Buscar socio" value={search} onChange={(event) => { setSearch(event.target.value); setMemberId(''); invalidatePreview() }} placeholder="Buscar por nombre o documento" /></span><select aria-label="Socio" value={memberId} onChange={(event) => { setMemberId(event.target.value); invalidatePreview() }} required><option value="">Seleccioná un socio</option>{members?.items.map((member: MemberListItem) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName} · DNI {member.documentNumber}</option>)}</select></label><div className="payment-dialog-row"><label className="read-field"><span>Importe</span><input aria-label="Importe" type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); invalidatePreview() }} required /></label><label className="read-field"><span>Medio de pago</span><select aria-label="Medio de pago" value={method} onChange={(event) => { setMethod(event.target.value); invalidatePreview() }} required><option>Efectivo</option><option>Débito</option><option>Transferencia</option></select></label></div><label className="read-field"><span>Número de comprobante</span><input aria-label="Número de comprobante" value={receiptNumber} maxLength={100} onChange={(event) => { setReceiptNumber(event.target.value); invalidatePreview() }} placeholder="0001-0456" /></label>{loading && <LoadingState message="Buscando socios…" />}{error && <ErrorState message={error} retry={() => void reload()} />}{selected && <div className="payment-operation-summary"><span className="payment-summary-title">RESUMEN DE LA OPERACIÓN</span><p><span>Socio</span><strong>{selected.firstName} {selected.lastName}</strong></p><p><span>Valor vigente de la cuota</span><strong>{money(currentPrice)}</strong></p><p><span>Vencimiento actual</span><strong>{formatDate(selected.expiresAt)}</strong></p><div className="payment-summary-divider" /><p className="payment-new-expiration"><span>Nuevo vencimiento</span><strong>{preview ? formatDate(preview.estimatedExpiresAt) : 'Pendiente de validar'}</strong></p><small>Los días restantes del vencimiento anterior no se acumulan.</small></div>}{notice && <p className="error-message" role="alert">{notice}</p>}</div><footer className="dialog-actions payment-dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button>{preview ? <button type="button" className="button button-primary" disabled={saving} onClick={() => void confirmPayment()}><Icon name="check" size={20} />{saving ? 'Acreditando…' : 'Confirmar y acreditar'}</button> : <button className="button button-primary" disabled={!selected}><Icon name="check" size={20} />Revisar y acreditar</button>}</footer></form></section></div>
}
