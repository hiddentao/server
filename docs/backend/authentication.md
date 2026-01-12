# Authentication

QuickDapp uses stateless JWT authentication with multiple provider options. Users can sign in with their Ethereum wallet (SIWE), email verification codes, or OAuth providers. All flows result in a JWT token that the client sends with subsequent requests.

## How It Works

Authentication state lives entirely in the JWT—there's no session table. When a request arrives with an Authorization header, the server verifies the token signature and extracts the user ID. Tokens expire after 24 hours.

The `userAuth` table links authentication methods to users. A single user can have multiple auth methods (wallet address, email, OAuth accounts), all pointing to the same user record. This separation allows adding new sign-in options without changing the user model.

## SIWE Authentication (Web3)

Sign-In With Ethereum lets users authenticate by signing a message with their wallet. The flow:

1. Client calls `generateSiweMessage` with the wallet address, chain ID, and domain
2. Server creates a SIWE message containing a random nonce and returns it
3. User signs the message in their wallet
4. Client calls `authenticateWithSiwe` with the message and signature
5. Server verifies the signature using the `siwe` library, creates or finds the user, and returns a JWT

The server validates that the domain matches `WEB3_ALLOWED_SIWE_ORIGINS` to prevent phishing attacks where a malicious site tries to use a signature meant for another domain.

## Email Authentication

Email verification uses time-limited codes sent to the user's address:

1. Client calls `sendEmailVerificationCode` with the email address
2. Server generates a random code, encrypts it into a blob, and emails the code
3. User enters the code they received
4. Client calls `authenticateWithEmail` with the email, code, and blob
5. Server decrypts and verifies the code, creates or finds the user, and returns a JWT

The blob contains the encrypted code and expiration time. This stateless approach avoids storing verification codes in the database.

## OAuth Authentication

QuickDapp supports six OAuth providers: Google, Facebook, GitHub, X (Twitter), TikTok, and LinkedIn. The flow:

1. Client calls `getOAuthLoginUrl` with the provider name and redirect URL
2. Server generates an encrypted state containing PKCE challenge and redirect info
3. User is redirected to the OAuth provider
4. After authorization, provider redirects to `/auth/callback/:provider`
5. Server exchanges the code for tokens, fetches user info, creates or finds the user
6. Server returns an HTML page that stores the JWT and redirects back to the app

Each provider requires client ID and secret configured in environment variables. Some providers (Google, X, TikTok) use PKCE for additional security.

## JWT Structure

Tokens are signed with HS256 using `SESSION_ENCRYPTION_KEY`. The payload includes:

- `type: "auth"` — Token type identifier
- `userId` — Database user ID
- `web3_wallet` — Wallet address if authenticated via SIWE
- `iat`, `iatMs` — Issue timestamp
- `jti` — Unique token ID

The auth service provides `generateToken()`, `verifyToken()`, and `extractBearerToken()` functions for working with tokens.

## Protected Operations

GraphQL operations marked with `@auth` require a valid token. The GraphQL handler checks for the directive and validates the token before running resolvers. Unauthenticated requests receive an error with `extensions.code = "UNAUTHORIZED"`.

Users can be disabled by setting `users.disabled = true`. Disabled users receive `"ACCOUNT_DISABLED"` errors when trying to access protected operations.

See [`src/server/auth/index.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/auth/index.ts) for the core authentication logic, [`src/server/auth/oauth.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/auth/oauth.ts) for OAuth implementation, and [`src/server/auth/oauth-routes.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/auth/oauth-routes.ts) for the callback handler.
