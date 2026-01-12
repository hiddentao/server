import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "../utils/cn"

export interface PopoverProps {
  trigger: ReactNode
  children: ReactNode
  placement?: "top" | "bottom" | "left" | "right"
  className?: string
  contentClassName?: string
  disabled?: boolean
  closeOnClickOutside?: boolean
  closeOnEscape?: boolean
}

export function Popover({
  trigger,
  children,
  placement = "bottom",
  className,
  contentClassName,
  disabled = false,
  closeOnClickOutside = true,
  closeOnEscape = true,
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const toggleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  const closePopover = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Handle click outside
  useEffect(() => {
    if (!closeOnClickOutside || !isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        triggerRef.current &&
        !contentRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        closePopover()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen, closeOnClickOutside, closePopover])

  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePopover()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, closeOnEscape, closePopover])

  const placementClasses = {
    top: "bottom-full left-0 mb-2",
    bottom: "top-full left-0 mt-2",
    left: "right-full top-0 mr-2",
    right: "left-full top-0 ml-2",
  }

  return (
    <div className={cn("relative inline-block", className)}>
      <div ref={triggerRef} onClick={toggleOpen}>
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={contentRef}
          className={cn(
            "absolute z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            placementClasses[placement],
            contentClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// Convenience components for common popover patterns
export interface PopoverContentProps {
  children: ReactNode
  className?: string
}

export function PopoverContent({ children, className }: PopoverContentProps) {
  return (
    <div className={cn("p-4 text-sm text-white", className)}>{children}</div>
  )
}

export interface PopoverHeaderProps {
  children: ReactNode
  className?: string
}

export function PopoverHeader({ children, className }: PopoverHeaderProps) {
  return (
    <div
      className={cn(
        "px-4 py-2 border-b border-slate-700 font-medium",
        className,
      )}
    >
      {children}
    </div>
  )
}

export interface PopoverBodyProps {
  children: ReactNode
  className?: string
}

export function PopoverBody({ children, className }: PopoverBodyProps) {
  return <div className={cn("p-4", className)}>{children}</div>
}
