import { useState, type ComponentType, type SVGProps } from 'react'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

type Props = {
  label: string
  icon: Icon
  onClick: () => void
  danger?: boolean
}

export function IconButton({ label, icon: Icon, onClick, danger = false }: Props) {
  const [open, setOpen] = useState(false)
  const show = () => setOpen(true)
  const hide = () => setOpen(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={`rounded-md p-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
          danger ? 'text-red-700 hover:bg-red-50' : 'text-emerald-800 hover:bg-emerald-50'
        }`}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute right-0 bottom-full z-10 mb-1 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white"
        >
          {label}
        </span>
      )}
    </span>
  )
}
