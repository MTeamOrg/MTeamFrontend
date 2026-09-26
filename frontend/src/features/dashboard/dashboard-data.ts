import { backendApi, type Payment } from '../../service/backend-api'
import { addDays, gymDate } from '../../service/date-time'

export interface DailyRevenue {
  date: string
  amount: number
}

export interface RevenueWeek {
  days: DailyRevenue[]
  total: number
}

const MAX_PAGES = 50

export function lastSevenDays(today = gymDate()) {
  return Array.from({ length: 7 }, (_, index) => addDays(today, index - 6))
}

export function groupRevenueByDay(payments: Pick<Payment, 'accreditedAt' | 'amount' | 'status'>[], dates: string[]): DailyRevenue[] {
  const totals = new Map(dates.map((date) => [date, 0]))
  for (const payment of payments) {
    if (payment.status !== 'ACCREDITED') continue
    const date = gymDate(new Date(payment.accreditedAt))
    if (totals.has(date)) totals.set(date, (totals.get(date) ?? 0) + Number(payment.amount))
  }
  return dates.map((date) => ({ date, amount: Math.round((totals.get(date) ?? 0) * 100) / 100 }))
}

export async function loadRevenueWeek(today = gymDate()): Promise<RevenueWeek> {
  const dates = lastSevenDays(today)
  const from = `${dates[0]}T00:00:00-03:00`
  const to = `${addDays(today, 1)}T00:00:00-03:00`
  const [summary, firstPage] = await Promise.all([
    backendApi.getPaymentsSummary(from, to),
    backendApi.listPayments({ status: 'ACCREDITED', from, to, page: 1, limit: 100 }),
  ])
  const payments = [...firstPage.items]
  const pages = Math.min(Math.ceil(firstPage.total / firstPage.limit), MAX_PAGES)
  for (let page = 2; page <= pages; page += 1) {
    const next = await backendApi.listPayments({ status: 'ACCREDITED', from, to, page, limit: 100 })
    payments.push(...next.items)
  }
  return { days: groupRevenueByDay(payments, dates), total: Number(summary.totalAmount) }
}

export function formatMoney(value: number | string | null) {
  if (value === null) return 'Sin configurar'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value))
}

export function formatNumericDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
