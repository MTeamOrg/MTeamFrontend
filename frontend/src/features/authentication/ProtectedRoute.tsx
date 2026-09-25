import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './use-auth'

interface ProtectedRouteProps {
  allowPasswordChange?: boolean
}

export function ProtectedRoute({ allowPasswordChange = false }: ProtectedRouteProps) {
  const { session, logout } = useAuth()
  useEffect(() => {
    if (session?.user.status === 'INACTIVE') void logout()
  }, [session?.user.status, logout])

  if (!session) return <Navigate to="/iniciar-sesion" replace />
  if (session.user.status === 'INACTIVE') return <Navigate to="/iniciar-sesion" replace />
  if (session.user.isPasswordChangeRequired && !allowPasswordChange) {
    return <Navigate to="/cambiar-contrasena" replace />
  }
  if (!session.user.isPasswordChangeRequired && allowPasswordChange) {
    return <Navigate to="/inicio" replace />
  }
  return <Outlet />
}
