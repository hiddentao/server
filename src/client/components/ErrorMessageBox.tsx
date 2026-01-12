import { memo, type ReactNode } from "react"
import { cn } from "../utils/cn"

export interface ErrorMessageBoxProps {
  title?: string
  message?: string
  error?: Error | string
  details?: string
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  children?: ReactNode
  showDetails?: boolean
}

export const ErrorMessageBox = memo(function ErrorMessageBox({
  title = "Something went wrong",
  message,
  error,
  details,
  onRetry,
  onDismiss,
  className,
  children,
  showDetails = true,
}: ErrorMessageBoxProps) {
  const errorMessage = typeof error === "string" ? error : error?.message
  const displayMessage = message || errorMessage

  return (
    <div
      className={cn(
        "border border-red-700 bg-red-800/20 rounded-lg p-4 text-red-100",
        "max-w-full overflow-hidden",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex-shrink-0 text-red-400 text-lg">❌</div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <h3 className="font-medium text-red-100 mb-1 break-words">{title}</h3>

          {displayMessage && (
            <div className="text-sm text-red-200 mb-3 max-h-32 overflow-y-auto">
              <p className="break-all whitespace-pre-wrap">{displayMessage}</p>
            </div>
          )}

          <div className="min-w-0">{children}</div>

          {details && showDetails && (
            <details className="mt-3 min-w-0">
              <summary className="cursor-pointer text-xs text-red-300 hover:text-red-200 mb-2">
                Technical Details
              </summary>
              <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded max-h-32 overflow-auto">
                <pre className="whitespace-pre-wrap break-all min-w-0">
                  {details}
                </pre>
              </div>
            </details>
          )}

          {(onRetry || onDismiss) && (
            <div className="flex gap-2 mt-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  Try Again
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-red-400 hover:text-red-200 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
})
