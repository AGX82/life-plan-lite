import { Check, X } from 'lucide-react'
import type { BoardItem, BoardList, ListColumn } from '@shared/domain'
import type { ReactElement } from 'react'
import type { BoardDisplayColumn, ListTemplateModule, TemplateBoardRendererProps } from '../types'

function healthBoardSections(list: BoardList, boardVisibleColumns: (list: BoardList) => ListColumn[], visibleColumns: (list: BoardList) => ListColumn[], boardColumnLabel: (column: ListColumn) => string, normalizeColumnName: (name: string) => string) {
  const entryColumn = boardVisibleColumns(list).find((column) => normalizeColumnName(column.name) === 'entry') ?? visibleColumns(list).find((column) => normalizeColumnName(column.name) === 'entry')
  if (!entryColumn) return []
  const appointmentDateColumn = boardVisibleColumns(list).find((column) => normalizeColumnName(column.name) === 'appointment date') ?? null
  const recurrenceColumn = boardVisibleColumns(list).find((column) => normalizeColumnName(column.name) === 'recurrence') ?? null
  const mentionsColumn = boardVisibleColumns(list).find((column) => normalizeColumnName(column.name) === 'mentions') ?? null
  const sections: Array<{
    key: string
    label: string
    entryColumn: ListColumn
    columns: Array<{ column: ListColumn; label: string }>
    items: BoardItem[]
  }> = []

  const configuredGroups = [...list.groups].sort((left, right) => left.order - right.order)
  for (const group of configuredGroups) {
    const items = list.items.filter((item) => item.groupId === group.id)
    if (items.length === 0) continue
    const normalizedGroup = normalizeColumnName(group.name)
    let columns: Array<{ column: ListColumn; label: string }> = []
    if (normalizedGroup === 'recurring appointments') {
      if (recurrenceColumn) columns.push({ column: recurrenceColumn, label: 'Recurrence' })
      if (mentionsColumn) columns.push({ column: mentionsColumn, label: 'Mentions' })
    } else if (normalizedGroup === 'scheduled investigations') {
      if (appointmentDateColumn) columns.push({ column: appointmentDateColumn, label: 'Appointment Date' })
      if (mentionsColumn) columns.push({ column: mentionsColumn, label: 'Mentions' })
    } else if (normalizedGroup === 'treatment plan') {
      if (recurrenceColumn) columns.push({ column: recurrenceColumn, label: 'Schedule' })
      if (mentionsColumn) columns.push({ column: mentionsColumn, label: 'Mentions' })
    } else {
      columns = [appointmentDateColumn, recurrenceColumn, mentionsColumn]
        .filter((column): column is ListColumn => column !== null)
        .map((column) => ({ column, label: boardColumnLabel(column) }))
    }
    sections.push({
      key: group.id,
      label: group.name,
      entryColumn,
      columns,
      items
    })
  }

  const rootItems = list.items.filter((item) => !item.groupId)
  if (rootItems.length > 0) {
    const fallbackColumns = [appointmentDateColumn, recurrenceColumn, mentionsColumn]
      .filter((column): column is ListColumn => column !== null)
      .map((column) => ({ column, label: boardColumnLabel(column) }))
    sections.push({
      key: 'root',
      label: 'List Root',
      entryColumn,
      columns: fallbackColumns,
      items: rootItems
    })
  }

  return sections
}

function healthBoardCellValue(
  item: BoardItem,
  column: ListColumn,
  list: BoardList,
  formatBoardDisplayValue: (item: BoardItem, column: BoardDisplayColumn, list: BoardList, depth?: number, firstVisibleColumn?: boolean) => string | ReactElement,
  boardColumnLabel: (column: ListColumn) => string
): string | ReactElement {
  return formatBoardDisplayValue(
    item,
    {
      kind: 'real',
      key: column.id,
      label: boardColumnLabel(column),
      column
    },
    list
  )
}

function healthSectionGridTemplate(section: { columns: Array<{ column: ListColumn; label: string }> }, withActions: boolean): string {
  const tracks = ['minmax(150px, 1.2fr)', ...section.columns.map(() => 'minmax(110px, 0.95fr)')]
  if (withActions) tracks.push('4.3rem')
  return tracks.join(' ')
}

function HealthBoardContent({ helpers, list, onCloseItem, onOpenItem, rowActionBusy }: TemplateBoardRendererProps): ReactElement {
  const sections = healthBoardSections(list, helpers.boardVisibleColumns, helpers.visibleColumns, helpers.boardColumnLabel, helpers.normalizeColumnName)
  return (
    <div className="health-board-view">
      {sections.map((section) => (
        <section className="health-board-section" key={section.key}>
          <div className="health-board-section-header" style={{ gridTemplateColumns: healthSectionGridTemplate(section, Boolean(onCloseItem || onOpenItem)) }}>
            <strong>{section.label}</strong>
            {section.columns.map((column) => (
              <span key={`${section.key}-${column.label}`}>{column.label}</span>
            ))}
            {(onCloseItem || onOpenItem) && <span aria-hidden="true" />}
          </div>
          {section.items.map((item) => (
            <div
              className={`${helpers.deadlineRowClass(item) ?? ''} ${onOpenItem ? 'health-board-row clickable-row' : 'health-board-row'}`.trim()}
              key={item.id}
              onClick={() => onOpenItem?.(list.id, item.id)}
              style={{ gridTemplateColumns: healthSectionGridTemplate(section, Boolean(onCloseItem || onOpenItem)) }}
            >
              <span>{healthBoardCellValue(item, section.entryColumn, list, helpers.formatBoardDisplayValue, helpers.boardColumnLabel)}</span>
              {section.columns.map((column) => (
                <span key={`${item.id}-${column.column.id}`}>
                  {healthBoardCellValue(item, column.column, list, helpers.formatBoardDisplayValue, helpers.boardColumnLabel)}
                </span>
              ))}
              {(onCloseItem || onOpenItem) && (
                <span className="row-actions-cell">
                  <button
                    aria-label={`Mark ${item.displayCode} completed`}
                    className="row-action-button complete"
                    disabled={rowActionBusy}
                    onClick={(event) => {
                      event.stopPropagation()
                      onCloseItem?.(item, 'completed')
                    }}
                    title="Mark completed"
                    type="button"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    aria-label={`Cancel ${item.displayCode}`}
                    className="row-action-button cancel"
                    disabled={rowActionBusy}
                    onClick={(event) => {
                      event.stopPropagation()
                      onCloseItem?.(item, 'cancelled')
                    }}
                    title="Cancel task"
                    type="button"
                  >
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

export const healthTemplateModule: ListTemplateModule = {
  type: 'health',
  displayName: 'Health',
  capabilities: {
    customBoardView: true
  },
  renderBoardContent: (props) => <HealthBoardContent {...props} />
}
