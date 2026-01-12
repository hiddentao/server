/**
 * Comprehensive Tests for Chain Configuration Module
 *
 * Tests all functionality of src/shared/contracts/chain.ts including
 * chain resolution, ID mapping, error handling, and edge cases.
 */

import { describe, expect, it } from "bun:test"
import { mainnet, sepolia } from "viem/chains"
import {
  CHAIN_IDS,
  getChain,
  getChainById,
  getChainId,
  getChainTransports,
  getPrimaryChain,
  getPrimaryChainName,
  getSupportedChains,
} from "../../../src/shared/contracts/chain"
// Import global test setup
import "../../setup"

describe("Chain Configuration Module", () => {
  describe("CHAIN_IDS", () => {
    it("should have correct chain IDs defined", () => {
      expect(CHAIN_IDS.ANVIL).toBe(31337)
      expect(CHAIN_IDS.MAINNET).toBe(1)
      expect(CHAIN_IDS.SEPOLIA).toBe(11155111)
      expect(CHAIN_IDS.BASE).toBe(8453)
    })
  })

  describe("getChain()", () => {
    describe("Valid Chain Names", () => {
      it("should return mainnet chain for 'mainnet'", () => {
        const chain = getChain("mainnet")
        expect(chain.id).toBe(1)
        expect(chain.name).toBe("Ethereum")
        expect(chain.nativeCurrency?.symbol).toBe("ETH")
      })

      it("should return sepolia chain for 'sepolia'", () => {
        const chain = getChain("sepolia")
        expect(chain.id).toBe(11155111)
        expect(chain.name).toBe("Sepolia")
        expect(chain.testnet).toBe(true)
        expect(chain.nativeCurrency?.symbol).toBe("ETH")
      })

      it("should return base chain for 'base'", () => {
        const chain = getChain("base")
        expect(chain.id).toBe(8453)
        expect(chain.name).toBe("Base")
        expect(chain.nativeCurrency?.symbol).toBe("ETH")
      })

      it("should return anvil chain for 'anvil'", () => {
        const chain = getChain("anvil")
        expect(chain.id).toBe(31337)
        expect(chain.name).toBe("Anvil")
      })
    })

    describe("Chain Name Aliases", () => {
      it("should return mainnet chain for 'ethereum' alias", () => {
        const chain = getChain("ethereum")
        expect(chain.id).toBe(1)
        expect(chain.name).toBe("Ethereum")
      })
    })

    describe("Chain Structure Validation", () => {
      it("should return chain with required properties", () => {
        const chain = getChain("mainnet")

        expect(chain.id).toBeTypeOf("number")
        expect(chain.name).toBeTypeOf("string")
        expect(chain.nativeCurrency).toBeDefined()
        expect(chain.rpcUrls).toBeDefined()
        expect(chain.rpcUrls.default).toBeDefined()
        expect(chain.rpcUrls.default.http).toBeDefined()
        expect(Array.isArray(chain.rpcUrls.default.http)).toBe(true)
      })

      it("should return chain with native currency details", () => {
        const chain = getChain("mainnet")
        expect(chain.nativeCurrency?.name).toBeTypeOf("string")
        expect(chain.nativeCurrency?.symbol).toBeTypeOf("string")
        expect(chain.nativeCurrency?.decimals).toBeTypeOf("number")
      })

      it("should return testnet chain with testnet flag", () => {
        const chain = getChain("sepolia")
        expect(chain.testnet).toBe(true)
      })
    })

    describe("Error Handling", () => {
      it("should throw error for unknown chain", () => {
        expect(() => getChain("unknownchain")).toThrow(
          "Unknown chain: unknownchain",
        )
      })

      it("should throw error for empty string", () => {
        expect(() => getChain("")).toThrow("Unknown chain:")
      })
    })
  })

  describe("getChainId()", () => {
    describe("Valid Chain IDs", () => {
      it("should return correct ID for mainnet", () => {
        const chainId = getChainId("mainnet")
        expect(chainId).toBe(1)
      })

      it("should return correct ID for sepolia", () => {
        const chainId = getChainId("sepolia")
        expect(chainId).toBe(11155111)
      })

      it("should return correct ID for anvil", () => {
        const chainId = getChainId("anvil")
        expect(chainId).toBe(31337)
      })

      it("should return correct ID for base", () => {
        const chainId = getChainId("base")
        expect(chainId).toBe(8453)
      })
    })

    describe("Alias Support", () => {
      it("should return mainnet ID for 'ethereum' alias", () => {
        const chainId = getChainId("ethereum")
        expect(chainId).toBe(1)
      })
    })

    describe("Error Propagation", () => {
      it("should propagate error from getChain() for unknown chains", () => {
        expect(() => getChainId("unknownchain")).toThrow(
          "Unknown chain: unknownchain",
        )
      })
    })

    describe("Return Type Validation", () => {
      it("should always return a number", () => {
        const chainId = getChainId("mainnet")
        expect(typeof chainId).toBe("number")
        expect(Number.isInteger(chainId)).toBe(true)
        expect(chainId).toBeGreaterThan(0)
      })
    })
  })

  describe("getChainById()", () => {
    it("should return chain by ID", () => {
      const chain = getChainById(1)
      expect(chain.id).toBe(1)
      expect(chain.name).toBe("Ethereum")
    })

    it("should return anvil chain by ID", () => {
      const chain = getChainById(31337)
      expect(chain.id).toBe(31337)
      expect(chain.name).toBe("Anvil")
    })

    it("should return sepolia chain by ID", () => {
      const chain = getChainById(11155111)
      expect(chain.id).toBe(11155111)
      expect(chain.name).toBe("Sepolia")
    })

    it("should return base chain by ID", () => {
      const chain = getChainById(8453)
      expect(chain.id).toBe(8453)
      expect(chain.name).toBe("Base")
    })

    it("should throw for unsupported chain ID", () => {
      expect(() => getChainById(999999)).toThrow("Unsupported chain ID: 999999")
    })
  })

  describe("getSupportedChains()", () => {
    it("should return array of chains based on SUPPORTED_CHAINS config", () => {
      const chains = getSupportedChains()
      expect(Array.isArray(chains)).toBe(true)
      // In test environment, SUPPORTED_CHAINS=anvil
      expect(chains.length).toBeGreaterThan(0)
    })

    it("should return chains with valid structure", () => {
      const chains = getSupportedChains()
      if (chains.length > 0) {
        const chain = chains[0]
        expect(chain?.id).toBeTypeOf("number")
        expect(chain?.name).toBeTypeOf("string")
        expect(chain?.nativeCurrency).toBeDefined()
        expect(chain?.rpcUrls).toBeDefined()
      }
    })
  })

  describe("getPrimaryChain()", () => {
    it("should return first chain from SUPPORTED_CHAINS", () => {
      const chain = getPrimaryChain()
      expect(chain.id).toBeTypeOf("number")
      expect(chain.name).toBeTypeOf("string")
    })

    it("should return valid chain structure", () => {
      const chain = getPrimaryChain()
      expect(chain.nativeCurrency).toBeDefined()
      expect(chain.rpcUrls).toBeDefined()
      expect(chain.rpcUrls.default).toBeDefined()
    })
  })

  describe("getPrimaryChainName()", () => {
    it("should return first chain name from SUPPORTED_CHAINS", () => {
      const chainName = getPrimaryChainName()
      expect(typeof chainName).toBe("string")
      expect(chainName.length).toBeGreaterThan(0)
    })
  })

  describe("getChainTransports()", () => {
    it("should return transport config object", () => {
      const transports = getChainTransports()
      expect(typeof transports).toBe("object")
    })

    it("should have transports for known chain IDs", () => {
      const transports = getChainTransports()
      expect(transports[CHAIN_IDS.ANVIL]).toBeDefined()
      expect(transports[CHAIN_IDS.MAINNET]).toBeDefined()
      expect(transports[CHAIN_IDS.SEPOLIA]).toBeDefined()
      expect(transports[CHAIN_IDS.BASE]).toBeDefined()
    })
  })

  describe("Integration Tests", () => {
    describe("Chain Property Consistency", () => {
      it("should return chains consistent with viem exports", () => {
        const mainnetChain = getChain("mainnet")
        expect(mainnetChain.id).toBe(mainnet.id)
        expect(mainnetChain.name).toBe(mainnet.name)
        expect(mainnetChain.nativeCurrency?.symbol).toBe(
          mainnet.nativeCurrency.symbol,
        )

        const sepoliaChain = getChain("sepolia")
        expect(sepoliaChain.id).toBe(sepolia.id)
        expect(sepoliaChain.name).toBe(sepolia.name)
      })
    })

    describe("Function Interdependencies", () => {
      it("should have getChainId() return same ID as getChain().id", () => {
        const chainName = "mainnet"
        const chainId = getChainId(chainName)
        const chain = getChain(chainName)
        expect(chainId).toBe(chain.id)
      })

      it("should have getPrimaryChain() return same as getChain(getPrimaryChainName())", () => {
        const primaryChain = getPrimaryChain()
        const primaryChainName = getPrimaryChainName()
        const chainByName = getChain(primaryChainName)
        expect(primaryChain.id).toBe(chainByName.id)
        expect(primaryChain.name).toBe(chainByName.name)
      })
    })

    describe("Error Message Quality", () => {
      it("should provide helpful error messages", () => {
        try {
          getChain("invalidchain")
        } catch (error) {
          expect(error instanceof Error).toBe(true)
          expect((error as Error).message).toContain("Unknown chain")
          expect((error as Error).message).toContain("invalidchain")
        }
      })
    })

    describe("Performance and Memory", () => {
      it("should handle multiple calls efficiently", () => {
        for (let i = 0; i < 100; i++) {
          const chain = getChain("mainnet")
          const chainId = getChainId("mainnet")
          const primaryChain = getPrimaryChain()

          expect(chain.id).toBe(1)
          expect(chainId).toBe(1)
          expect(primaryChain.id).toBeTypeOf("number")
        }
      })

      it("should return consistent objects across calls", () => {
        const chain1 = getChain("mainnet")
        const chain2 = getChain("mainnet")

        expect(chain1.id).toBe(chain2.id)
        expect(chain1.name).toBe(chain2.name)
        expect(chain1.nativeCurrency?.symbol).toBe(
          chain2.nativeCurrency?.symbol,
        )
      })
    })
  })
})
