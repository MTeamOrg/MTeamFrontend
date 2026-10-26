import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../service/api-client'
import { authService } from './auth-service'
import { ResetPasswordPage } from './ResetPasswordPage'

const recoveryToken = 'a'.repeat(64)

function renderResetPage(token = recoveryToken) {
  window.history.replaceState({}, '', token ? `/restablecer#token=${token}` : '/restablecer')
  return render(<MemoryRouter><ResetPasswordPage/></MemoryRouter>)
}

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

describe('ResetPasswordPage', () => {
  it('rechaza un enlace sin token válido y permite solicitar otro', () => {
    renderResetPage('invalid-token')

    expect(screen.getByRole('alert')).toHaveTextContent('El enlace es inválido o está incompleto.')
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Solicitar otro enlace' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/iniciar-sesion')
  })

  it('no envía la solicitud cuando las contraseñas no coinciden', async () => {
    const completeRecovery = vi.spyOn(authService, 'completeRecovery')
    renderResetPage()
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'password-123' } })
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'different-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas nuevas no coinciden.')
    expect(completeRecovery).not.toHaveBeenCalled()
  })

  it('envía el token y la nueva contraseña, y muestra confirmación al completar', async () => {
    const completeRecovery = vi.spyOn(authService, 'completeRecovery').mockResolvedValue(undefined)
    renderResetPage()
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'new-password-123' } })
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'new-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Contraseña actualizada. Ya podés iniciar sesión')
    expect(completeRecovery).toHaveBeenCalledWith(recoveryToken, 'new-password-123')
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
  })

  it('muestra el error del servidor y bloquea un token vencido', async () => {
    vi.spyOn(authService, 'completeRecovery').mockRejectedValue(new ApiError(400, {
      code: 'EXPIRED_RECOVERY_TOKEN', message: 'El enlace venció. Solicitá uno nuevo.', details: null,
    }))
    renderResetPage()
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'new-password-123' } })
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'new-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace venció. Solicitá uno nuevo.')
    expect(screen.getByRole('button', { name: 'Solicitar otro enlace' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
  })
})
