import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingState } from './ApiStates'

describe('LoadingState', () => {
  it('shows a contextual message and three animated dots', () => {
    render(<LoadingState message="Cargando clases…" />)

    expect(screen.getByRole('status')).toHaveTextContent('Cargando clases…')
    expect(screen.getByRole('status').querySelectorAll('.loading-dot')).toHaveLength(3)
    expect(screen.getByRole('status').querySelector('.loading-dots')).toHaveAttribute('aria-hidden', 'true')
  })
})
