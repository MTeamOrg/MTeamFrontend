export const MEDICAL_CERTIFICATE_MAX_BYTES = 5 * 1024 * 1024
export const MEDICAL_CERTIFICATE_ACCEPT = '.pdf,.jpg,.jpeg,.png'
export const MEDICAL_CERTIFICATE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const

export function validateMedicalCertificateFile(file: File) {
  const extension = file.name.toLowerCase().split('.').pop()
  const validExtension = extension === 'pdf' || extension === 'jpg' || extension === 'jpeg' || extension === 'png'
  const validMime = MEDICAL_CERTIFICATE_MIME_TYPES.includes(file.type as typeof MEDICAL_CERTIFICATE_MIME_TYPES[number])

  if (!validExtension || !validMime) return 'El archivo debe ser PDF, JPG o PNG.'
  if (file.size > MEDICAL_CERTIFICATE_MAX_BYTES) return 'El archivo no puede superar los 5 MB.'
  return ''
}
