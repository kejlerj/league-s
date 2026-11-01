import type { ReactNode } from 'react'

export type Column<T> = {
  header: string
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  width?: string
  title?: (row: T) => string
}

type Props<T> = {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  empty: string
}

export function DataTable<T>({ rows, columns, rowKey, empty }: Props<T>) {
  if (rows.length === 0) {
    return <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{empty}</p>
  }
  const fixed = columns.some((column) => column.width !== undefined)
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className={`divide-y divide-slate-200 text-sm ${fixed ? 'w-full table-fixed' : 'min-w-full'}`}>
        {fixed && (
          <colgroup>
            {columns.map((column, index) => (
              <col key={index} style={column.width === undefined ? undefined : { width: column.width }} />
            ))}
          </colgroup>
        )}
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={`px-3 py-2 font-medium text-slate-600 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column, index) => (
                <td
                  key={index}
                  title={column.title?.(row)}
                  className={`px-3 py-2 text-slate-800 ${column.align === 'right' ? 'text-right' : ''} ${column.title ? 'truncate' : ''}`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
