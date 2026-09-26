import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { backendApi } from '../../service/backend-api'
import { gymDate } from '../../service/date-time'
import { useAuth } from '../authentication/use-auth'
import { MobileClassCard } from '../schedule/ScheduledClassCard'
import { toneForIndex } from '../schedule/schedule-model'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { DashboardCard, DashboardHeader, StatusCard } from './DashboardParts'
import { formatNumericDate } from './dashboard-data'
import './dashboard.css'

export function TrainerDashboardScreen() {
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const trainerId = session?.user.id
  const loader = useCallback(async () => {
    const schedule = await backendApi.getWeeklySchedule()
    const mine = schedule.classes.filter((scheduledClass) => scheduledClass.trainer?.id === trainerId)
    const today = gymDate()
    return { week: mine, today: mine.filter((scheduledClass) => scheduledClass.day === today) }
  }, [trainerId])
  const data = useApiResource(loader)
  const header = <DashboardHeader
    greeting={`Buen día, ${session?.user.firstName ?? ''}`}
    intro={isMobile ? `Resumen de hoy · ${formatNumericDate(gymDate())}` : 'Tus clases asignadas en el cronograma de M-TEAM.'}
  />

  if (data.loading) return <div className="app-page dashboard-screen">{header}<div className="app-card"><LoadingState/></div></div>
  if (data.error || !data.data) return <div className="app-page dashboard-screen">{header}<div className="app-card"><ErrorState message={data.error || 'No se pudieron cargar tus clases.'} retry={() => void data.reload()}/></div></div>

  const { week, today } = data.data
  return <div className="app-page dashboard-screen">
    {header}
    <div className="status-grid status-grid-two">
      <StatusCard label="CLASES DE HOY" value={String(today.length)} tone="pink"/>
      <StatusCard label="CLASES DE LA SEMANA" value={String(week.length)} tone="blue"/>
    </div>
    <DashboardCard title="Clases de hoy" action={<Link className="text-link" to="/entrenador/clases">Ver mis clases</Link>}>
      {today.length
        ? <div className="dashboard-list">{today.map((scheduledClass, index) => <MobileClassCard key={scheduledClass.id} scheduledClass={scheduledClass} tone={toneForIndex(index)}/>)}</div>
        : <EmptyState message="No tenés clases asignadas para hoy."/>}
    </DashboardCard>
  </div>
}
