import { createPublicClient, createWalletClient, type Hex, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import {
  requireChainRpcEndpoint,
  serverConfig,
} from "../../../shared/config/server"
import { getMulticall3Info } from "../../../shared/contracts"
import {
  getPrimaryChain,
  getPrimaryChainName,
} from "../../../shared/contracts/chain"
import type { Job, JobParams } from "./types"

export interface DeployMulticall3Data {
  forceRedeploy?: boolean
}

export const deployMulticall3Job: Job = {
  async run({ log }: JobParams): Promise<void> {
    log.info("Starting Multicall3 deployment check...")

    try {
      const multicall3Info = getMulticall3Info()
      const chainName = getPrimaryChainName()
      const rpcUrl = requireChainRpcEndpoint(chainName)
      const chain = getPrimaryChain()

      // Verify private key is available
      const privateKey = serverConfig.WEB3_SERVER_WALLET_PRIVATE_KEY
      if (!privateKey || !privateKey.startsWith("0x")) {
        throw new Error(
          "WEB3_SERVER_WALLET_PRIVATE_KEY must be a valid hex string starting with 0x",
        )
      }

      // Create clients
      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      })

      const account = privateKeyToAccount(privateKey as Hex)
      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
      })

      log.info(
        `Checking Multicall3 at ${multicall3Info.contract} on chain ${chainName}`,
      )

      // Check if Multicall3 is already deployed
      try {
        const bytecode = await publicClient.getCode({
          address: multicall3Info.contract,
        })

        if (bytecode && bytecode.length > 5) {
          log.info("✅ Multicall3 already deployed")
          return
        }
      } catch {
        log.debug("Multicall3 not found, will deploy")
      }

      log.info("🚀 Deploying Multicall3 using deterministic deployment...")

      // First, fund the sender address with the required ETH
      const fundingTx = await walletClient.sendTransaction({
        account,
        chain,
        to: multicall3Info.sender,
        value: BigInt(parseFloat(multicall3Info.eth) * 10 ** 18),
      })

      await publicClient.waitForTransactionReceipt({ hash: fundingTx })
      log.info(`Funded deployer address ${multicall3Info.sender}`)

      // Deploy using the pre-signed transaction
      const deployTx = await publicClient.sendRawTransaction({
        serializedTransaction: multicall3Info.signedDeploymentTx,
      })

      const deployReceipt = await publicClient.waitForTransactionReceipt({
        hash: deployTx,
      })

      if (deployReceipt.status === "success") {
        // Verify deployment
        const bytecode = await publicClient.getCode({
          address: multicall3Info.contract,
        })

        if (bytecode && bytecode.length > 5) {
          log.info(
            `✅ Multicall3 deployed successfully at ${multicall3Info.contract}`,
          )
          log.info(`Transaction hash: ${deployTx}`)
        } else {
          throw new Error("Multicall3 deployment verification failed")
        }
      } else {
        throw new Error("Deployment transaction failed")
      }
    } catch (error) {
      log.error("Multicall3 deployment failed:", error)
      throw error
    }
  },
}
