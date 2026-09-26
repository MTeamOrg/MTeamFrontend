import type { ScheduleClass } from '../../service/backend-api'
import { addDays } from '../../service/date-time'

export type ClassTone = 'pink' | 'purple' | 'blue'

const TONES: ClassTone[] = ['pink', 'purple', 'blue']
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export interface ScheduleDayGroup {
  date: string
  name: string
  shortName: string
  label: string
  classes: ScheduleClass[]
}

function parts(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month: month - 1, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() }
}

export function toneForIndex(index: number): ClassTone {
  return TONES[index % TONES.length]
}

export function shortDateLabel(date: string) {
  const { day, month } = parts(date)
  return `${day} ${SHORT_MONTHS[month]}`
}

export function longDateLabel(date: string) {
  const { day, month } = parts(date)
  return `${day} de ${MONTHS[month]}`
}

export const SCHEDULE_DAYS = 6

// Figma (A10/S7) defines a Monday–Saturday grid. The backend also accepts Sunday classes;
// that mismatch is reported instead of changing the grid.
export function groupWeek(weekStartsOn: string, classes: ScheduleClass[]): ScheduleDayGroup[] {
  return Array.from({ length: SCHEDULE_DAYS }, (_, offset) => {
    const date = addDays(weekStartsOn, offset)
    const name = DAY_NAMES[parts(date).weekday]
    return {
      date,
      name,
      shortName: name.slice(0, 3),
      label: shortDateLabel(date),
      classes: classes.filter((scheduledClass) => scheduledClass.day === date),
    }
  })
}

export function weekRangeLabel(weekStartsOn: string) {
  const start = parts(weekStartsOn)
  const end = parts(addDays(weekStartsOn, 5))
  if (start.month === end.month) return `Semana del ${start.day} al ${end.day} de ${MONTHS[end.month]}`
  return `Semana del ${start.day} de ${MONTHS[start.month]} al ${end.day} de ${MONTHS[end.month]}`
}

export function trainerName(scheduledClass: ScheduleClass) {
  return scheduledClass.trainer ? `${scheduledClass.trainer.firstName} ${scheduledClass.trainer.lastName}` : 'Sin entrenador asignado'
}

export function hasStarted(scheduledClass: ScheduleClass, now = new Date()) {
  return new Date(scheduledClass.startsAt).getTime() <= now.getTime()
}
