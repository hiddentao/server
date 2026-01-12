import { useEffect, useState } from "react"
import { cn } from "../utils/cn"
import { Button } from "./Button"

export interface CookieConsentBannerProps {
  className?: string
  title?: string
  message?: string
  acceptText?: string
  declineText?: string
  onAccept?: () => void
  onDecline?: () => void
  showDecline?: boolean
  storageKey?: string
}

export function CookieConsentBanner({
  className,
  title = "Cookie Consent",
  message = "We use cookies to enhance your experience and analyze site usage. By continuing to use this site, you consent to our use of cookies.",
  acceptText = "Accept",
  declineText = "Decline",
  onAccept,
  onDecline,
  showDecline = true,
  storageKey = "cookie-consent",
}: CookieConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(storageKey)
    if (!consent) {
      setIsVisible(true)
    }
  }, [storageKey])

  const handleAccept = () => {
    setIsAnimating(true)
    localStorage.setItem(storageKey, "accepted")
    onAccept?.()
    setTimeout(() => {
      setIsVisible(false)
      setIsAnimating(false)
    }, 300)
  }

  const handleDecline = () => {
    setIsAnimating(true)
    localStorage.setItem(storageKey, "declined")
    onDecline?.()
    setTimeout(() => {
      setIsVisible(false)
      setIsAnimating(false)
    }, 300)
  }

  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 p-4 transition-transform duration-300",
        isAnimating && "translate-y-full",
        className,
      )}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-white mb-2">{title}</h3>
            <p className="text-sm text-slate-300">{message}</p>
          </div>

          <div className="flex gap-3 flex-shrink-0">
            {showDecline && (
              <Button variant="outline" size="sm" onClick={handleDecline}>
                {declineText}
              </Button>
            )}
            <Button variant="default" size="sm" onClick={handleAccept}>
              {acceptText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook to check cookie consent status
export function useCookieConsent(storageKey = "cookie-consent") {
  const [consent, setConsent] = useState<"accepted" | "declined" | null>(null)

  useEffect(() => {
    const storedConsent = localStorage.getItem(storageKey)
    setConsent(storedConsent as "accepted" | "declined" | null)
  }, [storageKey])

  const updateConsent = (newConsent: "accepted" | "declined") => {
    localStorage.setItem(storageKey, newConsent)
    setConsent(newConsent)
  }

  const clearConsent = () => {
    localStorage.removeItem(storageKey)
    setConsent(null)
  }

  return {
    consent,
    hasConsented: consent !== null,
    isAccepted: consent === "accepted",
    isDeclined: consent === "declined",
    updateConsent,
    clearConsent,
  }
}
