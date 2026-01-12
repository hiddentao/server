import type { AbiEvent } from "viem"
import { parseAbiItem } from "viem"
import { clientConfig } from "../../../shared/config/client"
import { serverConfig } from "../../../shared/config/server"
import { AUTH_METHOD } from "../../../shared/constants"
import { NotificationType } from "../../../shared/notifications/types"
import { getUserByAuthIdentifier } from "../../db/users"
import type { ChainLogModule } from "../jobs/types"

// ERC20NewToken event from the factory contract
const ERC20_NEW_TOKEN_EVENT = parseAbiItem(
  "event ERC20NewToken(address indexed token, string name, string symbol, address indexed creator, uint256 initialSupply)",
)

export const getEvent: ChainLogModule["getEvent"] = () => {
  return ERC20_NEW_TOKEN_EVENT as AbiEvent
}

export const getContractAddress: ChainLogModule["getContractAddress"] = () => {
  // In test mode, don't filter by address to allow test factories
  if (serverConfig.NODE_ENV === "test") {
    return null
  }
  return (clientConfig.WEB3_FACTORY_CONTRACT_ADDRESS as `0x${string}`) || null
}

export const processLogs: ChainLogModule["processLogs"] = async (
  serverApp,
  log,
  logs,
) => {
  if (!logs || logs.length === 0) {
    return
  }

  log.info(`Processing ${logs.length} ERC20NewToken events`)

  for (const logEntry of logs) {
    try {
      const {
        args: { token: tokenAddress, name, symbol, creator, initialSupply },
        transactionHash,
      } = logEntry

      log.info(
        `Processing token creation: ${symbol} (${name}) at ${tokenAddress}, creator: ${creator}, initialSupply: ${initialSupply}`,
      )

      const creatorAddress = creator

      // Look up user by wallet address via userAuth table
      const user = await getUserByAuthIdentifier(
        serverApp.db,
        AUTH_METHOD.WEB3_WALLET,
        creatorAddress.toLowerCase(),
      )

      if (!user) {
        log.warn(`No user found for wallet ${creatorAddress}`)
        continue
      }

      const tokenInfo = { name, symbol }

      log.debug(
        `Using token metadata from factory event for ${tokenAddress}: ${symbol} (${name})`,
      )

      await serverApp.createNotification(user.id, {
        type: NotificationType.TOKEN_CREATED,
        message: `Created new token ${tokenInfo.symbol} (${tokenInfo.name}) at ${tokenAddress}`,
        transactionHash,
        tokenAddress: tokenAddress.toLowerCase(),
        creator: creatorAddress,
        initialSupply: initialSupply.toString(),
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
      })

      log.info(
        `Created notification for user ${user.id} for new token creation`,
      )
    } catch (error) {
      log.error("Error processing token creation event:", error)
    }
  }
}
