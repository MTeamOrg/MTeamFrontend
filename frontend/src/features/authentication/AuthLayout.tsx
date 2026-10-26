import type { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'
import pinIcon from '../../assets/icons/pin.svg'

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <main className="auth-layout">
      <section className="auth-brand" aria-label="Presentación de M-Team">
        <Link className="brand-lockup" to="/" aria-label="M-Team Gimnasio, ir al inicio">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>M-TEAM <b>GIMNASIO</b></span>
        </Link>
        <div className="brand-copy">
          <h1>Tu gimnasio,<br /><em>en un solo lugar.</em></h1>
          <p>Cuota, apto médico, acceso y clases. Todo desde la web, sin depender del mostrador.</p>
        </div>
        <div className="branch-pill"><img src={pinIcon} alt="" /> Entrená en nuestras sedes activas</div>
      </section>
      <section className="auth-content">{children}</section>
    </main>
  )
}
