# Static Assets

QuickDapp supports two types of static assets: files processed by Vite (images imported in React components) and passthrough files served directly (favicon, robots.txt, custom fonts).

## Where to Put Static Files

Static files that should be served directly without Vite processing go in `src/server/static-src/`. This is the source directory for assets like:

- `favicon.ico` — Site favicon
- `robots.txt` — Search engine instructions
- Custom fonts or other files that need direct URL access

```
src/server/
├── static-src/         # YOUR static files go here
│   ├── favicon.ico     # Site favicon
│   └── robots.txt      # Search engine config
└── static/             # Generated - don't edit directly
```

## How It Works

Vite's `publicDir` is configured to point to `src/server/static-src/`:

```typescript
// From src/client/vite.config.ts
publicDir: path.resolve(__dirname, "../server/static-src"),
```

This means:
- **Development**: Vite serves files from `static-src/` directly at the root URL
- **Production build**: Vite copies `static-src/` contents to the build output alongside the compiled frontend

The build system also copies `static-src/` to `src/server/static/` via [`scripts/shared/copy-static-src.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/scripts/shared/copy-static-src.ts) for the server to serve in production.

The server uses ElysiaJS's static plugin to serve files from the `static/` directory:

```typescript
// From src/server/start-server.ts
const staticDir = serverConfig.STATIC_ASSETS_FOLDER ||
                  path.join(import.meta.dir, "static")
app.use(staticPlugin({
  assets: staticDir,
  prefix: "",
  indexHTML: true,
  alwaysStatic: true,
}))
```

The `indexHTML: true` option enables SPA routing—unmatched routes serve `index.html` so client-side routing works.

## Static vs Vite-Processed Assets

**Use `static-src/`** for files that need a predictable URL:
- Favicon, robots.txt, sitemap.xml
- Files referenced in `<head>` meta tags
- Assets loaded by external services

**Use Vite imports** for assets used in React components:
```tsx
// Vite handles optimization, hashing, and bundling
import logo from './images/logo.png'

function Header() {
  return <img src={logo} alt="Logo" />
}
```

Vite-imported assets get content hashing (`logo.abc123.png`) for cache busting. Files in `static-src/` keep their original names.

## Adding Custom Static Files

To add a static file:

1. Create the file in `src/server/static-src/`
2. Access it immediately at the root URL during dev (e.g., `/robots.txt`)
3. Run `bun run build` for production

Example `robots.txt`:
```
User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml
```

## Important Notes

- **Never edit `src/server/static/` directly** — It's regenerated on every build
- **Binary deployments** extract static files to a temp directory at runtime; the `STATIC_ASSETS_FOLDER` environment variable points to this location
