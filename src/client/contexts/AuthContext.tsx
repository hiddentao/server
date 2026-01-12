import { clientConfig } from "@shared/config/client"
import { getGraphQLClient, setAuthToken } from "@shared/graphql/client"
import {
  AUTHENTICATE_WITH_SIWE,
  GENERATE_SIWE_MESSAGE,
} from "@shared/graphql/mutations"
import { VALIDATE_TOKEN } from "@shared/graphql/queries"
import type { ReactNode } from "react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import { useAccount, useChainId, useSignMessage } from "wagmi"

interface SiweMessageResult {
  message: string
  nonce: string
}

interface AuthResult {
  success: boolean
  token: string | null
  web3Wallet: string | null
  error: string | null
}

// Constants
const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  AUTH_WEB3_WALLET: "auth_web3_wallet",
} as const

// Helper functions for localStorage operations
const saveAuthToStorage = (token: string, web3Wallet: string | null) => {
  console.log("Saving auth to localStorage:", { token, web3Wallet })
  localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token)
  if (web3Wallet) {
    localStorage.setItem(STORAGE_KEYS.AUTH_WEB3_WALLET, web3Wallet)
  } else {
    localStorage.removeItem(STORAGE_KEYS.AUTH_WEB3_WALLET)
  }
}

const getAuthFromStorage = () => {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
  const web3Wallet = localStorage.getItem(STORAGE_KEYS.AUTH_WEB3_WALLET)
  console.log("Getting auth from localStorage:", { token, web3Wallet })
  return { token, web3Wallet }
}

const clearAuthFromStorage = () => {
  console.log("Clearing auth from localStorage")
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.AUTH_WEB3_WALLET)
}

// Auth status enum
export enum AuthStatus {
  IDLE = "idle",
  RESTORING = "restoring",
  WAITING_FOR_WALLET = "waiting_for_wallet",
  AUTHENTICATING = "authenticating",
  AUTHENTICATED = "authenticated",
  REJECTED = "rejected",
  ERROR = "error",
}

// Auth action types enum
enum AuthActionType {
  AUTH_START = "AUTH_START",
  AUTH_SUCCESS = "AUTH_SUCCESS",
  AUTH_REJECTED = "AUTH_REJECTED",
  AUTH_ERROR = "AUTH_ERROR",
  LOGOUT = "LOGOUT",
  RESTORE_START = "RESTORE_START",
  RESTORE_SUCCESS = "RESTORE_SUCCESS",
  RESTORE_COMPLETE = "RESTORE_COMPLETE",
  WALLET_READY = "WALLET_READY",
  RESET_TO_IDLE = "RESET_TO_IDLE",
}

// State Machine Definition
type AuthState =
  | { status: AuthStatus.IDLE }
  | { status: AuthStatus.RESTORING }
  | {
      status: AuthStatus.WAITING_FOR_WALLET
      token: string
      web3Wallet: string
    }
  | { status: AuthStatus.AUTHENTICATING }
  | {
      status: AuthStatus.AUTHENTICATED
      token: string
      web3Wallet: string
    }
  | { status: AuthStatus.REJECTED; error: string }
  | { status: AuthStatus.ERROR; error: string }

type AuthAction =
  | { type: AuthActionType.AUTH_START }
  | {
      type: AuthActionType.AUTH_SUCCESS
      payload: { token: string; web3Wallet: string }
    }
  | { type: AuthActionType.AUTH_REJECTED; payload: { error: string } }
  | { type: AuthActionType.AUTH_ERROR; payload: { error: string } }
  | { type: AuthActionType.LOGOUT }
  | { type: AuthActionType.RESTORE_START }
  | {
      type: AuthActionType.RESTORE_SUCCESS
      payload: { token: string; web3Wallet: string }
    }
  | { type: AuthActionType.RESTORE_COMPLETE }
  | { type: AuthActionType.WALLET_READY }
  | { type: AuthActionType.RESET_TO_IDLE }

// Error handling utilities
const isUserRejection = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    (error.message.includes("User rejected") ||
      error.message.includes("UserRejectedRequestError"))
  )
}

const isConnectorNotReady = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    error.message.includes("getChainId is not a function")
  )
}

const getAuthErrorMessage = (error: unknown): string => {
  if (isUserRejection(error)) {
    return "Authentication cancelled by user"
  }
  if (isConnectorNotReady(error)) {
    return "Wallet connector not ready, please try connecting again"
  }
  return error instanceof Error ? error.message : "Authentication failed"
}

// State machine reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case AuthActionType.AUTH_START:
      return { status: AuthStatus.AUTHENTICATING }

    case AuthActionType.AUTH_SUCCESS:
      return {
        status: AuthStatus.AUTHENTICATED,
        token: action.payload.token,
        web3Wallet: action.payload.web3Wallet,
      }

    case AuthActionType.AUTH_REJECTED:
      return {
        status: AuthStatus.REJECTED,
        error: action.payload.error,
      }

    case AuthActionType.AUTH_ERROR:
      return {
        status: AuthStatus.ERROR,
        error: action.payload.error,
      }

    case AuthActionType.LOGOUT:
      return { status: AuthStatus.IDLE }

    case AuthActionType.RESTORE_START:
      return { status: AuthStatus.RESTORING }

    case AuthActionType.RESTORE_SUCCESS:
      return {
        status: AuthStatus.WAITING_FOR_WALLET,
        token: action.payload.token,
        web3Wallet: action.payload.web3Wallet,
      }

    case AuthActionType.RESTORE_COMPLETE:
      return { status: AuthStatus.IDLE }

    case AuthActionType.WALLET_READY:
      // Only transition from WAITING_FOR_WALLET to AUTHENTICATED
      if (state.status === AuthStatus.WAITING_FOR_WALLET) {
        return {
          status: AuthStatus.AUTHENTICATED,
          token: state.token,
          web3Wallet: state.web3Wallet,
        }
      }
      return state

    case AuthActionType.RESET_TO_IDLE:
      return { status: AuthStatus.IDLE }

    default:
      return state
  }
}

const initialState: AuthState = {
  status: AuthStatus.IDLE,
}

interface AuthContextValue {
  // State
  isAuthenticated: boolean
  isLoading: boolean
  error: Error | null
  authToken: string | null
  walletAddress: string | null
  userRejectedAuth: boolean

  // Methods
  authenticate: (address: string) => Promise<AuthResult>
  logout: () => void
  restoreAuth: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

// Web3 Auth Provider - uses wagmi hooks for SIWE authentication
function Web3AuthProvider({ children }: AuthProviderProps) {
  const [authState, dispatch] = useReducer(authReducer, initialState)
  const [lastRejectedAddress, setLastRejectedAddress] = useState<string | null>(
    null,
  )
  const [wasConnected, setWasConnected] = useState(false)
  const restorationStarted = useRef(false)
  const { address, isConnected, connector, status } = useAccount()
  const chainId = useChainId()
  const { signMessageAsync } = useSignMessage()

  // Simplified authentication flow using state machine
  const authenticate = useCallback(
    async (address: string): Promise<AuthResult> => {
      // Prevent concurrent authentication attempts
      if (authState.status === AuthStatus.AUTHENTICATING) {
        console.log("Authentication already in progress, skipping...")
        return {
          success: false,
          token: null,
          web3Wallet: null,
          error: "Authentication already in progress",
        }
      }

      dispatch({ type: AuthActionType.AUTH_START })

      try {
        console.log("Starting authentication for address:", address)

        // Step 1: Generate SIWE message
        console.log("Generating SIWE message...")
        const graphqlClient = getGraphQLClient()
        const domain = window.location.host
        const messageResponse = (await graphqlClient.request(
          GENERATE_SIWE_MESSAGE,
          {
            address,
            chainId,
            domain,
          },
        )) as { generateSiweMessage: SiweMessageResult }
        const { message } = messageResponse.generateSiweMessage
        console.log("SIWE message generated successfully")

        // Step 2: Sign the message with the user's wallet
        console.log("Requesting signature from wallet...")
        const signature = await signMessageAsync({ message })
        console.log("Message signed successfully")

        // Step 3: Authenticate with the signed message
        console.log("Authenticating with server...")
        const authResponse = (await graphqlClient.request(
          AUTHENTICATE_WITH_SIWE,
          {
            message,
            signature,
          },
        )) as { authenticateWithSiwe: AuthResult }
        const result = authResponse.authenticateWithSiwe
        console.log("Authentication completed:", result.success)

        if (result.success && result.token) {
          const payload = {
            token: result.token,
            web3Wallet: result.web3Wallet || address,
          }
          dispatch({ type: AuthActionType.AUTH_SUCCESS, payload })

          // Clear rejection tracking on successful authentication
          setLastRejectedAddress(null)

          // Persist to localStorage and set GraphQL client token
          saveAuthToStorage(result.token, payload.web3Wallet)
          setAuthToken(result.token)
        } else {
          dispatch({
            type: AuthActionType.AUTH_ERROR,
            payload: { error: result.error || "Authentication failed" },
          })
        }

        return result
      } catch (error) {
        console.error("Authentication failed:", error)

        const errorMessage = getAuthErrorMessage(error)
        if (isUserRejection(error)) {
          setLastRejectedAddress(address)
          dispatch({
            type: AuthActionType.AUTH_REJECTED,
            payload: { error: errorMessage },
          })
        } else {
          dispatch({
            type: AuthActionType.AUTH_ERROR,
            payload: { error: errorMessage },
          })
        }

        return {
          success: false,
          token: null,
          web3Wallet: null,
          error: errorMessage,
        }
      }
    },
    [authState.status, chainId, signMessageAsync],
  )

  // Logout function
  const logout = useCallback(() => {
    setAuthToken(null)
    setLastRejectedAddress(null)
    dispatch({ type: AuthActionType.LOGOUT })
    clearAuthFromStorage()
  }, [])

  // Restore authentication from localStorage
  const restoreAuth = useCallback(async () => {
    dispatch({ type: AuthActionType.RESTORE_START })

    const { token, web3Wallet } = getAuthFromStorage()

    if (token && web3Wallet) {
      console.log("Restoring auth from localStorage for wallet:", web3Wallet)

      try {
        // Validate the token with the server
        console.log("Validating stored token with server...")
        setAuthToken(token) // Set token before making the request

        const graphqlClient = getGraphQLClient()
        const response = (await graphqlClient.request(VALIDATE_TOKEN)) as {
          validateToken: { valid: boolean; web3Wallet: string | null }
        }

        if (response.validateToken.valid && response.validateToken.web3Wallet) {
          console.log(
            "Token is valid, restoring auth for wallet:",
            response.validateToken.web3Wallet,
          )
          dispatch({
            type: AuthActionType.RESTORE_SUCCESS,
            payload: { token, web3Wallet: response.validateToken.web3Wallet },
          })
        } else {
          console.log("Token is invalid, clearing stored auth")
          // Token is invalid, clear it
          clearAuthFromStorage()
          setAuthToken(null)
          dispatch({ type: AuthActionType.RESTORE_COMPLETE })
        }
      } catch (error) {
        console.log("Error validating token, clearing stored auth:", error)
        // Error validating token, clear it
        clearAuthFromStorage()
        setAuthToken(null)
        dispatch({ type: AuthActionType.RESTORE_COMPLETE })
      }
    } else {
      dispatch({ type: AuthActionType.RESTORE_COMPLETE })
    }
  }, [])

  // State derivation helpers - memoized
  const isAuthenticated = useMemo(
    () => authState.status === AuthStatus.AUTHENTICATED,
    [authState.status],
  )
  const isAuthenticating = useMemo(
    () =>
      authState.status === AuthStatus.AUTHENTICATING ||
      authState.status === AuthStatus.RESTORING,
    [authState.status],
  )
  const userRejectedAuth = useMemo(
    () => authState.status === AuthStatus.REJECTED,
    [authState.status],
  )

  // Effect 1: Token restoration (runs once on mount)
  useEffect(() => {
    if (authState.status === AuthStatus.IDLE && !restorationStarted.current) {
      restorationStarted.current = true
      restoreAuth().catch((error) => {
        console.error("Error during auth restoration:", error)
        dispatch({ type: AuthActionType.RESTORE_COMPLETE })
      })
    }
  }, [authState.status, restoreAuth])

  // Effect 2: Track wallet connection state
  useEffect(() => {
    if (isConnected && !wasConnected) {
      setWasConnected(true)
    } else if (!isConnected && wasConnected) {
      setWasConnected(false)
    }
  }, [isConnected, wasConnected])

  // Effect 3: Handle wallet ready state
  useEffect(() => {
    if (
      authState.status === AuthStatus.WAITING_FOR_WALLET &&
      isConnected &&
      address &&
      status === "connected"
    ) {
      console.log("Wallet is ready, transitioning to authenticated")
      dispatch({ type: AuthActionType.WALLET_READY })
    }
  }, [authState.status, isConnected, address, status])

  // Effect 4: Handle wallet disconnection (only after being connected)
  useEffect(() => {
    if (
      !isConnected &&
      wasConnected &&
      isAuthenticated &&
      authState.status === AuthStatus.AUTHENTICATED
    ) {
      console.log("Wallet disconnected after being connected, logging out")
      logout()
    }
  }, [isConnected, wasConnected, isAuthenticated, authState.status, logout])

  // Effect 5: Handle auto-authentication for new users
  useEffect(() => {
    const addressWasRejected = lastRejectedAddress === address

    if (
      authState.status === AuthStatus.IDLE &&
      isConnected &&
      address &&
      status === "connected" &&
      connector &&
      !addressWasRejected
    ) {
      console.log("Auto-authenticating new user with wallet:", address)
      // Add a small delay to ensure connector is fully ready
      const timeoutId = setTimeout(() => {
        authenticate(address)
      }, 200)
      return () => clearTimeout(timeoutId)
    }
  }, [
    authState.status,
    isConnected,
    address,
    status,
    connector,
    lastRejectedAddress,
    authenticate,
  ])

  // Effect 6: Reset rejection tracking when address changes
  useEffect(() => {
    if (address && lastRejectedAddress && lastRejectedAddress !== address) {
      console.log("Different wallet connected, clearing rejection tracking")
      setLastRejectedAddress(null)
    }
  }, [address, lastRejectedAddress])

  // Memoized error derivation
  const error = useMemo(() => {
    if (
      authState.status === AuthStatus.ERROR ||
      authState.status === AuthStatus.REJECTED
    ) {
      return new Error(authState.error)
    }
    return null
  }, [authState])

  // Memoized token and wallet derivation
  const authToken = useMemo(() => {
    if (
      authState.status === AuthStatus.AUTHENTICATED ||
      authState.status === AuthStatus.WAITING_FOR_WALLET
    ) {
      return authState.token
    }
    return null
  }, [authState])

  const walletAddress = useMemo(() => {
    if (
      authState.status === AuthStatus.AUTHENTICATED ||
      authState.status === AuthStatus.WAITING_FOR_WALLET
    ) {
      return authState.web3Wallet
    }
    return null
  }, [authState])

  const contextValue = useMemo(
    () => ({
      // State
      isAuthenticated,
      isLoading: isAuthenticating,
      error,
      authToken,
      walletAddress,
      userRejectedAuth,

      // Methods
      authenticate,
      logout,
      restoreAuth,
    }),
    [
      isAuthenticated,
      isAuthenticating,
      error,
      authToken,
      walletAddress,
      userRejectedAuth,
      authenticate,
      logout,
      restoreAuth,
    ],
  )

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  )
}

// Non-Web3 Auth Provider - used when WEB3_ENABLED=false
// Provides a minimal auth context for email/OAuth authentication
function NonWeb3AuthProvider({ children }: AuthProviderProps) {
  const [authState, dispatch] = useReducer(authReducer, initialState)
  const restorationStarted = useRef(false)

  // Logout function
  const logout = useCallback(() => {
    setAuthToken(null)
    dispatch({ type: AuthActionType.LOGOUT })
    clearAuthFromStorage()
  }, [])

  // Restore authentication from localStorage (for OAuth/email tokens)
  const restoreAuth = useCallback(async () => {
    dispatch({ type: AuthActionType.RESTORE_START })

    const { token, web3Wallet } = getAuthFromStorage()

    if (token) {
      try {
        setAuthToken(token)
        const graphqlClient = getGraphQLClient()
        const response = (await graphqlClient.request(VALIDATE_TOKEN)) as {
          validateToken: { valid: boolean; web3Wallet: string | null }
        }

        if (response.validateToken.valid) {
          dispatch({
            type: AuthActionType.AUTH_SUCCESS,
            payload: { token, web3Wallet: web3Wallet || "" },
          })
        } else {
          clearAuthFromStorage()
          setAuthToken(null)
          dispatch({ type: AuthActionType.RESTORE_COMPLETE })
        }
      } catch {
        clearAuthFromStorage()
        setAuthToken(null)
        dispatch({ type: AuthActionType.RESTORE_COMPLETE })
      }
    } else {
      dispatch({ type: AuthActionType.RESTORE_COMPLETE })
    }
  }, [])

  // Authenticate stub - Web3 auth is not available
  const authenticate = useCallback(async (): Promise<AuthResult> => {
    return {
      success: false,
      token: null,
      web3Wallet: null,
      error: "Web3 authentication is not enabled",
    }
  }, [])

  // Effect: Token restoration on mount
  useEffect(() => {
    if (authState.status === AuthStatus.IDLE && !restorationStarted.current) {
      restorationStarted.current = true
      restoreAuth().catch(() => {
        dispatch({ type: AuthActionType.RESTORE_COMPLETE })
      })
    }
  }, [authState.status, restoreAuth])

  const isAuthenticated = authState.status === AuthStatus.AUTHENTICATED
  const isLoading =
    authState.status === AuthStatus.AUTHENTICATING ||
    authState.status === AuthStatus.RESTORING

  const contextValue = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      error: null,
      authToken:
        authState.status === AuthStatus.AUTHENTICATED ? authState.token : null,
      walletAddress: null,
      userRejectedAuth: false,
      authenticate,
      logout,
      restoreAuth,
    }),
    [isAuthenticated, isLoading, authState, authenticate, logout, restoreAuth],
  )

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  )
}

// Exported AuthProvider - chooses the right provider based on WEB3_ENABLED
export function AuthProvider({ children }: AuthProviderProps) {
  if (clientConfig.WEB3_ENABLED) {
    return <Web3AuthProvider>{children}</Web3AuthProvider>
  }
  return <NonWeb3AuthProvider>{children}</NonWeb3AuthProvider>
}

// Hook to use the auth context
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider")
  }
  return context
}
