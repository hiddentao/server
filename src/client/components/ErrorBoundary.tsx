import type { ReactNode } from "react"
import { Component } from "react"
import { ErrorMessageBox } from "./ErrorMessageBox"

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: any
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
        window.location.reload()
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
          <div className="max-w-md mx-auto">
            <ErrorMessageBox
              title="Application Error"
              message="Something went wrong and the application crashed."
              error={this.state.error || undefined}
              details={this.state.errorInfo?.componentStack}
              onRetry={handleRetry}
            />
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
