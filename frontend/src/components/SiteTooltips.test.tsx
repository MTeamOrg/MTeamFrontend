import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTooltipText, SiteTooltips } from './SiteTooltips'

function element({
  label,
  tag = 'button',
  href,
  title,
  className,
  context,
  role,
  disabled = false,
}: {
  label?: string
  tag?: 'button' | 'a' | 'select' | 'input' | 'summary' | 'div'
  href?: string
  title?: string
  className?: string
  context?: string
  role?: string
  disabled?: boolean
}) {
  const parent = document.createElement(context ? 'section' : 'div')
  if (context) parent.className = context
  const node = document.createElement(tag)
  if (label) node.textContent = label
  if (href) node.setAttribute('href', href)
  if (title) node.setAttribute('title', title)
  if (className) node.className = className
  if (role) node.setAttribute('role', role)
  if (disabled && 'disabled' in node) (node as HTMLButtonElement).disabled = true
  parent.append(node)
  return node as HTMLElement
}

describe('getTooltipText', () => {
  it('uses a meaningful title when it differs from the control label, and preserves disabled reasons', () => {
    expect(getTooltipText(element({ label: 'Acción', title: 'Explicación útil' }))).toBe('Explicación útil')
    expect(getTooltipText(element({ label: 'Acción', title: 'No disponible', disabled: true }))).toBe('No disponible')
    expect(getTooltipText(element({ label: 'Editar sede Norte', title: 'Editar sede Norte' }))).toBe('Abre el formulario para cambiar los datos de esta sede.')
  })

  it('describes public and workspace destinations, query strings, and nested records', () => {
    const cases: Array<[string, string, string]> = [
      ['/crear-cuenta', 'Crear cuenta', 'Formulario para solicitar una cuenta de socio.'],
      ['/admin/pagos?role=MEMBER', 'Pagos', 'Registro y consulta de pagos, vencimientos y valor de la cuota.'],
      ['/admin/usuarios/abc', 'Editar usuario Ana', 'Ficha de la cuenta con datos, estado, pagos y accesos registrados.'],
      ['/admin/aptos/abc', 'Revisar Ana', 'Certificado médico y herramientas para registrar la revisión.'],
      ['/sedes/abc', 'Sede Norte', 'Dirección, horarios, contacto y clases programadas de esta sede.'],
      ['/entrenador/clases', 'Mis clases', 'Tus clases asignadas y sus horarios semanales.'],
      ['/otra-ruta', 'Clases', 'Horarios semanales, actividades y sedes.'],
      ['/otra-ruta', 'Enlace externo', 'Información relacionada con enlace externo.'],
    ]
    for (const [href, label, expected] of cases) expect(getTooltipText(element({ tag: 'a', href, label }))).toBe(expected)
  })

  it('describes navigation aids, filters, search, paging, retry, recovery, and password visibility', () => {
    const cases: Array<[string, string]> = [
      ['Mostrar filtros', 'Abre los criterios disponibles para acotar la lista.'],
      ['Filtrar por sede', 'Limita la lista según sede.'],
      ['Filtrar eventos', 'Abre los criterios para acotar los resultados de la lista.'],
      ['Buscar socio', 'Escribí un dato y activá esta opción para encontrar coincidencias.'],
      ['Semana anterior', 'Cambia el cronograma a la semana indicada.'],
      ['Semana siguiente', 'Cambia el cronograma a la semana indicada.'],
      ['Página siguiente', 'Cambia la página de resultados que estás viendo.'],
      ['Anterior', 'Cambia la página de resultados que estás viendo.'],
      ['Reintentar', 'Volvé a intentar la acción que no pudo completarse.'],
      ['¿Olvidaste tu contraseña?', 'Abre la recuperación para recibir un enlace y definir una contraseña nueva.'],
      ['Solicitar otro enlace', 'Abre la recuperación para recibir un enlace y definir una contraseña nueva.'],
      ['Escanear QR', 'Activa la cámara para leer el código QR del acceso.'],
      ['Reintentar cámara', 'Activa la cámara para leer el código QR del acceso.'],
      ['Escanear de nuevo', 'Activa la cámara para leer el código QR del acceso.'],
      ['Sacar una foto', 'Abre la cámara o captura una imagen para adjuntarla al certificado médico.'],
      ['Tomar foto', 'Abre la cámara o captura una imagen para adjuntarla al certificado médico.'],
      ['Elegir archivo', 'Busca en tu dispositivo un PDF, JPG o PNG del certificado médico.'],
      ['Seleccionar certificado médico', 'Busca en tu dispositivo un PDF, JPG o PNG del certificado médico.'],
      ['Ocultar detalle', 'Contrae el contenido de esta notificación.'],
      ['Ver detalle', 'Expande la notificación para leer su contenido completo.'],
      ['Acciones de Mi evento', 'Abre las opciones disponibles para Mi evento.'],
      ['Cerrar sesión', 'Finaliza tu sesión en este dispositivo.'],
      ['Mostrar contraseña', 'Muestra el texto de la contraseña para que puedas comprobarlo.'],
      ['Ocultar contraseña', 'Vuelve a ocultar el texto de la contraseña.'],
    ]
    for (const [label, expected] of cases) expect(getTooltipText(element({ label }))).toBe(expected)
  })

  it('describes account, payment, certificate, schedule, event, news, branch, and file actions', () => {
    const cases: Array<[string, string, string?, string?]> = [
      ['Crear cuenta', 'Crea una cuenta con el rol seleccionado y una contraseña temporal que deberá cambiarse al ingresar.', undefined, 'admin-create-account-form'],
      ['Crear cuenta', 'Abre el formulario para crear una cuenta y elegir su rol.', undefined, 'admin-users-screen'],
      ['Crear cuenta', 'Registra los datos ingresados para crear una cuenta de socio.'],
      ['Editar usuario Ana', 'Abre la ficha para consultar o modificar los datos de esta cuenta.'],
      ['Editar datos', 'Habilita la edición de los datos personales de esta cuenta.'],
      ['Editar sede Norte', 'Abre el formulario para cambiar los datos de esta sede.'],
      ['Restablecer contraseña', 'Inicia el restablecimiento de la contraseña de esta cuenta.'],
      ['Cambiar contraseña', 'Abre el formulario para definir una contraseña nueva.'],
      ['Anular pago', 'Anula este pago acreditado; el cambio queda registrado en su historial.'],
      ['Aprobar apto médico', 'Aprueba el certificado y habilita su uso para validar el acceso del socio.'],
      ['Rechazar apto médico', 'Rechaza el certificado y guarda la observación para que el socio pueda corregirlo.'],
      ['Confirmar y acreditar', 'Registra el pago y extiende la vigencia de la cuota por 30 días.'],
      ['Revisar y acreditar', 'Valida el importe y muestra la fecha de vencimiento antes de registrar el pago.'],
      ['Copiar a la semana siguiente', 'Copia las clases de esta semana a la siguiente; luego podés ajustar el cronograma.'],
      ['Agregar clase el lunes', 'Abre el formulario de una clase nueva para el día indicado.'],
      ['Nueva clase', 'Abre el formulario para asignar actividad, horario, sede y entrenador.'],
      ['Nueva sede', 'Abre el formulario para registrar una sede y sus datos de contacto.'],
      ['Guardar sede', 'Guarda los datos de la sede nueva o los cambios realizados.'],
      ['Guardar nuevo valor', 'Actualiza el valor de la cuota desde la fecha indicada.'],
      ['Eliminar', 'Elimina esta clase del cronograma semanal.', undefined, 'class-dialog-delete'],
      ['Guardar borrador', 'Guarda el evento sin publicarlo; podrás publicarlo después.'],
      ['Nuevo evento', 'Abre el formulario para definir título, fecha, ubicación e información del evento.'],
      ['Publicar una novedad', 'Abre el formulario para redactar un anuncio y elegir quién lo recibirá.'],
      ['Buscar novedad', 'Busca publicaciones por su título o contenido.'],
      ['Buscar sedes', 'Busca sedes por nombre o dirección.'],
      ['Reemplazar certificado', 'Carga una nueva versión cuando el certificado actual fue rechazado.'],
      ['Código QR del molinete', 'Ubica el código fijo del acceso dentro del marco de la cámara.'],
      ['Ver documento', 'Abre el certificado médico mediante un enlace temporal seguro.'],
    ]
    for (const [label, expected, context, className] of cases) {
      expect(getTooltipText(element({ label, context, className }))).toBe(expected)
    }
  })

  it('uses surrounding context to explain event, news, branch, and class actions', () => {
    const cases: Array<[string, string, string?]> = [
      ['Desactivar', 'Retira esta novedad de la publicación y deja de mostrarla a su audiencia.', 'admin-news-actions'],
      ['Cancelar', 'Cambia el evento publicado al estado cancelado para informar a los usuarios.', 'admin-events-action-buttons'],
      ['Publicar', 'Publica el evento para que los usuarios puedan consultar sus datos.', 'admin-events-actions'],
      ['Publicar', 'Hace visible el anuncio para la audiencia seleccionada.', 'admin-news-form'],
      ['Desactivar', 'Activa o desactiva la sede. Si se desactiva, deja de ofrecerse para nuevas clases y conserva su historial.', 'admin-branch-actions-menu'],
      ['Editar', 'Modifica el título, fecha, ubicación o descripción del evento.', 'admin-events-actions'],
      ['Editar', 'Modifica el contenido o la audiencia de esta novedad.', 'admin-news-actions'],
      ['Editar', 'Modifica los datos de esta sede.', 'admin-branches'],
      ['Editar Pilates a las 09:00', 'Abre el formulario para cambiar la actividad, horario, sede o entrenador de esta clase.'],
      ['Desactivar cuenta', 'Bloquea el acceso de esta cuenta al sitio.'],
      ['Reactivar cuenta', 'Restablece el acceso de esta cuenta al sitio.'],
      ['Cancelar', 'Cambia el evento publicado al estado cancelado para informar a los usuarios.', 'admin-events-actions'],
      ['Cerrar', 'Descarta este aviso de permisos.', 'app-notice-error'],
      ['Cancelar escaneo', 'Detiene la cámara sin validar un código.', 'access-qr-controls'],
      ['Cancelar', 'Cierra la cámara sin adjuntar una foto.', 'medical-camera-dialog'],
      ['Cancelar', 'Cierra esta ventana sin aplicar los cambios pendientes.'],
    ]
    for (const [label, expected, context] of cases) expect(getTooltipText(element({ label, context }))).toBe(expected)
  })

  it('handles tabs, unlabeled controls, form actions, ordinary actions, and directions', () => {
    expect(getTooltipText(element({ label: 'No leídas', role: 'tab' }))).toBe('Filtra el contenido para mostrar solo este grupo.')
    expect(getTooltipText(element({ tag: 'button' }))).toBe('Seleccioná este control para ver su función.')
    expect(getTooltipText(element({ label: 'Guardar cambios' }))).toBe('Guarda los cambios realizados en el formulario.')
    expect(getTooltipText(element({ label: 'Registrar pago' }))).toBe('Confirma la operación y actualiza el registro.')
    expect(getTooltipText(element({ label: 'Crear entrenador' }))).toBe('Da de alta un nuevo elemento con los datos ingresados.')
    expect(getTooltipText(element({ label: 'Publicar anuncio' }))).toBe('Hace visible esta novedad para la audiencia seleccionada.')
    expect(getTooltipText(element({ label: 'Generar desde la semana anterior' }))).toBe('Copia las clases de la semana actual al cronograma de la semana siguiente.')
    expect(getTooltipText(element({ label: 'Generar reporte' }))).toBe('Crea el elemento nuevo con los datos o la plantilla seleccionada.')
    expect(getTooltipText(element({ label: 'Enviar certificado' }))).toBe('Envía la información cargada para su revisión.')
    expect(getTooltipText(element({ label: 'Ver perfil' }))).toBe('Consultá el contenido completo y los datos relacionados.')
    expect(getTooltipText(element({ label: 'Editar formulario' }))).toBe('Permite actualizar los datos o revisar la información enviada.')
    expect(getTooltipText(element({ label: 'Marcar como leída' }))).toBe('Actualiza el estado de lectura de este aviso.')
    expect(getTooltipText(element({ label: 'Sedes', tag: 'a', href: '/otro' }))).toBe('Direcciones, horarios y datos de contacto.')
    expect(getTooltipText(element({ label: 'Cómo llegar', className: 'directions' }))).toBe('Abre Google Maps con la ubicación de esta sede y opciones para llegar.')
    expect(getTooltipText(element({ label: 'Otra acción' }))).toBe('Permite otra acción en esta pantalla.')
    expect(getTooltipText(element({ label: 'Otra acción', tag: 'a', href: '/otro' }))).toBe('Información relacionada con otra acción.')
    expect(getTooltipText(element({ label: 'Inicio', tag: 'a', href: '/admin/' }))).toBe('Indicadores de actividad y accesos a herramientas administrativas.')
    expect(getTooltipText(element({ label: 'Link', tag: 'a', href: '/desconocido/usuarios' }))).toBe('Cuentas, datos y estado de los socios.')
    const input = document.createElement('input')
    const label = document.createElement('label')
    label.textContent = 'Buscar por sede'
    label.append(input)
    expect(getTooltipText(input)).toBe('Escribí un dato y activá esta opción para encontrar coincidencias.')
  })

  it('handles missing labels and href attributes defensively', () => {
    const input = document.createElement('input')
    Object.defineProperty(input, 'labels', { configurable: true, value: null })
    expect(getTooltipText(input)).toBe('Seleccioná este control para ver su función.')

    const emptyLabel = document.createElement('label')
    const emptyInput = document.createElement('input')
    emptyLabel.append(emptyInput)
    expect(getTooltipText(emptyInput)).toBe('Seleccioná este control para ver su función.')

    const anchor = element({ label: 'Enlace sin destino', tag: 'a', href: '/test' })
    vi.spyOn(anchor, 'getAttribute').mockImplementation((name) => name === 'href' ? null : HTMLElement.prototype.getAttribute.call(anchor, name))
    expect(getTooltipText(anchor)).toBe('Información relacionada con enlace sin destino.')
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SiteTooltips', () => {
  it('shows a delayed tooltip on mouse hover, follows the pointer, and hides on leave', () => {
    vi.useFakeTimers()
    render(<><SiteTooltips/><button>Guardar</button></>)
    const button = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.pointerOver(button, { pointerType: 'mouse', clientX: 20, clientY: 30 })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(650))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Guarda los cambios realizados en el formulario.')
    fireEvent.pointerMove(button, { pointerType: 'mouse', clientX: 40, clientY: 50 })
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '54px', top: '64px' })
    fireEvent.pointerOut(button, { pointerType: 'mouse', relatedTarget: document.body })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('ignores non-interactive targets, same-control hover, and movement before the tooltip appears', () => {
    vi.useFakeTimers()
    render(<><SiteTooltips/><div>Decoration</div><button><span>Guardar</span></button></>)
    const decoration = screen.getByText('Decoration')
    const button = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.pointerOver(decoration, { pointerType: 'mouse', clientX: 1, clientY: 1 })
    fireEvent.pointerMove(decoration, { pointerType: 'mouse', clientX: 2, clientY: 2 })
    fireEvent.focusIn(decoration)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.pointerOver(button, { pointerType: 'mouse', clientX: 3, clientY: 4 })
    fireEvent.pointerMove(button, { pointerType: 'mouse', clientX: 4, clientY: 5 })
    fireEvent.pointerOver(button.querySelector('span')!, { pointerType: 'mouse', clientX: 5, clientY: 6 })
    act(() => vi.advanceTimersByTime(650))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('keeps the tooltip while pointer remains inside the control and hides it on pointer exit', () => {
    vi.useFakeTimers()
    render(<><SiteTooltips/><button><span>Reintentar</span></button></>)
    const button = screen.getByRole('button', { name: 'Reintentar' })
    const child = button.querySelector('span')!
    fireEvent.pointerOver(button, { pointerType: 'mouse', clientX: 10, clientY: 10 })
    act(() => vi.advanceTimersByTime(650))
    fireEvent.pointerOut(child, { pointerType: 'mouse', relatedTarget: button })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.pointerOut(button, { pointerType: 'mouse' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('replaces the pending target when keyboard focus moves to another control', () => {
    vi.useFakeTimers()
    render(<><SiteTooltips/><button>Guardar</button><button>Reintentar</button></>)
    const save = screen.getByRole('button', { name: 'Guardar' })
    const retry = screen.getByRole('button', { name: 'Reintentar' })
    fireEvent.focusIn(save)
    fireEvent.focusIn(retry)
    act(() => vi.advanceTimersByTime(650))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Volvé a intentar la acción que no pudo completarse.')
  })

  it('does not render a delayed tooltip if its target is cleared before the timer fires', () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => undefined)
    render(<><SiteTooltips/><button>Guardar</button></>)
    const button = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.pointerOver(button, { pointerType: 'mouse', clientX: 10, clientY: 10 })
    fireEvent.pointerOut(button, { pointerType: 'mouse' })
    act(() => vi.advanceTimersByTime(650))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    clearTimeoutSpy.mockRestore()
  })

  it('shows the tooltip after keyboard focus and cancels a pending hover when leaving', () => {
    vi.useFakeTimers()
    render(<><SiteTooltips/><button aria-label="Semana anterior">Anterior</button><button>Reintentar</button></>)
    const previous = screen.getByRole('button', { name: 'Semana anterior' })
    fireEvent.focusIn(previous)
    act(() => vi.advanceTimersByTime(650))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Cambia el cronograma a la semana indicada.')
    fireEvent.focusOut(previous)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    const retry = screen.getByRole('button', { name: 'Reintentar' })
    fireEvent.pointerOver(retry, { pointerType: 'mouse', clientX: 10, clientY: 10 })
    fireEvent.pointerOut(retry, { relatedTarget: document.body })
    act(() => vi.advanceTimersByTime(650))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('ignores touch pointer hover and clears timers and listeners on unmount', () => {
    vi.useFakeTimers()
    const { unmount } = render(<><SiteTooltips/><button>Entrar</button></>)
    const button = screen.getByRole('button', { name: 'Entrar' })
    fireEvent.pointerOver(button, { pointerType: 'touch', clientX: 5, clientY: 5 })
    act(() => vi.advanceTimersByTime(700))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    fireEvent.pointerOver(button, { pointerType: 'mouse', clientX: 5, clientY: 5 })
    unmount()
    act(() => vi.advanceTimersByTime(700))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
