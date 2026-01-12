import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { useCreateToken, useTransactionStatus } from "../hooks/useTokenActions"
import { Button } from "./Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./Dialog"
import { ErrorMessageBox } from "./ErrorMessageBox"
import { Form, Input, Label } from "./Form"

interface CreateTokenFormData {
  name: string
  symbol: string
  decimals: number
  initialSupply: string
}

interface FormErrors {
  name?: string
  symbol?: string
  decimals?: string
  initialSupply?: string
}

export function CreateTokenDialog() {
  const [open, setOpen] = React.useState(false)
  const [formData, setFormData] = React.useState<CreateTokenFormData>({
    name: "",
    symbol: "",
    decimals: 18,
    initialSupply: "100",
  })
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [txHash, setTxHash] = React.useState<string>()
  const [submitError, setSubmitError] = React.useState<Error | null>(null)

  const createToken = useCreateToken()
  const txStatus = useTransactionStatus(txHash as `0x${string}`)
  const queryClient = useQueryClient()

  const validateForm = React.useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = "Token name is required"
    }

    if (!formData.symbol.trim()) {
      newErrors.symbol = "Token symbol is required"
    } else if (formData.symbol.length > 11) {
      newErrors.symbol = "Symbol must be 11 characters or less"
    }

    if (formData.decimals < 0 || formData.decimals > 18) {
      newErrors.decimals = "Decimals must be between 0 and 18"
    }

    if (!formData.initialSupply || parseFloat(formData.initialSupply) <= 0) {
      newErrors.initialSupply = "Initial supply must be greater than 0"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validateForm()) {
        return
      }

      // Clear any previous errors
      setSubmitError(null)

      try {
        const result = await createToken.mutateAsync({
          name: formData.name.trim(),
          symbol: formData.symbol.trim().toUpperCase(),
          decimals: formData.decimals,
          initialSupply: formData.initialSupply,
        })

        setTxHash(result.hash)
        console.log("txHash", result.hash)
      } catch (error) {
        console.error("Failed to create token:", error)
        setSubmitError(
          error instanceof Error ? error : new Error("Failed to create token"),
        )
      }
    },
    [validateForm, createToken, formData],
  )

  const handleInputChange =
    (field: keyof CreateTokenFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        field === "decimals" ? parseInt(e.target.value) || 0 : e.target.value
      setFormData((prev) => ({ ...prev, [field]: value }))

      // Clear error when user starts typing
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }

  const resetForm = React.useCallback(() => {
    setFormData({
      name: "",
      symbol: "",
      decimals: 18,
      initialSupply: "100",
    })
    setErrors({})
    setTxHash(undefined)
    setSubmitError(null)
  }, [])

  // Helper to convert error messages to user-friendly text
  const getErrorMessage = React.useCallback((error: Error): string => {
    const message = error.message.toLowerCase()

    if (
      message.includes("erc20invalidinput") ||
      message.includes("invalid input")
    ) {
      return "Invalid token parameters. Please check that decimals are greater than 0 and all fields are filled correctly."
    }

    if (message.includes("user rejected") || message.includes("user denied")) {
      return "Transaction was cancelled by user."
    }

    if (
      message.includes("insufficient funds") ||
      message.includes("insufficient balance")
    ) {
      return "Insufficient funds to create token. You need ETH to pay for gas fees."
    }

    if (message.includes("network")) {
      return "Network error. Please check your connection and try again."
    }

    // Return original message if we can't parse it
    return error.message || "Failed to create token"
  }, [])

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen)
      if (!newOpen) {
        resetForm()
      }
    },
    [resetForm],
  )

  // Close dialog when transaction is successful
  React.useEffect(() => {
    if (txStatus.isSuccess) {
      setTimeout(() => {
        handleOpenChange(false)
        queryClient.invalidateQueries({ queryKey: ["tokens"] })
      }, 2000)
    }
  }, [txStatus.isSuccess, handleOpenChange, queryClient])

  const isSubmitting = React.useMemo(
    () => createToken.isPending || txStatus.isLoading,
    [createToken.isPending, txStatus.isLoading],
  )

  const canSubmit = React.useMemo(
    () => !isSubmitting && !txHash,
    [isSubmitting, txHash],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Create New Token</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Token</DialogTitle>
          <DialogDescription>
            Deploy a new ERC20 token to the blockchain.
          </DialogDescription>
        </DialogHeader>

        {txHash ? (
          <div className="space-y-4">
            {txStatus.isLoading && (
              <div className="text-center">
                <p className="text-blue-400">Transaction submitted...</p>
                <p className="text-sm text-slate-400 mt-2">
                  Hash: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </p>
              </div>
            )}

            {txStatus.isSuccess && (
              <div className="text-center">
                <p className="text-green-400">✅ Token created successfully!</p>
                <p className="text-sm text-slate-400 mt-2">
                  Transaction confirmed
                </p>
              </div>
            )}

            {txStatus.isError && (
              <div className="text-center">
                <p className="text-red-400">❌ Transaction failed</p>
                <Button
                  variant="outline"
                  onClick={() => setTxHash(undefined)}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Form onSubmit={handleSubmit}>
            {submitError && (
              <ErrorMessageBox
                title="Failed to Create Token"
                message={getErrorMessage(submitError)}
                error={submitError}
                onDismiss={() => setSubmitError(null)}
                onRetry={() => setSubmitError(null)}
                className="mb-4"
              />
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" required>
                  Token Name
                </Label>
                <Input
                  id="name"
                  placeholder="My Awesome Token"
                  value={formData.name}
                  onChange={handleInputChange("name")}
                  error={errors.name}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="symbol" required>
                  Token Symbol
                </Label>
                <Input
                  id="symbol"
                  placeholder="MAT"
                  value={formData.symbol}
                  onChange={handleInputChange("symbol")}
                  error={errors.symbol}
                  maxLength={11}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="decimals">Decimals</Label>
                <Input
                  id="decimals"
                  type="number"
                  min="0"
                  max="18"
                  value={formData.decimals}
                  onChange={handleInputChange("decimals")}
                  error={errors.decimals}
                />
                <p className="text-xs text-slate-400">
                  Standard is 18 (like ETH)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialSupply" required>
                  Initial Supply
                </Label>
                <Input
                  id="initialSupply"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="100"
                  value={formData.initialSupply}
                  onChange={handleInputChange("initialSupply")}
                  error={errors.initialSupply}
                />
                <p className="text-xs text-slate-400">
                  You'll receive this amount when the token is created
                </p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmitting}
                disabled={!canSubmit}
              >
                {isSubmitting ? "Creating..." : "Create Token"}
              </Button>
            </DialogFooter>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
