import type { AbiEvent } from "viem"
import { parseAbiItem } from "viem"
import { AUTH_METHOD } from "../../../shared/constants"
import { NotificationType } from "../../../shared/notifications/types"
import { getUserByAuthIdentifier } from "../../db/users"
import type { ChainLogModule } from "../jobs/types"

// Custom TokenTransferred event from SimpleERC20 contracts
const TOKEN_TRANSFERRED_EVENT = parseAbiItem(
  "event TokenTransferred(address indexed from, address indexed to, uint256 value, string name, string symbol, uint8 decimals)",
)

export const getEvent: ChainLogModule["getEvent"] = () => {
  return TOKEN_TRANSFERRED_EVENT as AbiEvent
}

export const getContractAddress: ChainLogModule["getContractAddress"] = () => {
  // TokenTransferred events can come from any SimpleERC20 contract
  // Return null to not filter by address
  return null
}

export const processLogs: ChainLogModule["processLogs"] = async (
  serverApp,
  log,
  logs,
) => {
  if (!logs || logs.length === 0) {
    return
  }

  log.info(`Processing ${logs.length} TokenTransferred events`)

  for (const logEntry of logs) {
    try {
      const {
        args: { from, to, value, name, symbol, decimals },
        address: tokenAddress,
        transactionHash,
      } = logEntry

      log.debug(
        `Processing TokenTransferred: ${from} -> ${to}, amount: ${value}, token: ${symbol} (${name}) at ${tokenAddress}`,
      )

      // Look up user by wallet address via userAuth table (sender)
      const user = await getUserByAuthIdentifier(
        serverApp.db,
        AUTH_METHOD.WEB3_WALLET,
        from.toLowerCase(),
      )

      if (!user) {
        log.debug(`No user found for wallet ${from}`)
        continue
      }

      // Token information is already available from the custom event
      const tokenInfo = { name, symbol, decimals }

      // Format amount (convert from wei)
      const amount = Number(value) / Math.pow(10, tokenInfo.decimals)
      const formattedAmount = amount.toFixed(2)

      try {
        await serverApp.createNotification(user.id, {
          type: NotificationType.TOKEN_TRANSFER,
          message: `Sent ${formattedAmount} ${tokenInfo.symbol} (${tokenInfo.name}) to ${to}`,
          transactionHash,
          tokenAddress: tokenAddress.toLowerCase(),
          from,
          to,
          amount: value.toString(),
          tokenSymbol: tokenInfo.symbol,
          tokenName: tokenInfo.name,
        })

        log.info(
          `Successfully created notification for user ${user.id} for token transfer`,
        )
      } catch (notificationError) {
        log.error(
          `Failed to create notification for user ${user.id}:`,
          notificationError,
        )
      }
    } catch (error) {
      log.error("Error processing TokenTransferred event:", error)
    }
  }
}
