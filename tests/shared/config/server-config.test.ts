/**
 * Server configuration validation tests
 *
 * Tests the server configuration loading and validation functionality
 *
 * NOTE: serverConfig is evaluated at module load time. Tests that modify
 * process.env after module load cannot test the validation behavior of
 * missing/empty values. Those scenarios are tested implicitly by the fact
 * that env-var's .required() throws during module load.
 */

import { describe, expect, it } from "bun:test"
import { serverConfig, validateConfig } from "../../../src/shared/config/server"

describe("Server Configuration Validation", () => {
  describe("validateConfig", () => {
    it("should pass validation with the test environment configuration", () => {
      // The test environment should have all required variables set
      // This validates that validateConfig() doesn't throw with valid config
      expect(() => validateConfig()).not.toThrow()
    })

    it("should have all required config values loaded", () => {
      // Verify that the loaded config has all required values
      expect(serverConfig.DATABASE_URL).toBeTruthy()
      expect(serverConfig.SESSION_ENCRYPTION_KEY).toBeTruthy()
      expect(serverConfig.API_URL).toBeTruthy()
    })

    it("should validate SESSION_ENCRYPTION_KEY length requirement", () => {
      // Verify the key meets the minimum length requirement
      expect(serverConfig.SESSION_ENCRYPTION_KEY.length).toBeGreaterThanOrEqual(
        32,
      )
    })

    it("should have Web3 config when WEB3_ENABLED is true", () => {
      if (serverConfig.WEB3_ENABLED) {
        expect(serverConfig.WEB3_SERVER_WALLET_PRIVATE_KEY).toBeTruthy()
        expect(serverConfig.WEB3_ALLOWED_SIWE_ORIGINS).toBeDefined()
        expect(serverConfig.WEB3_SUPPORTED_CHAINS).toBeDefined()
        expect(serverConfig.WEB3_WALLETCONNECT_PROJECT_ID).toBeTruthy()
      }
    })
  })
})
