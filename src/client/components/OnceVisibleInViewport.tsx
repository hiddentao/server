import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"

export interface OnceVisibleInViewportProps {
  children: ReactNode
  fallback?: ReactNode
  threshold?: number
  rootMargin?: string
  className?: string
}

export function OnceVisibleInViewport({
  children,
  fallback = null,
  threshold = 0.1,
  rootMargin = "0px",
  className,
}: OnceVisibleInViewportProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || hasBeenVisible) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setIsVisible(true)
          setHasBeenVisible(true)
          observer.disconnect()
        }
      },
      {
        threshold,
        rootMargin,
      },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin, hasBeenVisible])

  return (
    <div ref={ref} className={className}>
      {hasBeenVisible || isVisible ? children : fallback}
    </div>
  )
}

// Hook version for more flexibility
export function useOnceVisibleInViewport(threshold = 0.1, rootMargin = "0px") {
  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || hasBeenVisible) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setIsVisible(true)
          setHasBeenVisible(true)
          observer.disconnect()
        }
      },
      {
        threshold,
        rootMargin,
      },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin, hasBeenVisible])

  return { ref, isVisible, hasBeenVisible }
}
