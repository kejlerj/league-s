import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'

export type Tab = { id: string; label: string; content: ReactNode }

export function Tabs({ tabs }: { tabs: Tab[] }) {
  const [params, setParams] = useSearchParams()
  const active = tabs.find((tab) => tab.id === params.get('tab')) ?? tabs[0]

  return (
    <div>
      <div role="tablist" className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active.id}
            onClick={() => setParams({ tab: tab.id })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab.id === active.id
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{active.content}</div>
    </div>
  )
}
