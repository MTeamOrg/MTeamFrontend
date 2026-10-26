import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { UserAvatar } from './UserAvatar'

afterEach(cleanup)

describe('UserAvatar', () => {
  it('shows initials when there is no profile photo', () => {
    render(<UserAvatar firstName="Ana" lastName="Pérez"/>)
    expect(screen.getByRole('img', { name: 'Iniciales de Ana Pérez' })).toHaveTextContent('AP')
  })

  it('shows the photo with accessible alternative text', () => {
    render(<UserAvatar firstName="Ana" lastName="Pérez" photoUrl="https://example.com/avatar.jpg"/>)
    expect(screen.getByRole('img', { name: 'Foto de perfil de Ana Pérez' })).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('falls back after an image failure and tries the new URL after a change', () => {
    const { rerender } = render(<UserAvatar firstName="Ana" lastName="Pérez" photoUrl="https://example.com/expired.jpg"/>)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByRole('img', { name: 'Iniciales de Ana Pérez' })).toHaveTextContent('AP')
    rerender(<UserAvatar firstName="Ana" lastName="Pérez" photoUrl="https://example.com/current.jpg"/>)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/current.jpg')
  })
})
