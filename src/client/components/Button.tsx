import * as React from "react"
import { cn } from "../utils/cn"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "error"
  size?: "sm" | "default" | "lg"
  loading?: boolean
}

const BUTTON_VARIANTS = {
  default: "bg-anchor text-black hover:bg-anchor/90",
  outline: "border border-anchor text-anchor hover:bg-anchor hover:text-black",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  error: "bg-red-600 text-white hover:bg-red-700",
} as const

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-sm",
  default: "h-10 px-4 py-2",
  lg: "h-11 px-8 text-lg",
} as const

const BASE_CLASSES =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-anchor focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      loading,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        className={cn(
          BASE_CLASSES,
          BUTTON_VARIANTS[variant],
          BUTTON_SIZES[size],
          className,
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = "Button"

export { Button }
