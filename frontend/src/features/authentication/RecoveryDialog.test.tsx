import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../service/api-client'
import { authService } from './auth-service'
import { RecoveryDialog } from './RecoveryDialog'

describe('RecoveryDialog', () => {
  const showModal = vi.fn()
  const closeDialog = vi.fn()
  const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
  const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

  beforeEach(() => {
    showModal.mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
    closeDialog.mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute('open') })
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: closeDialog })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
    showModal.mockClear()
    closeDialog.mockClear()
  })

  it('abre el diálogo, normaliza el correo y confirma el envío del enlace', async () => {
    const requestRecovery = vi.spyOn(authService, 'requestRecovery').mockResolvedValue({ message: 'Si la cuenta existe, recibirás un enlace.' })
    const onClose = vi.fn()
    render(<RecoveryDialog initialEmail="  LARA@EXAMPLE.COM " onClose={onClose}/>)

    expect(showModal).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('LARA@EXAMPLE.COM')
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Si la cuenta existe, recibirás un enlace.')
    expect(requestRecovery).toHaveBeenCalledWith('lara@example.com')
    expect(screen.getByRole('button', { name: 'Enviar otro enlace' })).toBeDisabled()
    expect(screen.getByText('Podés volver a solicitar un enlace en un minuto.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('muestra un error del servidor y permite reintentar', async () => {
    const requestRecovery = vi.spyOn(authService, 'requestRecovery')
      .mockRejectedValueOnce(new ApiError(503, { code: 'SERVICE_UNAVAILABLE', message: 'No pudimos enviar el correo.', details: null }))
      .mockResolvedValueOnce({ message: 'Solicitud recibida.' })
    render(<RecoveryDialog initialEmail="lara@example.com" onClose={vi.fn()}/>)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos enviar el correo.')
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Solicitud recibida.')
    expect(requestRecovery).toHaveBeenCalledTimes(2)
  })

  it('aplica el tiempo de espera cuando el servidor responde con 429', async () => {
    vi.spyOn(authService, 'requestRecovery').mockRejectedValue(new ApiError(429, {
      code: 'RATE_LIMITED', message: 'Esperá antes de volver a intentarlo.', details: null,
    }))
    render(<RecoveryDialog initialEmail="lara@example.com" onClose={vi.fn()}/>)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Esperá antes de volver a intentarlo.')
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeDisabled()
    expect(screen.getByText('Podés volver a solicitar un enlace en un minuto.')).toBeInTheDocument()
  })

  it('permite cerrar la ventana desde el botón de cierre y desde volver', () => {
    const onClose = vi.fn()
    const { rerender } = render(<RecoveryDialog initialEmail="" onClose={onClose}/>)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledOnce()

    onClose.mockClear()
    rerender(<RecoveryDialog initialEmail="" onClose={onClose}/>)
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
