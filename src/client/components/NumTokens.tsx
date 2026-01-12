import { useTokenCount } from "../hooks/useTokens"

interface NumTokensProps {
  className?: string
}

export function NumTokens({ className }: NumTokensProps) {
  const { data: count, isLoading, error } = useTokenCount()

  if (isLoading) {
    return (
      <div className={className}>
        <span className="mr-2">No. of tokens:</span>
        <span>Loading...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={className}>
        <span className="mr-2">No. of tokens:</span>
        <span>Error</span>
      </div>
    )
  }

  const tokenCount = count ?? 0

  return (
    <div className={className}>
      <span className="mr-2">No. of tokens:</span>
      <span>{tokenCount}</span>
    </div>
  )
}
