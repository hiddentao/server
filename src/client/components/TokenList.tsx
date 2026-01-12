import { memo, useMemo } from "react"
import { formatUnits } from "viem"
import type { Token } from "../hooks/useTokens"
import { useMyTokens } from "../hooks/useTokens"
import { cn } from "../utils/cn"
import { Button } from "./Button"
import { SendTokenDialog } from "./SendTokenDialog"
import styles from "./TokenList.module.css"

interface TokenCardProps {
  token: Token
}

const TokenCard = memo(function TokenCard({ token }: TokenCardProps) {
  const formattedBalance = useMemo(
    () => formatUnits(BigInt(token.balance), token.decimals),
    [token.balance, token.decimals],
  )

  return (
    <SendTokenDialog token={token}>
      <div className="p-4 rounded-md m-2 bg-slate-800 hover:bg-slate-600 hover:cursor-pointer transition-colors">
        <div className="text-sm font-mono mb-2">{token.address}</div>
        <div
          className={cn(
            styles.tokenMeta,
            "flex flex-row justify-between items-end w-full",
          )}
        >
          <div className="text-left">
            <p>
              <em>name:</em>
              {token.name}
            </p>
            <p>
              <em>symbol:</em>
              {token.symbol}
            </p>
            <p>
              <em>decimals:</em>
              {token.decimals}
            </p>
          </div>
          <div className="text-right">
            <em>bal:</em>
            <span className="text-lg font-mono">
              {parseFloat(formattedBalance).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </SendTokenDialog>
  )
})

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4 animate-pulse"
        >
          <div className="mb-3">
            <div className="h-5 bg-slate-700 rounded w-32 mb-2"></div>
            <div className="h-4 bg-slate-700 rounded w-24 mb-1"></div>
            <div className="h-3 bg-slate-700 rounded w-full"></div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <div className="h-4 bg-slate-700 rounded w-20"></div>
              <div className="h-4 bg-slate-700 rounded w-16"></div>
            </div>
            <div className="flex justify-between">
              <div className="h-4 bg-slate-700 rounded w-20"></div>
              <div className="h-4 bg-slate-700 rounded w-16"></div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 bg-slate-700 rounded flex-1"></div>
            <div className="h-8 bg-slate-700 rounded flex-1"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function TokenList() {
  const { data: tokenResponse, isLoading, error, refetch } = useMyTokens()

  if (isLoading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Your Tokens</h2>
          <div className="h-8 bg-slate-700 rounded w-20 animate-pulse"></div>
        </div>
        <LoadingSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-4">Failed to load tokens</p>
        <Button onClick={() => refetch()} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  const tokens = tokenResponse?.tokens || []

  if (tokens.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🪙</div>
        <h3 className="text-xl font-semibold text-white mb-2">No tokens yet</h3>
        <p className="text-slate-400 mb-4">
          Create your first token to get started!
        </p>
      </div>
    )
  }

  return (
    <div>
      <ul className="flex flex-row flex-wrap justify-start items-start">
        {tokens.map((token) => (
          <li key={token.address}>
            <TokenCard token={token} />
          </li>
        ))}
      </ul>
    </div>
  )
}
