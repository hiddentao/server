# Forms

QuickDapp uses a custom hook-based form system rather than external libraries like React Hook Form. The [`useForm`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/hooks/useForm.ts) and [`useField`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/hooks/useForm.ts) hooks provide validation, error handling, and field state management.

## The useField Hook

Each form field gets its own `useField` instance that tracks value, validation state, and touched status:

```typescript
const nameField = useField({
  initialValue: "",
  validate: (value) => {
    if (!value.trim()) return "Name is required"
    if (value.length < 2) return "Name must be at least 2 characters"
  }
})
```

The hook returns:
- `name` — Field name from options
- `value` — Current field value
- `valid` — Whether the field passes validation
- `error` — Validation error message (if any)
- `version` — Increments on each change
- `isSet` — True if the field has a value or is optional
- `isValidating` — True during async validation
- `handleChange(value)` — Update the field value
- `unset()` — Reset to initial state

## Async Validation

Fields support async validation with debouncing. This is useful for checking availability or validating against a server:

```typescript
const addressField = useField({
  initialValue: "",
  validateAsync: async (value) => {
    const isValid = await checkAddressOnChain(value)
    if (!isValid) return "Invalid address"
  },
  validateAsyncDebounceMs: 300
})
```

The `isValidating` flag indicates when async validation is in progress, so you can show a loading indicator.

## The useForm Hook

For forms with multiple fields, `useForm` coordinates validation across all fields:

```typescript
const form = useForm({
  onSubmit: async (values) => {
    await createToken(values)
  }
})
```

The form tracks overall validity and handles submission. Fields register themselves with the form and validation runs on submit.

## Form Components

The form UI components in [`Form.tsx`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/components/Form.tsx) integrate with the field hooks:

`Input` and `Textarea` accept an `error` prop to display validation messages below the field. They show a red border when invalid.

`Label` wraps Radix UI's label with optional required indicator styling.

`FormField` combines a label, input, and error message into a single component.

`TextInput` and `NumberInput` are pre-integrated with `useField` for common use cases.

`FieldSuffix` shows a spinning indicator during async validation.

## Validation Patterns

Validate on change for immediate feedback:

```typescript
const field = useField({
  initialValue: "",
  validate: (value) => {
    if (!value) return "Required"
  }
})

// Error updates as user types
```

Validate on blur for less intrusive feedback:

```typescript
// Check field.isSet before showing errors
{field.isSet && field.error && <span>{field.error}</span>}
```

Combine sync and async validation:

```typescript
const field = useField({
  initialValue: "",
  validate: (value) => {
    // Sync validation runs first
    if (!isAddress(value)) return "Invalid address format"
  },
  validateAsync: async (value) => {
    // Async only runs if sync passes
    const exists = await checkAddressExists(value)
    if (!exists) return "Address not found"
  }
})
```

## Sanitization

Fields can sanitize values before validation:

```typescript
const field = useField({
  initialValue: "",
  sanitize: (value) => value.toLowerCase().trim()
})
```

The sanitized value is what gets validated and submitted.
