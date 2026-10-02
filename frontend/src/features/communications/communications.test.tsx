import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, stubApi, testUser } from '../../test/test-utils'
import { EventsScreen } from './EventsScreen'
import { NewsScreen } from './NewsScreen'
import { NotificationsScreen } from './NotificationsScreen'

const event = { id: 'event-1', title: 'Torneo interno', description: 'Actividad para socios.', startsAt: '2030-10-01T15:00:00.000Z', location: 'Sede central', imageUrl: 'https://example.com/event.jpg', status: 'PUBLISHED' as const, displayStatus: 'UPCOMING' as const, createdById: 'admin-id' }
const news = { id: 'news-1', title: 'Feriado', content: 'La sede permanecerá cerrada.', imageUrl: null, audience: 'MEMBERS' as const, status: 'PUBLISHED' as const, publishedAt: '2030-09-01T12:00:00.000Z', createdById: 'admin-id' }
const notification = { id: 'notification-1', userId: 'member-id', title: 'Apto médico aprobado', message: 'Tu apto fue aprobado.', type: 'MEDICAL_CERTIFICATE_REVIEWED' as const, createdAt: '2030-09-01T12:00:00.000Z', readAt: null }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('communications screens', () => {
  it('shows real events and lets an administrator save a draft', async () => {
    const fetchStub = stubApi([
      { path: '/events', handler: () => ({ body: { items: [event], page: 1, limit: 12, total: 1 } }) },
      { method: 'POST', path: '/events', handler: () => ({ status: 201, body: event }) },
    ])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })
    expect(await screen.findByText('Torneo interno')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Nuevo evento/ }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nuevo evento' } })
    fireEvent.change(screen.getByLabelText('Fecha y horario'), { target: { value: '2030-10-01T12:00' } })
    fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'Sede central' } })
    fireEvent.change(screen.getByLabelText('Imagen (URL)'), { target: { value: 'https://example.com/new.jpg' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Descripción' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(fetchStub).toHaveBeenCalledWith(expect.stringContaining('/events'), expect.objectContaining({ method: 'POST' })))
  })

  it('shows the audience and publication state of a news post', async () => {
    stubApi([{ path: '/news-posts', handler: () => ({ body: { items: [news], page: 1, limit: 12, total: 1 } }) }])
    renderWithSession(<NewsScreen/>, { user: testUser('MEMBER') })
    expect(await screen.findByText('Feriado')).toBeInTheDocument()
    expect(screen.getByText('Socios')).toBeInTheDocument()
    expect(screen.getByText('Publicada')).toBeInTheDocument()
  })

  it('marks only an unread notification as read', async () => {
    const fetchStub = stubApi([
      { path: '/notifications', handler: () => ({ body: { items: [notification], page: 1, limit: 20, total: 1 } }) },
      { method: 'PATCH', path: '/notifications/notification-1/read-status', handler: () => ({ status: 204 }) },
    ])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER', { id: 'member-id' }) })
    expect(await screen.findByText('Apto médico aprobado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como leída' }))
    await waitFor(() => expect(fetchStub).toHaveBeenCalledWith(expect.stringContaining('/notifications/notification-1/read-status'), expect.objectContaining({ method: 'PATCH' })))
  })
})
