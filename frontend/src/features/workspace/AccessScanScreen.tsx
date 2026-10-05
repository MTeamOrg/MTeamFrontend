import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import type { UserRole } from '../authentication/auth-types'
import { backendApi, type AccessAttemptResult } from '../../service/backend-api'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'

const denialMessages: Record<string, string> = {
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
  const processingRef = useRef(false)
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [result, setResult] = useState<AccessAttemptResult | null>(null)
  const [requestError, setRequestError] = useState('')

  useEffect(() => {
    if (!scanning || result) return
    let isCurrentScan = true
    const reader = new BrowserMultiFormatReader()
    void reader.decodeFromVideoDevice(undefined, videoRef.current!, async (decoded, _error, controls) => {
      if (!decoded || processingRef.current) return
      processingRef.current = true
      controls.stop()
      controlsRef.current = null
      setScanning(false)
      setLoading(true)
      try {
        setResult(await backendApi.createAccessAttempt(decoded.getText()))
      } catch (value) {
        setRequestError(value instanceof Error ? value.message : 'No se pudo registrar el intento. Intentá nuevamente.')
      } finally {
        processingRef.current = false
        setLoading(false)
      }
    }).then((controls) => {
      if (!isCurrentScan) controls.stop()
      else controlsRef.current = controls
    }).catch(() => {
      if (!isCurrentScan) return
      setScanning(false)
      setCameraError('No pudimos acceder a la cámara. Permití su uso en el navegador y volvé a intentar el escaneo.')
    })
    return () => {
      isCurrentScan = false
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [result, scanning])

  function scanAgain() {
    processingRef.current = false
    setResult(null)
    setRequestError('')
    setCameraError('')
    setScanning(true)
  }

  function stopScanning() {
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
  }

  if (result) return <div className={`app-page access-outcome ${result.result === 'ALLOWED' ? 'allowed' : 'denied'}`}>
    <section className="access-outcome-card" aria-live="polite">
      <span className="access-outcome-icon"><Icon name={result.result === 'ALLOWED' ? 'check' : 'close'} size={34}/></span>
      <h1>{result.result === 'ALLOWED' ? 'ACCESO PERMITIDO' : 'ACCESO RECHAZADO'}</h1>
      <p>{result.result === 'ALLOWED'
        ? role === 'TRAINER' ? 'Cuenta activa con rol de entrenador.' : 'Tu cuenta está activa, tu cuota está vigente y cumplís los requisitos de acceso.'
        : denialMessages[result.denialReason ?? ''] ?? 'No pudimos autorizar el ingreso. Revisá tu cuenta e intentá nuevamente.'}</p>
      <dl><div><dt>Sede</dt><dd>{result.branch?.name ?? 'No identificada'}</dd></div><div><dt>Punto de acceso</dt><dd>{result.accessPoint?.name ?? 'No identificado'}</dd></div><div><dt>Fecha y hora</dt><dd>{new Date(result.attemptedAt).toLocaleString('es-AR')}</dd></div></dl>
      <button type="button" className="button button-primary" onClick={() => void scanAgain()}><Icon name="qr" size={18}/>Escanear de nuevo</button>
    </section>
  </div>

  return <div className="app-page access-page">
    <PageHeader title="Acceso al gimnasio" description="Apuntá la cámara al código QR del punto de acceso."/>
    <section className={`scanner-viewport${scanning ? ' scanning' : ''}`}>
      <video ref={videoRef} className="scanner-video" muted playsInline aria-label="Vista de la cámara para escanear el código QR"/>
      {!scanning && <><Icon name="camera" size={40}/><small>{cameraError || 'Escaneá el código QR fijo ubicado en el acceso.'}</small></>}
      {scanning && <div className="scanner-frame" aria-hidden="true"><span/><span/><span/><span/></div>}
    </section>
    <div className="scanner-controls">
      {loading ? <p role="status">Validando el acceso…</p> : scanning
        ? <><p role="status">Mantené el código QR dentro del marco y con buena iluminación.</p><button type="button" className="button button-secondary" onClick={stopScanning}>Cancelar escaneo</button></>
        : <button type="button" className="button button-primary" onClick={() => void scanAgain()}>Escanear QR</button>}
      {!scanning && <p>El navegador te va a pedir permiso para usar la cámara. Si no podés leer el código, ajustá la distancia e intentá nuevamente.</p>}
    </div>
    {requestError && <p className="notice-inline" role="alert">{requestError} Podés volver a escanear el código.</p>}
  </div>
}
