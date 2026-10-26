import { AdminNewsScreen } from './AdminNewsScreen'
import { NewsConsultationScreen } from './NewsConsultationScreen'

export function NewsScreen({ isAdmin = false }: { isAdmin?: boolean }) {
  return isAdmin ? <AdminNewsScreen/> : <NewsConsultationScreen/>
}
