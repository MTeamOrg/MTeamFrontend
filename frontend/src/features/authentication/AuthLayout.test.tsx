import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthLayout } from './AuthLayout'

describe('layout de autenticaciÃ³n', () => {
  it('permite volver al inicio desde el logo', () => {
    render(
      <MemoryRouter initialEntries={['/iniciar-sesion']}>
        <AuthLayout><div>Contenido de autenticaciÃ³n</div></AuthLayout>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'M-Team Gimnasio, ir al inicio' }))
      .toHaveAttribute('href', '/')
  })
})
