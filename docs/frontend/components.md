# Components

QuickDapp includes a small set of UI components built on Radix UI primitives with TailwindCSS styling. The focus is on essential functionality rather than a comprehensive design system.

## Base Components

[`Button`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/Button.tsx) provides variants (default, outline, ghost, error), sizes, and loading state. It uses the `cn()` utility for class merging and forwards refs properly.

[`Dialog`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/Dialog.tsx) wraps Radix UI's dialog primitive with consistent styling—dark background, blur overlay, and close button. The `DialogContent`, `DialogHeader`, `DialogTitle`, and `DialogDescription` components compose together for modal interfaces.

**Form components** in [`Form.tsx`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/Form.tsx) include `Input`, `Textarea`, `Label`, and `FormField`. `Input` and `Textarea` display validation errors below the field. `Label` supports a required indicator. These integrate with the custom [`useForm`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/hooks/useForm.ts) hook for validation.

[`Toast`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/Toast.tsx) provides temporary notification messages. The `ToastProvider` manages a list of toasts with auto-dismiss. Toast types include default, success, error, and warning with corresponding colors and icons.

## Layout

The application uses a simple layout with a fixed header and main content area. The [`Header`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/Header.tsx) component shows the logo, wallet connection button (when Web3 enabled), and notification indicator (when authenticated).

There's no sidebar—the application focuses on the main token management interface. Routing uses React Router with a single page currently ([`HomePage`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/pages/HomePage.tsx)).

```
┌─────────────────────────────────────┐
│ Header (fixed, 56px)                │
├─────────────────────────────────────┤
│                                     │
│ Main Content                        │
│                                     │
├─────────────────────────────────────┤
│ Footer                              │
└─────────────────────────────────────┘
```

## Application Components

[`ConnectWallet`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/ConnectWallet.tsx) uses RainbowKit's custom button API to render wallet connection UI. It shows a connect button when disconnected, account info when connected, and optionally a network selector.

**Token components** handle Web3 token operations:
- [`CreateTokenDialog`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/CreateTokenDialog.tsx) — Modal for deploying new ERC-20 tokens via the factory contract
- [`SendTokenDialog`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/SendTokenDialog.tsx) — Modal for transferring tokens to another address
- [`TokenList`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/TokenList.tsx) — Displays the user's tokens with balances
- [`ContractValue`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/ContractValue.tsx) — Shows values read from contracts

**Notification components** display real-time updates:
- [`NotificationsIndicator`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/notifications/NotificationsIndicator.tsx) — Bell icon in header with unread count badge
- [`NotificationsDialog`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/notifications/NotificationsDialog.tsx) — Full list of notifications with mark-as-read functionality
- [`NotificationComponents`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/notifications/NotificationComponents.tsx) — Individual renderers for different notification types

## Utility Components

[`Loading`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/Loading.tsx) shows a spinning indicator for async operations.

[`ErrorBoundary`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/ErrorBoundary.tsx) catches component errors and displays a fallback UI instead of crashing the application.

[`IfWalletConnected`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/IfWalletConnected.tsx) conditionally renders children only when a wallet is connected—useful for gating Web3-specific UI.

## Styling Approach

Components use TailwindCSS with the [`cn()`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/utils/cn.ts) utility. This combines `clsx` for conditional classes and `tailwind-merge` for deduplication:

```typescript
import { cn } from "../utils/cn"

<div className={cn(
  "base-styles",
  isActive && "active-styles",
  className
)} />
```

The theme is defined in [`globals.css`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/styles/globals.css) using Tailwind v4's `@theme` directive. Key colors include `--color-anchor` (cyan accent), `--color-background` (black), and `--color-foreground` (white).

Custom utilities like `btn-primary`, `card`, and `glow-effect` are defined in [`globals.css`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/styles/globals.css) for consistent styling patterns.
