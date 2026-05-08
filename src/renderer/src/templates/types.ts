import type { BoardItem, BoardList, ListColumn, ListTemplateType } from '@shared/domain'
import type { ReactElement } from 'react'

export type BoardDisplayColumn =
  | { kind: 'real'; key: string; label: string; column: ListColumn }
  | { kind: 'birthday_turning'; key: string; label: string }
  | { kind: 'wishlist_advised_buy_order'; key: string; label: string }
  | { kind: 'project_gantt'; key: string; label: string }

export type TemplateBoardRendererHelpers = {
  boardVisibleColumns: (list: BoardList) => ListColumn[]
  visibleColumns: (list: BoardList) => ListColumn[]
  boardColumnLabel: (column: ListColumn) => string
  formatBoardDisplayValue: (
    item: BoardItem,
    column: BoardDisplayColumn,
    list: BoardList,
    depth?: number,
    firstVisibleColumn?: boolean
  ) => string | ReactElement
  deadlineRowClass: (item: BoardItem) => string | undefined
  normalizeColumnName: (name: string) => string
}

export type TemplateBoardColumnHelpers = Pick<
  TemplateBoardRendererHelpers,
  'boardVisibleColumns' | 'visibleColumns' | 'boardColumnLabel' | 'normalizeColumnName'
>

export type TemplateBoardRendererProps = {
  list: BoardList
  onCloseItem?: (item: BoardItem, action: 'completed' | 'cancelled') => void
  onOpenItem?: (listId: string, itemId: string) => void
  rowActionBusy?: boolean
  helpers: TemplateBoardRendererHelpers
}

export type ListTemplateModule = {
  type: ListTemplateType
  displayName: string
  capabilities: {
    customBoardView?: boolean
    customItemEditor?: boolean
    customWizard?: boolean
    computedFields?: boolean
  }
  buildBoardColumns?: (list: BoardList, helpers: TemplateBoardColumnHelpers) => BoardDisplayColumn[]
  renderBoardContent?: (props: TemplateBoardRendererProps) => ReactElement | null
}
