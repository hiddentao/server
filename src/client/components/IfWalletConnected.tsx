import { useAccount } from "wagmi"
import { ConnectWallet } from "./ConnectWallet"

interface IfWalletConnectedProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function IfWalletConnected({
  children,
  fallback,
}: IfWalletConnectedProps) {
  const { isConnected } = useAccount()

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        {fallback || (
          <div className="space-y-4">
            <p className="text-slate-400 mb-4">
              Please connect your wallet to use this dapp.
            </p>
            <ConnectWallet />
          </div>
        )}
      </div>
    )
  }

  return <>{children}</>
}
