import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Button } from './Button'
import { ConfirmDialog } from './ConfirmDialog'
import { DataTable, type Column } from './DataTable'
import { Modal } from './Modal'
import { PageState } from './PageState'

type FormProps<T> = { initial?: T; onDone: () => void; onCancel: () => void }

type Props<T> = {
  queryKey: QueryKey
  queryFn: () => Promise<T[]>
  invalidate?: QueryKey
  columns: Column<T>[]
  rowKey: (row: T) => string
  describe: (row: T) => string
  empty: string
  newLabel: string
  editTitle: string
  removeTitle: string
  conflict: string
  remove: (row: T) => Promise<unknown>
  form: (props: FormProps<T>) => ReactNode
  toolbar?: ReactNode
}

export function ResourceTab<T>(props: Props<T>) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<T | 'new' | null>(null)
  const [removing, setRemoving] = useState<T | null>(null)
  const query = useQuery({ queryKey: props.queryKey, queryFn: props.queryFn, placeholderData: (previous) => previous })

  const changed = () => queryClient.invalidateQueries({ queryKey: props.invalidate ?? props.queryKey })
  const close = () => setEditing(null)

  const columns: Column<T>[] = [
    ...props.columns,
    {
      header: '',
      align: 'right',
      cell: (row) => (
        <span className="whitespace-nowrap">
          <Button variant="link" onClick={() => setEditing(row)}>
            Modifier
          </Button>
          <Button variant="link" onClick={() => setRemoving(row)}>
            Supprimer
          </Button>
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-3 flex items-end gap-3">
        {props.toolbar}
        <Button variant="primary" className="ml-auto" onClick={() => setEditing('new')}>
          {props.newLabel}
        </Button>
      </div>
      <PageState query={query}>
        {(rows) => <DataTable rows={rows} columns={columns} rowKey={props.rowKey} empty={props.empty} />}
      </PageState>
      <Modal title={editing === 'new' ? props.newLabel : props.editTitle} open={editing !== null} onClose={close}>
        {editing !== null
          ? props.form({
              initial: editing === 'new' ? undefined : editing,
              onCancel: close,
              onDone: () => {
                close()
                void changed()
              },
            })
          : null}
      </Modal>
      <ConfirmDialog
        open={removing !== null}
        title={props.removeTitle}
        message={removing !== null ? `Supprimer « ${props.describe(removing)} » ?` : ''}
        confirmLabel="Supprimer"
        errorOverrides={{ 409: props.conflict }}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing !== null) {
            await props.remove(removing)
            await changed()
          }
        }}
      />
    </div>
  )
}
