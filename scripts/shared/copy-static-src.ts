import path from "node:path"
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs"

/**
 * Copy contents from static-src to static directory
 * Used by both dev and build scripts to ensure static files are available
 */
export function copyStaticSrc(rootFolder: string, verbose = false): void {
  const STATIC_SRC = path.join(rootFolder, "src", "server", "static-src")
  const STATIC_DEST = path.join(rootFolder, "src", "server", "static")

  if (existsSync(STATIC_SRC)) {
    if (verbose) {
      console.log("📁 Copying static-src to static directory...")
    }

    // Clear existing contents of static directory
    if (existsSync(STATIC_DEST)) {
      const items = readdirSync(STATIC_DEST)
      for (const item of items) {
        rmSync(path.join(STATIC_DEST, item), { recursive: true, force: true })
      }
    } else {
      // Create static directory if it doesn't exist
      mkdirSync(STATIC_DEST, { recursive: true })
    }

    cpSync(STATIC_SRC, STATIC_DEST, { recursive: true })
    if (verbose) {
      console.log("✅ Static-src copied to static directory")
    }
  } else if (verbose) {
    console.log("ℹ️  No static-src directory found, skipping copy")
  }
}
