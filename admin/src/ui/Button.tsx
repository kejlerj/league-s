import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'link'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  pending?: boolean
}

const BASE =
  'rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800',
  secondary: 'border border-slate-300 bg-white px-3 py-2 text-slate-800 hover:bg-slate-50',
  danger: 'bg-red-700 px-3 py-2 text-white hover:bg-red-800',
  link: 'px-1 py-0.5 text-emerald-800 underline-offset-2 hover:underline',
}

export function Button({ variant = 'secondary', pending = false, disabled, className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}
