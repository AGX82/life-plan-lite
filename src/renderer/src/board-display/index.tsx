import { Check, Gift, Grip, Plus, Settings2, SquarePen, SunMedium, X } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'
import type { ComponentProps, Dispatch, PointerEvent, ReactElement, SetStateAction } from 'react'
import type {
  AppSettings,
  BoardItem,
  BoardList,
  BoardSnapshot,
  BoardSummary,
  BoardWidget,
  BoardWidgetConfig,
  FieldValue,
  ItemGroup,
  ListColumn,
  SummarySlot,
  WidgetType
} from '@shared/domain'
import type { RunAction, SelectedNode } from '../app/types'
import { CloseItemModal, ItemEditorPanel } from '../editors/itemEditor'
import { ListEditorPanel } from '../list-editor'
import { MessageModal } from '../modals/dialogs'
import { getListTemplateModule } from '../templates/registry'
import type { BoardDisplayColumn } from '../templates/types'
import { WidgetRenderer, WidgetTypeIcon } from '../widgets'

type BoardDisplaySharedItemHelpers = ComponentProps<typeof ItemEditorPanel>['helpers']
type BoardDisplayListEditorHelpers = ComponentProps<typeof ListEditorPanel>['helpers']

export type BoardDisplayRow = { kind: 'group'; group: ItemGroup } | { kind: 'item'; item: BoardItem; depth: number }

export type SystemBoardFieldKey = 'itemId' | 'dependencies' | 'createdAt' | 'createdBy' | 'status'

type BoardListSortDirection = 'asc' | 'desc'

type BoardListSortState = {
  key: string
  direction: BoardListSortDirection
}

export type BoardRenderFieldEntry =
  | { kind: 'system'; key: `system:${SystemBoardFieldKey}`; field: SystemBoardFieldKey; label: string }
  | { kind: 'display'; key: string; column: BoardDisplayColumn; label: string }

type SummaryEntry = {
  id: string
  title: string
  subtitle: string
  source: string
  when: Date
  whenLabel: string
}

export type BoardDisplayHelpers = {
  birthdayOccurrenceDate: (value: FieldValue | undefined, now?: Date) => Date | null
  birthdayCoreColumns: (list: BoardList) => ListColumn[]
  blankValues: (columns: ListColumn[], list?: BoardList) => Record<string, FieldValue>
  boardVisibleColumns: (list: BoardList) => ListColumn[]
  boardDisplayRows: (list: BoardList) => BoardDisplayRow[]
  boardSortMetaForDisplayColumn: (
    list: BoardList,
    column: BoardDisplayColumn
  ) => { key: string; defaultDirection: BoardListSortDirection } | null
  boardVisibleItemCount: (list: BoardList) => number
  collectDaySummaryEntries: (snapshot: BoardSnapshot, mode: 'today' | 'next24h') => SummaryEntry[]
  dayBeforeBirthday: (date: Date) => Date
  deadlineDisplayLabel: (list: BoardList) => string
  deadlineRowClass: (item: BoardItem) => string | undefined
  editableItemColumns: (list: BoardList) => ListColumn[]
  formatBoardDisplayValue: (
    item: BoardItem,
    column: BoardDisplayColumn,
    list: BoardList,
    depth?: number,
    firstVisibleColumn?: boolean
  ) => string | ReactElement
  formatGroupCell: (group: ItemGroup, column: ListColumn, list: BoardList, includeName: boolean) => string | ReactElement
  formatSystemDate: (value: string) => string
  isBirthdayDateColumn: (column: ListColumn) => boolean
  isSummarySlotDefined: (slot: SummarySlot) => boolean
  itemEditorHelpers: BoardDisplaySharedItemHelpers
  itemTitle: (item: BoardItem, list: BoardList) => string
  listEditorHelpers: BoardDisplayListEditorHelpers
  listSummaryValues: (list: BoardList) => Array<{ columnId: string; label: string; value: string }>
  localDateTimeInputValue: (date: Date) => string
  normalizeColumnName: (name: string) => string
  orderedBoardRenderFields: (list: BoardList) => BoardRenderFieldEntry[]
  pointerMoveGrid: (grid: BoardList['grid'], rect: DOMRect, pointerX: number, pointerY: number) => BoardList['grid']
  pointerMoveWidgetGridWithOffset: (
    grid: BoardWidget['grid'],
    rect: DOMRect,
    pointerX: number,
    pointerY: number,
    offsetX: number,
    offsetY: number
  ) => BoardWidget['grid']
  resizeGrid: (
    grid: BoardList['grid'],
    handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
    dx: number,
    dy: number
  ) => BoardList['grid']
  resizeWidgetGrid: (
    grid: BoardWidget['grid'],
    type: WidgetType,
    config: BoardWidgetConfig,
    handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
    dx: number,
    dy: number
  ) => BoardWidget['grid']
  sortBoardDisplayRows: (
    list: BoardList,
    rows: BoardDisplayRow[],
    displayColumns: BoardDisplayColumn[],
    sortState: BoardListSortState | null
  ) => BoardDisplayRow[]
  summaryToneForSlot: (slot: SummarySlot) => 'positive' | 'alert'
  visibleColumns: (list: BoardList) => ListColumn[]
}

export function DisplayBoard({
  appSettings,
  appThemeClass,
  boards = [],
  busy = false,
  compact = false,
  editable = false,
  helpers,
  onAdmin,
  onListChange,
  onListSelect,
  onWidgetChange,
  onWidgetSelect,
  runAction,
  selectedListId,
  selectedWidgetId,
  snapshot
}: {
  appSettings?: AppSettings
  appThemeClass?: string
  boards?: BoardSummary[]
  busy?: boolean
  compact?: boolean
  editable?: boolean
  helpers: BoardDisplayHelpers
  onAdmin?: () => void | Promise<void>
  onListChange?: (list: BoardList, grid: BoardList['grid']) => void
  onListSelect?: (listId: string) => void
  onWidgetChange?: (widget: BoardWidget, grid: BoardWidget['grid']) => void
  onWidgetSelect?: (widgetId: string) => void
  runAction?: RunAction
  selectedListId?: string
  selectedWidgetId?: string
  snapshot: BoardSnapshot
}): ReactElement {
  const [closeDialog, setCloseDialog] = useState<{ item: BoardItem; action: 'completed' | 'cancelled' } | null>(null)
  const [closeComment, setCloseComment] = useState('')
  const [closingItemId, setClosingItemId] = useState<string | null>(null)
  const [giftDialog, setGiftDialog] = useState<{ item: BoardItem; list: BoardList } | null>(null)
  const [itemDialog, setItemDialog] = useState<
    | { mode: 'create'; listId: string }
    | { mode: 'edit'; listId: string; itemId: string }
    | null
  >(null)
  const [listSettingsListId, setListSettingsListId] = useState<string | null>(null)
  const [summaryDialogMode, setSummaryDialogMode] = useState<'today' | 'next24h' | null>(null)
  const [messageDialog, setMessageDialog] = useState<{ title: string; message: string } | null>(null)
  const confirmationMode = appSettings?.closeConfirmationMode ?? 'with_comments'
  const enableBoardInteraction = !compact && !editable && Boolean(appSettings && runAction)
  const enableCloseActions = enableBoardInteraction
  const closeDialogTitle = closeDialog
    ? (() => {
        const list = snapshot.lists.find((entry) => entry.id === closeDialog.item.listId)
        return list ? helpers.itemTitle(closeDialog.item, list) : closeDialog.item.displayCode
      })()
    : ''
  const dialogList = itemDialog ? snapshot.lists.find((list) => list.id === itemDialog.listId) ?? null : null
  const dialogItem =
    itemDialog?.mode === 'edit' && dialogList ? dialogList.items.find((item) => item.id === itemDialog.itemId) ?? null : null
  const listSettingsList = listSettingsListId ? snapshot.lists.find((list) => list.id === listSettingsListId) ?? null : null
  const showItemDialog = Boolean(itemDialog && dialogList && (itemDialog.mode === 'create' || dialogItem))
  const noopSelectedNodeSetter: Dispatch<SetStateAction<SelectedNode | null>> = () => undefined

  async function submitClose(item: BoardItem, action: 'completed' | 'cancelled', comment: string | null): Promise<void> {
    setClosingItemId(item.id)
    try {
      await window.lpl.closeItem({ itemId: item.id, action, comment, archiveScope: 'published' })
      setCloseDialog(null)
      setCloseComment('')
    } catch (error) {
      setMessageDialog({
        title: 'Unable to close item',
        message: error instanceof Error ? error.message : 'Unable to close the item right now.'
      })
    } finally {
      setClosingItemId(null)
    }
  }

  function requestClose(item: BoardItem, action: 'completed' | 'cancelled'): void {
    if (confirmationMode === 'none') {
      void submitClose(item, action, null)
      return
    }
    setCloseComment('')
    setCloseDialog({ item, action })
  }

  return (
    <section className={`${appThemeClass ?? 'theme-midnight-clear'} ${compact ? 'display-board compact' : 'display-board'}`}>
      <div className="board-shell" data-tutorial-id="display-board-shell">
        <header className="display-top-band" data-tutorial-id="display-top-band">
          <div className="display-title">
            <p className="eyebrow">{snapshot.mode === 'display' ? 'Display Mode' : 'Preview'}</p>
            <h2>{snapshot.name}</h2>
          </div>
          <div className="top-summary" data-tutorial-id="display-summary-row">
            {snapshot.summarySlots.filter(helpers.isSummarySlotDefined).map((slot) => (
              <div className={`summary-slot top summary-tone-${helpers.summaryToneForSlot(slot)}`} key={slot.slotIndex} title={`${slot.label}: ${slot.value}`}>
                <span>{slot.label}</span>
                <strong>{slot.value}</strong>
              </div>
            ))}
          </div>
          <div className="display-top-actions" data-tutorial-id="display-day-actions">
            {!compact && !editable && (
              <>
                <button className="summary-trigger-button text-badge" onClick={() => setSummaryDialogMode('next24h')} title="Next 24 hours" type="button">
                  24
                </button>
                <button className="summary-trigger-button" onClick={() => setSummaryDialogMode('today')} title="Today until midnight" type="button">
                  <SunMedium size={18} />
                </button>
              </>
            )}
            {onAdmin && (
              <button className="icon-only" title="Admin mode" onClick={onAdmin}>
                <SquarePen size={20} />
              </button>
            )}
          </div>
        </header>

        <div className={editable ? 'board-grid editable-grid' : 'board-grid'}>
          {snapshot.lists.map((list, index) => (
            <BoardListView
              compact={compact}
              editable={editable}
              helpers={helpers}
              key={list.id}
              list={list}
              onAddItem={enableBoardInteraction ? (listId) => setItemDialog({ mode: 'create', listId }) : undefined}
              onChange={onListChange}
              onCloseItem={enableCloseActions ? requestClose : undefined}
              onEditList={enableBoardInteraction ? (listId) => setListSettingsListId(listId) : undefined}
              onGiftItem={
                enableBoardInteraction
                  ? (listId, itemId) => {
                      const sourceList = snapshot.lists.find((entry) => entry.id === listId)
                      const item = sourceList?.items.find((entry) => entry.id === itemId)
                      if (sourceList && item) setGiftDialog({ item, list: sourceList })
                    }
                  : undefined
              }
              onOpenItem={enableBoardInteraction ? (listId, itemId) => setItemDialog({ mode: 'edit', listId, itemId }) : undefined}
              onSelect={onListSelect}
              rowActionBusy={closingItemId !== null}
              selected={list.id === selectedListId}
              tutorialAnchor={index === 0}
            />
          ))}
          {snapshot.widgets.map((widget) => (
            <BoardWidgetView
              compact={compact}
              editable={editable}
              helpers={helpers}
              key={widget.id}
              onChange={onWidgetChange}
              onSelect={onWidgetSelect}
              selected={widget.id === selectedWidgetId}
              widget={widget}
            />
          ))}
        </div>
      </div>
      {closeDialog && (
        <CloseItemModal
          action={closeDialog.action}
          busy={closingItemId === closeDialog.item.id}
          comments={closeComment}
          itemTitle={closeDialogTitle}
          mode={confirmationMode}
          onCancel={() => {
            if (closingItemId) return
            setCloseDialog(null)
            setCloseComment('')
          }}
          onCommentsChange={setCloseComment}
          onConfirm={() =>
            submitClose(
              closeDialog.item,
              closeDialog.action,
              confirmationMode === 'with_comments' ? closeComment : null
            )
          }
        />
      )}
      {enableBoardInteraction && showItemDialog && dialogList && itemDialog && runAction && (
        <ItemEditorPanel
          appSettings={appSettings!}
          busy={busy}
          helpers={helpers.itemEditorHelpers}
          item={itemDialog.mode === 'edit' ? dialogItem : null}
          mode={itemDialog.mode}
          onClose={() => setItemDialog(null)}
          presentation="modal"
          list={dialogList}
          runAction={runAction}
          snapshot={snapshot}
        />
      )}
      {enableBoardInteraction && listSettingsList && runAction && (
        <ListEditorPanel
          appSettings={appSettings!}
          boards={boards}
          busy={busy}
          helpers={helpers.listEditorHelpers}
          list={listSettingsList}
          onClose={() => setListSettingsListId(null)}
          presentation="modal"
          runAction={runAction}
          setSelectedNode={noopSelectedNodeSetter}
          snapshot={snapshot}
        />
      )}
      {enableBoardInteraction && giftDialog && runAction && (
        <BirthdayGiftModal
          birthdayItem={giftDialog.item}
          birthdayList={giftDialog.list}
          helpers={helpers}
          lists={snapshot.lists.filter((list) => list.id !== giftDialog.list.id && list.templateType !== 'birthday_calendar')}
          onClose={() => setGiftDialog(null)}
          runAction={runAction}
        />
      )}
      {summaryDialogMode && <DaySummaryModal helpers={helpers} mode={summaryDialogMode} onClose={() => setSummaryDialogMode(null)} snapshot={snapshot} />}
      {messageDialog && <MessageModal title={messageDialog.title} message={messageDialog.message} onClose={() => setMessageDialog(null)} />}
    </section>
  )
}

function BoardListView({
  compact,
  editable,
  helpers,
  list,
  onAddItem,
  onChange,
  onCloseItem,
  onEditList,
  onGiftItem,
  onOpenItem,
  onSelect,
  rowActionBusy,
  selected,
  tutorialAnchor = false
}: {
  compact: boolean
  editable: boolean
  helpers: BoardDisplayHelpers
  list: BoardList
  onAddItem?: (listId: string) => void
  onChange?: (list: BoardList, grid: BoardList['grid']) => void
  onCloseItem?: (item: BoardItem, action: 'completed' | 'cancelled') => void
  onEditList?: (listId: string) => void
  onGiftItem?: (listId: string, itemId: string) => void
  onOpenItem?: (listId: string, itemId: string) => void
  onSelect?: (listId: string) => void
  rowActionBusy?: boolean
  selected?: boolean
  tutorialAnchor?: boolean
}): ReactElement {
  const templateModule = getListTemplateModule(list.templateType)
  const boardFields = helpers.orderedBoardRenderFields(list)
  const [sortState, setSortState] = useState<BoardListSortState | null>(null)
  const displayColumns = boardFields
    .filter((field): field is Extract<BoardRenderFieldEntry, { kind: 'display' }> => field.kind === 'display')
    .map((field) => field.column)
  const firstDisplayFieldKey = boardFields.find((field) => field.kind === 'display')?.key ?? null
  const rows = helpers.sortBoardDisplayRows(list, helpers.boardDisplayRows(list), displayColumns, sortState)
  const listSummaries = helpers.listSummaryValues(list)
  const itemCount = helpers.boardVisibleItemCount(list)
  const groupCount = list.groups.length
  const drag = useRef<{
    mode: 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
    x: number
    y: number
    grid: BoardList['grid']
    rect: DOMRect
  } | null>(null)

  useEffect(() => {
    setSortState(null)
  }, [list.id])

  function toggleSort(key: string, defaultDirection: BoardListSortDirection): void {
    setSortState((current) => {
      if (!current || current.key !== key) return { key, direction: defaultDirection }
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  function renderSortableHeader(label: string, key: string, defaultDirection: BoardListSortDirection): ReactElement {
    const active = sortState?.key === key ? sortState.direction : null
    const indicator = active === 'asc' ? '↑' : active === 'desc' ? '↓' : '↕'
    return (
      <button
        className={`board-sort-button ${active ? 'active' : ''}`}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          toggleSort(key, defaultDirection)
        }}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="board-sort-indicator">
          {indicator}
        </span>
      </button>
    )
  }

  function startDrag(event: PointerEvent, mode: NonNullable<typeof drag.current>['mode']): void {
    if (!editable) return
    const grid = event.currentTarget.closest('.board-grid')?.getBoundingClientRect()
    if (!grid) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    drag.current = { mode, x: event.clientX, y: event.clientY, grid: list.grid, rect: grid }
  }

  function finishDrag(event: PointerEvent): void {
    if (!drag.current || !onChange) return
    const unitW = drag.current.rect.width / 16
    const unitH = drag.current.rect.height / 8
    const next =
      drag.current.mode === 'move'
        ? helpers.pointerMoveGrid(drag.current.grid, drag.current.rect, event.clientX, event.clientY)
        : helpers.resizeGrid(
            drag.current.grid,
            drag.current.mode,
            Math.round((event.clientX - drag.current.x) / unitW),
            Math.round((event.clientY - drag.current.y) / unitH)
          )
    drag.current = null
    onChange(list, next)
  }

  return (
    <article
      className={`${onSelect ? 'board-list-panel selectable' : 'board-list-panel'} ${selected ? 'selected-layout' : ''}`}
      data-tutorial-id={tutorialAnchor ? 'display-primary-list-header' : undefined}
      onClick={() => onSelect?.(list.id)}
      onPointerUp={finishDrag}
      style={{
        gridColumn: `${list.grid.x} / span ${list.grid.w}`,
        gridRow: `${list.grid.y} / span ${list.grid.h}`
      }}
    >
      <header onPointerDown={(event) => startDrag(event, 'move')}>
        <div className="board-list-header-title">
          {(onAddItem || onEditList) && (
            <div className="board-list-toolbar">
              {onAddItem && (
                <button
                  className="board-list-tool-button"
                  data-tutorial-id={tutorialAnchor ? 'display-add-item' : undefined}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onAddItem(list.id)
                  }}
                  title={`Add item to ${list.name}`}
                  type="button"
                >
                  <Plus size={15} />
                </button>
              )}
              {onEditList && (
                <button
                  className="board-list-tool-button"
                  data-tutorial-id={tutorialAnchor ? 'display-edit-list' : undefined}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onEditList(list.id)
                  }}
                  title={`Edit ${list.name}`}
                  type="button"
                >
                  <Settings2 size={15} />
                </button>
              )}
            </div>
          )}
          <h3>{compact ? `LIST: ${list.name}` : list.name}</h3>
          {!compact && listSummaries.length > 0 && (
            <div className="board-list-summaries" data-tutorial-id={tutorialAnchor ? 'display-list-summary' : undefined}>
              {listSummaries.map((summary) => (
                <span className="board-list-summary" key={summary.columnId}>
                  <em>{summary.label}</em>
                  <strong>{summary.value}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
        {editable ? <Grip size={16} /> : list.dueDateEnabled && <span className="due-chip">{helpers.deadlineDisplayLabel(list)}</span>}
      </header>
      {compact ? (
        <div className="compact-list-preview">
          <div className="compact-list-meta">
            <span>{itemCount} item{itemCount === 1 ? '' : 's'}</span>
            {groupCount > 0 && <span>{groupCount} group{groupCount === 1 ? '' : 's'}</span>}
            {list.dueDateEnabled && <span>Deadline</span>}
          </div>
          <div className="compact-list-caption">
            {list.templateType === 'birthday_calendar'
              ? 'Birthday timeline'
              : displayColumns.length > 0
                ? `${displayColumns.length} visible field${displayColumns.length === 1 ? '' : 's'}`
                : 'Layout preview'}
          </div>
        </div>
      ) : (
        <div className="table-wrap" data-tutorial-id={tutorialAnchor ? 'display-list-table' : undefined}>
          {templateModule.renderBoardContent ? (
            templateModule.renderBoardContent({
              list,
              onCloseItem,
              onOpenItem,
              rowActionBusy,
              helpers: {
                boardVisibleColumns: helpers.boardVisibleColumns,
                visibleColumns: helpers.visibleColumns,
                boardColumnLabel,
                formatBoardDisplayValue: helpers.formatBoardDisplayValue,
                deadlineRowClass: helpers.deadlineRowClass,
                normalizeColumnName: helpers.normalizeColumnName
              }
            })
          ) : (
            <table>
              <thead>
                <tr>
                  {boardFields.map((field) => {
                    if (field.kind === 'system') {
                      const meta =
                        field.field === 'itemId'
                          ? { key: '__itemId', defaultDirection: 'asc' as const }
                          : field.field === 'createdAt'
                            ? { key: '__createdAt', defaultDirection: 'desc' as const }
                            : field.field === 'createdBy'
                              ? { key: '__createdBy', defaultDirection: 'asc' as const }
                              : null
                      return <th key={field.key}>{meta ? renderSortableHeader(field.label, meta.key, meta.defaultDirection) : field.label}</th>
                    }
                    const meta = helpers.boardSortMetaForDisplayColumn(list, field.column)
                    return <th key={field.key}>{meta ? renderSortableHeader(field.label, meta.key, meta.defaultDirection) : field.label}</th>
                  })}
                  {(onCloseItem || onGiftItem) && <th className="row-actions-heading" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) =>
                  row.kind === 'group' ? (
                    <tr className="group-heading-row" key={`group-${row.group.id}`}>
                      {boardFields.map((field) => (
                        <td key={field.key}>
                          {field.kind === 'system'
                            ? field.field === 'itemId'
                              ? row.group.showIdOnBoard
                                ? row.group.code
                                : ''
                              : ''
                            : field.column.kind === 'real'
                              ? helpers.formatGroupCell(row.group, field.column.column, list, field.key === firstDisplayFieldKey)
                              : ''}
                        </td>
                      ))}
                      {(onCloseItem || onGiftItem) && <td />}
                    </tr>
                  ) : (
                    <tr
                      className={`${helpers.deadlineRowClass(row.item) ?? ''} ${onOpenItem ? 'board-item-row clickable-row' : 'board-item-row'}`.trim()}
                      key={row.item.id}
                      onClick={() => onOpenItem?.(list.id, row.item.id)}
                    >
                      {boardFields.map((field) => (
                        <td className={field.kind === 'system' && field.field === 'itemId' ? 'code-cell' : undefined} key={field.key}>
                          {field.kind === 'system'
                            ? field.field === 'itemId'
                              ? row.item.displayCode
                              : field.field === 'dependencies'
                                ? row.item.dependencyCodes.join(', ') || '-'
                                : field.field === 'createdAt'
                                  ? helpers.formatSystemDate(row.item.createdAt)
                                  : field.field === 'createdBy'
                                    ? row.item.createdBy
                                    : row.item.deadlineStatus
                            : helpers.formatBoardDisplayValue(row.item, field.column, list, row.depth, field.key === firstDisplayFieldKey)}
                        </td>
                      ))}
                      {(onCloseItem || onGiftItem) && (
                        <td className="row-actions-cell">
                          {onGiftItem && list.templateType === 'birthday_calendar' && (
                            <button
                              aria-label={`Create gift task for ${row.item.displayCode}`}
                              className="row-action-button gift"
                              disabled={rowActionBusy}
                              onClick={(event) => {
                                event.stopPropagation()
                                onGiftItem(list.id, row.item.id)
                              }}
                              title="Create gift task"
                              type="button"
                            >
                              <Gift size={14} />
                            </button>
                          )}
                          <button
                            aria-label={`Mark ${row.item.displayCode} completed`}
                            className="row-action-button complete"
                            disabled={rowActionBusy}
                            onClick={(event) => {
                              event.stopPropagation()
                              onCloseItem?.(row.item, 'completed')
                            }}
                            title="Mark completed"
                            type="button"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            aria-label={`Cancel ${row.item.displayCode}`}
                            className="row-action-button cancel"
                            disabled={rowActionBusy}
                            onClick={(event) => {
                              event.stopPropagation()
                              onCloseItem?.(row.item, 'cancelled')
                            }}
                            title="Cancel task"
                            type="button"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
      {editable &&
        (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const).map((handle) => (
          <button className={`resize-handle ${handle}`} key={handle} onPointerDown={(event) => startDrag(event, handle)} type="button" />
        ))}
    </article>
  )
}

function BoardWidgetView({
  compact,
  editable,
  helpers,
  onChange,
  onSelect,
  selected,
  widget
}: {
  compact: boolean
  editable: boolean
  helpers: BoardDisplayHelpers
  onChange?: (widget: BoardWidget, grid: BoardWidget['grid']) => void
  onSelect?: (widgetId: string) => void
  selected?: boolean
  widget: BoardWidget
}): ReactElement {
  const drag = useRef<{
    mode: 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
    x: number
    y: number
    grabOffsetX: number
    grabOffsetY: number
    grid: BoardWidget['grid']
    rect: DOMRect
  } | null>(null)

  function startDrag(event: PointerEvent, mode: NonNullable<typeof drag.current>['mode']): void {
    if (!editable) return
    const grid = event.currentTarget.closest('.board-grid')?.getBoundingClientRect()
    const panel = event.currentTarget.closest('.board-widget-panel')?.getBoundingClientRect()
    if (!grid) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    drag.current = {
      mode,
      x: event.clientX,
      y: event.clientY,
      grabOffsetX: panel ? event.clientX - panel.left : 0,
      grabOffsetY: panel ? event.clientY - panel.top : 0,
      grid: widget.grid,
      rect: grid
    }
  }

  function finishDrag(event: PointerEvent): void {
    if (!drag.current || !onChange) return
    const unitW = drag.current.rect.width / 16
    const unitH = drag.current.rect.height / 8
    const next =
      drag.current.mode === 'move'
        ? helpers.pointerMoveWidgetGridWithOffset(
            drag.current.grid,
            drag.current.rect,
            event.clientX,
            event.clientY,
            drag.current.grabOffsetX,
            drag.current.grabOffsetY
          )
        : helpers.resizeWidgetGrid(
            drag.current.grid,
            widget.type,
            widget.config,
            drag.current.mode,
            Math.round((event.clientX - drag.current.x) / unitW),
            Math.round((event.clientY - drag.current.y) / unitH)
          )
    drag.current = null
    onChange(widget, next)
  }

  return (
    <article
      className={`${onSelect ? 'board-widget-panel selectable' : 'board-widget-panel'} ${selected ? 'selected-layout' : ''}`}
      onClick={() => onSelect?.(widget.id)}
      onPointerUp={finishDrag}
      style={{
        gridColumn: `${widget.grid.x} / span ${widget.grid.w}`,
        gridRow: `${widget.grid.y} / span ${widget.grid.h}`
      }}
    >
      <header onPointerDown={(event) => startDrag(event, 'move')}>
        <div className="board-widget-header">
          <WidgetTypeIcon type={widget.type} />
          <h3>{compact ? 'Widget' : widget.name}</h3>
        </div>
      </header>
      <div className="widget-body">
        <WidgetRenderer compact={compact} widget={widget} />
      </div>
      {editable &&
        (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const).map((handle) => (
          <button className={`resize-handle ${handle}`} key={handle} onPointerDown={(event) => startDrag(event, handle)} type="button" />
        ))}
    </article>
  )
}

function BirthdayGiftModal({
  birthdayItem,
  birthdayList,
  helpers,
  lists,
  onClose,
  runAction
}: {
  birthdayItem: BoardItem
  birthdayList: BoardList
  helpers: BoardDisplayHelpers
  lists: BoardList[]
  onClose: () => void
  runAction: RunAction
}): ReactElement {
  const birthdayName = helpers.itemTitle(birthdayItem, birthdayList)
  const birthdayColumn = helpers.birthdayCoreColumns(birthdayList).find((column) => helpers.isBirthdayDateColumn(column))
  const occurrence = birthdayColumn ? helpers.birthdayOccurrenceDate(birthdayItem.values[birthdayColumn.id]) : null
  const [targetListId, setTargetListId] = useState(lists[0]?.id ?? '')
  const [title, setTitle] = useState(`Get present for ${birthdayName}`)
  const [deadline, setDeadline] = useState(occurrence ? helpers.localDateTimeInputValue(helpers.dayBeforeBirthday(occurrence)) : '')

  useEffect(() => {
    setTargetListId(lists[0]?.id ?? '')
    setTitle(`Get present for ${birthdayName}`)
    setDeadline(occurrence ? helpers.localDateTimeInputValue(helpers.dayBeforeBirthday(occurrence)) : '')
  }, [birthdayItem.id, birthdayList.id, birthdayName, helpers, lists, occurrence])

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const targetList = lists.find((list) => list.id === targetListId)
    if (!targetList) return
    const values = helpers.blankValues(helpers.editableItemColumns(targetList))
    const nameColumn = helpers.editableItemColumns(targetList)[0]
    if (nameColumn) values[nameColumn.id] = title
    if (targetList.dueDateEnabled && targetList.dueDateColumnId && deadline) {
      values[targetList.dueDateColumnId] = deadline
    }
    const result = await runAction(async () => {
      return window.lpl.createItem({ listId: targetList.id, groupId: null, values, dependencyItemIds: [] })
    })
    if (result && 'lists' in result) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog">
        <form onSubmit={(event) => void submit(event)}>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Birthday Gift Task</p>
              <h3>{birthdayName}</h3>
            </div>
          </div>
          <div className="modal-body modal-body-form">
            <label className="modal-field">
              <span>Target list</span>
              <select onChange={(event) => setTargetListId(event.target.value)} value={targetListId}>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="modal-field">
              <span>Task title</span>
              <input onChange={(event) => setTitle(event.target.value)} required value={title} />
            </label>
            <label className="modal-field">
              <span>Deadline</span>
              <input onChange={(event) => setDeadline(event.target.value)} type="datetime-local" value={deadline} />
            </label>
          </div>
          <div className="modal-actions">
            <button className="icon-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" disabled={!targetListId} type="submit">
              <Gift size={16} />
              Create Gift Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DaySummaryModal({
  helpers,
  mode,
  onClose,
  snapshot
}: {
  helpers: BoardDisplayHelpers
  mode: 'today' | 'next24h'
  onClose: () => void
  snapshot: BoardSnapshot
}): ReactElement {
  const entries = helpers.collectDaySummaryEntries(snapshot, mode)
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="modal-card modal-card-wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Day Summary</p>
            <h3>{mode === 'today' ? 'Today Until Midnight' : 'Next 24 Hours'}</h3>
          </div>
        </div>
        <div className="modal-body">
          {entries.length === 0 ? (
            <p>Nothing scheduled in this window.</p>
          ) : (
            <div className="summary-entry-list">
              {entries.map((entry) => (
                <article className="summary-entry-card" key={entry.id}>
                  <div>
                    <strong>{entry.title}</strong>
                    <p>{entry.subtitle}</p>
                  </div>
                  <div className="summary-entry-meta">
                    <span>{entry.source}</span>
                    <strong>{entry.whenLabel}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="primary-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function boardColumnLabel(column: ListColumn): string {
  return column.displayName?.trim() || column.name
}
