import { describe, expect, it } from 'vitest'
import { MEDICAL_CERTIFICATE_MAX_BYTES, validateMedicalCertificateFile } from './medical-certificate-validation'

describe('validación de certificados médicos', () => {
  it('acepta PDF, JPG y PNG de hasta 5 MB', () => {
    expect(validateMedicalCertificateFile(new File(['pdf'], 'apto.pdf', { type: 'application/pdf' }))).toBe('')
    expect(validateMedicalCertificateFile(new File(['jpg'], 'apto.jpg', { type: 'image/jpeg' }))).toBe('')
    expect(validateMedicalCertificateFile(new File(['png'], 'apto.png', { type: 'image/png' }))).toBe('')
  })

  it('rechaza tipos no admitidos y archivos mayores a 5 MB', () => {
    expect(validateMedicalCertificateFile(new File(['text'], 'apto.txt', { type: 'text/plain' }))).toContain('PDF')
    const tooLarge = new File([new Uint8Array(MEDICAL_CERTIFICATE_MAX_BYTES + 1)], 'apto.pdf', { type: 'application/pdf' })
    expect(validateMedicalCertificateFile(tooLarge)).toContain('5 MB')
  })
})
