import { Navigate, Route, Routes } from 'react-router-dom'
import { ChangePasswordPage } from './features/authentication/ChangePasswordPage'
import { LoginPage } from './features/authentication/LoginPage'
import { ProtectedRoute } from './features/authentication/ProtectedRoute'
import { RegisterPage } from './features/authentication/RegisterPage'
import { PublicSite } from './features/public-site/PublicSite'
import { RoleWorkspace } from './features/workspace/RoleWorkspace'
import { useAuth } from './features/authentication/use-auth'

function RoleHomeRedirect() {
  const { session } = useAuth()
  if (!session) return <Navigate to="/iniciar-sesion" replace />
  const path = session.user.role === 'ADMIN' ? '/admin' : session.user.role === 'TRAINER' ? '/entrenador' : '/socio'
  return <Navigate to={session.user.isPasswordChangeRequired ? '/cambiar-contrasena' : path} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicSite />} />
      <Route path="/sedes" element={<PublicSite />} />
      <Route path="/eventos" element={<PublicSite />} />
      <Route path="/novedades" element={<PublicSite />} />
      <Route path="/iniciar-sesion" element={<LoginPage />} />
      <Route path="/crear-cuenta" element={<RegisterPage />} />
      <Route element={<ProtectedRoute allowPasswordChange />}>
        <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/cambiar-contrasena-voluntario" element={<ChangePasswordPage optional />} />
        <Route path="/inicio" element={<RoleHomeRedirect />} />
        <Route path="/socio/*" element={<RoleWorkspace role="MEMBER" />} />
        <Route path="/entrenador/*" element={<RoleWorkspace role="TRAINER" />} />
        <Route path="/admin/*" element={<RoleWorkspace role="ADMIN" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
