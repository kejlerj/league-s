import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

const CONTROL =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600'

function FieldError({ id, error }: { id: string; error?: string | null }) {
  return error ? (
    <p id={id} className="mt-1 text-sm text-red-700">
      {error}
    </p>
  ) : null
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string | null
}

export function Field({ label, error, id, className = '', ...rest }: FieldProps) {
  const generated = useId()
  const inputId = id ?? generated
  const errorId = `${inputId}-error`
  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={inputId}
        className={CONTROL}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      <FieldError id={errorId} error={error} />
    </div>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  error?: string | null
  children: ReactNode
}

export function SelectField({ label, error, id, className = '', children, ...rest }: SelectProps) {
  const generated = useId()
  const selectId = id ?? generated
  const errorId = `${selectId}-error`
  return (
    <div className={className}>
      <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={selectId}
        className={CONTROL}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      >
        {children}
      </select>
      <FieldError id={errorId} error={error} />
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (message === null) {
    return null
  }
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  )
}
