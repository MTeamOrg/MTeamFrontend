import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import type { UserRole } from '../authentication/auth-types'
import { backendApi, type AccessAttemptResult } from '../../service/backend-api'
import { LoadingDots } from './ApiStates'
import { Icon } from './Icon'
import './access-qr.css'

const DENIAL_MESSAGES: Record<string, string> = {
  INVALID_QR: 'El código QR no es válido. Revisá el código del acceso e intentá nuevamente.',
  INACTIVE_USER: 'Tu cuenta está desactivada. Acercate al mostrador para recibir ayuda.',
  INACTIVE_BRANCH: 'La sede está desactivada y no puede recibir ingresos.',
  INACTIVE_ACCESS_POINT: 'Este punto de acceso está desactivado.',
  EXPIRED_MEMBERSHIP: 'Tu cuota está vencida. Acercate al mostrador para registrar el pago.',
  MEDICAL_CERTIFICATE_REQUIRED: 'Necesitás tener un apto médico aprobado para ingresar.',
}

export function AccessScanScreen({ role }: { role: Extract<UserRole, 'MEMBER' | 'TRAINER'> }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const isProcessingRef = useRef(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [isPermissionDenied, setIsPermissionDenied] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [result, setResult] = useState<AccessAttemptResult | null>(null)
  const [requestError, setRequestError] = useState('')

  useEffect(() => {
    if (!isScanning || result) return
    let isCurrentScan = true
    const reader = new BrowserMultiFormatReader()
    void reader.decodeFromVideoDevice(undefined, videoRef.current!, async (decoded, _error, controls) => {
      if (!isCurrentScan || !decoded || isProcessingRef.current) return
      isProcessingRef.current = true
      controls.stop()
      controlsRef.current = null
      setIsScanning(false)
      setIsLoading(true)
      try {
        setResult(await backendApi.createAccessAttempt(decoded.getText()))
      } catch (value) {
        setRequestError(value instanceof Error ? value.message : 'No se pudo registrar el intento. Intentá nuevamente.')
      } finally {
        isProcessingRef.current = false
        setIsLoading(false)
      }
    }).then((controls) => {
      if (!isCurrentScan) controls.stop()
      else {
        controlsRef.current = controls
        setIsCameraReady(true)
      }
    }).catch((error: unknown) => {
      if (!isCurrentScan) return
      setIsScanning(false)
      const hasDeniedPermission = error instanceof Error && ['NotAllowedError', 'PermissionDeniedError'].includes(error.name)
      setIsPermissionDenied(hasDeniedPermission)
      setCameraError(hasDeniedPermission
        ? 'El navegador bloqueó el acceso a la cámara.'
        : 'No pudimos iniciar la cámara. Comprobá que esté conectada y que otra aplicación no la esté usando. Volvé a intentar el escaneo.')
    })
    return () => {
      isCurrentScan = false
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [result, isScanning])

  function scanAgain() {
    isProcessingRef.current = false
    setResult(null)
    setRequestError('')
    setCameraError('')
    setIsCameraReady(false)
    setIsPermissionDenied(false)
    setIsScanning(true)
  }

  function stopScanning() {
    controlsRef.current?.stop()
    controlsRef.current = null
    setIsScanning(false)
    setIsCameraReady(false)
  }

  if (result) return <div className={`app-page access-outcome ${result.result === 'ALLOWED' ? 'allowed' : 'denied'}`}>
    <section className="access-outcome-card" aria-live="polite">
      <span className="access-outcome-icon"><Icon name={result.result === 'ALLOWED' ? 'check' : 'close'} size={34}/></span>
      <h1>{result.result === 'ALLOWED' ? 'ACCESO PERMITIDO' : 'ACCESO RECHAZADO'}</h1>
      <p>{result.result === 'ALLOWED'
        ? 'El sistema autorizó tu ingreso al gimnasio.'
        : DENIAL_MESSAGES[result.denialReason ?? ''] ?? 'No pudimos autorizar el ingreso. Revisá tu cuenta e intentá nuevamente.'}</p>
      <dl><div><dt>Sede</dt><dd>{result.branch?.name ?? 'No identificada'}</dd></div><div><dt>Punto de acceso</dt><dd>{result.accessPoint?.name ?? 'No identificado'}</dd></div><div><dt>Fecha y hora</dt><dd>{new Date(result.attemptedAt).toLocaleString('es-AR')}</dd></div></dl>
      <button type="button" className="button button-primary" onClick={() => void scanAgain()}><Icon name="qr" size={18}/>Escanear de nuevo</button>
    </section>
  </div>

  const statusText = isLoading ? 'Validando el acceso…'
    : isScanning ? isCameraReady ? 'Escaneando código QR' : 'Solicitando permiso de cámara…'
    : isPermissionDenied ? 'Permiso de cámara denegado'
    : cameraError ? 'Error de cámara' : 'Listo para escanear'

  return <div className="app-page access-qr-page" data-role={role}>
    <header className="access-qr-heading">
      <h1><span className="access-qr-desktop-title">Acceso QR</span><span className="access-qr-mobile-title">Acceso al gimnasio</span></h1>
      <p>Apuntá la cámara al código QR fijo del molinete para validar tu ingreso.</p>
    </header>
    <div className="access-qr-grid">
      <section className="access-qr-card" aria-label="Escáner de acceso">
        <div className="access-qr-viewport">
          <video ref={videoRef} className="access-qr-video" muted playsInline aria-label="Vista de la cámara para escanear el código QR"/>
          <div className="access-qr-frame" aria-hidden="true">{!isCameraReady && <Icon name="qr" size={64}/>}</div>
          <span className="access-qr-camera-label"><Icon name="camera" size={16}/>Código QR del molinete</span>
        </div>
        <div className="access-qr-controls">
          <p className="access-qr-status" role="status">{isLoading && <LoadingDots/>}<span>{statusText}</span></p>
          <p>{isPermissionDenied
            ? 'Abrí los permisos de este sitio en la barra de direcciones, habilitá la cámara y volvé a intentar.'
            : cameraError ? cameraError : 'Ubicá el código dentro del marco y mantené el celular quieto, con buena iluminación.'}</p>
          {isLoading ? null : isScanning
            ? <button type="button" className="button button-secondary" onClick={stopScanning}>Cancelar escaneo</button>
            : <button type="button" className="button button-primary" onClick={scanAgain}><Icon name={cameraError ? 'refresh' : 'camera'} size={18}/>{cameraError ? 'Reintentar cámara' : 'Escanear QR'}</button>}
          {requestError && <p className="notice-inline" role="alert">{requestError} Podés volver a escanear el código.</p>}
        </div>
      </section>
      <aside className="access-qr-help" aria-label="Ayuda para el acceso">
        <section className="access-qr-card">
          <h2><Icon name="qr" size={20}/>Cómo funciona</h2>
          <ol><li>Acercate al molinete del gimnasio.</li><li>Activá la cámara y apuntá al código QR fijo.</li><li>Esperá el resultado de la validación antes de ingresar.</li></ol>
          <p>El sistema valida tu acceso al leer el código.</p>
        </section>
        <section className="access-qr-card">
          <h2><Icon name="camera" size={20}/>Permisos de cámara</h2>
          <p>Para escanear el QR, permití que el navegador use tu cámara cuando lo solicite.</p>
          <p>Si bloqueaste el permiso, habilitalo desde los permisos de este sitio y reintentá el escaneo.</p>
        </section>
      </aside>
    </div>
  </div>
}
