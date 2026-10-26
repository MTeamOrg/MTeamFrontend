import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { UserRole } from '../authentication/auth-types'
import { FrequentlyAskedQuestionsPage } from './FrequentlyAskedQuestionsPage'

function renderFaq(role?: UserRole) {
  return render(<MemoryRouter><FrequentlyAskedQuestionsPage role={role}/></MemoryRouter>)
}

function openAnswers() {
  document.querySelectorAll('summary').forEach((question) => fireEvent.click(question))
}

function answerLinks() {
  return screen.getAllByRole('link').map((link) => ({ label: link.textContent, href: link.getAttribute('href') }))
}

describe('preguntas frecuentes', () => {
  afterEach(cleanup)

  it('muestra la versión pública y enlaza solo registro, ingreso y sedes', () => {
    renderFaq()
    expect(screen.getByRole('heading', { level: 1, name: 'Preguntas frecuentes' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3)
    expect(document.querySelectorAll('summary')).toHaveLength(8)
    openAnswers()

    expect(answerLinks()).toEqual([
      { label: 'Crear cuenta', href: '/crear-cuenta' },
      { label: 'Iniciar sesión', href: '/iniciar-sesion' },
      { label: 'Sedes', href: '/sedes' },
    ])
    expect(screen.queryByRole('link', { name: 'Clases' })).not.toBeInTheDocument()
  })

  it('muestra destinos específicos para socios sin enlazar acciones ajenas', () => {
    renderFaq('MEMBER')
    openAnswers()
    expect(answerLinks().map(({ href }) => href)).toEqual([
      '/sedes', '/socio/clases', '/socio/acceso', '/socio/pagos', '/socio/apto-medico',
    ])
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument()
  })

  it.each([
    ['TRAINER', ['/sedes', '/entrenador/clases', '/entrenador/acceso']],
    ['ADMIN', ['/admin/sedes', '/admin/clases']],
  ] as const)('filtra destinos para el rol %s', (role, expectedHrefs) => {
    renderFaq(role)
    expect(screen.getByRole('heading', { level: 1, name: 'Preguntas frecuentes' })).toBeInTheDocument()
    openAnswers()
    expect(answerLinks().map(({ href }) => href)).toEqual(expectedHrefs)
    expect(screen.queryByRole('link', { name: 'Mis pagos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Apto médico' })).not.toBeInTheDocument()
    if (role === 'ADMIN') expect(screen.queryByRole('link', { name: 'Acceso QR' })).not.toBeInTheDocument()
  })
})
