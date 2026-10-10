import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

const CONTROL =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string | null
}

export function Field({ label, error, id, className = '', ...rest }: FieldProps) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input id={inputId} className={CONTROL} aria-invalid={error ? true : undefined} {...rest} />
      {error ? <p className="mt-1 text-sm text-red-700">{error}</p> : null}
    </div>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  children: ReactNode
}

export function SelectField({ label, id, className = '', children, ...rest }: SelectProps) {
  const generated = useId()
  const selectId = id ?? generated
  return (
    <div className={className}>
      <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select id={selectId} className={CONTROL} {...rest}>
        {children}
      </select>
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
