# Smart Contracts (Optional)

QuickDapp includes sample smart contracts for Web3 developers. If you're building a non-Web3 application, skip this section entirely.

## Overview

The sample contracts demonstrate a simple ERC20 token factory pattern using OpenZeppelin contracts and Foundry tooling. The factory deploys new ERC20 tokens with custom names, symbols, and initial supplies.

Both contracts live in [`sample-contracts/src/ERC20Factory.sol`](https://github.com/QuickDapp/QuickDapp/blob/main/sample-contracts/src/ERC20Factory.sol):

- **`ERC20Factory`** - Deploys new ERC20 tokens and tracks them
- **`SimpleERC20`** - Basic ERC20 with mint/burn capabilities and custom transfer events

## Directory Structure

```
sample-contracts/
├── src/
│   └── ERC20Factory.sol      # Factory and token contracts
├── devnet.ts                 # Local Hardhat blockchain
├── deploy.ts                 # Foundry deployment script
├── foundry.toml              # Foundry configuration
└── hardhat.config.cjs        # Hardhat node configuration
```

## Local Development

Start the local blockchain and deploy contracts in separate terminals:

```shell
# Terminal 1: Start local blockchain
cd sample-contracts
bun devnet.ts

# Terminal 2: Deploy contracts
cd sample-contracts
bun deploy.ts
```

The deployment script uses Foundry's `forge create` to deploy `ERC20Factory`, then automatically updates `.env.local` with the deployed contract address.

## Factory Interface

The factory tracks deployed tokens and emits events for indexing:

```solidity
contract ERC20Factory {
    event ERC20NewToken(
        address indexed token,
        string name,
        string symbol,
        address indexed creator,
        uint256 initialSupply
    );

    function erc20DeployToken(
        ERC20TokenConfig memory config,
        uint256 initialBalance
    ) external returns (address);

    function getNumErc20s() external view returns (uint256);
    function getErc20Address(uint256 index) external view returns (address);
    function getAllErc20Addresses() external view returns (address[] memory);
}
```

Token configuration uses a struct:

```solidity
struct ERC20TokenConfig {
    string name;
    string symbol;
    uint8 decimals;
}
```

## Testnet Deployment

Deploy to Sepolia or other testnets by configuring environment variables:

```shell
# In your .env.local
WEB3_SUPPORTED_CHAINS=sepolia
WEB3_SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_KEY
WEB3_SERVER_WALLET_PRIVATE_KEY=0x...

# Deploy
cd sample-contracts
bun deploy.ts
```

The script reads from the first chain in `WEB3_SUPPORTED_CHAINS` and uses the corresponding RPC endpoint.

## Testing

Run Foundry tests for contract verification:

```shell
cd sample-contracts
forge test           # Run all tests
forge test -vvv      # Verbose output
forge test --gas-report
```

## Frontend Integration

After deployment, the contract address is available via [`clientConfig.WEB3_FACTORY_CONTRACT_ADDRESS`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/config/client.ts). ABIs are generated from Foundry build artifacts to [`src/shared/abi/generated.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/abi/generated.ts) when you run `bun run gen`.

Use viem/wagmi on the client for contract interactions. The `ERC20NewToken` and `TokenTransferred` events are useful for real-time tracking via WebSockets.

## Customization

To add your own contracts:

1. Add Solidity files to `sample-contracts/src/`
2. Run `forge build` to compile
3. Update [`deploy.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/sample-contracts/deploy.ts) to deploy your contracts
4. Run `bun run gen` to regenerate ABI types
