/**
 * Mock R2 server for testing
 *
 * Creates a local HTTP server that mimics R2's S3-compatible API
 * for testing presigned URL generation and file operations.
 */

import { testLogger } from "./logger"

export interface MockR2Server {
  url: string
  port: number
  uploads: Map<string, { content: Buffer; contentType: string }>
  getUpload: (
    key: string,
  ) => { content: Buffer; contentType: string } | undefined
  clearUploads: () => void
  stop: () => void
}

/**
 * Create a mock R2 server for testing
 */
export function createMockR2Server(port: number = 9000): MockR2Server {
  const uploads = new Map<string, { content: Buffer; contentType: string }>()

  const server = Bun.serve({
    port,
    fetch: async (req) => {
      const url = new URL(req.url)
      const pathParts = url.pathname.split("/").filter(Boolean)

      if (pathParts.length < 2) {
        return new Response("Invalid path", { status: 400 })
      }

      const bucket = pathParts[0]
      const key = pathParts.slice(1).join("/")

      testLogger.debug(`Mock R2 ${req.method}: bucket=${bucket}, key=${key}`)

      if (req.method === "PUT") {
        const content = Buffer.from(await req.arrayBuffer())
        const contentType =
          req.headers.get("content-type") || "application/octet-stream"

        uploads.set(key, { content, contentType })

        testLogger.debug(
          `Mock R2 upload stored: ${key} (${content.length} bytes)`,
        )

        return new Response(null, { status: 200 })
      }

      if (req.method === "GET") {
        const upload = uploads.get(key)

        if (!upload) {
          testLogger.debug(`Mock R2 file not found: ${key}`)
          return new Response("Not found", { status: 404 })
        }

        testLogger.debug(
          `Mock R2 download: ${key} (${upload.content.length} bytes)`,
        )

        return new Response(new Uint8Array(upload.content), {
          status: 200,
          headers: {
            "Content-Type": upload.contentType,
            "Content-Length": upload.content.length.toString(),
          },
        })
      }

      if (req.method === "HEAD") {
        const upload = uploads.get(key)

        if (!upload) {
          return new Response(null, { status: 404 })
        }

        return new Response(null, {
          status: 200,
          headers: {
            "Content-Type": upload.contentType,
            "Content-Length": upload.content.length.toString(),
          },
        })
      }

      if (req.method === "DELETE") {
        uploads.delete(key)
        return new Response(null, { status: 204 })
      }

      return new Response("Method not allowed", { status: 405 })
    },
  })

  testLogger.info(`Mock R2 server started on port ${port}`)

  return {
    url: `http://localhost:${port}`,
    port,
    uploads,
    getUpload: (key: string) => uploads.get(key),
    clearUploads: () => uploads.clear(),
    stop: () => {
      server.stop()
      testLogger.info("Mock R2 server stopped")
    },
  }
}

/**
 * Configure mock R2 environment variables for testing
 */
export function configureMockR2Env(mockServerUrl: string): void {
  const _url = new URL(mockServerUrl)
  process.env.CLOUDFLARE_ACCOUNT_ID = "mock-account-id"
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "mock-access-key"
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "mock-secret-key"
  process.env.CLOUDFLARE_R2_BUCKET_NAME = "mock-bucket"
  process.env.CLOUDFLARE_R2_PUBLIC_URL = mockServerUrl
}

/**
 * Clear mock R2 environment variables
 */
export function clearMockR2Env(): void {
  delete process.env.CLOUDFLARE_ACCOUNT_ID
  delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  delete process.env.CLOUDFLARE_R2_BUCKET_NAME
  delete process.env.CLOUDFLARE_R2_PUBLIC_URL
}
