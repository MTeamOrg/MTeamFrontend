import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './use-auth'

interface ProtectedRouteProps {
  allowPasswordChange?: boolean
}

export function ProtectedRoute({ allowPasswordChange = false }: ProtectedRouteProps) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/iniciar-sesion" replace />
  if (session.user.isPasswordChangeRequired && !allowPasswordChange) {
    return <Navigate to="/cambiar-contrasena" replace />
  }
  if (!session.user.isPasswordChangeRequired && allowPasswordChange) {
    return <Navigate to="/inicio" replace />
  }
  return <Outlet />
}
