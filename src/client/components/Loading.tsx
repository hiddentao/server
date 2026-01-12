import type { ReactNode } from "react"
import { cn } from "../utils/cn"

export interface LoadingProps {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "spinner" | "dots" | "pulse"
  text?: string
  className?: string
  children?: ReactNode
  overlay?: boolean
}

export function Loading({
  size = "md",
  variant = "spinner",
  text,
  className,
  children,
  overlay = false,
}: LoadingProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12",
  }

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-lg",
  }

  const LoadingElement = () => {
    switch (variant) {
      case "spinner":
        return (
          <div
            className={cn(
              "animate-spin rounded-full border-2 border-slate-600 border-t-white",
              sizeClasses[size],
            )}
          />
        )

      case "dots":
        return (
          <div className="flex gap-1">
            <div
              className={cn(
                "rounded-full bg-white animate-pulse",
                size === "sm"
                  ? "w-1 h-1"
                  : size === "md"
                    ? "w-1.5 h-1.5"
                    : size === "lg"
                      ? "w-2 h-2"
                      : "w-3 h-3",
              )}
              style={{ animationDelay: "0ms" }}
            />
            <div
              className={cn(
                "rounded-full bg-white animate-pulse",
                size === "sm"
                  ? "w-1 h-1"
                  : size === "md"
                    ? "w-1.5 h-1.5"
                    : size === "lg"
                      ? "w-2 h-2"
                      : "w-3 h-3",
              )}
              style={{ animationDelay: "150ms" }}
            />
            <div
              className={cn(
                "rounded-full bg-white animate-pulse",
                size === "sm"
                  ? "w-1 h-1"
                  : size === "md"
                    ? "w-1.5 h-1.5"
                    : size === "lg"
                      ? "w-2 h-2"
                      : "w-3 h-3",
              )}
              style={{ animationDelay: "300ms" }}
            />
          </div>
        )

      case "pulse":
        return (
          <div
            className={cn(
              "rounded-full bg-white/20 animate-pulse",
              sizeClasses[size],
            )}
          />
        )
    }
  }

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-white",
        className,
      )}
    >
      <LoadingElement />
      {text && (
        <p className={cn("text-slate-300", textSizeClasses[size])}>{text}</p>
      )}
      {children}
    </div>
  )

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    )
  }

  return content
}

// Skeleton loading component for content placeholders
export interface SkeletonProps {
  className?: string
  count?: number
}

export function Skeleton({ className, count = 1 }: SkeletonProps) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "bg-slate-700 rounded",
            count > 1 && i < count - 1 && "mb-2",
            className || "h-4 w-full",
          )}
        />
      ))}
    </div>
  )
}
