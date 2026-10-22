import { addDays } from '../../service/date-time'
import { Icon } from '../workspace/Icon'
import { weekRangeLabel } from './schedule-model'

export function WeekSelector({ weekStartsOn, onChange }: { weekStartsOn: string; onChange: (weekStartsOn: string) => void }) {
  return <div className="week-selector">
    <button type="button" aria-label="Semana anterior" onClick={() => onChange(addDays(weekStartsOn, -7))}><Icon name="back" size={18}/></button>
    <span aria-live="polite">{weekRangeLabel(weekStartsOn)}</span>
    <button type="button" aria-label="Semana siguiente" onClick={() => onChange(addDays(weekStartsOn, 7))}><Icon name="next" size={18}/></button>
  </div>
}
