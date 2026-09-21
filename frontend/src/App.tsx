import { Navigate, Route, Routes } from 'react-router-dom'
import { ChangePasswordPage } from './features/authentication/ChangePasswordPage'
import { LoginPage } from './features/authentication/LoginPage'
import { ProtectedRoute } from './features/authentication/ProtectedRoute'
import { RegisterPage } from './features/authentication/RegisterPage'
import { AuthenticatedHomePage } from './pages/AuthenticatedHomePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/iniciar-sesion" replace />} />
      <Route path="/iniciar-sesion" element={<LoginPage />} />
      <Route path="/crear-cuenta" element={<RegisterPage />} />
      <Route element={<ProtectedRoute allowPasswordChange />}>
        <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/inicio" element={<AuthenticatedHomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
