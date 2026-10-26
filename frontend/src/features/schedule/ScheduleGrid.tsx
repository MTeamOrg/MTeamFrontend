import type { ScheduleClass } from '../../service/backend-api'
import { Icon } from '../workspace/Icon'
import { ScheduledClassCard } from './ScheduledClassCard'
import { toneForIndex, type ScheduleDayGroup } from './schedule-model'

export function ScheduleGrid({ days, onSelectClass, onAdd }: {
  days: ScheduleDayGroup[]
  onSelectClass?: (scheduledClass: ScheduleClass) => void
  onAdd?: (date: string) => void
}) {
  return <div className="schedule-grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
    {days.map((day) => <ScheduleDay key={day.date} day={day} onSelectClass={onSelectClass} onAdd={onAdd}/>)}
  </div>
}

function ScheduleDay({ day, onSelectClass, onAdd }: {
  day: ScheduleDayGroup
  onSelectClass?: (scheduledClass: ScheduleClass) => void
  onAdd?: (date: string) => void
}) {
  return <section className="schedule-day" aria-label={`${day.name} ${day.label}`}>
    <header className="schedule-day-header">
      <h3>{day.name}</h3>
      <span>{day.label}</span>
    </header>
    {day.classes.map((scheduledClass, index) => <ScheduledClassCard key={scheduledClass.id} scheduledClass={scheduledClass} tone={toneForIndex(index)} onSelect={onSelectClass}/>)}
    {onAdd && <button type="button" className="schedule-add" onClick={() => onAdd(day.date)} aria-label={`Agregar clase el ${day.name} ${day.label}`}><Icon name="plus" size={16}/><span>Agregar</span></button>}
  </section>
}
