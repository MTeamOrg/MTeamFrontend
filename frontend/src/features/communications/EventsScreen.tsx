import { AdminEventsScreen } from './AdminEventsScreen'
import { EventConsultationScreen } from './EventConsultationScreen'

export function EventsScreen({ isAdmin = false }: { isAdmin?: boolean }) {
  return isAdmin ? <AdminEventsScreen/> : <EventConsultationScreen/>
}
