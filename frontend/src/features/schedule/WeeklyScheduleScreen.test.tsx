import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduleClass, WeeklySchedule } from '../../service/backend-api'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser, type ApiRoute } from '../../test/test-utils'
import { WeeklyScheduleScreen } from './WeeklyScheduleScreen'

const CENTRO = { id: '11111111-1111-4111-8111-111111111111', name: 'Centro' }
const NORTE = { id: '22222222-2222-4222-8222-222222222222', name: 'Norte' }
const TRAINER = { id: 'trainer-id', firstName: 'Ana', lastName: 'Gómez' }
const OTHER_TRAINER = { id: 'other-trainer', firstName: 'Bruno', lastName: 'Díaz' }

function scheduledClass(id: string, day: string, time: string, activity: string, branch = CENTRO, trainer: ScheduleClass['trainer'] = TRAINER): ScheduleClass {
  return { id, activity, day, startTime: time, startsAt: `${day}T${time}:00-03:00`, branch, trainer }
}

const WEEK: WeeklySchedule = {
  id: 'schedule-week-1',
  weekStartsOn: '2026-09-07',
  classes: [
    scheduledClass('c1', '2026-09-07', '08:00', 'Funcional'),
    scheduledClass('c2', '2026-09-07', '18:00', 'Yoga', NORTE, OTHER_TRAINER),
    scheduledClass('c3', '2026-09-09', '10:00', 'Spinning', CENTRO, null),
  ],
}

const page = <T,>(items: T[]) => ({ items, page: 1, limit: 100, total: items.length })

function routes({ current = WEEK, next = { id: null, weekStartsOn: '2026-09-14', classes: [] } as WeeklySchedule, extra = [] as ApiRoute[] } = {}): ApiRoute[] {
  return [
    ...extra,
    {
      path: '/weekly-schedules',
      handler: (url) => {
        const week = url.searchParams.get('weekStartsOn')
        if (week === '2026-09-14') return { body: next }
        if (week === '2026-09-07') return { body: current }
        return { body: { id: null, weekStartsOn: week, classes: [] } }
      },
    },
    { path: '/branches', handler: () => ({ body: page([CENTRO, NORTE]) }) },
    { path: '/trainers', handler: () => ({ body: page([{ ...TRAINER, photoUrl: null, specialty: 'Funcional', description: 'x' }]) }) },
  ]
}

describe('cronograma semanal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-07T06:00:00-03:00'))
    setMobileViewport(false)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('muestra carga y luego el cronograma de solo lectura para el socio', async () => {
    stubApi(routes())
    renderWithSession(<WeeklyScheduleScreen variant="member"/>, { user: testUser('MEMBER') })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando cronograma…')
    expect(await screen.findByText('08:00 · Funcional')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clases de la semana' })).toBeInTheDocument()
    expect(screen.getByText('Semana del 7 al 12 de septiembre')).toBeInTheDocument()
    for (const day of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']) {
      expect(screen.getByRole('heading', { name: day })).toBeInTheDocument()
    }
    expect(screen.queryByRole('heading', { name: 'Domingo' })).not.toBeInTheDocument()
    expect(screen.getByText('Sin entrenador asignado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nueva clase/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Agregar/ })).not.toBeInTheDocument()
  })

  it('muestra error con reintento cuando el backend falla', async () => {
    let fail = true
    stubApi(routes({ extra: [{ path: '/weekly-schedules', handler: () => fail ? { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno', details: null } } : undefined }] }))
    renderWithSession(<WeeklyScheduleScreen variant="member"/>, { user: testUser('MEMBER') })
    expect(await screen.findByText('Ocurrió un error interno')).toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('08:00 · Funcional')).toBeInTheDocument()
  })

  const EMPTY_WEEK: WeeklySchedule = { id: null, weekStartsOn: '2026-09-07', classes: [] }
  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  function expectSixColumns() {
    expect(document.querySelector('.schedule-grid')).toBeInTheDocument()
    expect(document.querySelectorAll('.schedule-day')).toHaveLength(6)
    for (const day of DAY_NAMES) expect(screen.getByRole('heading', { name: day })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Domingo' })).not.toBeInTheDocument()
    expect(screen.getByText('7 sep')).toBeInTheDocument()
    expect(screen.getByText('12 sep')).toBeInTheDocument()
  }

  it('socio: la semana vacía conserva la grilla lunes–sábado y solo suma un mensaje sutil', async () => {
    stubApi(routes({ current: EMPTY_WEEK }))
    renderWithSession(<WeeklyScheduleScreen variant="member"/>, { user: testUser('MEMBER') })
    expect(await screen.findByText('No hay clases programadas para esta semana.')).toBeInTheDocument()
    expectSixColumns()
    expect(document.querySelectorAll('.class-card')).toHaveLength(0)
    expect(document.querySelectorAll('.schedule-card')).toHaveLength(1)
    expect(document.querySelector('.schedule-card')).toContainElement(document.querySelector('.schedule-grid') as HTMLElement)
    expect(screen.getByRole('button', { name: 'Semana siguiente' })).toBeInTheDocument()
    expect(screen.getByLabelText('Filtrar por sede')).toBeInTheDocument()
  })

  it('socio: una semana con algunas clases mantiene los días vacíos y muestra datos reales', async () => {
    stubApi(routes())
    renderWithSession(<WeeklyScheduleScreen variant="member"/>, { user: testUser('MEMBER') })
    await screen.findByText('08:00 · Funcional')
    expectSixColumns()
    const columns = [...document.querySelectorAll('.schedule-day')]
    expect(columns.map((column) => column.querySelectorAll('.class-card').length)).toEqual([2, 0, 1, 0, 0, 0])
    expect(within(columns[0] as HTMLElement).getByText('Centro')).toBeInTheDocument()
    expect(within(columns[0] as HTMLElement).getByText('Ana Gómez')).toBeInTheDocument()
    expect(screen.queryByText('No hay clases programadas para esta semana.')).not.toBeInTheDocument()
    expect(screen.queryByText(/cupo|reserva|lista de espera/i, { selector: '.class-card *' })).not.toBeInTheDocument()
  })

  it('entrenador: sin clases asignadas conserva las seis columnas', async () => {
    stubApi(routes({ current: { ...WEEK, classes: WEEK.classes.filter((item) => item.trainer?.id !== TRAINER.id) } }))
    renderWithSession(<WeeklyScheduleScreen variant="trainer"/>, { user: testUser('TRAINER', { id: TRAINER.id }) })
    expect(await screen.findByText('No tenés clases asignadas esta semana.')).toBeInTheDocument()
    expectSixColumns()
    expect(document.querySelectorAll('.class-card')).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Mis clases' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeInTheDocument()
  })

  it('entrenador: en la grilla solo aparecen sus clases y nunca las de otros', async () => {
    stubApi(routes())
    renderWithSession(<WeeklyScheduleScreen variant="trainer"/>, { user: testUser('TRAINER', { id: TRAINER.id }) })
    await screen.findByText('08:00 · Funcional')
    expectSixColumns()
    expect(document.querySelectorAll('.class-card')).toHaveLength(1)
    expect(screen.queryByText('Bruno Díaz')).not.toBeInTheDocument()
    expect(screen.queryByText('18:00 · Yoga')).not.toBeInTheDocument()
  })

  it('mobile: con la semana vacía siguen las pastillas de días y el día vacío lo explica sin toolbar', async () => {
    setMobileViewport(true)
    stubApi(routes({ current: EMPTY_WEEK }))
    renderWithSession(<WeeklyScheduleScreen variant="member"/>, { user: testUser('MEMBER') })
    expect(await screen.findByRole('tab', { name: 'Lun 7' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    expect(screen.queryByRole('tab', { name: /Dom/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lunes 7 de septiembre' })).toBeInTheDocument()
    expect(screen.getByText('Sin clases programadas.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Mié 9' }))
    expect(screen.getByRole('heading', { name: 'Miércoles 9 de septiembre' })).toBeInTheDocument()
    expect(screen.getByText('Sin clases programadas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Semana siguiente' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Filtrar por sede')).not.toBeInTheDocument()
    expect(document.querySelector('.schedule-grid')).toBeNull()
  })

  it('mobile entrenador: recorre lunes–sábado y el día sin clases muestra su mensaje', async () => {
    setMobileViewport(true)
    stubApi(routes())
    renderWithSession(<WeeklyScheduleScreen variant="trainer"/>, { user: testUser('TRAINER', { id: TRAINER.id }) })
    expect(await screen.findByRole('tab', { name: 'Lun 7' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Funcional')).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    fireEvent.click(screen.getByRole('tab', { name: 'Vie 11' }))
    expect(screen.getByText('No tenés clases asignadas para este día.')).toBeInTheDocument()
    expect(screen.queryByText('Yoga')).not.toBeInTheDocument()
  })

  it('admin (regresión): sigue con seis columnas, controles CRUD y botones Agregar', async () => {
    stubApi(routes({ current: EMPTY_WEEK }))
    renderWithSession(<WeeklyScheduleScreen variant="admin"/>, { user: testUser('ADMIN') })
    await screen.findByText('No hay clases programadas para esta semana.')
    expectSixColumns()
    expect(screen.getByRole('button', { name: 'Copiar a la semana siguiente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nueva clase/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Agregar clase el/ })).toHaveLength(6)
    expect(screen.getByRole('note')).toHaveTextContent('todavía no fue generada')
  })

  it('navega entre semanas consultando el backend con weekStartsOn', async () => {
    const fetchStub = stubApi(routes())
    renderWithSession(<WeeklyScheduleScreen variant="member"/>, { user: testUser('MEMBER') })
    await screen.findByText('08:00 · Funcional')
    fireEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }))
    expect(await screen.findByText('Semana del 14 al 19 de septiembre')).toBeInTheDocument()
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/weekly-schedules').some(({ url }) => url.searchParams.get('weekStartsOn') === '2026-09-14')).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }))
    expect(await screen.findByText('Semana del 7 al 12 de septiembre')).toBeInTheDocument()
  })

  it('filtra por sede', async () => {
    stubApi(routes())
    renderWithSession(<WeeklyScheduleScreen variant="member"/>, { user: testUser('MEMBER') })
    await screen.findByText('18:00 · Yoga')
    await screen.findByRole('option', { name: 'Norte' })
    fireEvent.change(screen.getByLabelText('Filtrar por sede'), { target: { value: NORTE.id } })
    expect(screen.getByText('18:00 · Yoga')).toBeInTheDocument()
    expect(screen.queryByText('08:00 · Funcional')).not.toBeInTheDocument()
  })

  it('muestra al entrenador solo sus clases asignadas', async () => {
    stubApi(routes())
    renderWithSession(<WeeklyScheduleScreen variant="trainer"/>, { user: testUser('TRAINER', { id: TRAINER.id }) })
    expect(await screen.findByText('08:00 · Funcional')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mis clases' })).toBeInTheDocument()
    expect(screen.queryByText('18:00 · Yoga')).not.toBeInTheDocument()
    expect(screen.queryByText('10:00 · Spinning')).not.toBeInTheDocument()
  })

  it('el administrador crea una clase y refresca el cronograma', async () => {
    const fetchStub = stubApi(routes({ extra: [{ method: 'POST', path: '/scheduled-classes', handler: () => ({ status: 201, body: { id: 'new' } }) }] }))
    renderWithSession(<WeeklyScheduleScreen variant="admin"/>, { user: testUser('ADMIN') })
    await screen.findByText('08:00 · Funcional')
    await screen.findByRole('option', { name: 'Norte' })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar clase el Martes 8 sep' }))
    const dialog = screen.getByRole('dialog', { name: 'Nueva clase' })
    fireEvent.change(within(dialog).getByLabelText('Actividad'), { target: { value: ' Pilates ' } })
    fireEvent.change(within(dialog).getByLabelText('Horario'), { target: { value: '09:30' } })
    fireEvent.change(within(dialog).getByLabelText('Sede'), { target: { value: NORTE.id } })
    fireEvent.change(within(dialog).getByLabelText('Entrenador'), { target: { value: TRAINER.id } })
    const before = requestsTo(fetchStub, 'GET', '/weekly-schedules').length
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear clase' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requestsTo(fetchStub, 'POST', '/scheduled-classes')[0].body).toEqual({
      weekStartsOn: '2026-09-07',
      activity: 'Pilates',
      startsAt: '2026-09-08T09:30:00-03:00',
      branchId: NORTE.id,
      trainerId: TRAINER.id,
    })
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/weekly-schedules').length).toBeGreaterThan(before))
  })

  it('valida localmente que la clase sea futura', async () => {
    const fetchStub = stubApi(routes())
    renderWithSession(<WeeklyScheduleScreen variant="admin"/>, { user: testUser('ADMIN') })
    await screen.findByText('08:00 · Funcional')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar clase el Lunes 7 sep' }))
    const dialog = screen.getByRole('dialog', { name: 'Nueva clase' })
    fireEvent.change(within(dialog).getByLabelText('Actividad'), { target: { value: 'Temprano' } })
    fireEvent.change(within(dialog).getByLabelText('Horario'), { target: { value: '05:00' } })
    await within(dialog).findByRole('option', { name: 'Centro' })
    fireEvent.change(within(dialog).getByLabelText('Sede'), { target: { value: CENTRO.id } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear clase' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('La clase debe comenzar en un horario futuro.')
    expect(requestsTo(fetchStub, 'POST', '/scheduled-classes')).toHaveLength(0)
  })

  it('el administrador edita solo los campos modificados', async () => {
    const fetchStub = stubApi(routes({ extra: [{ method: 'PATCH', path: /^\/scheduled-classes\/c1$/, handler: () => ({ body: { id: 'c1' } }) }] }))
    renderWithSession(<WeeklyScheduleScreen variant="admin"/>, { user: testUser('ADMIN') })
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Funcional a las 08:00' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar clase' })
    expect(within(dialog).getByLabelText('Actividad')).toHaveValue('Funcional')
    fireEvent.change(within(dialog).getByLabelText('Actividad'), { target: { value: 'Funcional intensivo' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requestsTo(fetchStub, 'PATCH', '/scheduled-classes/c1')[0].body).toEqual({ activity: 'Funcional intensivo' })
  })

  it('el administrador elimina una clase con confirmación', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    const fetchStub = stubApi(routes({ extra: [{ method: 'DELETE', path: '/scheduled-classes/c3', handler: () => ({ status: 204 }) }] }))
    renderWithSession(<WeeklyScheduleScreen variant="admin"/>, { user: testUser('ADMIN') })
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Spinning a las 10:00' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requestsTo(fetchStub, 'DELETE', '/scheduled-classes/c3')).toHaveLength(1)
  })

  it('copia la semana a la siguiente cuando todavía no fue generada', async () => {
    let nextGenerated = false
    const fetchStub = stubApi(routes({
      extra: [
        { method: 'POST', path: '/weekly-schedules/schedule-week-1/copies', handler: () => { nextGenerated = true; return { status: 201, body: { id: 'next', weekStartsOn: '2026-09-14', classes: [] } } } },
        { path: '/weekly-schedules', handler: (url) => url.searchParams.get('weekStartsOn') === '2026-09-14' && nextGenerated ? { body: { id: 'next', weekStartsOn: '2026-09-14', classes: [] } } : undefined },
      ],
    }))
    renderWithSession(<WeeklyScheduleScreen variant="admin"/>, { user: testUser('ADMIN') })
    expect(await screen.findByRole('note')).toHaveTextContent('La semana del 14 al 19 de septiembre todavía no fue generada.')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar a la semana siguiente' }))
    expect(await screen.findByText('Se generó la semana del 14 al 19 de septiembre.')).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'POST', '/weekly-schedules/schedule-week-1/copies')[0].body).toEqual({ weekStartsOn: '2026-09-14' })
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Copiar a la semana siguiente' })).toBeDisabled()
  })

  it('mantiene la grilla de seis columnas aunque el backend devuelva una clase en domingo', async () => {
    stubApi(routes({ current: { ...WEEK, classes: [...WEEK.classes, scheduledClass('sun', '2026-09-13', '09:00', 'Domingo funcional')] } }))
    renderWithSession(<WeeklyScheduleScreen variant="member"/>, { user: testUser('MEMBER') })
    await screen.findByText('08:00 · Funcional')
    expect(document.querySelectorAll('.schedule-day')).toHaveLength(6)
    expect(screen.queryByRole('heading', { name: 'Domingo' })).not.toBeInTheDocument()
  })

  it('el formulario de clase limita el día a lunes–sábado', async () => {
    stubApi(routes())
    renderWithSession(<WeeklyScheduleScreen variant="admin"/>, { user: testUser('ADMIN') })
    await screen.findByText('08:00 · Funcional')
    fireEvent.click(screen.getByRole('button', { name: /Nueva clase/ }))
    const day = within(screen.getByRole('dialog', { name: 'Nueva clase' })).getByLabelText('Día')
    expect(day).toHaveAttribute('min', '2026-09-07')
    expect(day).toHaveAttribute('max', '2026-09-12')
  })

  it('en mobile el administrador sigue la composición MA10 sin encabezado ni toolbar', async () => {
    setMobileViewport(true)
    stubApi(routes())
    renderWithSession(<WeeklyScheduleScreen variant="admin"/>, { user: testUser('ADMIN') })
    expect(await screen.findByRole('tab', { name: 'Lun 7' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cronograma de clases' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Semana siguiente' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Filtrar por sede')).not.toBeInTheDocument()
    const order = [...document.querySelector('.schedule-screen')!.querySelectorAll('.day-pills, .schedule-notice, .schedule-copy, .mobile-day-heading, .mobile-class-card, .button-block')]
      .map((element) => element.className.split(' ').find((name) => ['day-pills', 'schedule-notice', 'schedule-copy', 'mobile-day-heading', 'mobile-class-card', 'button-block'].includes(name)))
    expect([...new Set(order)]).toEqual(['day-pills', 'schedule-notice', 'schedule-copy', 'mobile-day-heading', 'mobile-class-card', 'button-block'])
    expect(screen.getByRole('button', { name: 'Nueva clase' })).toHaveClass('button-secondary')
    expect(document.querySelectorAll('.day-pill')).toHaveLength(6)
  })

  it('en mobile muestra pastillas de días y la lista del día elegido', async () => {
    setMobileViewport(true)
    stubApi(routes())
    renderWithSession(<WeeklyScheduleScreen variant="member"/>, { user: testUser('MEMBER') })
    expect(await screen.findByRole('tab', { name: 'Lun 7' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Lunes 7 de septiembre' })).toBeInTheDocument()
    expect(screen.getByText('Funcional')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Mié 9' }))
    expect(screen.getByText('Spinning')).toBeInTheDocument()
    expect(screen.queryByText('Funcional')).not.toBeInTheDocument()
  })
})
