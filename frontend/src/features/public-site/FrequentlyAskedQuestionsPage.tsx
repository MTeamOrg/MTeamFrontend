import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { UserRole } from '../authentication/auth-types'
import { PageHeader } from '../workspace/PageHeader'

type FaqLinkKey = 'signup' | 'login' | 'branches' | 'classes' | 'qr' | 'payments' | 'medical'
type FaqLinks = Partial<Record<FaqLinkKey, string>>

// Where each mention in the answers leads. A key without a destination is shown as plain text, so
// nobody is sent to a screen their role does not have (or to the login page while signed in).
const PUBLIC_LINKS: FaqLinks = { signup: '/crear-cuenta', login: '/iniciar-sesion', branches: '/sedes' }
const ROLE_LINKS: Record<UserRole, FaqLinks> = {
  MEMBER: { branches: '/sedes', classes: '/socio/clases', qr: '/socio/acceso', payments: '/socio/pagos', medical: '/socio/apto-medico' },
  TRAINER: { branches: '/sedes', classes: '/entrenador/clases', qr: '/entrenador/acceso' },
  ADMIN: { branches: '/admin/sedes', classes: '/admin/clases' },
}

const faqGroups = (link: (key: FaqLinkKey, label: ReactNode) => ReactNode) => [
  {
    title: 'Empezar y acceder a tu cuenta',
    items: [
      { question: '¿Cómo empiezo a usar M-TEAM?', answer: <>Creá tu cuenta desde {link('signup', 'Crear cuenta')} y acercate al mostrador para registrar el primer pago. Después vas a poder iniciar sesión y consultar tu información como socio.</> },
      { question: '¿Qué hago si olvidé mi contraseña?', answer: <>En {link('login', 'Iniciar sesión')}, elegí la opción para restablecerla e ingresá el correo de tu cuenta. Vas a recibir un enlace que vence a los 30 minutos y se puede usar una sola vez.</> },
    ],
  },
  {
    title: 'Sedes, clases e ingreso',
    items: [
      { question: '¿Cómo consulto las sedes y sus horarios?', answer: <>Entrá en {link('branches', 'Sedes')} para ver las sedes activas, su dirección, horario y teléfono. Abrí una sede para consultar también su información y las clases programadas.</> },
      { question: '¿Dónde veo el cronograma de clases?', answer: <>Iniciá sesión y abrí {link('classes', <strong>Clases</strong>)} en tu espacio de socio. El cronograma muestra las clases programadas por semana; también podés revisar las clases de una sede desde su detalle público.</> },
      { question: '¿Cómo ingreso con el código QR?', answer: <>Desde {link('qr', <strong>Acceso QR</strong>)}, permití el uso de la cámara y apuntá al código fijo del molinete. Esperá el resultado antes de ingresar. Si el navegador no habilitó la cámara, permití el acceso en sus ajustes y volvé a intentar.</> },
    ],
  },
  {
    title: 'Cuota y apto médico',
    items: [
      { question: '¿Dónde consulto mi cuota y mis pagos?', answer: <>En tu espacio de socio, abrí {link('payments', <strong>Mis pagos</strong>)} para ver el valor vigente, el estado de la cuota, su vencimiento y el historial de pagos acreditados. Si la cuota figura vencida, acercate al mostrador para registrar el pago.</> },
      { question: '¿Cómo cargo el apto médico y qué pasa después?', answer: <>Abrí {link('medical', <strong>Apto médico</strong>)} y cargá un PDF, JPG o PNG de hasta 5 MB, o tomá una foto. Debe incluir nombre y documento, fecha de emisión, aptitud para actividad física, firma y sello profesional. Queda <strong>Pendiente</strong> hasta que lo revise un administrador; si lo rechaza, vas a ver la observación y podrás reemplazarlo. Un apto aprobado no vence.</> },
      { question: '¿Puedo ingresar mientras revisan mi primer apto?', answer: <>Durante los primeros 20 días desde tu primer pago acreditado podés ingresar aunque el apto todavía no esté aprobado. Cuando termine ese período, necesitás tenerlo aprobado para ingresar.</> },
    ],
  },
]

const INTRO = 'Encontrá respuestas a las dudas más comunes sobre tu cuenta, las sedes y el uso de M-TEAM.'

// Public site by default; with a `role` it is the same content inside that role's signed-in workspace.
export function FrequentlyAskedQuestionsPage({ role }: { role?: UserRole }) {
  const links = role ? ROLE_LINKS[role] : PUBLIC_LINKS
  const link = (key: FaqLinkKey, label: ReactNode) => {
    const to = links[key]
    return to ? <Link to={to}>{label}</Link> : label
  }
  const groups = faqGroups(link).map((group, groupIndex) => <section className="faq-group" key={group.title} aria-labelledby={`faq-group-${groupIndex}`}>
    <h2 id={`faq-group-${groupIndex}`}>{group.title}</h2>
    <div className="faq-list">{group.items.map((item) => <details className="faq-item" key={item.question}>
      <summary>{item.question}</summary>
      <div className="faq-answer"><p>{item.answer}</p></div>
    </details>)}</div>
  </section>)

  if (role) return <div className="app-page faq-page"><PageHeader title="Preguntas frecuentes" description={INTRO}/>{groups}</div>
  return <div className="public-page faq-page">
    <header className="faq-heading">
      <h1>Preguntas frecuentes</h1>
      <p className="page-intro">{INTRO}</p>
    </header>
    {groups}
  </div>
}
