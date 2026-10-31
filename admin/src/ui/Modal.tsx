import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

const FIELDS = 'input:not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])'
const FOCUSABLE = `${FIELDS}, input:not([disabled]), button:not([disabled]), a[href]`

export function Modal({ title, open, onClose, children }: Props) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) {
      return
    }
    const node = dialog.current
    const previous = document.activeElement
    const first = node?.querySelector<HTMLElement>(FIELDS) ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node
    first?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close.current()
        return
      }
      if (event.key !== 'Tab' || !node) {
        return
      }
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === firstItem || !node.contains(active))) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && (active === lastItem || !node.contains(active))) {
        event.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous instanceof HTMLElement) {
        previous.focus()
      }
    }
  }, [open])

  if (!open) {
    return null
  }
  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl focus:outline-none"
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}
