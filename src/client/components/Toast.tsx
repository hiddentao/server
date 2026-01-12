import * as React from "react"
import { cn } from "../utils/cn"

const TOAST_TYPE_STYLES = {
  default: "bg-slate-800 border-slate-700",
  success: "bg-green-800 border-green-700",
  error: "bg-red-800 border-red-700",
  warning: "bg-yellow-800 border-yellow-700",
} as const

const TOAST_ICON_MAP = {
  default: "ℹ️",
  success: "✅",
  error: "❌",
  warning: "⚠️",
} as const

export interface Toast {
  id: string
  title?: string
  description?: string
  type?: "default" | "success" | "error" | "warning"
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | null>(null)

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = React.useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2)
      const newToast: Toast = { id, duration: 5000, ...toast }

      setToasts((prev) => [...prev, newToast])

      // Auto remove after duration
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(id)
        }, newToast.duration)
      }
    },
    [removeToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  removeToast: (id: string) => void
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-full max-w-sm">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onClose: () => void
}

const ToastItem = React.memo(function ToastItem({
  toast,
  onClose,
}: ToastItemProps) {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    setTimeout(() => setIsVisible(true), 10)
  }, [])

  const handleClose = React.useCallback(() => {
    setIsVisible(false)
    setTimeout(onClose, 150)
  }, [onClose])

  return (
    <div
      className={cn(
        "border rounded-lg p-4 shadow-lg transition-all duration-150 transform",
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
        TOAST_TYPE_STYLES[toast.type || "default"],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <span className="text-lg">
            {TOAST_ICON_MAP[toast.type || "default"]}
          </span>
          <div className="flex-1 min-w-0">
            {toast.title && (
              <h4 className="font-medium text-white text-sm">{toast.title}</h4>
            )}
            {toast.description && (
              <p className="text-sm text-slate-300 mt-1">{toast.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
})
