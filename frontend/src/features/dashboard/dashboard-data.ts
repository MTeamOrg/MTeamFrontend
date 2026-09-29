import { backendApi } from '../../service/backend-api'
import { addDays, gymDate } from '../../service/date-time'

export interface DailyRevenue {
  date: string
  amount: number
}

export interface RevenueWeek {
  days: DailyRevenue[]
  total: number
}

export function lastSevenDays(today = gymDate()) {
  return Array.from({ length: 7 }, (_, index) => addDays(today, index - 6))
}

export async function loadRevenueWeek(today = gymDate()): Promise<RevenueWeek> {
  const dates = lastSevenDays(today)
  const from = `${dates[0]}T00:00:00-03:00`
  const to = `${addDays(today, 1)}T00:00:00-03:00`
  const summary = await backendApi.getPaymentsSummary(from, to)
  return { days: summary.days.map((day) => ({ date: day.date, amount: Number(day.amount) })), total: Number(summary.totalAmount) }
}

export function formatMoney(value: number | string | null) {
  if (value === null) return 'Sin configurar'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value))
}

export function formatNumericDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export function formatDayMonth(date: string) {
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}
