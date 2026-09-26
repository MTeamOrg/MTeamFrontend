import { useState } from 'react'
import { Icon, type IconName } from './Icon'

export function SafeImage({ src, alt, className, fallbackIcon = 'image' }: { src: string | null | undefined; alt: string; className?: string; fallbackIcon?: IconName }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || failedSrc === src) {
    return <div className={`${className ?? ''} media-fallback`} role="img" aria-label={alt}><Icon name={fallbackIcon} size={32}/></div>
  }
  return <img className={className} src={src} alt={alt} onError={() => setFailedSrc(src)}/>
}
