import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/authentication/use-auth'

export function AuthenticatedHomePage() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/iniciar-sesion', { replace: true })
  }

  return (
    <main className="placeholder-page">
      <div className="placeholder-card">
        <span className="eyebrow">M-TEAM GIMNASIO</span>
        <h1>¡Hola, {session?.user.firstName}!</h1>
        <p>Tu sesión está activa. El dashboard correspondiente al rol <strong>{session?.user.role}</strong> se implementará en el módulo siguiente.</p>
        <button className="primary-button" type="button" onClick={() => void handleLogout()}>Cerrar sesión</button>
      </div>
    </main>
  )
}
