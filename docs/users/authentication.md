# Authentication

QuickDapp uses stateless JWT authentication with three provider options: SIWE (wallet signing), email verification, and OAuth. This page covers the authentication flows in detail.

## JWT Tokens

All authentication methods produce a JWT token signed with `SESSION_ENCRYPTION_KEY`. The token contains:

```typescript
{
  type: "auth",
  userId: number,
  web3_wallet?: string,  // Present for SIWE auth
  iat: number,
  iatMs: number,
  jti: string
}
```

Tokens expire after 24 hours. There's no session table—authentication state lives entirely in the token. The server verifies the signature and extracts the user ID on each request.

## SIWE Authentication

Sign-In With Ethereum works through wallet message signing:

1. Client calls `generateSiweMessage` with wallet address, chain ID, and domain
2. Server creates a SIWE-compliant message with a random nonce
3. User signs the message in their wallet (MetaMask, WalletConnect, etc.)
4. Client calls `authenticateWithSiwe` with the message and signature
5. Server verifies the signature using the `siwe` library
6. Server finds or creates the user and returns a JWT

The [`AuthContext`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/contexts/AuthContext.tsx) handles this flow automatically. It uses a state machine to track progress and handles edge cases like wallet disconnection mid-auth.

Domain validation prevents phishing. The server checks that the SIWE message domain matches `WEB3_ALLOWED_SIWE_ORIGINS`. A malicious site can't reuse a signature meant for your application.

## Email Authentication

Email verification uses encrypted, stateless codes:

1. Client calls `sendEmailVerificationCode` with email address
2. Server generates a random code and encrypts it into a blob containing the code and expiration
3. Server sends the code via email
4. User enters the code they received
5. Client calls `authenticateWithEmail` with email, code, and blob
6. Server decrypts the blob, verifies the code matches and hasn't expired
7. Server finds or creates the user and returns a JWT

The blob approach means no database storage for pending verifications. Codes expire after a short window (typically 10 minutes).

Email configuration requires `EMAIL_*` environment variables for SMTP settings.

## OAuth Authentication

Six OAuth providers are supported: Google, Facebook, GitHub, X (Twitter), TikTok, and LinkedIn. The flow:

1. Client calls `getOAuthLoginUrl` with provider name and redirect URL
2. Server generates encrypted state containing PKCE challenge and redirect info
3. User is redirected to the OAuth provider's authorization page
4. After authorization, provider redirects to `/auth/callback/:provider`
5. Server exchanges the authorization code for tokens
6. Server fetches user info from the provider's API
7. Server finds or creates the user based on provider user ID
8. Server returns an HTML page that stores the JWT and redirects to the app

Each provider requires configuration:

```bash
# Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# GitHub
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Similar for Facebook, X, TikTok, LinkedIn
```

The OAuth implementation uses the Arctic library and handles PKCE automatically for providers that support it.

## Token Validation

Protected GraphQL operations use the `@auth` directive. The handler:

1. Extracts the Bearer token from the Authorization header
2. Verifies the JWT signature
3. Checks token expiration
4. Loads the user from the database
5. Checks the `disabled` flag
6. Attaches the user to the resolver context

Invalid or expired tokens return `UNAUTHORIZED`. Disabled users return `ACCOUNT_DISABLED`.

## Frontend Integration

The [`AuthContext`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/contexts/AuthContext.tsx) exposes:

- `isAuthenticated` — Whether the user is logged in
- `isLoading` — Loading state during auth operations
- `error` — Error message from failed auth attempts
- `authToken` — The current JWT (null if not authenticated)
- `walletAddress` — Connected wallet address (SIWE only)
- `userRejectedAuth` — True if user rejected wallet signature
- `authenticate(address)` — Trigger SIWE auth for connected wallet
- `logout()` — Clear auth state
- `restoreAuth()` — Attempt to restore auth from stored token

For non-Web3 apps, use the email or OAuth flows directly through GraphQL mutations.

## Security

**Encryption Key**: The `SESSION_ENCRYPTION_KEY` must be 32+ characters and kept secret. It signs JWTs and encrypts OAuth state.

**HTTPS**: Always use HTTPS in production. Tokens sent over HTTP can be intercepted.

**Domain Validation**: SIWE messages include the domain. Configure `WEB3_ALLOWED_SIWE_ORIGINS` to match your deployment domains.

**Token Storage**: The frontend stores tokens in localStorage. For higher security requirements, consider httpOnly cookies with CSRF protection.

See [`src/server/auth/`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/auth/) for the complete authentication implementation.
