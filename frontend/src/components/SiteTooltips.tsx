import { useEffect, useState } from 'react'

type Hint = { text: string; x: number; y: number }
const INTERACTIVE = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], summary, select, input[type="checkbox"], input[type="radio"], [tabindex="0"][aria-label]'

function hintFor(target: HTMLElement) {
  const associatedLabel = 'labels' in target ? Array.from((target as HTMLInputElement).labels ?? []).map((item) => item.innerText).join(' ') : ''
  const label = (target.getAttribute('aria-label') || associatedLabel || target.innerText || target.textContent || target.getAttribute('alt') || '').replace(/\s+/g, ' ').trim()
  const title = target.getAttribute('title')
  if (title && (target.matches(':disabled') || title.toLocaleLowerCase() !== label.toLocaleLowerCase())) return title
  const value = label.replace(/[→←✓+]$/g, '').trim()
  const lower = value.toLocaleLowerCase()
  if (target.closest('.directions')) return 'Abre Google Maps con la ubicación de esta sede y opciones para llegar.'
  const href = target.matches('a[href]') ? (target as HTMLAnchorElement).getAttribute('href') ?? '' : ''
  const normalizedHref = href.split(/[?#]/)[0].replace(/\/$/, '').toLocaleLowerCase()
  const routeHints: Record<string, string> = {
    '/': 'Información del gimnasio, sedes y próximos pasos para empezar.',
    '/sedes': 'Direcciones, horarios y datos de contacto de cada sede.',
    '/eventos': 'Eventos y actividades próximas del gimnasio.',
    '/novedades': 'Anuncios e información reciente del gimnasio.',
    '/preguntas-frecuentes': 'Respuestas sobre cuentas, pagos, clases y uso del sitio.',
    '/iniciar-sesion': 'Acceso a una cuenta existente.',
    '/crear-cuenta': 'Formulario para solicitar una cuenta de socio.',
    '/admin': 'Indicadores de actividad y accesos a herramientas administrativas.',
    '/admin/usuarios': 'Búsqueda y administración de cuentas de socios, entrenadores y administradores.',
    '/admin/pagos': 'Registro y consulta de pagos, vencimientos y valor de la cuota.',
    '/admin/aptos': 'Certificados médicos enviados por socios para revisar y aprobar.',
    '/admin/accesos': 'Historial de ingresos permitidos y rechazados, con filtros.',
    '/admin/clases': 'Cronograma semanal de clases; permite crear y editar horarios.',
    '/admin/sedes': 'Datos y configuración de las sedes del gimnasio.',
    '/admin/eventos': 'Administración de eventos publicados para los usuarios.',
    '/admin/novedades': 'Creación y administración de anuncios del gimnasio.',
    '/socio': 'Resumen de tu cuenta, cuota, apto médico y novedades.',
    '/socio/perfil': 'Tus datos personales y opciones de cuenta.',
    '/socio/apto-medico': 'Estado del certificado médico y opciones para cargarlo.',
    '/socio/acceso': 'Escáner para leer el QR fijo del acceso y validar tu ingreso.',
    '/socio/clases': 'Horarios semanales de clases y sedes disponibles.',
    '/socio/eventos': 'Eventos y actividades próximas del gimnasio.',
    '/socio/novedades': 'Anuncios e información reciente del gimnasio.',
    '/socio/notificaciones': 'Avisos de tu cuenta y novedades pendientes de leer.',
    '/socio/preguntas-frecuentes': 'Respuestas sobre pagos, clases, cuenta y acceso.',
    '/socio/pagos': 'Estado de tu cuota, último pago e historial de acreditaciones.',
    '/entrenador': 'Resumen de tus clases, novedades y accesos frecuentes.',
    '/entrenador/perfil': 'Tus datos personales y opciones de cuenta.',
    '/entrenador/acceso': 'Escáner para leer el QR fijo del acceso y validar el ingreso de un socio.',
    '/entrenador/clases': 'Tus clases asignadas y sus horarios semanales.',
    '/entrenador/eventos': 'Eventos y actividades próximas del gimnasio.',
    '/entrenador/novedades': 'Anuncios e información reciente del gimnasio.',
    '/entrenador/notificaciones': 'Avisos de tu cuenta y novedades pendientes de leer.',
    '/entrenador/preguntas-frecuentes': 'Respuestas sobre el uso del sitio y sus funciones.',
  }
  if (routeHints[normalizedHref]) return routeHints[normalizedHref]
  if (normalizedHref.startsWith('/admin/usuarios/')) return 'Ficha de la cuenta con datos, estado, pagos y accesos registrados.'
  if (normalizedHref.startsWith('/admin/aptos/')) return 'Certificado médico y herramientas para registrar la revisión.'
  if (normalizedHref.startsWith('/sedes/')) return 'Dirección, horarios, contacto y clases programadas de esta sede.'
  const sectionHints: Record<string, string> = {
    inicio: 'Resumen de tu cuenta, avisos y accesos frecuentes.',
    panel: 'Resumen de actividad y accesos de administración.',
    'mi perfil': 'Tus datos personales y opciones de cuenta.',
    perfil: 'Tus datos personales y opciones de cuenta.',
    usuarios: 'Cuentas, datos y estado de los socios.',
    'pagos y cuota': 'Cuotas, pagos registrados y estado de deuda.',
    pagos: 'Estado de tu cuota e historial de pagos.',
    'apto médico': 'Estado de tu certificado y carga de documentación.',
    'aptos médicos': 'Certificados enviados por socios para revisión.',
    aptos: 'Estado de los certificados médicos enviados.',
    'acceso qr': 'Código QR para ingresar al gimnasio.',
    acceso: 'Código QR y resultado de tu ingreso al gimnasio.',
    accesos: 'Historial de intentos de ingreso al gimnasio.',
    clases: 'Horarios semanales, actividades y sedes.',
    'mis clases': 'Tus clases asignadas y sus horarios.',
    eventos: 'Próximos eventos y actividades del gimnasio.',
    novedades: 'Anuncios e información reciente del gimnasio.',
    notificaciones: 'Avisos de tu cuenta y novedades pendientes.',
    ayuda: 'Respuestas a preguntas frecuentes sobre el sitio.',
    'preguntas frecuentes': 'Respuestas a preguntas frecuentes sobre el sitio.',
    sedes: 'Direcciones, horarios y datos de contacto.',
    entrenadores: 'Perfiles y datos de contacto de entrenadores.',
  }
  if (target.matches('a[href]')) {
    const sectionHint = sectionHints[lower]
    if (sectionHint) return sectionHint
    const href = (target as HTMLAnchorElement).getAttribute('href') ?? ''
    const destination = href.split(/[?#]/)[0].split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ').toLocaleLowerCase()
    if (destination && sectionHints[destination]) return sectionHints[destination]
  }
  if (!value) return 'Seleccioná este control para ver su función.'
  if (/^(mostrar filtros)\b/.test(lower)) return 'Abre los criterios disponibles para acotar la lista.'
  if (/^(filtrar por)\b/.test(lower)) return `Limita la lista según ${lower.replace('filtrar por ', '')}.`
  if (/^(filtrar|filtros?)\b/.test(lower)) return 'Abre los criterios para acotar los resultados de la lista.'
  if (/^(buscar|buscá)\b/.test(lower)) return 'Escribí un dato y activá esta opción para encontrar coincidencias.'
  if (/^(semana anterior|semana siguiente)\b/.test(lower)) return 'Cambia el cronograma a la semana indicada.'
  if (/^(anterior|siguiente|página anterior|página siguiente)\b/.test(lower)) return 'Cambia la página de resultados que estás viendo.'
  if (/^(reintentar)\b/.test(lower)) return 'Volvé a intentar la acción que no pudo completarse.'
  if (/^(¿olvidaste tu contraseña\?|solicitar otro enlace)\b/.test(lower)) return 'Abre la recuperación para recibir un enlace y definir una contraseña nueva.'
  if (/^(cerrar sesión)\b/.test(lower)) return 'Finaliza tu sesión en este dispositivo.'
  if (/^(mostrar contraseña|ocultar contraseña)\b/.test(lower)) return lower.startsWith('mostrar') ? 'Muestra el texto de la contraseña para que puedas comprobarlo.' : 'Vuelve a ocultar el texto de la contraseña.'
  if (/^(escanear qr|escanear de nuevo|reintentar cámara)\b/.test(lower)) return 'Activa la cámara para leer el código QR del acceso.'
  if (/^(sacar una foto|tomar foto)\b/.test(lower)) return 'Abre la cámara o captura una imagen para adjuntarla al certificado médico.'
  if (/^(elegir archivo|seleccionar certificado médico)\b/.test(lower)) return 'Busca en tu dispositivo un PDF, JPG o PNG del certificado médico.'
  if (/^(ocultar detalle)\b/.test(lower)) return 'Contrae el contenido de esta notificación.'
  if (/^(ver detalle)\b/.test(lower)) return 'Expande la notificación para leer su contenido completo.'
  if (/^acciones de\b/.test(lower)) return `Abre las opciones disponibles para ${value.slice('Acciones de'.length).trim()}.`
  if (/^editar usuario\b/.test(lower)) return 'Abre la ficha para consultar o modificar los datos de esta cuenta.'
  if (/^editar datos\b/.test(lower)) return 'Habilita la edición de los datos personales de esta cuenta.'
  if (/^crear cuenta\b/.test(lower) && target.closest('.admin-create-account-form')) return 'Crea una cuenta con el rol seleccionado y una contraseña temporal que deberá cambiarse al ingresar.'
  if (/^crear cuenta\b/.test(lower) && target.closest('.admin-users-screen')) return 'Abre el formulario para crear una cuenta y elegir su rol.'
  if (/^crear cuenta\b/.test(lower)) return 'Registra los datos ingresados para crear una cuenta de socio.'
  if (/^editar sede\b/.test(lower)) return 'Abre el formulario para cambiar los datos de esta sede.'
  if (/^restablecer contraseña\b/.test(lower)) return 'Inicia el restablecimiento de la contraseña de esta cuenta.'
  if (/^cambiar contraseña\b/.test(lower)) return 'Abre el formulario para definir una contraseña nueva.'
  if (/^anular pago\b/.test(lower) || /^anular\b/.test(lower)) return 'Anula este pago acreditado; el cambio queda registrado en su historial.'
  if (/^aprobar apto médico\b/.test(lower)) return 'Aprueba el certificado y habilita su uso para validar el acceso del socio.'
  if (/^rechazar apto médico\b/.test(lower)) return 'Rechaza el certificado y guarda la observación para que el socio pueda corregirlo.'
  if (/^confirmar y acreditar\b/.test(lower)) return 'Registra el pago y extiende la vigencia de la cuota por 30 días.'
  if (/^revisar y acreditar\b/.test(lower)) return 'Valida el importe y muestra la fecha de vencimiento antes de registrar el pago.'
  if (/^copiar a la semana siguiente\b/.test(lower)) return 'Copia las clases de esta semana a la siguiente; luego podés ajustar el cronograma.'
  if (/^agregar clase\b/.test(lower)) return 'Abre el formulario de una clase nueva para el día indicado.'
  if (/^nueva clase\b/.test(lower)) return 'Abre el formulario para asignar actividad, horario, sede y entrenador.'
  if (/^nueva sede\b/.test(lower)) return 'Abre el formulario para registrar una sede y sus datos de contacto.'
  if (/^guardar sede\b/.test(lower)) return 'Guarda los datos de la sede nueva o los cambios realizados.'
  if (/^guardar nuevo valor\b/.test(lower)) return 'Actualiza el valor de la cuota desde la fecha indicada.'
  if (/^eliminar\b/.test(lower) && target.closest('.class-dialog-delete')) return 'Elimina esta clase del cronograma semanal.'
  if (/^guardar borrador\b/.test(lower)) return 'Guarda el evento sin publicarlo; podrás publicarlo después.'
  if (/^nuevo evento\b/.test(lower)) return 'Abre el formulario para definir título, fecha, ubicación e información del evento.'
  if (/^publicar una novedad\b/.test(lower)) return 'Abre el formulario para redactar un anuncio y elegir quién lo recibirá.'
  if (/^buscar novedad\b/.test(lower)) return 'Busca publicaciones por su título o contenido.'
  if (/^buscar sedes\b/.test(lower)) return 'Busca sedes por nombre o dirección.'
  if (/^reemplazar certificado\b/.test(lower)) return 'Carga una nueva versión cuando el certificado actual fue rechazado.'
  if (/^código qr del molinete\b/.test(lower)) return 'Ubica el código fijo del acceso dentro del marco de la cámara.'
  if (/^(ver archivo|ver documento|abrir en pestaña)\b/.test(lower)) return 'Abre el certificado médico mediante un enlace temporal seguro.'
  if (/^desactivar\b/.test(lower) && target.closest('.admin-events-actions, .admin-news-actions')) return 'Retira esta novedad de la publicación y deja de mostrarla a su audiencia.'
  if (/^cancelar\b/.test(lower) && target.closest('.admin-events-actions, .admin-events-action-buttons')) return 'Cambia el evento publicado al estado cancelado para informar a los usuarios.'
  if (/^publicar\b/.test(lower) && target.closest('.admin-events-actions, .admin-events-action-buttons')) return 'Publica el evento para que los usuarios puedan consultar sus datos.'
  if (/^publicar\b/.test(lower) && target.closest('.admin-news-actions, .admin-news-form')) return 'Hace visible el anuncio para la audiencia seleccionada.'
  if (/^(activar|desactivar)\b/.test(lower) && target.closest('.admin-branch-toggle, .admin-branch-actions-menu')) return 'Activa o desactiva la sede. Si se desactiva, deja de ofrecerse para nuevas clases y conserva su historial.'
  if (/^editar\b/.test(lower) && target.closest('.admin-events-actions, .admin-events-action-buttons')) return 'Modifica el título, fecha, ubicación o descripción del evento.'
  if (/^editar\b/.test(lower) && target.closest('.admin-news-actions')) return 'Modifica el contenido o la audiencia de esta novedad.'
  if (/^editar\b/.test(lower) && target.closest('.admin-branches')) return 'Modifica los datos de esta sede.'
  if (/^editar .+ a las \d{2}:\d{2}/.test(lower)) return 'Abre el formulario para cambiar la actividad, horario, sede o entrenador de esta clase.'
  if (/^(desactivar cuenta)\b/.test(lower)) return 'Bloquea el acceso de esta cuenta al sitio.'
  if (/^(reactivar cuenta)\b/.test(lower)) return 'Restablece el acceso de esta cuenta al sitio.'
  if (/^(cerrar|cancelar|volver|atrás)\b/.test(lower)) {
    if (target.closest('.admin-events-action-buttons, .admin-events-actions')) return 'Cambia el evento publicado al estado cancelado.'
    if (target.closest('.app-notice-error')) return 'Descarta este aviso de permisos.'
    if (target.closest('.access-qr-controls')) return 'Detiene la cámara sin validar un código.'
    if (target.closest('.medical-camera-dialog')) return 'Cierra la cámara sin adjuntar una foto.'
    return 'Cierra esta ventana sin aplicar los cambios pendientes.'
  }
  if (/^guardar\b/.test(lower)) return 'Guarda los cambios realizados en el formulario.'
  if (/^(confirmar|registrar)\b/.test(lower)) return 'Confirma la operación y actualiza el registro.'
  if (/^crear\b/.test(lower)) return 'Da de alta un nuevo elemento con los datos ingresados.'
  if (/^publicar\b/.test(lower)) return 'Hace visible esta novedad para la audiencia seleccionada.'
  if (/^generar desde la semana anterior\b/.test(lower)) return 'Copia las clases de la semana actual al cronograma de la semana siguiente.'
  if (/^generar\b/.test(lower)) return 'Crea el elemento nuevo con los datos o la plantilla seleccionada.'
  if (/^enviar\b/.test(lower)) return 'Envía la información cargada para su revisión.'
  if (/^(ver|abrir|consultar|detalle)\b/.test(lower)) return 'Consultá el contenido completo y los datos relacionados.'
  if (/^(editar|revisar)\b/.test(lower)) return 'Permite actualizar los datos o revisar la información enviada.'
  if (/^(marcar)\b/.test(lower)) return 'Actualiza el estado de lectura de este aviso.'
  if (target.matches('[role="tab"]')) return 'Filtra el contenido para mostrar solo este grupo.'
  if (target.matches('a[href]')) return `Información relacionada con ${value.toLocaleLowerCase()}.`
  return `Permite ${value.toLocaleLowerCase()} en esta pantalla.`
}

export function SiteTooltips() {
  const [hint, setHint] = useState<Hint | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let current: HTMLElement | null = null
    const clear = () => {
      if (timer) clearTimeout(timer)
      timer = undefined
      current = null
      setHint(null)
    }
    const showAfterDelay = (target: HTMLElement, x: number, y: number) => {
      if (timer) clearTimeout(timer)
      current = target
      timer = setTimeout(() => {
        if (current === target) setHint({ text: hintFor(target), x, y })
      }, 650)
    }
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const target = (event.target as HTMLElement).closest<HTMLElement>(INTERACTIVE)
      if (target && target !== current) showAfterDelay(target, event.clientX, event.clientY)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (current && event.pointerType === 'mouse') setHint((previous) => previous ? { ...previous, x: event.clientX, y: event.clientY } : previous)
    }
    const onFocus = (event: FocusEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(INTERACTIVE)
      if (target) {
        const rect = target.getBoundingClientRect()
        showAfterDelay(target, rect.left + rect.width / 2, rect.bottom)
      }
    }
    const onPointerOut = (event: PointerEvent) => {
      if (current && (!event.relatedTarget || !current.contains(event.relatedTarget as Node))) clear()
    }
    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerout', onPointerOut)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', clear)
    return () => {
      clear()
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', clear)
    }
  }, [])

  if (!hint) return null
  return <div className="site-tooltip" role="tooltip" style={{ left: Math.min(hint.x + 14, window.innerWidth - 290), top: Math.min(hint.y + 14, window.innerHeight - 90) }}>{hint.text}</div>
}
