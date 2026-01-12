import crypto from "node:crypto"
import type { Logger } from "./logger"

export interface CryptoParams {
  key: string
}

function assertCryptoParams(params: CryptoParams): void {
  if (params.key.length !== 32) {
    throw new Error("Encryption key must be 32 characters")
  }
}

export async function encrypt(
  logger: Logger,
  cryptoParams: CryptoParams,
  data: string,
): Promise<string> {
  assertCryptoParams(cryptoParams)

  const { key } = cryptoParams

  const iv = crypto.randomBytes(16)

  logger.debug("Encrypting data")

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv)

  const salt = crypto.randomBytes(32).toString("hex")
  const plaindata = [
    salt.substring(0, salt.length / 2),
    data,
    salt.substring(salt.length / 2),
  ]

  const encrypted =
    cipher.update(JSON.stringify(plaindata), "utf8", "hex") +
    cipher.final("hex")

  return iv.toString("hex") + encrypted
}

export async function decrypt(
  logger: Logger,
  cryptoParams: CryptoParams,
  ciphertext: string,
): Promise<string> {
  assertCryptoParams(cryptoParams)

  const { key } = cryptoParams

  const iv = Buffer.from(ciphertext.slice(0, 32), "hex")
  const encryptedData = ciphertext.slice(32)

  logger.debug("Decrypting ciphertext")

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv)

  const plaintext =
    decipher.update(encryptedData, "hex", "utf8") + decipher.final("utf8")

  return JSON.parse(plaintext)[1]
}
