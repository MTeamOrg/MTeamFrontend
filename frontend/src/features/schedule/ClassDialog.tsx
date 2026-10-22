import { useState, type FormEvent } from 'react'
import {
  backendApi,
  type EntityRef,
  type PersonRef,
  type ScheduleClass,
  type ScheduledClassUpdate,
} from '../../service/backend-api'
import { addDays, localDateTimeToGymOffset } from '../../service/date-time'
import { Icon } from '../workspace/Icon'
import { SCHEDULE_DAYS, hasStarted } from './schedule-model'

type Props = {
  weekStartsOn: string
  branches: EntityRef[]
  trainers: PersonRef[]
  onClose: () => void
  onSaved: () => void
} & ({ scheduledClass: ScheduleClass; defaultDate?: never } | { scheduledClass?: never; defaultDate: string })

export function ClassDialog({ weekStartsOn, branches, trainers, scheduledClass, defaultDate, onClose, onSaved }: Props) {
  const editing = Boolean(scheduledClass)
  const locked = scheduledClass ? hasStarted(scheduledClass) : false
  const [activity, setActivity] = useState(scheduledClass?.activity ?? '')
  const [date, setDate] = useState(scheduledClass?.day ?? defaultDate ?? weekStartsOn)
  const [time, setTime] = useState(scheduledClass?.startTime ?? '')
  const [branchId, setBranchId] = useState(scheduledClass?.branch.id ?? '')
  const [trainerId, setTrainerId] = useState(scheduledClass?.trainer?.id ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const title = editing ? 'Editar clase' : 'Nueva clase'
  const branchOptions = scheduledClass && !branches.some((branch) => branch.id === scheduledClass.branch.id)
    ? [...branches, scheduledClass.branch]
    : branches
  const assignedTrainer = scheduledClass?.trainer
  const trainerOptions = assignedTrainer && !trainers.some((trainer) => trainer.id === assignedTrainer.id)
    ? [...trainers, assignedTrainer]
    : trainers

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const startsAt = localDateTimeToGymOffset(`${date}T${time}`)
    if (new Date(startsAt).getTime() <= Date.now()) {
      setError('La clase debe comenzar en un horario futuro.')
      return
    }
    setSaving(true)
    try {
      if (scheduledClass) {
        const changes: ScheduledClassUpdate = {}
        if (activity.trim() !== scheduledClass.activity) changes.activity = activity.trim()
        if (date !== scheduledClass.day || time !== scheduledClass.startTime) changes.startsAt = startsAt
        if (branchId !== scheduledClass.branch.id) changes.branchId = branchId
        if (trainerId !== (scheduledClass.trainer?.id ?? '')) changes.trainerId = trainerId || null
        if (Object.keys(changes).length === 0) {
          onClose()
          return
        }
        await backendApi.updateScheduledClass(scheduledClass.id, changes)
      } else {
        await backendApi.createScheduledClass({
          weekStartsOn,
          activity: activity.trim(),
          startsAt,
          branchId,
          trainerId: trainerId || null,
        })
      }
      onSaved()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo guardar la clase.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!scheduledClass || !window.confirm(`¿Confirmás la eliminación de ${scheduledClass.activity} (${scheduledClass.startTime})?`)) return
    setSaving(true)
    setError('')
    try {
      await backendApi.deleteScheduledClass(scheduledClass.id)
      onSaved()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo eliminar la clase.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="dialog-backdrop" role="presentation">
    <section className="workspace-dialog class-dialog" role="dialog" aria-modal="true" aria-labelledby="class-dialog-title">
      <button type="button" className="dialog-close" aria-label="Cerrar" onClick={onClose}><Icon name="close" size={20}/></button>
      <h2 id="class-dialog-title">{title}</h2>
      {locked && <p className="class-dialog-locked" role="status"><Icon name="info" size={18}/>Esta clase ya comenzó: no puede modificarse ni eliminarse.</p>}
      <form onSubmit={submit}>
        <fieldset className="dialog-fields" disabled={locked || saving}>
          <label className="read-field"><span>Actividad</span><input value={activity} onChange={(event) => setActivity(event.target.value)} required maxLength={150}/></label>
          <label className="read-field"><span>Día</span><input type="date" value={date} min={weekStartsOn} max={addDays(weekStartsOn, SCHEDULE_DAYS - 1)} onChange={(event) => setDate(event.target.value)} required/></label>
          <label className="read-field"><span>Horario</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} required/></label>
          <label className="read-field"><span>Sede</span><select value={branchId} onChange={(event) => setBranchId(event.target.value)} required>
            <option value="">Seleccioná una sede</option>
            {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select></label>
          <label className="read-field"><span>Entrenador</span><select value={trainerId} onChange={(event) => setTrainerId(event.target.value)}>
            <option value="">Sin entrenador asignado</option>
            {trainerOptions.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.firstName} {trainer.lastName}</option>)}
          </select></label>
        </fieldset>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="dialog-actions">
          {editing && !locked && <button type="button" className="button button-danger class-dialog-delete" disabled={saving} onClick={() => void remove()}><Icon name="trash" size={20}/>Eliminar</button>}
          <button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button>
          {!locked && <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear clase'}</button>}
        </div>
      </form>
    </section>
  </div>
}
