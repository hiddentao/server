import { randomInt } from "crypto"
import isEmail from "validator/lib/isEmail"
import { serverConfig } from "../../shared/config/server"
import {
  EMAIL_VERIFICATION_CODE_EXPIRY_MS,
  EMAIL_VERIFICATION_CODE_MAX,
  EMAIL_VERIFICATION_CODE_MIN,
} from "../../shared/constants"
import { type CryptoParams, decrypt, encrypt } from "./crypto"
import type { Logger } from "./logger"

export interface VerifyEmailCodeBlob {
  email: string
  code: string
  blob: string
}

function getCryptoParams(): CryptoParams {
  const key = serverConfig.SESSION_ENCRYPTION_KEY.substring(0, 32)
  return { key }
}

export function validateEmailFormat(email: string): boolean {
  if (!email) {
    return false
  }
  return isEmail(email)
}

export async function generateVerificationCodeAndBlob(
  logger: Logger,
  email: string,
): Promise<VerifyEmailCodeBlob> {
  logger.debug(`Generating verification code for email`)

  const code = randomInt(
    EMAIL_VERIFICATION_CODE_MIN,
    EMAIL_VERIFICATION_CODE_MAX + 1,
  ).toString()

  const deadline = Date.now() + EMAIL_VERIFICATION_CODE_EXPIRY_MS
  const cryptoParams = getCryptoParams()

  const blob = await encrypt(
    logger,
    cryptoParams,
    JSON.stringify({ email: email.toLowerCase(), code, deadline }),
  )

  return {
    email: email.toLowerCase(),
    code,
    blob,
  }
}

export async function verifyCodeWithBlob(
  logger: Logger,
  blob: string,
  code: string,
): Promise<string> {
  logger.debug("Verifying code with blob")

  const cryptoParams = getCryptoParams()

  let orig: { code: string; deadline: number; email: string }

  try {
    orig = JSON.parse(await decrypt(logger, cryptoParams, blob))
  } catch {
    throw new Error("Invalid verification data")
  }

  if (orig.code !== code) {
    throw new Error("Incorrect verification code")
  }

  if (orig.deadline < Date.now()) {
    throw new Error("Verification code has expired")
  }

  return orig.email.toLowerCase()
}
