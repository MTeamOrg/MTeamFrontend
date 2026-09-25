import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileScreen } from './ProfileScreen'

const profile = {
  id: 'member-id',
  firstName: 'Ana',
  lastName: 'Pérez',
  documentNumber: '30111222',
  birthDate: '1990-01-02',
  email: 'ana@example.com',
  phone: '1100000000',
  photoUrl: null,
  role: 'MEMBER',
  status: 'ACTIVE',
  isPasswordChangeRequired: false,
  memberProfile: { emergencyContactName: 'Luis', emergencyContactPhone: '1111111111' },
  trainerProfile: null,
}

describe('perfil conectado', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('carga y actualiza los campos habilitados, reflejando la respuesta', async () => {
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, options?: RequestInit) => {
      const body = options?.method === 'PATCH' ? JSON.parse(String(options.body)) : null
      return Promise.resolve(new Response(JSON.stringify(body ? { ...profile, ...body } : profile), { status: 200 }))
    }))
    render(<ProfileScreen role="MEMBER" onPasswordChange={() => undefined}/>)
    const email = await screen.findByDisplayValue('ana@example.com')
    fireEvent.change(email, { target: { value: 'nueva@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Perfil actualizado correctamente.')).toBeInTheDocument()
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/users/me'), expect.objectContaining({ method: 'PATCH' })))
    const [, options] = vi.mocked(fetch).mock.calls.at(-1) ?? []
    expect(JSON.parse(String(options?.body))).toMatchObject({ email: 'nueva@example.com', phone: '1100000000' })
  })
})
