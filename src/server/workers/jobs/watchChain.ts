import { encodeEventTopics } from "viem"
import {
  requireChainRpcEndpoint,
  serverConfig,
} from "../../../shared/config/server"
import { getPrimaryChainName } from "../../../shared/contracts/chain"
import { getLastProcessedBlock, setLastProcessedBlock } from "../../db/settings"
import * as createTokenFilter from "../chainFilters/createToken"
import * as sendTokenFilter from "../chainFilters/sendToken"
import type {
  ChainLogModule,
  ChainLogRegistry,
  JobParams,
  JobRunner,
} from "./types"

export const WATCH_CHAIN_POLL_INTERVAL_SECONDS = 3

const CHAIN_WATCHER = {
  MAX_BLOCK_RANGE: 500,
} as const

// Registry of all chain log modules
const chainLogModules: ChainLogRegistry = {
  sendToken: sendTokenFilter,
  createToken: createTokenFilter,
}

function getChainName(): string {
  return getPrimaryChainName()
}

async function getFromBlock(
  params: JobParams,
  currentBlock: bigint,
): Promise<bigint> {
  const { serverApp, log } = params
  const chainName = getChainName()

  const lastProcessed = await getLastProcessedBlock(serverApp.db, chainName)

  if (lastProcessed !== null) {
    return lastProcessed + 1n
  }

  // First run - in test mode start from block 1, otherwise from current block
  if (serverConfig.NODE_ENV === "test") {
    log.info(
      `First run for chain ${chainName}, starting from block 1 (test mode)`,
    )
    return 1n
  }

  log.info(
    `First run for chain ${chainName}, starting from current block ${currentBlock}`,
  )
  return currentBlock
}

async function processLogsForModule(
  params: JobParams,
  moduleName: string,
  module: ChainLogModule,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<void> {
  const { serverApp, log } = params
  const moduleLog = log.child(moduleName)
  const client = serverApp.publicClient

  if (!client) {
    moduleLog.error("No chain client available")
    return
  }

  const event = module.getEvent()
  const address = module.getContractAddress()

  // Get the event topic hash for debugging
  const eventTopics = encodeEventTopics({ abi: [event] })
  const eventTopicHash = eventTopics[0]

  moduleLog.debug(
    `Querying logs: event=${event.name}, topic=${eventTopicHash}, address=${address || "any"}, fromBlock=${fromBlock}, toBlock=${toBlock}`,
  )

  try {
    const logs = await client.getLogs({
      event,
      address: address || undefined,
      fromBlock,
      toBlock,
    })

    if (logs.length > 0) {
      moduleLog.info(
        `Found ${logs.length} events in blocks ${fromBlock}-${toBlock}`,
      )
      await module.processLogs(serverApp, moduleLog, logs)
    } else {
      moduleLog.debug(`No events in blocks ${fromBlock}-${toBlock}`)
    }
  } catch (err) {
    moduleLog.error("Error fetching logs:", err)
    throw err
  }
}

export const run: JobRunner = async (params: JobParams) => {
  const { serverApp, log } = params
  const client = serverApp.publicClient
  const chainName = getChainName()

  if (!client) {
    log.error("No chain client available, skipping chain watching")
    return
  }

  // Force fresh block number by making a direct RPC call
  const currentBlock = await client.getBlockNumber()
  const lastProcessed = await getLastProcessedBlock(serverApp.db, chainName)
  const rpcUrl = requireChainRpcEndpoint(chainName)
  log.debug(
    `watchChain: currentBlock=${currentBlock}, lastProcessedBlock=${lastProcessed}, rpc=${rpcUrl}`,
  )

  const fromBlock = await getFromBlock(params, currentBlock)

  if (fromBlock > currentBlock) {
    log.debug(`Chain ${chainName}: Already caught up at block ${currentBlock}`)
    return
  }

  let toBlock = currentBlock
  if (toBlock - fromBlock > BigInt(CHAIN_WATCHER.MAX_BLOCK_RANGE)) {
    toBlock = fromBlock + BigInt(CHAIN_WATCHER.MAX_BLOCK_RANGE) - 1n
    log.debug(
      `Chain ${chainName}: Limiting range to ${CHAIN_WATCHER.MAX_BLOCK_RANGE} blocks`,
    )
  }

  log.debug(`Chain ${chainName}: Processing blocks ${fromBlock} to ${toBlock}`)

  for (const [moduleName, module] of Object.entries(chainLogModules)) {
    await processLogsForModule(params, moduleName, module, fromBlock, toBlock)
  }

  await setLastProcessedBlock(serverApp.db, chainName, toBlock)
  log.debug(`Chain ${chainName}: Updated last processed block to ${toBlock}`)
}

export const watchChainJob = {
  run,
}
