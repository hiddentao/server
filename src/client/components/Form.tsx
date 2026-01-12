import * as LabelPrimitive from "@radix-ui/react-label"
import * as React from "react"
import type { FieldApi } from "../hooks/useForm"
import { cn } from "../utils/cn"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

// Input component
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-anchor focus:outline-none focus:ring-1 focus:ring-anchor disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500",
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    )
  },
)
Input.displayName = "Input"

// Textarea component
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-anchor focus:outline-none focus:ring-1 focus:ring-anchor disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500",
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    )
  },
)
Textarea.displayName = "Textarea"

// Label component using Radix UI
export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & {
    required?: boolean
  }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium text-white leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  >
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </LabelPrimitive.Root>
))
Label.displayName = LabelPrimitive.Root.displayName

// Form field wrapper
export interface FormFieldProps {
  label?: string
  required?: boolean
  error?: string
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  required,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label required={required}>{label}</Label>}
      {children}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

// Form component
export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode
}

export function Form({ className, children, ...props }: FormProps) {
  return (
    <form className={cn("space-y-4", className)} {...props}>
      {children}
    </form>
  )
}

// Field Error Component
export interface FieldErrorProps {
  error?: string
  className?: string
}

export function FieldError({ error, className }: FieldErrorProps) {
  return error ? (
    <p className={cn("text-sm text-red-500 mt-1", className)}>{error}</p>
  ) : null
}

// Field Suffix Component (validation indicator)
export interface FieldSuffixProps {
  field: FieldApi<any>
  hideValidationIndicator?: boolean
}

export function FieldSuffix({
  field,
  hideValidationIndicator,
}: FieldSuffixProps) {
  return (
    <>
      {field.isValidating && !hideValidationIndicator ? (
        <span className="inline-block ml-2 text-blue-400 animate-spin">⟳</span>
      ) : null}
    </>
  )
}

// Number Input Component for useField integration
export interface NumberInputProps {
  field: FieldApi<string>
  label?: string
  required?: boolean
  placeholder?: string
  min?: number
  max?: number
  step?: number
  className?: string
  hideValidationIndicator?: boolean
  disabled?: boolean
}

export function NumberInput({
  field,
  label,
  required,
  placeholder,
  min,
  max,
  step,
  className,
  hideValidationIndicator,
  disabled,
}: NumberInputProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label required={required}>{label}</Label>}
      <div className="flex items-center">
        <Input
          type="number"
          name={field.name}
          value={field.value || ""}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          error={field.error}
          disabled={disabled}
        />
        <FieldSuffix
          field={field}
          hideValidationIndicator={hideValidationIndicator}
        />
      </div>
    </div>
  )
}

// Text Input Component for useField integration
export interface TextInputProps {
  field: FieldApi<string>
  label?: string
  required?: boolean
  placeholder?: string
  maxLength?: number
  className?: string
  hideValidationIndicator?: boolean
  disabled?: boolean
  type?: string
}

export function TextInput({
  field,
  label,
  required,
  placeholder,
  maxLength,
  className,
  hideValidationIndicator,
  disabled,
  type = "text",
}: TextInputProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label required={required}>{label}</Label>}
      <div className="flex items-center">
        <Input
          type={type}
          name={field.name}
          value={field.value || ""}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          error={field.error}
          disabled={disabled}
        />
        <FieldSuffix
          field={field}
          hideValidationIndicator={hideValidationIndicator}
        />
      </div>
    </div>
  )
}
