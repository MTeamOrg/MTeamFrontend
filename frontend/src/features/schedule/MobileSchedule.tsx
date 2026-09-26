import type { ReactNode } from 'react'
import type { ScheduleClass } from '../../service/backend-api'
import { EmptyState } from '../workspace/ApiStates'
import { MobileClassCard } from './ScheduledClassCard'
import { longDateLabel, toneForIndex, type ScheduleDayGroup } from './schedule-model'

export function MobileSchedule({ days, selectedDate, onSelectDate, onSelectClass, emptyDayMessage = 'No hay clases programadas para este día.', beforeDay, afterDay }: {
  days: ScheduleDayGroup[]
  selectedDate: string
  onSelectDate: (date: string) => void
  onSelectClass?: (scheduledClass: ScheduleClass) => void
  emptyDayMessage?: string
  beforeDay?: ReactNode
  afterDay?: ReactNode
}) {
  const day = days.find((item) => item.date === selectedDate) ?? days[0]
  return <>
    <div className="day-pills" role="tablist" aria-label="Días de la semana">
      {days.map((item) => <button
        key={item.date}
        type="button"
        role="tab"
        aria-selected={item.date === day.date}
        className={item.date === day.date ? 'day-pill is-active' : 'day-pill'}
        onClick={() => onSelectDate(item.date)}
      >{item.shortName} {Number(item.date.slice(8))}</button>)}
    </div>
    {beforeDay}
    <section className="mobile-day" aria-label={`${day.name} ${longDateLabel(day.date)}`}>
      <h2 className="mobile-day-heading">{day.name} {longDateLabel(day.date)}</h2>
      {day.classes.length
        ? day.classes.map((scheduledClass, index) => <MobileClassCard key={scheduledClass.id} scheduledClass={scheduledClass} tone={toneForIndex(index)} onSelect={onSelectClass}/>)
        : <div className="app-card"><EmptyState message={emptyDayMessage}/></div>}
    </section>
    {afterDay}
  </>
}
