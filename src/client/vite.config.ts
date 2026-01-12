import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { Plugin } from "vite"
import { defineConfig } from "vite"

// Import clientConfig from shared client.ts (this runs in Node.js context)
const { clientConfig } = require("../shared/config/client.ts")

// Plugin to inject config into HTML (for production builds)
function injectConfig(): Plugin {
  return {
    name: "inject-config",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        // Inject config script before closing body tag
        const configScript = `  <script>
    globalThis.__CONFIG__ = ${JSON.stringify(clientConfig)};
  </script>`

        return html.replace(
          "</body>",
          `${configScript}
</body>`,
        )
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), injectConfig()],
  publicDir: path.resolve(__dirname, "../server/static-src"),
  define: {
    "globalThis.__CONFIG__": JSON.stringify(clientConfig),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/graphql": "http://localhost:3000",
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
      },
    },
  },
})
