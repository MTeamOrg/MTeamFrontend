import { useCallback, useState } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { backendApi, type ScheduleClass } from '../../service/backend-api'
import { addDays, gymDate, mondayOfGymWeek } from '../../service/date-time'
import { useAuth } from '../authentication/use-auth'
import { ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import { BranchFilter } from './BranchFilter'
import { ClassDialog } from './ClassDialog'
import { MobileSchedule } from './MobileSchedule'
import { ScheduleGrid } from './ScheduleGrid'
import { WeekSelector } from './WeekSelector'
import { groupWeek, weekRangeLabel } from './schedule-model'
import './schedule.css'

export type ScheduleVariant = 'member' | 'trainer' | 'admin'

const COPY: Record<ScheduleVariant, { title: string; description: string; empty: string; emptyDay: string }> = {
  member: {
    title: 'Clases de la semana',
    description: 'Cronograma informativo: no hay reservas ni cupos, podés acercarte al horario de la clase.',
    empty: 'No hay clases programadas para esta semana.',
    emptyDay: 'Sin clases programadas.',
  },
  trainer: {
    title: 'Mis clases',
    description: 'Clases que tenés asignadas en el cronograma semanal de M-TEAM.',
    empty: 'No tenés clases asignadas esta semana.',
    emptyDay: 'No tenés clases asignadas para este día.',
  },
  admin: {
    title: 'Cronograma de clases',
    description: 'Podés agregar, modificar o eliminar clases. La semana siguiente se genera copiando la anterior.',
    empty: 'No hay clases programadas para esta semana.',
    emptyDay: 'No hay clases programadas para este día.',
  },
}

type DialogState = { scheduledClass: ScheduleClass } | { defaultDate: string } | null

function initialDate(weekStartsOn: string) {
  const today = gymDate()
  return today >= weekStartsOn && today <= addDays(weekStartsOn, 5) ? today : weekStartsOn
}

export function WeeklyScheduleScreen({ variant }: { variant: ScheduleVariant }) {
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const isAdmin = variant === 'admin'
  const [weekStartsOn, setWeekStartsOn] = useState(() => mondayOfGymWeek())
  const [selectedDate, setSelectedDate] = useState(() => initialDate(mondayOfGymWeek()))
  const [branchId, setBranchId] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [copying, setCopying] = useState(false)
  const [copyMessage, setCopyMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const nextWeekStartsOn = addDays(weekStartsOn, 7)

  const scheduleLoader = useCallback(async () => {
    const [current, next] = await Promise.all([
      backendApi.getWeeklySchedule(weekStartsOn),
      isAdmin ? backendApi.getWeeklySchedule(nextWeekStartsOn) : Promise.resolve(null),
    ])
    return { current, next }
  }, [isAdmin, nextWeekStartsOn, weekStartsOn])
  const schedule = useApiResource(scheduleLoader)

  const referenceLoader = useCallback(async () => {
    const [branches, trainers] = await Promise.all([
      backendApi.listBranches('', 1, 100),
      isAdmin ? backendApi.listTrainers(1, 100) : Promise.resolve(null),
    ])
    return { branches: branches.items, trainers: trainers?.items ?? [] }
  }, [isAdmin])
  const reference = useApiResource(referenceLoader)

  const userId = session?.user.id
  const classes = (schedule.data?.current.classes ?? []).filter((scheduledClass) =>
    (!branchId || scheduledClass.branch.id === branchId)
    && (variant !== 'trainer' || scheduledClass.trainer?.id === userId))
  const days = groupWeek(weekStartsOn, classes)

  const copy = COPY[variant]
  const current = schedule.data?.current
  const next = schedule.data?.next
  const nextMissing = isAdmin && next !== undefined && next !== null && next.id === null
  const canCopy = Boolean(current?.id) && nextMissing

  function changeWeek(value: string) {
    setWeekStartsOn(value)
    setSelectedDate(initialDate(value))
    setCopyMessage(null)
  }

  async function copyWeek() {
    if (!current?.id) return
    setCopying(true)
    setCopyMessage(null)
    try {
      await backendApi.copyWeeklySchedule(current.id, nextWeekStartsOn)
      setCopyMessage({ tone: 'success', text: `Se generó la ${weekRangeLabel(nextWeekStartsOn).toLowerCase()}.` })
      await schedule.reload()
    } catch (value) {
      setCopyMessage({ tone: 'error', text: value instanceof Error ? value.message : 'No se pudo copiar la semana.' })
    } finally {
      setCopying(false)
    }
  }

  const copyButton = isAdmin && <button
    type="button"
    className="button button-purple schedule-copy"
    onClick={() => void copyWeek()}
    disabled={!canCopy || copying}
    title={!current?.id ? 'La semana actual no tiene cronograma para copiar' : !nextMissing ? 'La semana siguiente ya fue generada' : undefined}
  ><Icon name="copy" size={20}/>{copying ? 'Copiando…' : 'Copiar a la semana siguiente'}</button>

  const newClassButton = (block = false) => isAdmin && <button
    type="button"
    className={block ? 'button button-secondary button-block' : 'button button-primary'}
    onClick={() => setDialog({ defaultDate: isMobile ? selectedDate : initialDate(weekStartsOn) })}
  ><Icon name="plus" size={20}/>Nueva clase</button>

  const notice = nextMissing && <div className="schedule-notice" role="note">
    <Icon name="info" size={isMobile ? 18 : 20}/>
    <p>La {weekRangeLabel(nextWeekStartsOn).toLowerCase()} todavía no fue generada. {current?.id ? 'Podés copiar esta semana para crearla y luego ajustar las clases.' : 'Agregá clases a esta semana para poder copiarla.'}</p>
  </div>

  const message = copyMessage && <p className={copyMessage.tone === 'error' ? 'error-message' : 'success-message'} role={copyMessage.tone === 'error' ? 'alert' : 'status'}>{copyMessage.text}</p>

  const onSelectClass = isAdmin ? (scheduledClass: ScheduleClass) => setDialog({ scheduledClass }) : undefined
  const noClasses = classes.length === 0

  function body() {
    if (schedule.loading) return <div className="app-card"><LoadingState message="Cargando cronograma…"/></div>
    if (schedule.error || !current) return <div className="app-card"><ErrorState message={schedule.error || 'No se pudo cargar el cronograma.'} retry={() => void schedule.reload()}/></div>
    if (isMobile) {
      return <MobileSchedule
        days={days}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onSelectClass={onSelectClass}
        emptyDayMessage={copy.emptyDay}
        beforeDay={isAdmin && <>{notice}{copyButton}{message}</>}
        afterDay={newClassButton(true)}
      />
    }
    return <div className="app-card schedule-card">
      {noClasses && <p className="schedule-empty-hint">{copy.empty}</p>}
      <ScheduleGrid days={days} onSelectClass={onSelectClass} onAdd={isAdmin ? (date) => setDialog({ defaultDate: date }) : undefined}/>
    </div>
  }

  // Mobile follows MA10: day pills, notice, copy, day heading, cards, "Nueva clase" — no header or toolbar.
  return <div className="app-page schedule-screen">
    {!isMobile && <>
      <PageHeader title={copy.title} description={copy.description}/>
      <div className="schedule-toolbar">
        <WeekSelector weekStartsOn={weekStartsOn} onChange={changeWeek}/>
        <BranchFilter branches={reference.data?.branches ?? []} value={branchId} onChange={setBranchId}/>
        {isAdmin && <><span className="schedule-toolbar-spacer"/>{copyButton}{newClassButton()}</>}
      </div>
      {reference.error && <p className="error-message" role="alert">No se pudieron cargar las sedes: {reference.error}</p>}
      {notice}
      {message}
    </>}
    {isMobile && isAdmin && reference.error && <p className="error-message" role="alert">No se pudieron cargar las sedes: {reference.error}</p>}
    {body()}
    {dialog && <ClassDialog
      {...dialog}
      weekStartsOn={weekStartsOn}
      branches={reference.data?.branches ?? []}
      trainers={reference.data?.trainers ?? []}
      onClose={() => setDialog(null)}
      onSaved={() => { setDialog(null); void schedule.reload() }}
    />}
  </div>
}
