import { render, screen } from '@testing-library/react'
import { DataTable, type Column } from '@/ui/DataTable'

type Row = { id: string; name: string }

const rows: Row[] = [{ id: '1', name: 'Association sportive au nom très long' }]

function renderTable(columns: Column<Row>[]) {
  return render(<DataTable rows={rows} columns={columns} rowKey={(row) => row.id} empty="Vide" />)
}

test('declared widths give the table a fixed layout with those column widths', () => {
  const { container } = renderTable([
    { header: 'Nom', cell: (row) => row.name, width: '12rem' },
    { header: 'Actions', cell: () => 'Modifier' },
  ])
  expect(screen.getByRole('table')).toHaveClass('table-fixed')
  const cols = container.querySelectorAll('colgroup col')
  expect(cols).toHaveLength(2)
  expect((cols[0] as HTMLElement).style.width).toBe('12rem')
  expect(cols[1].getAttribute('style')).toBeNull()
})

test('without widths the table keeps its automatic layout', () => {
  const { container } = renderTable([{ header: 'Nom', cell: (row) => row.name }])
  expect(screen.getByRole('table')).not.toHaveClass('table-fixed')
  expect(container.querySelector('colgroup')).toBeNull()
})

test('a column with a title truncates its cell and keeps the full text readable', () => {
  renderTable([{ header: 'Nom', cell: (row) => row.name, width: '8rem', title: (row) => row.name }])
  const cell = screen.getByRole('cell', { name: 'Association sportive au nom très long' })
  expect(cell).toHaveClass('truncate')
  expect(cell).toHaveAttribute('title', 'Association sportive au nom très long')
})
