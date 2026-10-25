import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ActionButton } from './ActionButton'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ActionButton', () => {
  it('blocks immediately and delays the visual spinner for fast requests', () => {
    vi.useFakeTimers()
    render(<ActionButton isLoading loadingLabel="Ingresando…">Iniciar sesión</ActionButton>)

    const button = screen.getByRole('button', { name: 'Iniciar sesión' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button.querySelector('.action-spinner')).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(150))
    expect(button.querySelector('.action-spinner')).toBeInTheDocument()
    expect(button).toHaveAccessibleName('Ingresando…')
    expect(screen.getByText('Ingresando…')).toBeInTheDocument()
  })

  it('prevents a second click once the first click starts the action', () => {
    const onClick = vi.fn()
    function TestButton() {
      const [isLoading, setIsLoading] = useState(false)
      return <ActionButton isLoading={isLoading} loadingLabel="Guardando…" onClick={() => { onClick(); setIsLoading(true) }}>Guardar</ActionButton>
    }

    render(<TestButton />)
    const button = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
  })
})
