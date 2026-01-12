/**
 * OAuth state encryption/decryption for cookie-free OAuth flow
 *
 * Encrypts {provider, codeVerifier, exp} into a URL-safe string that passes
 * through OAuth redirects. Uses AES-GCM for authenticated encryption.
 */

import { serverConfig } from "@shared/config/server"

const OAUTH_STATE_EXPIRATION_MS = 10 * 60 * 1000 // 10 minutes

interface OAuthStatePayload {
  provider: string
  codeVerifier?: string
  redirectUrl?: string
  exp: number
}

/**
 * Derive a 256-bit key from the session encryption key
 */
async function deriveKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(serverConfig.SESSION_ENCRYPTION_KEY),
    "PBKDF2",
    false,
    ["deriveKey"],
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("oauth-state-v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

/**
 * Encrypt OAuth state data into a URL-safe string
 */
export async function encryptOAuthState(
  provider: string,
  codeVerifier?: string,
  redirectUrl?: string,
): Promise<string> {
  const payload: OAuthStatePayload = {
    provider,
    codeVerifier,
    redirectUrl,
    exp: Date.now() + OAUTH_STATE_EXPIRATION_MS,
  }

  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  const data = encoder.encode(JSON.stringify(payload))

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  )

  // Combine IV + ciphertext and encode as URL-safe base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  return Buffer.from(combined).toString("base64url")
}

/**
 * Decrypt and validate OAuth state, returns null if invalid/expired
 */
export async function decryptOAuthState(
  encryptedState: string,
): Promise<OAuthStatePayload | null> {
  try {
    const combined = Buffer.from(encryptedState, "base64url")
    if (combined.length < 13) {
      return null
    }

    const iv = combined.subarray(0, 12)
    const ciphertext = combined.subarray(12)

    const key = await deriveKey()
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    )

    const decoder = new TextDecoder()
    const payload = JSON.parse(decoder.decode(decrypted)) as OAuthStatePayload

    // Validate required fields
    if (!payload.provider || typeof payload.exp !== "number") {
      return null
    }

    // Check expiration
    if (Date.now() > payload.exp) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
