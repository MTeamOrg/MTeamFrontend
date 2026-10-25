import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useDelayedLoading } from '../hooks/use-delayed-loading'

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean
  loadingLabel: string
  children: ReactNode
}

export function ActionButton({ isLoading = false, loadingLabel, children, className, disabled, ...props }: ActionButtonProps) {
  const showLoadingFeedback = useDelayedLoading(isLoading)
  const classes = ['action-button', className].filter(Boolean).join(' ')

  return <button
    {...props}
    className={classes}
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
    aria-label={showLoadingFeedback ? loadingLabel : props['aria-label']}
  >
    {showLoadingFeedback ? <><span className="action-spinner" aria-hidden="true"/><span>{loadingLabel}</span></> : children}
  </button>
}
