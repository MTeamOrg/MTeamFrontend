import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../authentication/AuthProvider'
import { authStorage } from '../authentication/auth-storage'
import { requestsTo, stubApi, testUser } from '../../test/test-utils'
import { RoleWorkspace } from './RoleWorkspace'
import type { UserRole } from '../authentication/auth-types'

function renderWorkspace(role: UserRole, section = 'perfil') {
  const base = role === 'MEMBER' ? '/socio' : '/entrenador'
  return render(<MemoryRouter initialEntries={[`${base}/${section}`]}><AuthProvider><Routes>
    <Route path={`${base}/*`} element={<RoleWorkspace role={role}/>}/>
    <Route path="/iniciar-sesion" element={<p>Pantalla de ingreso</p>}/>
  </Routes></AuthProvider></MemoryRouter>)
}

afterEach(() => { cleanup(); authStorage.clear(); vi.unstubAllGlobals() })

describe.each(['MEMBER', 'TRAINER'] as const)('profile navigation for %s', (role) => {
  function setup(photoUrl: string | null = null, isPersistent = false) {
    const user = testUser(role)
    authStorage.write({ user, accessToken: 'profile-test-token', tokenType: 'Bearer', expiresIn: 3600 }, isPersistent)
    let profile = { ...user, photoUrl, documentNumber: '30111222', birthDate: '1990-01-02', phone: '1100000000', memberProfile: null, trainerProfile: null }
    const fetchStub = stubApi([
      { path: '/auth/me', handler: () => ({ body: profile }) },
      { path: '/users/me', handler: () => ({ body: profile }) },
      { method: 'PUT', path: '/users/me/photo', handler: () => {
        profile = { ...profile, photoUrl: 'https://example.com/new-photo.jpg' }
        return { body: profile }
      } },
      { path: '/members/me/membership', handler: () => ({ body: { currentPrice: null, status: 'EXPIRED', daysRemaining: 0 } }) },
      { path: '/members/me/payments', handler: () => ({ body: { items: [], total: 0, page: 1, limit: 20 } }) },
      { path: '/members/me/medical-certificates', handler: () => ({ body: { items: [], total: 0, page: 1, limit: 20, initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false } } }) },
      { path: '/trainers', handler: () => ({ body: { items: [], total: 0, page: 1, limit: 100 } }) },
      { method: 'POST', path: '/auth/logout', handler: () => ({ status: 204 }) },
    ])
    return { user, fetchStub }
  }

  it.each([false, true])('loads the photo, updates navigation after upload and preserves it after reload (persistent=%s)', async (isPersistent) => {
    const { user, fetchStub } = setup('https://example.com/current-photo.jpg', isPersistent)
    const view = renderWorkspace(role)
    const sidebar = document.querySelector('.app-sidebar-user') as HTMLElement
    const profileCard = await screen.findByRole('region', { name: 'Resumen del perfil' })
    const photoName = `Foto de perfil de ${user.firstName} ${user.lastName}`
    await waitFor(() => expect(within(sidebar).getByRole('img', { name: photoName })).toHaveAttribute('src', 'https://example.com/current-photo.jpg'))
    expect(within(profileCard).getByRole('img', { name: photoName })).toHaveAttribute('src', 'https://example.com/current-photo.jpg')
    fireEvent.change(await screen.findByLabelText(/Cambiar fotografía/), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } })
    await waitFor(() => expect(within(sidebar).getByRole('img')).toHaveAttribute('src', 'https://example.com/new-photo.jpg'))
    expect(within(profileCard).getByRole('img')).toHaveAttribute('src', 'https://example.com/new-photo.jpg')
    expect(authStorage.read()?.user.photoUrl).toBe('https://example.com/new-photo.jpg')
    expect(fetchStub.mock.calls.filter(([input, init]) => String(input).endsWith('/users/me/photo') && init?.method === 'PUT')).toHaveLength(1)
    const upload = fetchStub.mock.calls.find(([, init]) => init?.method === 'PUT')?.[1]?.body
    expect(upload).toBeInstanceOf(FormData)
    expect((upload as FormData).get('file')).toBeInstanceOf(File)
    view.unmount()
    renderWorkspace(role)
    await waitFor(() => expect(within(document.querySelector('.app-sidebar-user') as HTMLElement).getByRole('img')).toHaveAttribute('src', 'https://example.com/new-photo.jpg'))
    expect(within(await screen.findByRole('region', { name: 'Resumen del perfil' })).getByRole('img')).toHaveAttribute('src', 'https://example.com/new-photo.jpg')
  })

  it('falls back to initials in the profile and navigation when the image fails', async () => {
    setup('https://example.com/unavailable.jpg')
    renderWorkspace(role)
    const profileCard = await screen.findByRole('region', { name: 'Resumen del perfil' })
    const sidebar = document.querySelector('.app-sidebar-user') as HTMLElement
    await waitFor(() => expect(within(sidebar).getByRole('img')).toHaveAttribute('src', 'https://example.com/unavailable.jpg'))
    for (const container of [profileCard, sidebar]) {
      fireEvent.error(within(container).getByRole('img'))
      expect(within(container).getByRole('img')).toHaveAccessibleName(/Iniciales/)
    }
  })

  it('keeps initials and displays the API error if the upload fails', async () => {
    const { fetchStub } = setup()
    const originalFetch = fetchStub.getMockImplementation()!
    fetchStub.mockImplementation((input, init) => init?.method === 'PUT'
      ? Promise.resolve(new Response(JSON.stringify({ message: 'No se pudo guardar la foto' }), { status: 503 }))
      : originalFetch(input, init))
    renderWorkspace(role)
    fireEvent.change(await screen.findByLabelText(/Cambiar fotografía/), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la foto')
    expect(within(document.querySelector('.app-sidebar-user') as HTMLElement).getByRole('img')).toHaveAccessibleName(/Iniciales/)
    expect(within(screen.getByRole('region', { name: 'Resumen del perfil' })).getByRole('img')).toHaveAccessibleName(/Iniciales/)
    expect(authStorage.read()?.user.photoUrl).toBeUndefined()
  })

  it.each([204, 503])('logs out from the last profile control and clears both storage locations (HTTP %s)', async (status) => {
    const { fetchStub } = setup(null, true)
    const originalFetch = fetchStub.getMockImplementation()!
    fetchStub.mockImplementation((input, init) => String(input).endsWith('/auth/logout')
      ? Promise.resolve(new Response(status === 204 ? null : JSON.stringify({ message: 'Sin conexión' }), { status }))
      : originalFetch(input, init))
    renderWorkspace(role)
    await screen.findByRole('region', { name: 'Resumen del perfil' })
    const profilePage = document.querySelector('.profile-page') as HTMLElement
    const logoutButton = profilePage.lastElementChild!
    expect(logoutButton).toHaveClass('profile-mobile-logout')
    expect(within(profilePage).getAllByRole('button').at(-1)).toBe(logoutButton)
    expect(document.querySelector('.mobile-user-bar')).toBeNull()
    expect(within(document.querySelector('.app-topbar') as HTMLElement).queryByRole('button')).not.toBeInTheDocument()
    fireEvent.click(within(profilePage).getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
    expect(localStorage.getItem('mteam.auth')).toBeNull()
    expect(sessionStorage.getItem('mteam.auth')).toBeNull()
    expect(requestsTo(fetchStub, 'POST', '/auth/logout')).toHaveLength(1)
  })
})
