import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../features/authentication/auth-context'
import type { AuthSession } from '../features/authentication/auth-types'
import { AuthenticatedHomePage } from './AuthenticatedHomePage'

afterEach(cleanup)

describe('AuthenticatedHomePage', () => {
  it('waits for logout and navigates to the sign-in page', async () => {
    const session: AuthSession = {
      accessToken: 'test-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: Date.now() + 3_600_000,
      user: {
        id: 'member-1',
        firstName: 'Ana',
        lastName: 'Prueba',
        email: 'ana@example.com',
        role: 'MEMBER',
        status: 'ACTIVE',
        isPasswordChangeRequired: false,
      },
    }
    const logout = vi.fn().mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <AuthContext.Provider value={{
          session,
          login: vi.fn(),
          logout,
          updateProfilePhoto: vi.fn(),
          changePassword: vi.fn(),
        }}>
          <Routes>
            <Route path="/inicio" element={<AuthenticatedHomePage/>}/>
            <Route path="/iniciar-sesion" element={<p>Página de inicio de sesión</p>}/>
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(logout).toHaveBeenCalledOnce()
    expect(await screen.findByText('Página de inicio de sesión')).toBeInTheDocument()
  })
})
