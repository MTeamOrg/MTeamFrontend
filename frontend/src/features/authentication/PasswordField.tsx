import { useState, type InputHTMLAttributes } from 'react'
import eyeIcon from '../../assets/icons/eye.svg'
import lockIcon from '../../assets/icons/lock.svg'

interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function PasswordField({ label, ...props }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  return (
    <label className="field">
      <span>{label}</span>
      <span className="input-shell">
        <img src={lockIcon} alt="" />
        <input {...props} type={isVisible ? 'text' : 'password'} />
        <button type="button" className="icon-button" onClick={() => setIsVisible((value) => !value)} aria-label={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          <img src={eyeIcon} alt="" />
        </button>
      </span>
    </label>
  )
}
