const GYM_TIME_ZONE = 'America/Argentina/Buenos_Aires'

export function gymDate(instant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
}

export function addDays(date: string, days: number) {
  const instant = new Date(`${date}T00:00:00.000Z`)
  instant.setUTCDate(instant.getUTCDate() + days)
  return instant.toISOString().slice(0, 10)
}

export function mondayOfGymWeek(instant = new Date()) {
  const today = gymDate(instant)
  const day = new Date(`${today}T00:00:00.000Z`).getUTCDay()
  return addDays(today, day === 0 ? -6 : 1 - day)
}

/**
 * "03/03/2036 23:30": always in Buenos Aires time, with a 24-hour clock and a four-digit year, the same
 * way the backend writes the dates inside its notification texts, so one card never mixes two styles.
 */
export function formatDateTime(value: string) {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: GYM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`
}

export function formatDate(value: string | null) {
  if (!value) return 'Sin registrar'
  const instant = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : new Date(value)
  return new Intl.DateTimeFormat('es-AR', { timeZone: GYM_TIME_ZONE, dateStyle: 'medium' }).format(instant)
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: GYM_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
}

export function localDateTimeToGymOffset(value: string) {
  return `${value}:00-03:00`
}
