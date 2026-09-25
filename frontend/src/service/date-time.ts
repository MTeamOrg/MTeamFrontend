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

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: GYM_TIME_ZONE, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function formatDate(value: string | null) {
  if (!value) return 'Sin registrar'
  const instant = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : new Date(value)
  return new Intl.DateTimeFormat('es-AR', { timeZone: GYM_TIME_ZONE, dateStyle: 'medium' }).format(instant)
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: GYM_TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function localDateTimeToGymOffset(value: string) {
  return `${value}:00-03:00`
}
