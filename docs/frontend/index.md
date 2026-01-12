# Frontend

The QuickDapp frontend is a React 19 application built with Vite, TypeScript, and TailwindCSS. Web3 integration through RainbowKit and Wagmi is optional—the same codebase works with or without blockchain features.

## Technology Stack

Vite handles development and production builds with hot module replacement. TailwindCSS v4 provides styling with a dark theme and custom utility classes. Radix UI supplies accessible primitives for dialogs, popovers, and tooltips.

For data fetching, React Query manages server state with caching and background refetching. The GraphQL client uses `graphql-request` with queries defined in the shared folder.

When Web3 is enabled, RainbowKit provides wallet connection UI and Wagmi supplies React hooks for blockchain interactions. Viem handles the underlying Ethereum operations.

## Project Structure

```
src/client/
├── App.tsx              # Root with provider setup
├── components/          # UI components
├── contexts/            # AuthContext, SocketContext, CookieConsentContext
├── hooks/               # useForm, useTokens, useTokenActions, useNotifications
├── lib/                 # Socket client
├── config/              # Web3 configuration
├── pages/               # Page components
├── styles/              # Tailwind globals
└── utils/               # cn() helper
```

## Provider Structure

The [`App`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/App.tsx) component conditionally wraps content with Web3 providers based on configuration:

```tsx
// When WEB3_ENABLED=true
<WagmiProvider>
  <QueryClientProvider>
    <RainbowKitProvider>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            {/* routes */}
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </RainbowKitProvider>
  </QueryClientProvider>
</WagmiProvider>

// When WEB3_ENABLED=false
<QueryClientProvider>
  <AuthProvider>
    <SocketProvider>
      <ToastProvider>
        {/* routes */}
      </ToastProvider>
    </SocketProvider>
  </AuthProvider>
</QueryClientProvider>
```

Components work identically in either mode. The [`AuthContext`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/contexts/AuthContext.tsx) switches between SIWE authentication and email/OAuth based on the Web3 flag.

## Key Patterns

**State management** uses React Context for global state (auth, sockets, toasts) and React Query for server data. There's no Redux or external state library.

**Forms** use a custom hook-based validation system in [`useForm.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/hooks/useForm.ts). It supports sync and async validation with debouncing, without external form libraries.

**Styling** combines TailwindCSS utilities with the [`cn()`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/utils/cn.ts) helper for conditional classes. CSS Modules handle component-specific styles where needed.

**Configuration** comes from [`clientConfig`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/config/client.ts) in the shared folder. The build process injects environment values so they're available at runtime.

## Documentation

- [Components](./components.md) — UI component library
- [Forms](./forms.md) — Form handling and validation
- [Global](./global.md) — Context providers and global state
- [GraphQL](./graphql.md) — GraphQL client usage
- [Static Assets](./static-assets.md) — Serving static files (favicon, fonts, etc.)
- [Web3](./web3.md) — Blockchain integration (optional)
