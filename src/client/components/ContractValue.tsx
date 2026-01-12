import type { ReactNode } from "react"
import { useState } from "react"
import { cn } from "../utils/cn"
import { ErrorMessageBox } from "./ErrorMessageBox"
import { Loading } from "./Loading"

export interface ContractValueProps<T = any> {
  value?: T
  loading?: boolean
  error?: Error | string
  placeholder?: ReactNode
  formatter?: (value: T) => ReactNode
  className?: string
  label?: string
  copyable?: boolean
  refreshable?: boolean
  onRefresh?: () => void
  emptyState?: ReactNode
}

export function ContractValue<T = any>({
  value,
  loading = false,
  error,
  placeholder = "—",
  formatter,
  className,
  label,
  copyable = false,
  refreshable = false,
  onRefresh,
  emptyState = "No data",
}: ContractValueProps<T>) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!copyable || value === undefined) return

    const textValue = formatter ? String(formatter(value)) : String(value)

    try {
      await navigator.clipboard.writeText(textValue)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const displayValue = () => {
    if (loading) {
      return <Loading size="sm" />
    }

    if (error) {
      return (
        <ErrorMessageBox
          message={typeof error === "string" ? error : error.message}
          className="text-xs p-2"
        />
      )
    }

    if (value === undefined || value === null || value === "") {
      return <span className="text-slate-400 italic">{emptyState}</span>
    }

    if (formatter) {
      return formatter(value)
    }

    return String(value)
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400 font-medium">{label}</label>
          {refreshable && onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              ↻
            </button>
          )}
        </div>
      )}

      <div
        className={cn(
          "inline-flex items-center gap-2",
          copyable &&
            "cursor-pointer hover:bg-slate-800 rounded px-2 py-1 transition-colors",
        )}
        onClick={copyable ? handleCopy : undefined}
        title={copyable ? "Click to copy" : undefined}
      >
        <span className="text-sm font-mono break-all">{displayValue()}</span>

        {copyable && value !== undefined && (
          <span className="text-xs text-slate-400 opacity-0 hover:opacity-100 transition-opacity">
            {copied ? "Copied!" : "📋"}
          </span>
        )}
      </div>
    </div>
  )
}

// Specialized contract value components
export interface AddressValueProps
  extends Omit<ContractValueProps<string>, "formatter"> {
  address?: string
  truncate?: boolean
  explorerUrl?: string
}

export function AddressValue({
  address,
  truncate = true,
  explorerUrl,
  ...props
}: AddressValueProps) {
  const formatter = (addr: string) => {
    const truncated =
      truncate && addr.length > 10
        ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
        : addr

    if (explorerUrl) {
      return (
        <a
          href={`${explorerUrl}/address/${addr}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          {truncated}
        </a>
      )
    }

    return truncated
  }

  return (
    <ContractValue value={address} formatter={formatter} copyable {...props} />
  )
}

export interface TokenAmountValueProps
  extends Omit<ContractValueProps<string>, "formatter"> {
  amount?: string | bigint
  symbol?: string
  decimals?: number
}

export function TokenAmountValue({
  amount,
  symbol = "",
  decimals = 18,
  ...props
}: TokenAmountValueProps) {
  const formatter = (amt: string | bigint) => {
    try {
      const bigintAmount = typeof amt === "string" ? BigInt(amt) : amt
      const divisor = BigInt(10) ** BigInt(decimals)
      const wholePart = bigintAmount / divisor
      const fractionalPart = bigintAmount % divisor

      let formatted = wholePart.toString()

      if (fractionalPart > 0) {
        const fractionalStr = fractionalPart.toString().padStart(decimals, "0")
        const trimmed = fractionalStr.replace(/0+$/, "")
        if (trimmed) {
          formatted += "." + trimmed.slice(0, 6) // Show max 6 decimal places
        }
      }

      return symbol ? `${formatted} ${symbol}` : formatted
    } catch {
      return "Invalid amount"
    }
  }

  return <ContractValue value={amount} formatter={formatter} {...props} />
}
