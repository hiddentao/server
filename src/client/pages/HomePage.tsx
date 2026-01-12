import { CreateTokenDialog } from "../components/CreateTokenDialog"
import { IfWalletConnected } from "../components/IfWalletConnected"
import { NumTokens } from "../components/NumTokens"
import { TokenList } from "../components/TokenList"

export function HomePage() {
  return (
    <div className="p-4">
      <p className="mb-6">
        This is the default Echo app. It lets you create and transfer ERC-20
        tokens.
      </p>
      <IfWalletConnected>
        <div>
          <CreateTokenDialog />
          <NumTokens className="mt-4" />
        </div>
        <div className="mt-4">
          <TokenList />
        </div>
      </IfWalletConnected>
    </div>
  )
}
