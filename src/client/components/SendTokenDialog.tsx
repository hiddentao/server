import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { formatUnits, isAddress } from "viem"
import {
  useTransactionStatus,
  useTransferToken,
} from "../hooks/useTokenActions"
import type { Token } from "../hooks/useTokens"
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
import { Form, Input, Label } from "./Form"

interface SendTokenDialogProps {
  token: Token
  children: React.ReactNode
}

interface TransferFormData {
  to: string
  amount: string
}

interface FormErrors {
  to?: string
  amount?: string
}

export function SendTokenDialog({ token, children }: SendTokenDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [formData, setFormData] = React.useState<TransferFormData>({
    to: "",
    amount: "",
  })
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [txHash, setTxHash] = React.useState<string>()

  const transferToken = useTransferToken()
  const txStatus = useTransactionStatus(txHash as `0x${string}`)
  const queryClient = useQueryClient()

  const maxBalance = formatUnits(BigInt(token.balance), token.decimals)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.to.trim()) {
      newErrors.to = "Recipient address is required"
    } else if (!isAddress(formData.to)) {
      newErrors.to = "Invalid Ethereum address"
    }

    if (!formData.amount.trim()) {
      newErrors.amount = "Amount is required"
    } else {
      const amount = parseFloat(formData.amount)
      const balance = parseFloat(maxBalance)

      if (amount <= 0) {
        newErrors.amount = "Amount must be greater than 0"
      } else if (amount > balance) {
        newErrors.amount = `Insufficient balance. Maximum: ${balance}`
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      const result = await transferToken.mutateAsync({
        tokenAddress: token.address,
        to: formData.to.trim(),
        amount: formData.amount,
        decimals: token.decimals,
      })

      setTxHash(result.hash)
    } catch (error) {
      console.error("Failed to transfer token:", error)
    }
  }

  const handleInputChange =
    (field: keyof TransferFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }))

      // Clear error when user starts typing
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }

  const setMaxAmount = () => {
    setFormData((prev) => ({ ...prev, amount: maxBalance }))
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: undefined }))
    }
  }

  const resetForm = React.useCallback(() => {
    setFormData({ to: "", amount: "" })
    setErrors({})
    setTxHash(undefined)
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

  const isSubmitting = transferToken.isPending || txStatus.isLoading
  const canSubmit = !isSubmitting && !txHash

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send {token.symbol}</DialogTitle>
          <DialogDescription>
            Transfer {token.name} tokens to another address.
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
                <p className="text-green-400">✅ Transfer successful!</p>
                <p className="text-sm text-slate-400 mt-2">
                  Tokens have been sent
                </p>
              </div>
            )}

            {txStatus.isError && (
              <div className="text-center">
                <p className="text-red-400">❌ Transfer failed</p>
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
          <div className="space-y-4">
            {/* Token info */}
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-white">{token.name}</p>
                  <p className="text-sm text-slate-400">{token.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">
                    {parseFloat(maxBalance).toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-400">Available</p>
                </div>
              </div>
            </div>

            <Form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="to" required>
                    Recipient Address
                  </Label>
                  <Input
                    id="to"
                    placeholder="0x..."
                    value={formData.to}
                    onChange={handleInputChange("to")}
                    error={errors.to}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="amount" required>
                      Amount
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={setMaxAmount}
                      className="h-auto p-1 text-xs"
                    >
                      MAX
                    </Button>
                  </div>
                  <Input
                    id="amount"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.0"
                    value={formData.amount}
                    onChange={handleInputChange("amount")}
                    error={errors.amount}
                  />
                  <p className="text-xs text-slate-400">
                    Available balance: {parseFloat(maxBalance).toLocaleString()}{" "}
                    {token.symbol}
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
                  {isSubmitting ? "Sending..." : "Send Tokens"}
                </Button>
              </DialogFooter>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
