import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useDelayedLoading } from '../hooks/use-delayed-loading'

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean
  isSuccess?: boolean
  loadingLabel: string
  successLabel?: string
  children: ReactNode
}

export function ActionButton({ isLoading = false, isSuccess = false, loadingLabel, successLabel = 'Listo', children, className, disabled, ...props }: ActionButtonProps) {
  const showLoadingFeedback = useDelayedLoading(isLoading)
  const showSuccessFeedback = isSuccess && !isLoading
  const classes = ['action-button', isSuccess && 'action-button-success', className].filter(Boolean).join(' ')

  return <button
    {...props}
    className={classes}
    disabled={disabled || isLoading || isSuccess}
    aria-busy={isLoading || undefined}
    aria-live={isLoading || isSuccess ? 'polite' : undefined}
    aria-label={showLoadingFeedback ? loadingLabel : showSuccessFeedback ? successLabel : props['aria-label']}
  >
    {showLoadingFeedback ? <><span className="action-spinner" aria-hidden="true"/><span>{loadingLabel}</span></> : showSuccessFeedback ? <><span className="action-success-icon" aria-hidden="true">✓</span><span>{successLabel}</span></> : children}
  </button>
}
