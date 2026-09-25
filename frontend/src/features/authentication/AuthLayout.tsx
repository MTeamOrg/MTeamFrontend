import type { PropsWithChildren } from 'react'
import pinIcon from '../../assets/icons/pin.svg'

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <main className="auth-layout">
      <section className="auth-brand" aria-label="Presentación de M-Team">
        <div className="brand-lockup"><span className="brand-mark">M</span><span>M-TEAM <b>GIMNASIO</b></span></div>
        <div className="brand-copy">
          <h1>Tu gimnasio,<br /><em>en un solo lugar.</em></h1>
          <p>Cuota, apto médico, acceso y clases. Todo desde la web, sin depender del mostrador.</p>
        </div>
        <div className="branch-pill"><img src={pinIcon} alt="" /> 2 sedes · Villa Urquiza y Belgrano</div>
      </section>
      <section className="auth-content">{children}</section>
    </main>
  )
}
