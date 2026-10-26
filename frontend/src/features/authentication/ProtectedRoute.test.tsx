import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from './auth-context'
import type { AuthContextValue } from './auth-context'
import { testUser } from '../../test/test-utils'
import { ProtectedRoute } from './ProtectedRoute'

function renderGuard(value: AuthContextValue, allowPasswordChange = false) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<ProtectedRoute allowPasswordChange={allowPasswordChange}/> }>
            <Route path="/protected" element={<p>Contenido protegido</p>}/>
          </Route>
          <Route path="/iniciar-sesion" element={<p>Pantalla de inicio de sesión</p>}/>
          <Route path="/cambiar-contrasena" element={<p>Pantalla de cambio de contraseña</p>}/>
          <Route path="/inicio" element={<p>Inicio de la aplicación</p>}/>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

function authValue(user: ReturnType<typeof testUser> | null, logout = vi.fn(() => Promise.resolve())): AuthContextValue {
  return {
    session: user ? {
      accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 3600,
      expiresAt: Date.now() + 3_600_000, user,
    } : null,
    login: vi.fn(), logout, updateProfilePhoto: vi.fn(), changePassword: vi.fn(),
  }
}

afterEach(cleanup)

describe('ProtectedRoute', () => {
  it('redirige al inicio de sesión si no existe una sesión', () => {
    renderGuard(authValue(null))
    expect(screen.getByText('Pantalla de inicio de sesión')).toBeInTheDocument()
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument()
  })

  it('cierra la sesión y bloquea a una cuenta inactiva', async () => {
    const logout = vi.fn(() => Promise.resolve())
    renderGuard(authValue(testUser('MEMBER', { status: 'INACTIVE' }), logout))

    expect(screen.getByText('Pantalla de inicio de sesión')).toBeInTheDocument()
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument()
    await waitFor(() => expect(logout).toHaveBeenCalledOnce())
  })

  it('obliga a cambiar una contraseña temporal antes de entrar', () => {
    renderGuard(authValue(testUser('ADMIN', { isPasswordChangeRequired: true })))
    expect(screen.getByText('Pantalla de cambio de contraseña')).toBeInTheDocument()
  })

  it('permite la ruta de cambio obligatorio y envía al inicio si ya no se requiere', () => {
    renderGuard(authValue(testUser('TRAINER', { isPasswordChangeRequired: true })), true)
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument()

    cleanup()
    renderGuard(authValue(testUser('MEMBER')), true)
    expect(screen.getByText('Inicio de la aplicación')).toBeInTheDocument()
  })
})
