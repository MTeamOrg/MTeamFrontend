import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import {
  backendApi,
  type MemberListItem,
  type PaymentPreview,
  type PaymentStatus,
} from '../../service/backend-api'
import { addDays, formatDate, formatDateTime, gymDate, localDateTimeToGymOffset } from '../../service/date-time'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'

const money = (value: string | null | undefined) => value == null
  ? 'Sin configurar'
  : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value))

export function AdminPaymentsScreen() {
  const today = gymDate()
  const [page, setPage] = useState(1)
  const [documentNumber, setDocumentNumber] = useState('')
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState<PaymentStatus | ''>('')
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`)
  const [to, setTo] = useState(addDays(today, 1))
  const [paymentOpen, setPaymentOpen] = useState(false)
  const loader = useCallback(async () => {
    const fromInstant = `${from}T00:00:00-03:00`
    const toInstant = `${to}T00:00:00-03:00`
    const [payments, summary, currentPrice, prices] = await Promise.all([
      backendApi.listPayments({
        page,
        limit: 20,
        documentNumber: documentNumber.trim() || undefined,
        method: method.trim() || undefined,
        status: status || undefined,
        from: fromInstant,
        to: toInstant,
      }),
      backendApi.getPaymentsSummary(fromInstant, toInstant),
      backendApi.getCurrentPrice().catch(() => null),
      backendApi.listPrices(1, 5),
    ])
    return { payments, summary, currentPrice, prices }
  }, [documentNumber, from, method, page, status, to])
  const { data, loading, error, reload } = useApiResource(loader)

  const setFilter = (action: () => void) => { setPage(1); action() }
  if (loading) return <LoadingState/>
  if (error || !data) return <ErrorState message={error || 'No se pudo cargar la información de pagos.'} retry={() => void reload()}/>

  return <section>
    <div className="stat-grid stat-grid-four payment-stats"><Metric label="Pagos acreditados" value={String(data.summary.paymentCount)} icon="check"/><Metric label="Total del período" value={money(data.summary.totalAmount)} icon="wallet"/><Metric label="Cuota vigente" value={money(data.currentPrice?.amount)} icon="calendar"/><Metric label="Registros encontrados" value={String(data.payments.total)} icon="users"/></div>
    <div className="admin-payments-layout"><section className="surface-card payment-list-panel"><div className="payment-list-heading"><div><h2>Pagos</h2><p>Datos acreditados y anulados registrados en el backend.</p></div><button className="button button-primary" onClick={() => setPaymentOpen(true)}><Icon name="plus"/> Registrar pago</button></div><div className="toolbar payment-filter-toolbar"><label className="search-shell"><Icon name="search"/><input aria-label="Filtrar por documento" placeholder="Documento" value={documentNumber} onChange={(event) => setFilter(() => setDocumentNumber(event.target.value))}/></label><input aria-label="Filtrar por medio" placeholder="Medio de pago" value={method} onChange={(event) => setFilter(() => setMethod(event.target.value))}/><select aria-label="Filtrar por estado" value={status} onChange={(event) => setFilter(() => setStatus(event.target.value as PaymentStatus | ''))}><option value="">Todos</option><option value="ACCREDITED">Acreditados</option><option value="VOIDED">Anulados</option></select><label className="date-filter">Desde<input type="date" value={from} max={to} onChange={(event) => setFilter(() => setFrom(event.target.value))}/></label><label className="date-filter">Hasta<input type="date" value={to} min={from} onChange={(event) => setFilter(() => setTo(event.target.value))}/></label></div>{!data.payments.items.length ? <EmptyState message="No hay pagos en el período o con los filtros seleccionados."/> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Socio</th><th>Fecha</th><th>Importe</th><th>Medio</th><th>Comprobante</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{data.payments.items.map((payment) => <tr key={payment.id}><td>{payment.member.firstName} {payment.member.lastName}<span className="cell-subtext">{payment.member.documentNumber}</span></td><td>{formatDateTime(payment.accreditedAt)}</td><td>{money(payment.amount)}</td><td>{payment.method}</td><td>{payment.receiptNumber ?? '—'}</td><td><span className={`badge ${payment.status === 'VOIDED' ? 'badge-disabled' : 'badge-info'}`}>{payment.status === 'VOIDED' ? 'Anulado' : 'Acreditado'}</span></td><td>{payment.status === 'ACCREDITED' && <button className="text-link" onClick={() => void voidPayment(payment.id)}>Anular</button>}</td></tr>)}</tbody></table></div>}<div className="form-actions"><button className="button button-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page}</span><button className="button button-secondary" disabled={page * data.payments.limit >= data.payments.total} onClick={() => setPage(page + 1)}>Siguiente</button></div></section><aside className="admin-payment-side"><PriceForm current={data.currentPrice?.amount ?? null} onSaved={() => void reload()}/><section className="surface-card"><h2>Historial de valores</h2><div className="price-history">{data.prices.items.length ? data.prices.items.map((price) => <p key={price.id}><span>{formatDate(price.effectiveFrom)}</span><strong>{money(price.amount)}</strong></p>) : <EmptyState message="No hay valores registrados."/>}</div></section></aside></div>
    {paymentOpen && (
      <PaymentDialog
        onClose={() => setPaymentOpen(false)}
        onSaved={() => { setPaymentOpen(false); void reload() }}
      />
    )}
  </section>

  async function voidPayment(id: string) {
    const reason = window.prompt('Ingresá el motivo de la anulación:')?.trim()
    if (!reason) return
    try {
      await backendApi.voidPayment(id, reason)
      await reload()
    } catch (value) {
      window.alert(value instanceof Error ? value.message : 'No se pudo anular el pago.')
    }
  }
}

function Metric({ label, value, icon }: { label: string; value: string; icon: 'check' | 'wallet' | 'calendar' | 'users' }) {
  return <article className="stat-card"><span className="stat-icon blue"><Icon name={icon}/></span><div><span>{label}</span><strong>{value}</strong></div></article>
}

function PriceForm({ current, onSaved }: { current: string | null; onSaved: () => void }) {
  const [amount, setAmount] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    try {
      await backendApi.createPrice(Number(amount), localDateTimeToGymOffset(effectiveFrom))
      setAmount('')
      setEffectiveFrom('')
      setNotice('Nuevo valor registrado correctamente.')
      onSaved()
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'No se pudo registrar el valor.')
    } finally {
      setSaving(false)
    }
  }
  return <section className="surface-card"><h2>Valor de la cuota</h2><p>Valor actual: <strong>{money(current)}</strong></p><form onSubmit={submit}><label className="read-field"><span>Nuevo valor</span><input type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required/></label><label className="read-field"><span>Vigente desde</span><input type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} required/></label>{notice && <p className="notice-inline" role="status">{notice}</p>}<button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Registrar valor'}</button></form></section>
}

function PaymentDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [search, setSearch] = useState('')
  const memberLoader = useCallback(() => backendApi.listMembers({ search: search.trim() || undefined, page: 1, limit: 100 }), [search])
  const { data: members, loading, error, reload } = useApiResource(memberLoader)
  const [memberId, setMemberId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [preview, setPreview] = useState<PaymentPreview | null>(null)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const selected = useMemo(() => members?.items.find((member) => member.id === memberId), [memberId, members])

  const body = () => ({
    memberId,
    amount: Number(amount),
    method,
    ...(receiptNumber.trim() ? { receiptNumber: receiptNumber.trim() } : {}),
  })

  async function previewPayment(event: FormEvent) {
    event.preventDefault()
    setNotice('')
    try {
      setPreview(await backendApi.previewPayment(body()))
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'No se pudo generar la vista previa.')
    }
  }

  async function confirmPayment() {
    setSaving(true)
    setNotice('')
    try {
      await backendApi.createPayment(body())
      onSaved()
    } catch (value) {
      setNotice(value instanceof Error ? value.message : 'No se pudo acreditar el pago.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="dialog-backdrop" role="presentation"><section className="workspace-dialog" role="dialog" aria-modal="true" aria-label="Registrar pago"><button className="dialog-close" aria-label="Cerrar" onClick={onClose}>×</button><span className="eyebrow">M-TEAM</span><h2>Registrar pago</h2><form onSubmit={previewPayment}><div className="dialog-fields"><label className="read-field"><span>Buscar socio</span><input value={search} onChange={(event) => { setSearch(event.target.value); setMemberId(''); setPreview(null) }} placeholder="Nombre, documento o correo"/></label><label className="read-field"><span>Socio</span><select value={memberId} onChange={(event) => { setMemberId(event.target.value); setPreview(null) }} required><option value="">Seleccioná un socio</option>{members?.items.map((member: MemberListItem) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName} · {member.documentNumber}</option>)}</select></label><label className="read-field"><span>Importe</span><input type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setPreview(null) }} required/></label><label className="read-field"><span>Medio de pago</span><input value={method} onChange={(event) => { setMethod(event.target.value); setPreview(null) }} required/></label><label className="read-field"><span>Comprobante</span><input value={receiptNumber} maxLength={100} onChange={(event) => { setReceiptNumber(event.target.value); setPreview(null) }}/></label></div>{loading && <LoadingState message="Buscando socios…"/>}{error && <ErrorState message={error} retry={() => void reload()}/>} {selected && <p>Socio seleccionado: <strong>{selected.firstName} {selected.lastName}</strong></p>}{preview && <div className="payment-summary"><p>Importe: <strong>{money(preview.amount)}</strong></p><p>Vencimiento estimado: <strong>{formatDateTime(preview.estimatedExpiresAt)}</strong></p></div>}{notice && <p className="error-message" role="alert">{notice}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button>{preview ? <button type="button" className="button button-primary" disabled={saving} onClick={() => void confirmPayment()}>{saving ? 'Acreditando…' : 'Confirmar acreditación'}</button> : <button className="button button-primary">Ver resumen</button>}</div></form></section></div>
}
