# Global State

QuickDapp uses React Context for global state management. The application separates concerns into focused providers: authentication, WebSocket connections, and toast notifications. Each handles one responsibility and exposes a hook for components to access its data.

## Provider Structure

The [`App.tsx`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/App.tsx) nests providers to make them available throughout the application. When Web3 is enabled, the stack includes Wagmi and RainbowKit for wallet connections:

```tsx
// Web3 enabled
<WagmiProvider config={web3Config}>
  <QueryClientProvider client={queryClient}>
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

// Web3 disabled
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <SocketProvider>
      <ToastProvider>
        {/* routes */}
      </ToastProvider>
    </SocketProvider>
  </AuthProvider>
</QueryClientProvider>
```

The `WEB3_ENABLED` config flag determines which structure is used. Both share the same inner providers, so components work identically regardless of Web3 mode.

## Authentication Context

The [`AuthContext`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/contexts/AuthContext.tsx) manages SIWE (Sign-In With Ethereum) authentication when Web3 is enabled, or provides a minimal auth shell for email/OAuth when disabled. It uses a state machine to track the authentication lifecycle.

```typescript
interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  error: Error | null
  authToken: string | null
  walletAddress: string | null
  userRejectedAuth: boolean
  authenticate: (address: string) => Promise<AuthResult>
  logout: () => void
  restoreAuth: () => void
}
```

The authentication flow works as follows: when a wallet connects, the context generates a SIWE message from the server, prompts the user to sign it, then sends the signature for verification. On success, the JWT token is stored in localStorage and attached to GraphQL requests.

The context tracks several states: `IDLE`, `RESTORING` (checking for existing session), `WAITING_FOR_WALLET`, `AUTHENTICATING`, `AUTHENTICATED`, `REJECTED` (user cancelled signature), and `ERROR`. This state machine prevents race conditions and handles edge cases like wallet disconnection mid-auth.

If the wallet disconnects after authentication, the user is automatically logged out. If they previously rejected signing, the context remembers and won't auto-prompt again until they connect a different wallet.

Access the context via `useAuthContext()`.

## Socket Context

The [`SocketProvider`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/contexts/SocketContext.tsx) manages WebSocket connections for real-time updates. It initializes after auth loading completes and automatically reconnects with the appropriate token when authentication state changes.

```typescript
interface SocketContextValue {
  connected: boolean
  subscribe: (type: WebSocketMessageType, handler: (message: WebSocketMessage) => void) => () => void
}
```

When a user authenticates, the socket reconnects with their JWT to establish an authenticated session. When they log out, it reconnects without a token. The `subscribe()` method returns an unsubscribe function for cleanup.

Access the context via `useSocket()`.

## Toast Notifications

The [`ToastProvider`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/Toast.tsx) manages temporary notification messages displayed in the UI. Toasts have types (default, success, error, warning), optional titles and descriptions, and auto-dismiss after a configurable duration.

```typescript
interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}
```

Toasts auto-dismiss after 5 seconds by default. The container renders in the top-right corner with slide-in animations.

Access the context via `useToast()`.

## Notification Hook

The [`useNotifications`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/hooks/useNotifications.ts) hook subscribes to real-time notification events from the WebSocket connection. It wraps the socket subscription for the `NotificationReceived` message type.

```typescript
useNotifications({
  onNotificationReceived: (notification) => {
    // Handle notification
  }
})
```

This hook provides a cleaner API than directly subscribing to socket messages for notifications.

## Cookie Consent (Optional)

The [`CookieConsentProvider`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/contexts/CookieConsentContext.tsx) tracks whether users have accepted or declined cookies. It shows a banner component and persists the choice to localStorage.

```typescript
interface CookieConsentContextValue {
  consent: "accepted" | "declined" | null
  hasConsented: boolean
  isAccepted: boolean
  isDeclined: boolean
  acceptCookies: () => void
  declineCookies: () => void
  resetConsent: () => void
}
```

This provider is not included in the default [`App.tsx`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/App.tsx) but can be added when needed for GDPR compliance.

Access via `useCookieConsent()`.
