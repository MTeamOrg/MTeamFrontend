import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from './auth-context'
import type { AuthSession } from './auth-types'
import { LoginPage } from './LoginPage'

afterEach(cleanup)

describe('LoginPage', () => {
  function buildSession(): AuthSession {
    return {
      accessToken: 'test-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: Date.now() + 3_600_000,
      user: {
        id: 'member-1',
        firstName: 'Test',
        lastName: 'Member',
        email: 'member@example.com',
        role: 'MEMBER',
        status: 'ACTIVE',
        isPasswordChangeRequired: false,
      },
    }
  }

  function renderLogin(login: AuthContextValue['login']) {
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

    fireEvent.change(screen.getByPlaceholderText('nombre@correo.com'), { target: { value: 'member@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(/tu contrase/), { target: { value: 'password' } })
  }

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

  it('sends only one request when Enter and repeated clicks occur while login is pending', async () => {
    let resolveLogin: (session: AuthSession) => void = () => undefined
    const loginPromise = new Promise<AuthSession>((resolve) => { resolveLogin = resolve })
    const login = vi.fn().mockReturnValue(loginPromise)
    renderLogin(login as AuthContextValue['login'])

    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: /Iniciar sesi/ })
    await user.click(screen.getByPlaceholderText(/tu contrase/))
    await user.keyboard('{Enter}')
    await user.keyboard('{Enter}')
    await user.keyboard('{Enter}')
    await user.click(button)
    await user.click(button)

    expect(login).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await waitFor(() => expect(screen.getByText('Entrando…')).toBeInTheDocument())

    resolveLogin(buildSession())
    expect(await screen.findByText('Inicio de socio')).toBeInTheDocument()
  })

  it('libera el bloqueo después de un error y permite volver a intentar', async () => {
    const login = vi.fn()
      .mockRejectedValueOnce(new Error('login failed'))
      .mockResolvedValueOnce(buildSession())
    renderLogin(login as AuthContextValue['login'])

    const button = screen.getByRole('button', { name: /Iniciar sesi/ })
    const form = button.closest('form') as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(button).not.toBeDisabled()

    fireEvent.submit(form)
    await waitFor(() => expect(login).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Inicio de socio')).toBeInTheDocument()
  })
})
