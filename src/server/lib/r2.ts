import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { serverConfig } from "../../shared/config/server"
import type { Logger } from "./logger"

export interface UploadUrlResult {
  uploadUrl: string
  publicUrl: string
  key: string
}

const ALLOWED_AUDIO_CONTENT_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-m4a",
]

let s3Client: S3Client | null = null

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  return !!(
    serverConfig.CLOUDFLARE_ACCOUNT_ID &&
    serverConfig.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    serverConfig.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    serverConfig.CLOUDFLARE_R2_BUCKET_NAME &&
    serverConfig.CLOUDFLARE_R2_PUBLIC_URL
  )
}

/**
 * Get the S3 client configured for R2
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    if (!isR2Configured()) {
      throw new Error("R2 is not configured")
    }

    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${serverConfig.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: serverConfig.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: serverConfig.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    })
  }

  return s3Client
}

/**
 * Reset the S3 client (useful for testing)
 */
export function resetS3Client(): void {
  s3Client = null
}

/**
 * Generate a unique key for audio files
 */
function generateAudioKey(userId: number, extension: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `audio/${userId}/${timestamp}-${random}.${extension}`
}

/**
 * Get file extension from content type
 */
function getExtensionFromContentType(contentType: string): string {
  switch (contentType) {
    case "audio/webm":
      return "webm"
    case "audio/mp4":
    case "audio/x-m4a":
      return "m4a"
    case "audio/mpeg":
      return "mp3"
    case "audio/ogg":
      return "ogg"
    case "audio/wav":
      return "wav"
    default:
      return "audio"
  }
}

/**
 * Validate that a content type is allowed for audio uploads
 */
export function isValidAudioContentType(contentType: string): boolean {
  return ALLOWED_AUDIO_CONTENT_TYPES.includes(contentType)
}

/**
 * Generate a presigned URL for uploading audio to R2
 */
export async function generateAudioUploadUrl(
  logger: Logger,
  userId: number,
  contentType: string,
): Promise<UploadUrlResult> {
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured")
  }

  if (!isValidAudioContentType(contentType)) {
    throw new Error(
      `Invalid audio content type: ${contentType}. Allowed types: ${ALLOWED_AUDIO_CONTENT_TYPES.join(", ")}`,
    )
  }

  const extension = getExtensionFromContentType(contentType)
  const key = generateAudioKey(userId, extension)

  const client = getS3Client()
  const bucket = serverConfig.CLOUDFLARE_R2_BUCKET_NAME!

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 })
  const publicUrl = `${serverConfig.CLOUDFLARE_R2_PUBLIC_URL}/${key}`

  logger.debug("Generated audio upload URL", { key, publicUrl })

  return {
    uploadUrl,
    publicUrl,
    key,
  }
}

/**
 * Generate a presigned URL for uploading waveform PNG to R2
 */
export async function generateWaveformUploadUrl(
  logger: Logger,
  postId: number,
): Promise<UploadUrlResult> {
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured")
  }

  const key = `waveforms/${postId}.png`

  const client = getS3Client()
  const bucket = serverConfig.CLOUDFLARE_R2_BUCKET_NAME!

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: "image/png",
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 })
  const publicUrl = `${serverConfig.CLOUDFLARE_R2_PUBLIC_URL}/${key}`

  logger.debug("Generated waveform upload URL", { key, publicUrl })

  return {
    uploadUrl,
    publicUrl,
    key,
  }
}

/**
 * Generate a presigned URL for downloading a file from R2
 */
export async function generateDownloadUrl(
  logger: Logger,
  key: string,
): Promise<string> {
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured")
  }

  const client = getS3Client()
  const bucket = serverConfig.CLOUDFLARE_R2_BUCKET_NAME!

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  const downloadUrl = await getSignedUrl(client, command, { expiresIn: 3600 })

  logger.debug("Generated download URL", { key })

  return downloadUrl
}

/**
 * Upload content directly to R2 (for server-side operations)
 */
export async function uploadToR2(
  logger: Logger,
  key: string,
  content: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured")
  }

  const client = getS3Client()
  const bucket = serverConfig.CLOUDFLARE_R2_BUCKET_NAME!

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: content,
    ContentType: contentType,
  })

  await client.send(command)

  const publicUrl = `${serverConfig.CLOUDFLARE_R2_PUBLIC_URL}/${key}`

  logger.debug("Uploaded to R2", { key, publicUrl })

  return publicUrl
}

/**
 * Download content from R2 (for server-side operations)
 */
export async function downloadFromR2(
  logger: Logger,
  key: string,
): Promise<Uint8Array> {
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured")
  }

  const client = getS3Client()
  const bucket = serverConfig.CLOUDFLARE_R2_BUCKET_NAME!

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  const response = await client.send(command)

  if (!response.Body) {
    throw new Error(`Failed to download from R2: empty response for key ${key}`)
  }

  logger.debug("Downloaded from R2", { key })

  return response.Body.transformToByteArray()
}

/**
 * Get the public URL for a key
 */
export function getPublicUrl(key: string): string {
  if (!serverConfig.CLOUDFLARE_R2_PUBLIC_URL) {
    throw new Error("R2 public URL is not configured")
  }
  return `${serverConfig.CLOUDFLARE_R2_PUBLIC_URL}/${key}`
}
