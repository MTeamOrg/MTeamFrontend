import type { ScheduleClass } from '../../service/backend-api'
import { trainerName, type ClassTone } from './schedule-model'

export function ScheduledClassCard({ scheduledClass, tone, onSelect }: { scheduledClass: ScheduleClass; tone: ClassTone; onSelect?: (scheduledClass: ScheduleClass) => void }) {
  const content = <>
    <strong className="class-card-title">{scheduledClass.startTime} · {scheduledClass.activity}</strong>
    <span className="class-card-branch">{scheduledClass.branch.name}</span>
    <span className="class-card-trainer">{trainerName(scheduledClass)}</span>
  </>
  if (onSelect) {
    return <button type="button" className={`class-card tone-${tone}`} onClick={() => onSelect(scheduledClass)} aria-label={`Editar ${scheduledClass.activity} a las ${scheduledClass.startTime}`}>{content}</button>
  }
  return <article className={`class-card tone-${tone}`}>{content}</article>
}

export function MobileClassCard({ scheduledClass, tone, onSelect, dayLabel }: { scheduledClass: ScheduleClass; tone: ClassTone; onSelect?: (scheduledClass: ScheduleClass) => void; dayLabel?: string }) {
  const content = <>
    <span className="mobile-class-time">{scheduledClass.startTime}</span>
    <span className={`mobile-class-divider tone-${tone}`} aria-hidden="true"/>
    <span className="mobile-class-main">
      <strong>{scheduledClass.activity}</strong>
      <span>{dayLabel ? `${dayLabel} · ` : ''}{scheduledClass.branch.name} · {trainerName(scheduledClass)}</span>
    </span>
  </>
  if (onSelect) {
    return <button type="button" className="mobile-class-card" onClick={() => onSelect(scheduledClass)} aria-label={`Editar ${scheduledClass.activity} a las ${scheduledClass.startTime}`}>{content}</button>
  }
  return <article className="mobile-class-card">{content}</article>
}
