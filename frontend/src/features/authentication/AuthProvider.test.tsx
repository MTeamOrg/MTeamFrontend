import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { authStorage } from './auth-storage'
import { useAuth } from './use-auth'
import { stubApi, testUser } from '../../test/test-utils'

function SessionControls() {
  const { session, login, logout, updateProfilePhoto } = useAuth()
  return <>
    <output aria-label="Foto vigente">{session?.user.photoUrl ?? 'Sin foto'}</output>
    <button onClick={() => void login({ email: 'test@example.com', password: 'test-password' }, false)}>Ingresar</button>
    <button onClick={() => updateProfilePhoto('https://example.com/new.jpg')}>Actualizar foto</button>
    <button onClick={() => void logout()}>Salir</button>
  </>
}

afterEach(() => { cleanup(); authStorage.clear(); vi.unstubAllGlobals() })

describe('AuthProvider profile photo', () => {
  it.each(['MEMBER', 'TRAINER'] as const)('loads the current photo after a fresh login for %s', async (role) => {
    const user = testUser(role)
    stubApi([
      { method: 'POST', path: '/auth/login', handler: () => ({ body: { user, accessToken: 'login-token', tokenType: 'Bearer', expiresIn: 3600 } }) },
      { path: '/auth/me', handler: () => ({ body: { ...user, photoUrl: 'https://example.com/current.jpg' } }) },
    ])
    render(<AuthProvider><SessionControls/></AuthProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    await waitFor(() => expect(screen.getByLabelText('Foto vigente')).toHaveTextContent('https://example.com/current.jpg'))
    expect(authStorage.read()?.user.photoUrl).toBe(user.photoUrl)
  })

  it('does not overwrite a recently uploaded photo with an older identity response', async () => {
    const user = testUser('MEMBER')
    authStorage.write({ user, accessToken: 'existing-token', tokenType: 'Bearer', expiresIn: 3600 }, false)
    let finishIdentity!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finishIdentity = resolve })))
    render(<AuthProvider><SessionControls/></AuthProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar foto' }))
    await act(async () => finishIdentity(new Response(JSON.stringify({ ...user, photoUrl: 'https://example.com/old.jpg' }), { status: 200 })))
    expect(screen.getByLabelText('Foto vigente')).toHaveTextContent('https://example.com/new.jpg')
    expect(authStorage.read()?.user.photoUrl).toBe('https://example.com/new.jpg')
  })
})
