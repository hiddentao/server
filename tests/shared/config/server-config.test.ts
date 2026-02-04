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
import {
  type FirebaseServiceAccountKey,
  parseFirebaseServiceAccountKey,
  serverConfig,
  validateConfig,
} from "../../../src/shared/config/server"

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

  describe("parseFirebaseServiceAccountKey", () => {
    const validServiceAccountKey: FirebaseServiceAccountKey = {
      type: "service_account",
      project_id: "test-project",
      private_key_id: "key-id-123",
      private_key:
        "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
      client_email: "test@test-project.iam.gserviceaccount.com",
      client_id: "123456789",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url:
        "https://www.googleapis.com/robot/v1/metadata/x509/test",
    }

    it("should return undefined for undefined input", () => {
      const result = parseFirebaseServiceAccountKey(undefined)
      expect(result).toBeUndefined()
    })

    it("should return undefined for empty string input", () => {
      const result = parseFirebaseServiceAccountKey("")
      expect(result).toBeUndefined()
    })

    it("should parse valid JSON service account key", () => {
      const jsonString = JSON.stringify(validServiceAccountKey)
      const result = parseFirebaseServiceAccountKey(jsonString)

      expect(result).toBeDefined()
      expect(result?.project_id).toBe("test-project")
      expect(result?.client_email).toBe(
        "test@test-project.iam.gserviceaccount.com",
      )
      expect(result?.private_key).toContain("BEGIN PRIVATE KEY")
    })

    it("should parse JSON with all required fields", () => {
      const jsonString = JSON.stringify(validServiceAccountKey)
      const result = parseFirebaseServiceAccountKey(jsonString)

      expect(result).toBeDefined()
      expect(result?.type).toBe("service_account")
      expect(result?.project_id).toBe("test-project")
      expect(result?.private_key_id).toBe("key-id-123")
      expect(result?.private_key).toBeDefined()
      expect(result?.client_email).toBeDefined()
      expect(result?.client_id).toBe("123456789")
      expect(result?.auth_uri).toBe("https://accounts.google.com/o/oauth2/auth")
      expect(result?.token_uri).toBe("https://oauth2.googleapis.com/token")
      expect(result?.auth_provider_x509_cert_url).toBe(
        "https://www.googleapis.com/oauth2/v1/certs",
      )
      expect(result?.client_x509_cert_url).toBe(
        "https://www.googleapis.com/robot/v1/metadata/x509/test",
      )
    })

    it("should throw error for invalid JSON", () => {
      expect(() => parseFirebaseServiceAccountKey("not valid json")).toThrow(
        "FIREBASE_SERVICE_ACCOUNT_KEY must be valid JSON",
      )
    })

    it("should throw error for malformed JSON", () => {
      expect(() =>
        parseFirebaseServiceAccountKey('{"project_id": "test",'),
      ).toThrow("FIREBASE_SERVICE_ACCOUNT_KEY must be valid JSON")
    })

    it("should normalize escaped newlines in private key", () => {
      const keyWithNewlines = {
        ...validServiceAccountKey,
        private_key:
          "-----BEGIN PRIVATE KEY-----\\nMIIkey\\n-----END PRIVATE KEY-----\\n",
      }
      const jsonString = JSON.stringify(keyWithNewlines)
      const result = parseFirebaseServiceAccountKey(jsonString)

      expect(result).toBeDefined()
      expect(result?.private_key).toContain("\n")
      expect(result?.private_key).not.toContain("\\n")
    })

    it("should handle JSON with unicode characters", () => {
      const keyWithUnicode = {
        ...validServiceAccountKey,
        project_id: "test-project-\u00e9\u00e8",
      }
      const jsonString = JSON.stringify(keyWithUnicode)
      const result = parseFirebaseServiceAccountKey(jsonString)

      expect(result).toBeDefined()
      expect(result?.project_id).toBe("test-project-\u00e9\u00e8")
    })

    it("should parse minified JSON", () => {
      const minified =
        '{"type":"service_account","project_id":"test","private_key_id":"key","private_key":"key","client_email":"email","client_id":"id","auth_uri":"uri","token_uri":"uri","auth_provider_x509_cert_url":"url","client_x509_cert_url":"url"}'
      const result = parseFirebaseServiceAccountKey(minified)

      expect(result).toBeDefined()
      expect(result?.type).toBe("service_account")
    })
  })
})
