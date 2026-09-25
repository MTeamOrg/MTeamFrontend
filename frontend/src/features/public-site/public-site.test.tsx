import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PublicSite } from './PublicSite'

function renderPublicSite(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<PublicSite />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('sitio público', () => {
  it('muestra el inicio y navega a las sedes', () => {
    renderPublicSite()

    expect(screen.getByRole('heading', { name: 'Entrená en M-TEAM' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Ver las sedes/ }))

    expect(screen.getByRole('heading', { name: 'Sedes' })).toBeInTheDocument()
    expect(screen.getAllByTitle(/Google Maps:/)).toHaveLength(2)
  })

  it('filtra eventos finalizados según su fecha y horario', () => {
    renderPublicSite('/eventos')

    fireEvent.click(screen.getByRole('button', { name: 'Finalizados' }))

    expect(screen.getByText('Maratón M-TEAM 5K')).toBeInTheDocument()
    expect(screen.getByText('Torneo interno de Crossfit')).toBeInTheDocument()
  })

  it('muestra las novedades publicadas', () => {
    renderPublicSite('/novedades')

    expect(screen.getByRole('heading', { name: 'Novedades' })).toBeInTheDocument()
    expect(screen.getByText('Feriado del 8 de septiembre')).toBeInTheDocument()
  })

  it('abre el detalle de una sede desde una ruta dedicada', () => {
    renderPublicSite('/sedes/villa-urquiza')

    expect(screen.getByRole('heading', { level: 2, name: 'Villa Urquiza' })).toBeInTheDocument()
    expect(screen.getAllByTitle('Google Maps: Villa Urquiza').length).toBeGreaterThan(0)
  })
})
