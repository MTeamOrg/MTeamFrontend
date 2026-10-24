import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext } from './auth-context'
import { RegisterPage } from './RegisterPage'
import { authService } from './auth-service'

function LoginLanding() {
  const location = useLocation()
  return <p>{location.state?.accountCreated ? 'Cuenta creada correctamente' : 'Iniciar sesión'}</p>
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RegisterPage', () => {
  it('waits for navigation to login after a successful registration', async () => {
    const register = vi.spyOn(authService, 'register').mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/crear-cuenta']}>
        <AuthContext.Provider value={{
          session: null,
          login: vi.fn(async () => { throw new Error('Unexpected login') }),
          logout: vi.fn(async () => {}),
          updateProfilePhoto: vi.fn(),
          changePassword: vi.fn(async () => {}),
        }}>
          <Routes>
            <Route path="/crear-cuenta" element={<RegisterPage/>}/>
            <Route path="/iniciar-sesion" element={<LoginLanding/>}/>
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Prueba' } })
    fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '40123456' } })
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '2000-01-01' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '1112345678' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() => expect(register).toHaveBeenCalledWith({
      firstName: 'Ana',
      lastName: 'Prueba',
      documentNumber: '40123456',
      birthDate: '2000-01-01',
      email: 'ana@example.com',
      phone: '1112345678',
      password: 'password123',
    }))
    expect(await screen.findByText('Cuenta creada correctamente')).toBeInTheDocument()
  })
})
