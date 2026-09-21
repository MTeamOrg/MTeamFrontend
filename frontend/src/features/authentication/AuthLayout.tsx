import type { PropsWithChildren } from 'react'
import pinIcon from '../../assets/icons/pin.svg'
import './authentication.css'

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <main className="auth-layout">
      <section className="auth-brand" aria-label="Presentación de M-Team">
        <div className="brand-mark"><span>M</span> M-TEAM <strong>GIMNASIO</strong></div>
        <div className="brand-copy">
          <span className="eyebrow">BIENVENIDO A M-TEAM</span>
          <h1>Tu gimnasio,<br /><em>en un solo lugar.</em></h1>
          <p>Cuota, apto médico, acceso y clases. Todo desde la web, sin depender del mostrador.</p>
          <div className="branch-pill"><img src={pinIcon} alt="" /> 2 sedes · Villa Urquiza y Belgrano</div>
        </div>
        <p className="brand-footer">Tu mejor versión, nuestro compromiso.</p>
      </section>
      <section className="auth-content">{children}</section>
    </main>
  )
}
