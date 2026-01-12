# Web3 (Optional)

QuickDapp includes built-in blockchain integration through RainbowKit, Wagmi, and Viem. Set `WEB3_ENABLED=true` to enable wallet connections, smart contract interactions, and SIWE authentication.

## Configuration

The [`createWeb3Config()`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/config/web3.ts) function sets up RainbowKit with the supported chains and WalletConnect project ID. It uses RainbowKit's `getDefaultConfig()` for a simple setup with standard wallet options.

Chain configuration lives in [`src/shared/contracts/chain.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/contracts/chain.ts). The `WEB3_SUPPORTED_CHAINS` environment variable specifies which networks to enable. Supported chains include `anvil` (local development), `mainnet`, `sepolia`, and `base`. The first chain in the list becomes the primary chain.

When Web3 is enabled, [`App.tsx`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/App.tsx) wraps the application with `WagmiProvider` and `RainbowKitProvider`. Components work identically with or without Web3—the provider structure adapts based on configuration.

## Wallet Connection

The [`ConnectWallet`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/ConnectWallet.tsx) component uses RainbowKit's `ConnectButton.Custom` API to render wallet connection UI. It coordinates with [`AuthContext`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/contexts/AuthContext.tsx) to trigger SIWE authentication after wallet connection.

The component shows different states: a connect button when disconnected, a "Wrong network" warning for unsupported chains, and the connected account address when authenticated. The optional `showNetwork` prop adds a chain selector button.

## Token Hooks

Two hooks handle ERC-20 token operations:

[`useTokens.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/hooks/useTokens.ts) provides read operations:
- `useMyTokens()` — Fetches all tokens where the connected wallet has a balance, using multicall for efficiency
- `useTokenInfo(address)` — Fetches details for a specific token (name, symbol, decimals, balance)
- `useTokenCount()` — Returns the total number of tokens deployed through the factory

[`useTokenActions.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/hooks/useTokenActions.ts) provides write operations:
- `useCreateToken()` — Deploys a new ERC-20 token through the factory contract
- `useTransferToken()` — Transfers tokens to another address
- `useTransactionStatus(hash)` — Tracks transaction confirmation status

These hooks use React Query for caching and automatic refetching. Token queries refresh every 5-30 seconds to keep balances current.

## Contract Utilities

The [`src/shared/contracts/`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/contracts/) folder provides utilities for contract interactions:

- `getFactoryContractInfo()` — Returns the factory contract address and ABI
- `getERC20ContractInfo(address)` — Returns ERC-20 ABI for any token address
- `readContract()` — Reads contract state with proper typing
- `writeContract()` — Sends transactions through the wallet
- `fetchTokenWithBalance()` — Fetches token metadata and balance in one multicall

Contract ABIs are generated from Solidity files during build. See [`src/shared/abi/generated.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/abi/generated.ts) for the generated types.

## Token Components

Several components handle token display and management:

- [`TokenList`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/TokenList.tsx) — Displays all tokens owned by the connected wallet
- [`CreateTokenDialog`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/CreateTokenDialog.tsx) — Modal form for deploying new tokens
- [`SendTokenDialog`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/SendTokenDialog.tsx) — Modal form for transferring tokens
- [`ContractValue`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/ContractValue.tsx) — Displays values read from contracts
- [`NumTokens`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/NumTokens.tsx) — Shows the total token count from the factory
- [`IfWalletConnected`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/IfWalletConnected.tsx) — Conditionally renders children only when a wallet is connected

## Multicall

Token operations use Viem's multicall support to batch multiple contract reads into a single RPC request. The [`fetchMultipleTokensWithBalances()`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/contracts/tokens.ts) function demonstrates this—it fetches name, symbol, decimals, and balance for multiple tokens in one call.

For development on Anvil, QuickDapp automatically deploys Multicall3 if it doesn't exist. The [`deployMulticall3`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/workers/jobs/deployMulticall3.ts) worker job handles this during server startup.

## Error Handling

Transaction errors are caught and displayed through the toast system. Common errors include:
- User rejected the transaction
- Insufficient funds for gas
- Contract reverted (with the revert reason if available)

The hooks return `error` and `isError` states so components can display appropriate feedback.

## Disabling Web3

Set `WEB3_ENABLED=false` to build without blockchain features. The application continues to work with email and OAuth authentication instead of SIWE. Web3-specific components don't render, and the provider tree excludes Wagmi and RainbowKit.
