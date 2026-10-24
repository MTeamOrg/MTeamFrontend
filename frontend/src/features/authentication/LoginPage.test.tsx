import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from './auth-context'
import type { AuthSession } from './auth-types'
import { LoginPage } from './LoginPage'

afterEach(cleanup)

describe('LoginPage', () => {
  it('waits for navigation to the home page after a successful login', async () => {
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
    const login = vi.fn().mockResolvedValue(session)

    render(
      <MemoryRouter initialEntries={['/iniciar-sesion']}>
        <AuthContext.Provider value={{
          session: null,
          login,
          logout: vi.fn(),
          updateProfilePhoto: vi.fn(),
          changePassword: vi.fn(),
        }}>
          <Routes>
            <Route path="/iniciar-sesion" element={<LoginPage/>}/>
            <Route path="/socio" element={<p>Inicio de socio</p>}/>
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('nombre@correo.com'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Ingresá tu contraseña'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await waitFor(() => expect(login).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'password' }, false))
    expect(await screen.findByText('Inicio de socio')).toBeInTheDocument()
  })
})
