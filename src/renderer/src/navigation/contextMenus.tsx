import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Dispatch, ReactElement, SetStateAction } from 'react'
import type { BoardItem, BoardList, BoardSnapshot, BoardSummary, BoardWidget, FieldValue, ItemGroup, ListColumn } from '@shared/domain'
import type { ConfirmDialogState, ContextMenuState, PromptDialogState, RunAction, SelectedNode } from '../app/types'
import { ConfirmActionModal } from '../modals/dialogs'
import { PromptModal } from '../modals/appModals'

export function BoardRailContextMenu({
  board,
  onClose,
  onDuplicate,
  onDelete,
  x,
  y
}: {
  board: BoardSummary
  onClose: () => void
  onDuplicate: () => void
  onDelete: () => void
  x: number
  y: number
}): ReactElement {
  return (
    <div className="context-menu" onClick={(event) => event.stopPropagation()} style={{ left: x, top: y }}>
      <button onClick={() => onDuplicate()} type="button">
        <Copy size={14} />
        Duplicate Board
      </button>
      <button
        className="danger-menu"
        onClick={() => {
          onDelete()
          onClose()
        }}
        type="button"
      >
        <Trash2 size={14} />
        Delete Board
      </button>
    </div>
  )
}

export type TreeContextMenuHelpers = {
  blankValues: (columns: ListColumn[]) => Record<string, FieldValue>
  editableItemColumns: (list: BoardList) => ListColumn[]
  listInput: (list: BoardList) => Parameters<typeof window.lpl.updateList>[0]
  newestGroup: (list: BoardList | undefined) => ItemGroup | undefined
  newestItem: (list: BoardList | undefined) => BoardItem | undefined
  visibleColumns: (list: BoardList) => ListColumn[]
}

export function TreeContextMenu({
  helpers,
  menu,
  onClose,
  onRequestNewList,
  runAction,
  setSelectedNode,
  snapshot
}: {
  helpers: TreeContextMenuHelpers
  menu: NonNullable<ContextMenuState>
  onClose: () => void
  onRequestNewList: () => void
  runAction: RunAction
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const nodeList = menu.node.kind === 'list' ? snapshot.lists.find((list) => list.id === menu.node.id) : null
  const nodeGroup = menu.node.kind === 'group' ? snapshot.lists.flatMap((list) => list.groups).find((group) => group.id === menu.node.id) : null
  const groupList = nodeGroup ? snapshot.lists.find((list) => list.id === nodeGroup.listId) : null
  const nodeItem = menu.node.kind === 'item' ? snapshot.lists.flatMap((list) => list.items).find((item) => item.id === menu.node.id) : null
  const itemList = nodeItem ? snapshot.lists.find((list) => list.id === nodeItem.listId) : null
  const nodeWidget = menu.node.kind === 'widget' ? snapshot.widgets.find((widget) => widget.id === menu.node.id) : null
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null)
  const [promptDialog, setPromptDialog] = useState<PromptDialogState>(null)

  async function addChild(): Promise<void> {
    if (menu.node.kind === 'board') {
      onRequestNewList()
      onClose()
      return
    }
    if (menu.node.kind === 'list' && nodeList) {
      const result = await runAction(() => window.lpl.createGroup({ listId: nodeList.id, name: 'New Group' }))
      if (result && 'lists' in result) {
        const created = helpers.newestGroup(result.lists.find((list) => list.id === nodeList.id))
        if (created) setSelectedNode({ kind: 'group', id: created.id })
      }
    }
    if (menu.node.kind === 'group' && nodeGroup && groupList) {
      const result = await runAction(() =>
        window.lpl.createItem({
          listId: groupList.id,
          groupId: nodeGroup.id,
          values: helpers.blankValues(helpers.editableItemColumns(groupList)),
          dependencyItemIds: []
        })
      )
      if (result && 'lists' in result) {
        const created = helpers.newestItem(result.lists.find((list) => list.id === groupList.id))
        if (created) setSelectedNode({ kind: 'item', id: created.id })
      }
    }
    onClose()
  }

  async function rename(): Promise<void> {
    if (menu.node.kind === 'board') {
      setPromptDialog({
        title: 'Rename Board',
        label: 'Board name',
        initialValue: snapshot.name,
        confirmLabel: 'Save Name',
        onConfirm: async (name) => {
          await runAction(() => window.lpl.updateBoard({ boardId: snapshot.id, name, description: snapshot.description, owner: snapshot.owner }))
        }
      })
    }
    if (menu.node.kind === 'list' && nodeList) {
      setPromptDialog({
        title: 'Rename List',
        label: 'List name',
        initialValue: nodeList.name,
        confirmLabel: 'Save Name',
        onConfirm: async (name) => {
          await runAction(() => window.lpl.updateList({ ...helpers.listInput(nodeList), name }))
        }
      })
    }
    if (nodeGroup) {
      setPromptDialog({
        title: 'Rename Group',
        label: 'Group name',
        initialValue: nodeGroup.name,
        confirmLabel: 'Save Name',
        onConfirm: async (name) => {
          await runAction(() =>
            window.lpl.updateGroup({
              groupId: nodeGroup.id,
              parentGroupId: nodeGroup.parentGroupId,
              name,
              showIdOnBoard: nodeGroup.showIdOnBoard,
              summaries: nodeGroup.summaries
            })
          )
        }
      })
    }
    if (nodeItem && itemList) {
      const nameColumn = helpers.visibleColumns(itemList)[0]
      setPromptDialog({
        title: 'Rename Item',
        label: 'Item name',
        initialValue: String(nodeItem.values[nameColumn.id] ?? ''),
        confirmLabel: 'Save Name',
        onConfirm: async (name) => {
          await runAction(() =>
            window.lpl.updateItem({
              itemId: nodeItem.id,
              groupId: nodeItem.groupId,
              values: { ...nodeItem.values, [nameColumn.id]: name },
              dependencyItemIds: nodeItem.dependencyItemIds
            })
          )
        }
      })
    }
    if (nodeWidget) {
      setPromptDialog({
        title: 'Rename Widget',
        label: 'Widget name',
        initialValue: nodeWidget.name,
        confirmLabel: 'Save Name',
        onConfirm: async (name) => {
          await runAction(() =>
            window.lpl.updateWidget({
              widgetId: nodeWidget.id,
              type: nodeWidget.type,
              name,
              displayEnabled: nodeWidget.displayEnabled,
              grid: nodeWidget.grid,
              config: nodeWidget.config
            })
          )
        }
      })
    }
  }

  async function deleteNode(): Promise<void> {
    if (menu.node.kind === 'list' && nodeList) {
      setConfirmDialog({
        title: 'Delete List',
        message: `Delete "${nodeList.name}" and all child items?`,
        confirmLabel: 'Delete List',
        destructive: true,
        onConfirm: async () => {
          await runAction(() => window.lpl.deleteList(nodeList.id))
          setSelectedNode({ kind: 'board', id: snapshot.id })
        }
      })
    }
    if (nodeGroup) {
      setConfirmDialog({
        title: 'Delete Group',
        message: `Delete "${nodeGroup.name}"? Child tasks will be moved back to the list root.`,
        confirmLabel: 'Delete Group',
        destructive: true,
        onConfirm: async () => {
          await runAction(() => window.lpl.deleteGroup(nodeGroup.id))
          setSelectedNode(groupList ? { kind: 'list', id: groupList.id } : { kind: 'board', id: snapshot.id })
        }
      })
    }
    if (nodeItem) {
      setConfirmDialog({
        title: 'Delete Item',
        message: `Delete "${nodeItem.displayCode}"?`,
        confirmLabel: 'Delete Item',
        destructive: true,
        onConfirm: async () => {
          await runAction(() => window.lpl.deleteItem(nodeItem.id))
          setSelectedNode(itemList ? { kind: 'list', id: itemList.id } : { kind: 'board', id: snapshot.id })
        }
      })
    }
    if (nodeWidget) {
      setConfirmDialog({
        title: 'Delete Widget',
        message: `Delete "${nodeWidget.name}"?`,
        confirmLabel: 'Delete Widget',
        destructive: true,
        onConfirm: async () => {
          await runAction(() => window.lpl.deleteWidget(nodeWidget.id))
          setSelectedNode({ kind: 'board', id: snapshot.id })
        }
      })
    }
  }

  return (
    <>
      <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
        {menu.node.kind !== 'item' && menu.node.kind !== 'widget' && (
          <button onClick={addChild}>
            <Plus size={14} />
            {menu.node.kind === 'board' ? 'Add New List' : menu.node.kind === 'list' ? 'Add New Group' : 'Add New Item'}
          </button>
        )}
        <button onClick={rename}>
          <Pencil size={14} />
          Rename
        </button>
        {menu.node.kind !== 'board' && (
          <button className="danger-menu" onClick={deleteNode}>
            <Trash2 size={14} />
            Delete
          </button>
        )}
      </div>
      {promptDialog && (
        <PromptModal
          busy={false}
          confirmLabel={promptDialog.confirmLabel}
          initialValue={promptDialog.initialValue}
          label={promptDialog.label}
          onCancel={() => setPromptDialog(null)}
          onConfirm={async (value) => {
            await promptDialog.onConfirm(value)
            setPromptDialog(null)
            onClose()
          }}
          title={promptDialog.title}
        />
      )}
      {confirmDialog && (
        <ConfirmActionModal
          busy={false}
          confirmLabel={confirmDialog.confirmLabel}
          destructive={confirmDialog.destructive}
          message={confirmDialog.message}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={async () => {
            await confirmDialog.onConfirm()
            setConfirmDialog(null)
            onClose()
          }}
          title={confirmDialog.title}
        />
      )}
    </>
  )
}
