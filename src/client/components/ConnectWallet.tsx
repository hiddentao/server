import { ConnectButton } from "@rainbow-me/rainbowkit"
import type { ReactNode } from "react"
import { useCallback, useMemo } from "react"
import { useAccount } from "wagmi"
import { useAuthContext } from "../contexts/AuthContext"
import { Button } from "./Button"

interface ConnectWalletProps {
  showNetwork?: boolean
}

interface ConnectWalletButtonProps {
  showNetwork: boolean
  account?: { displayName: string }
  chain?: {
    unsupported?: boolean
    hasIcon?: boolean
    iconBackground?: string
    iconUrl?: string
    name?: string
  }
  openAccountModal: () => void
  openChainModal: () => void
  openConnectModal: () => void
  authenticationStatus?: string
  mounted?: boolean
}

function ConnectWalletButton({
  showNetwork,
  account,
  chain,
  openAccountModal,
  openChainModal,
  openConnectModal,
  authenticationStatus,
  mounted,
}: ConnectWalletButtonProps): ReactNode {
  const { isAuthenticated, authenticate } = useAuthContext()
  const { address } = useAccount()

  // Memoized calculated values
  const ready = useMemo(
    () => mounted && authenticationStatus !== "loading",
    [mounted, authenticationStatus],
  )

  const walletConnected = useMemo(
    () => ready && account && chain,
    [ready, account, chain],
  )

  // Memoized authentication handler
  const handleAuthenticate = useCallback(() => {
    if (address) {
      authenticate(address)
    }
  }, [address, authenticate])

  // Memoized button content
  const buttonContent = useMemo(() => {
    if (!walletConnected) {
      return (
        <Button onClick={openConnectModal} size="sm">
          Connect Wallet
        </Button>
      )
    }

    if (chain?.unsupported) {
      return (
        <Button onClick={openChainModal} variant="error">
          Wrong network
        </Button>
      )
    }

    // Wallet connected but not authenticated - show Connect Wallet to trigger SIWE
    if (walletConnected && !isAuthenticated) {
      return (
        <Button onClick={handleAuthenticate} size="sm">
          Connect Wallet
        </Button>
      )
    }

    // Fully authenticated - show account details
    if (showNetwork) {
      return (
        <div className="flex gap-2">
          <Button
            onClick={openChainModal}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
          >
            {chain?.hasIcon && (
              <div
                style={{
                  background: chain.iconBackground,
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                {chain.iconUrl && (
                  <img
                    alt={chain.name ?? "Chain icon"}
                    src={chain.iconUrl}
                    style={{ width: 16, height: 16 }}
                  />
                )}
              </div>
            )}
          </Button>
          <Button onClick={openAccountModal} variant="outline" size="sm">
            {account?.displayName}
          </Button>
        </div>
      )
    }

    return (
      <Button onClick={openAccountModal} variant="outline" size="sm">
        {account?.displayName}
      </Button>
    )
  }, [
    walletConnected,
    chain,
    isAuthenticated,
    showNetwork,
    openConnectModal,
    openChainModal,
    handleAuthenticate,
    openAccountModal,
    account?.displayName,
  ])

  return (
    <div
      {...(!ready && {
        "aria-hidden": true,
        style: {
          opacity: 0,
          pointerEvents: "none",
          userSelect: "none",
        },
      })}
    >
      {buttonContent}
    </div>
  )
}

export function ConnectWallet({ showNetwork = false }: ConnectWalletProps) {
  return (
    <ConnectButton.Custom>
      {(props) => (
        <ConnectWalletButton
          showNetwork={showNetwork}
          account={props.account}
          chain={props.chain}
          openAccountModal={props.openAccountModal}
          openChainModal={props.openChainModal}
          openConnectModal={props.openConnectModal}
          authenticationStatus={props.authenticationStatus}
          mounted={props.mounted}
        />
      )}
    </ConnectButton.Custom>
  )
}
