import { describe, expect, it } from 'vitest'
import eye from './eye.svg?raw'
import lock from './lock.svg?raw'
import mail from './mail.svg?raw'
import pin from './pin.svg?raw'

describe('íconos exportados de Figma', () => {
  it('cada archivo contiene la capa de Figma que indica su nombre', () => {
    expect(eye).toContain('id="icon / eye"')
    expect(lock).toContain('id="icon / lock"')
    expect(mail).toContain('id="icon / mail"')
    expect(pin).toContain('id="icon / pin"')
  })
})
