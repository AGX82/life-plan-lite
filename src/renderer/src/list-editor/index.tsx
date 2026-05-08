import { Copy, Plus, Save, Trash2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { FormEvent, useEffect, useRef, useState } from 'react'
import type { ComponentProps, Dispatch, ReactElement, SetStateAction } from 'react'
import type {
  AppSettings,
  BirthdayBoardView,
  BoardItem,
  BoardList,
  BoardSnapshot,
  BoardSummary,
  ColumnSortOrder,
  ColumnType,
  ItemGroup,
  ListBehavior,
  ListColumn,
  ListSortDirection,
  ListTemplateType,
  WishlistRecommendationProfile
} from '@shared/domain'
import type { ConfirmDialogState, RunAction, SelectedNode } from '../app/types'
import { formatCellValue } from '../editors/itemFieldHelpers'
import { ItemEditorPanel } from '../editors/itemEditor'
import { visibleColumns } from '../lists/helpers'
import { ConfirmActionModal, MessageModal } from '../modals/dialogs'
import { columnDraftFromColumn, columnDraftMatchesColumn, columnDraftsForList, columnDraftToInput } from './drafts'
import type { ColumnDraft } from './drafts'
import { birthdayBoardViewOptions, columnTypes, wishlistRecommendationProfileOptions } from './options'
import { ColumnRow, ColumnSummaryRow, SystemColumnRow } from './rows'
import { orderedStructureFieldEntries } from './structure'

type ListEditorSharedItemHelpers = ComponentProps<typeof ItemEditorPanel>['helpers']

export type ListEditorHelpers = {
  birthdayCoreColumns: (list: BoardList) => ListColumn[]
  columnSortOrderOptions: Array<{ value: ColumnSortOrder; label: string }>
  defaultListBehavior: (templateType: ListTemplateType) => ListBehavior
  groupName: (groupId: string | null, list: BoardList) => string
  isBirthdayDateColumn: (column: ListColumn) => boolean
  listBehaviorOptions: Array<{ value: ListBehavior; label: string }>
  listInput: (list: BoardList) => Parameters<typeof window.lpl.updateList>[0]
  listTemplateConfigForSave: (
    templateType: ListTemplateType,
    listBehavior: ListBehavior,
    systemDisplayNames: { itemId: string; dependencies: string; createdAt: string; createdBy: string; status: string },
    birthdayBoardView: BirthdayBoardView,
    wishlistProfile: WishlistRecommendationProfile,
    showWishlistAdvisedBuyOrder: boolean,
    wishlistAdvisedBuyOrderDisplayName: string,
    boardFieldOrder: string[]
  ) => BoardList['templateConfig']
  listTemplateGridSizes: (templateType: ListTemplateType) => Array<Pick<BoardList['grid'], 'w' | 'h'>>
  listTemplateOptions: Array<{ value: ListTemplateType; label: string; description: string }>
  minListGridHeight: number
  minListGridWidth: number
  newestGroup: (list: BoardList | undefined) => ItemGroup | undefined
  placeListForDisplay: (
    lists: BoardList[],
    widgets: BoardSnapshot['widgets'],
    listId: string,
    preferred: BoardList['grid']
  ) => { grid: BoardList['grid']; moved: Array<{ list: BoardList; grid: BoardList['grid'] }> } | null
  placeListForDisplaySizes: (
    lists: BoardList[],
    widgets: BoardSnapshot['widgets'],
    listId: string,
    sizes: Array<Pick<BoardList['grid'], 'w' | 'h'>>
  ) => { grid: BoardList['grid']; moved: Array<{ list: BoardList; grid: BoardList['grid'] }> } | null
  sharedItemEditorHelpers: ListEditorSharedItemHelpers
  sortDirectionOptions: (column: ListColumn) => { value: Exclude<ListSortDirection, 'manual'>; label: string }[]
  statusLabel: (item: BoardItem) => string
  validDisplayGrid: (grid: BoardList['grid']) => boolean
}

export function ListEditorPanel({
  appSettings,
  boards,
  busy,
  helpers,
  list,
  onClose,
  presentation = 'panel',
  runAction,
  setSelectedNode,
  snapshot
}: {
  appSettings: AppSettings
  boards: BoardSummary[]
  busy: boolean
  helpers: ListEditorHelpers
  list: BoardList
  onClose?: () => void
  presentation?: 'panel' | 'modal'
  runAction: RunAction
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const [name, setName] = useState(list.name)
  const [templateType, setTemplateType] = useState<ListTemplateType>(list.templateType)
  const [listBehavior, setListBehavior] = useState<ListBehavior>(list.templateConfig.behavior ?? 'other')
  const [grid, setGrid] = useState(list.grid)
  const [displayEnabled, setDisplayEnabled] = useState(list.displayEnabled)
  const [dueDateEnabled, setDueDateEnabled] = useState(list.dueDateEnabled)
  const [deadlineMandatory, setDeadlineMandatory] = useState(list.deadlineMandatory)
  const [sortColumnId, setSortColumnId] = useState<string | null>(list.sortColumnId)
  const [sortDirection, setSortDirection] = useState<ListSortDirection>(list.sortDirection)
  const [columnSortOrder, setColumnSortOrder] = useState<ColumnSortOrder>(list.columnSortOrder)
  const [showItemIdOnBoard, setShowItemIdOnBoard] = useState(list.showItemIdOnBoard)
  const [showDependenciesOnBoard, setShowDependenciesOnBoard] = useState(list.showDependenciesOnBoard)
  const [showCreatedAtOnBoard, setShowCreatedAtOnBoard] = useState(list.showCreatedAtOnBoard)
  const [showCreatedByOnBoard, setShowCreatedByOnBoard] = useState(list.showCreatedByOnBoard)
  const [showStatusOnBoard, setShowStatusOnBoard] = useState(list.showStatusOnBoard)
  const [systemDisplayNames, setSystemDisplayNames] = useState(() => ({
    itemId: list.templateConfig.systemDisplayNames?.itemId ?? '',
    dependencies: list.templateConfig.systemDisplayNames?.dependencies ?? '',
    createdAt: list.templateConfig.systemDisplayNames?.createdAt ?? '',
    createdBy: list.templateConfig.systemDisplayNames?.createdBy ?? '',
    status: list.templateConfig.systemDisplayNames?.status ?? ''
  }))
  const [birthdayBoardView, setBirthdayBoardView] = useState<BirthdayBoardView>(list.templateConfig.birthday?.boardView ?? 'this_month')
  const [wishlistProfile, setWishlistProfile] = useState<WishlistRecommendationProfile>(list.templateConfig.wishlist?.profile ?? 'default')
  const [showWishlistAdvisedBuyOrder, setShowWishlistAdvisedBuyOrder] = useState(list.templateConfig.wishlist?.showAdvisedBuyOrder ?? false)
  const [wishlistAdvisedBuyOrderDisplayName, setWishlistAdvisedBuyOrderDisplayName] = useState(list.templateConfig.wishlist?.advisedBuyOrderDisplayName ?? '')
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnType, setNewColumnType] = useState<ColumnType>('text')
  const [addColumnOnTop, setAddColumnOnTop] = useState(appSettings.addColumnOnTopByBoard[list.boardId] ?? false)
  const [moveTargetBoardId, setMoveTargetBoardId] = useState('')
  const [copyTargetBoardId, setCopyTargetBoardId] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null)
  const [messageDialog, setMessageDialog] = useState<{ title: string; message: string } | null>(null)
  const [showCreateItemModal, setShowCreateItemModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'properties' | 'structure' | 'contents' | 'settings' | 'summary'>('properties')
  const [columnDrafts, setColumnDrafts] = useState<Record<string, ColumnDraft>>(() => columnDraftsForList(list))
  const newColumnInputRef = useRef<HTMLInputElement | null>(null)
  const birthdaySortColumn =
    templateType === 'birthday_calendar' ? helpers.birthdayCoreColumns(list).find((column) => helpers.isBirthdayDateColumn(column)) ?? null : null
  const effectiveSortColumnId = templateType === 'birthday_calendar' ? birthdaySortColumn?.id ?? sortColumnId : sortColumnId
  const effectiveSortDirection: ListSortDirection = templateType === 'birthday_calendar' ? 'asc' : sortDirection
  const sortColumn = effectiveSortColumnId ? visibleColumns(list).find((column) => column.id === effectiveSortColumnId) : null

  useEffect(() => {
    setName(list.name)
    setListBehavior(list.templateConfig.behavior ?? 'other')
    setTemplateType(list.templateType)
    setGrid(list.grid)
    setDisplayEnabled(list.displayEnabled)
    setDueDateEnabled(list.dueDateEnabled)
    setDeadlineMandatory(list.deadlineMandatory)
    setSortColumnId(list.sortColumnId)
    setSortDirection(list.sortDirection)
    setColumnSortOrder(list.columnSortOrder)
    setShowItemIdOnBoard(list.showItemIdOnBoard)
    setShowDependenciesOnBoard(list.showDependenciesOnBoard)
    setShowCreatedAtOnBoard(list.showCreatedAtOnBoard)
    setShowCreatedByOnBoard(list.showCreatedByOnBoard)
    setShowStatusOnBoard(list.showStatusOnBoard)
    setSystemDisplayNames({
      itemId: list.templateConfig.systemDisplayNames?.itemId ?? '',
      dependencies: list.templateConfig.systemDisplayNames?.dependencies ?? '',
      createdAt: list.templateConfig.systemDisplayNames?.createdAt ?? '',
      createdBy: list.templateConfig.systemDisplayNames?.createdBy ?? '',
      status: list.templateConfig.systemDisplayNames?.status ?? ''
    })
    setBirthdayBoardView(list.templateConfig.birthday?.boardView ?? 'this_month')
    setWishlistProfile(list.templateConfig.wishlist?.profile ?? 'default')
    setShowWishlistAdvisedBuyOrder(list.templateConfig.wishlist?.showAdvisedBuyOrder ?? false)
    setWishlistAdvisedBuyOrderDisplayName(list.templateConfig.wishlist?.advisedBuyOrderDisplayName ?? '')
    setMoveTargetBoardId('')
    setCopyTargetBoardId('')
    setActiveTab('properties')
    setColumnDrafts(columnDraftsForList(list))
  }, [list.id])

  useEffect(() => {
    setAddColumnOnTop(appSettings.addColumnOnTopByBoard[list.boardId] ?? false)
  }, [appSettings.addColumnOnTopByBoard, list.boardId])

  useEffect(() => {
    setColumnDrafts((current) => {
      const next: Record<string, ColumnDraft> = {}
      for (const column of visibleColumns(list)) {
        next[column.id] = current[column.id] ?? columnDraftFromColumn(column)
      }
      return next
    })
  }, [list.columns, list.dueDateEnabled])

  useEffect(() => {
    setGrid(list.grid)
    setDisplayEnabled(list.displayEnabled)
  }, [list.displayEnabled, list.grid.h, list.grid.w, list.grid.x, list.grid.y])

  const hasTemplateSettings = templateType === 'birthday_calendar' || templateType === 'wishlist'
  const structureRows = orderedStructureFieldEntries(
    list,
    systemDisplayNames,
    {
      itemId: showItemIdOnBoard,
      dependencies: showDependenciesOnBoard,
      createdAt: showCreatedAtOnBoard,
      createdBy: showCreatedByOnBoard,
      status: showStatusOnBoard
    },
    {
      showAdvisedBuyOrder: showWishlistAdvisedBuyOrder,
      advisedBuyOrderDisplayName: wishlistAdvisedBuyOrderDisplayName
    }
  )

  function submit(event: FormEvent): void {
    event.preventDefault()
    saveList(displayEnabled, grid)
  }

  function saveList(
    nextDisplayEnabled = displayEnabled,
    candidateGrid = grid,
    boardFieldOrderOverride: string[] | null = null,
    systemVisibility: {
      showItemIdOnBoard?: boolean
      showDependenciesOnBoard?: boolean
      showCreatedAtOnBoard?: boolean
      showCreatedByOnBoard?: boolean
      showStatusOnBoard?: boolean
    } = {}
  ): void {
    const nextShowItemIdOnBoard = systemVisibility.showItemIdOnBoard ?? showItemIdOnBoard
    const nextShowDependenciesOnBoard = systemVisibility.showDependenciesOnBoard ?? showDependenciesOnBoard
    const nextShowCreatedAtOnBoard = systemVisibility.showCreatedAtOnBoard ?? showCreatedAtOnBoard
    const nextShowCreatedByOnBoard = systemVisibility.showCreatedByOnBoard ?? showCreatedByOnBoard
    const nextShowStatusOnBoard = systemVisibility.showStatusOnBoard ?? showStatusOnBoard
    const placement = nextDisplayEnabled
      ? !displayEnabled || !helpers.validDisplayGrid(candidateGrid)
        ? helpers.placeListForDisplaySizes(snapshot.lists, snapshot.widgets, list.id, helpers.listTemplateGridSizes(templateType))
        : helpers.placeListForDisplay(snapshot.lists, snapshot.widgets, list.id, candidateGrid)
      : { grid: { x: 0, y: 0, w: 0, h: 0 }, moved: [] }
    if (nextDisplayEnabled && !placement) {
      setMessageDialog({
        title: 'No Space Available',
        message: 'This list cannot be shown because the board has no available 4 x 2 slot. Hide another list or resize the layout first.'
      })
      return
    }
    const nextGrid = placement?.grid ?? { x: 0, y: 0, w: 0, h: 0 }

    setDisplayEnabled(nextDisplayEnabled)
    setGrid(nextGrid)
    setShowItemIdOnBoard(nextShowItemIdOnBoard)
    setShowDependenciesOnBoard(nextShowDependenciesOnBoard)
    setShowCreatedAtOnBoard(nextShowCreatedAtOnBoard)
    setShowCreatedByOnBoard(nextShowCreatedByOnBoard)
    setShowStatusOnBoard(nextShowStatusOnBoard)
    runAction(async () => {
      if ((placement?.moved.length ?? 0) > 0) {
        await window.lpl.updateListLayouts([
          { listId: list.id, grid: nextGrid },
          ...(placement?.moved ?? []).map((moved) => ({ listId: moved.list.id, grid: moved.grid }))
        ])
      }
      if (templateType === list.templateType) {
        for (const column of visibleColumns(list)) {
          const draft = columnDrafts[column.id]
          if (draft && !columnDraftMatchesColumn(draft, column)) {
            await window.lpl.updateColumn(columnDraftToInput(column, draft))
          }
        }
      }
      return window.lpl.updateList({
        listId: list.id,
        name,
        templateType,
        templateConfig: helpers.listTemplateConfigForSave(
          templateType,
          listBehavior,
          systemDisplayNames,
          birthdayBoardView,
          wishlistProfile,
          showWishlistAdvisedBuyOrder,
          wishlistAdvisedBuyOrderDisplayName,
          boardFieldOrderOverride ?? structureRows.map((row) => row.key)
        ),
        grid: nextGrid,
        dueDateEnabled,
        dueDateColumnId: list.dueDateColumnId,
        deadlineMandatory,
        columnSortOrder,
        sortColumnId: effectiveSortColumnId,
        sortDirection: effectiveSortColumnId ? effectiveSortDirection : 'manual',
        displayEnabled: nextDisplayEnabled,
        showItemIdOnBoard: nextShowItemIdOnBoard,
        showDependenciesOnBoard: nextShowDependenciesOnBoard,
        showCreatedAtOnBoard: nextShowCreatedAtOnBoard,
        showCreatedByOnBoard: nextShowCreatedByOnBoard,
        showStatusOnBoard: nextShowStatusOnBoard
      })
    })
  }

  function persistBoardFieldOrder(nextOrder: string[], column?: ListColumn): void {
    runAction(async () => {
      if (column) {
        const draft = columnDrafts[column.id] ?? columnDraftFromColumn(column)
        const nextColumnOrder = nextOrder.filter((key) => visibleColumns(list).some((candidate) => candidate.id === key))
        const nextColumnIndex = nextColumnOrder.indexOf(column.id)
        if (nextColumnIndex >= 0) {
          await window.lpl.updateColumn({ ...columnDraftToInput(column, draft), order: nextColumnIndex + 1 })
        }
      }
      return window.lpl.updateList({
        listId: list.id,
        name,
        templateType,
        templateConfig: helpers.listTemplateConfigForSave(
          templateType,
          listBehavior,
          systemDisplayNames,
          birthdayBoardView,
          wishlistProfile,
          showWishlistAdvisedBuyOrder,
          wishlistAdvisedBuyOrderDisplayName,
          nextOrder
        ),
        grid,
        dueDateEnabled,
        dueDateColumnId: list.dueDateColumnId,
        deadlineMandatory,
        columnSortOrder,
        sortColumnId: effectiveSortColumnId,
        sortDirection: effectiveSortColumnId ? effectiveSortDirection : 'manual',
        displayEnabled,
        showItemIdOnBoard,
        showDependenciesOnBoard,
        showCreatedAtOnBoard,
        showCreatedByOnBoard,
        showStatusOnBoard
      })
    })
  }

  function updateColumnDraft(column: ListColumn, patch: Partial<ColumnDraft>): void {
    setColumnDrafts((current) => ({
      ...current,
      [column.id]: {
        ...(current[column.id] ?? columnDraftFromColumn(column)),
        ...patch
      }
    }))
    if (column.role === 'deadline' && patch.required !== undefined) {
      setDeadlineMandatory(patch.required)
    }
  }

  function saveColumnDraft(column: ListColumn): void {
    const draft = columnDrafts[column.id] ?? columnDraftFromColumn(column)
    runAction(async () => {
      await window.lpl.updateColumn(columnDraftToInput(column, draft))
      if (column.role === 'deadline' && draft.required !== list.deadlineMandatory) {
        return window.lpl.updateList({
          ...helpers.listInput(list),
          deadlineMandatory: draft.required,
          dueDateEnabled: true
        })
      }
      return window.lpl.getBoardSnapshot(list.boardId, 'admin')
    })
  }

  function updateColumnOrder(column: ListColumn, order: number): void {
    const keys = structureRows.map((row) => row.key)
    const currentIndex = keys.indexOf(column.id)
    if (currentIndex < 0) return
    const next = [...keys]
    const [moved] = next.splice(currentIndex, 1)
    next.splice(Math.max(0, Math.min(order - 1, next.length)), 0, moved)
    persistBoardFieldOrder(next, column)
  }

  function updateSystemFieldOrder(rowKey: string, order: number): void {
    const keys = structureRows.map((row) => row.key)
    const currentIndex = keys.indexOf(rowKey)
    if (currentIndex < 0) return
    const next = [...keys]
    const [moved] = next.splice(currentIndex, 1)
    next.splice(Math.max(0, Math.min(order - 1, next.length)), 0, moved)
    persistBoardFieldOrder(next)
  }

  function saveStructureBoardSettings(): void {
    saveList(displayEnabled, grid, structureRows.map((row) => row.key))
  }

  function requestDeleteList(): void {
    setConfirmDialog({
      title: 'Delete List',
      message: `Delete "${list.name}" and all child items?`,
      confirmLabel: 'Delete List',
      destructive: true,
      onConfirm: async () => {
        await runAction(() => window.lpl.deleteList(list.id))
        if (presentation === 'modal') {
          onClose?.()
          return
        }
        setSelectedNode({ kind: 'board', id: snapshot.id })
      }
    })
  }

  function addColumn(event: FormEvent): void {
    event.preventDefault()
    if (!newColumnName.trim()) {
      newColumnInputRef.current?.focus()
      setMessageDialog({ title: 'Please enter column name', message: 'Please enter column name' })
      return
    }
    runAction(() =>
      window.lpl.createColumn({
        listId: list.id,
        name: newColumnName,
        type: newColumnType,
        addOnTop: addColumnOnTop,
        columnSortOrder
      })
    )
    setNewColumnName('')
    setNewColumnType('text')
  }

  function updateAddColumnOnTopPreference(checked: boolean): void {
    setAddColumnOnTop(checked)
    runAction(() =>
      window.lpl.updateAppSettings({
        ...appSettings,
        addColumnOnTopByBoard: {
          ...appSettings.addColumnOnTopByBoard,
          [list.boardId]: checked
        }
      })
    )
  }

  function addGroup(): void {
    runAction(async () => {
      const result = await window.lpl.createGroup({ listId: list.id, name: 'New Group' })
      if (result && 'lists' in result) {
        const created = helpers.newestGroup(result.lists.find((candidate) => candidate.id === list.id))
        if (created) setSelectedNode({ kind: 'group', id: created.id })
      }
      return result
    })
  }

  const content = (
    <div className="editor-tabbed editor-tabbed-list" data-tutorial-id="list-editor-shell">
      <div className="editor-tabbar">
        <div className="editor-tab-buttons">
          <button className={activeTab === 'properties' ? 'editor-tab active' : 'editor-tab'} data-tutorial-id="list-tab-properties" onClick={() => setActiveTab('properties')} type="button">
            List Properties
          </button>
          <button className={activeTab === 'structure' ? 'editor-tab active' : 'editor-tab'} data-tutorial-id="list-tab-structure" onClick={() => setActiveTab('structure')} type="button">
            List Structure
          </button>
          <button className={activeTab === 'contents' ? 'editor-tab active' : 'editor-tab'} data-tutorial-id="list-tab-contents" onClick={() => setActiveTab('contents')} type="button">
            List Contents
          </button>
          <button className={activeTab === 'settings' ? 'editor-tab active' : 'editor-tab'} data-tutorial-id="list-tab-settings" onClick={() => setActiveTab('settings')} type="button">
            List Settings
          </button>
          <button className={activeTab === 'summary' ? 'editor-tab active' : 'editor-tab'} data-tutorial-id="list-tab-summary" onClick={() => setActiveTab('summary')} type="button">
            List Summary
          </button>
        </div>
        <div className="editor-tab-actions">
          <label className="editor-sort-order-field">
            <span>Sort Order</span>
            <select onChange={(event) => setColumnSortOrder(event.target.value as ColumnSortOrder)} value={columnSortOrder}>
              <option value="default">Default</option>
              <option value="manual">Manual</option>
              <option disabled value="">
                ──────────
              </option>
              {helpers.columnSortOrderOptions
                .filter((option) => option.value !== 'default' && option.value !== 'manual')
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
          <button className="danger-button" disabled={busy} onClick={requestDeleteList} type="button">
            <Trash2 size={16} />
            Delete List
          </button>
          <button className="primary-button" disabled={busy} onClick={() => saveList(displayEnabled, grid)} type="button">
            <Save size={16} />
            Save List
          </button>
        </div>
      </div>
      <div className="editor-tab-content">
        {activeTab === 'properties' && (
          <form className="list-tab-panel" data-tutorial-id="list-panel-properties" onSubmit={submit}>
            <div className="list-general-panel">
              <div className="list-general-top">
                <div className="list-general-main-fields">
                  <label>
                    <span>List Name</span>
                    <input autoFocus={list.name === 'New List'} onChange={(event) => setName(event.target.value)} required value={name} />
                  </label>
                  <label>
                    <span>List Template</span>
                    <select
                      onChange={(event) => {
                        const nextType = event.target.value as ListTemplateType
                        setTemplateType(nextType)
                        setListBehavior(helpers.defaultListBehavior(nextType))
                        if (nextType === 'birthday_calendar') {
                          setDueDateEnabled(false)
                          setDeadlineMandatory(false)
                          const birthdayColumn = helpers.birthdayCoreColumns(list).find((column) => helpers.isBirthdayDateColumn(column))
                          setSortColumnId(birthdayColumn?.id ?? null)
                          setSortDirection('asc')
                        }
                        if (nextType === 'wishlist') {
                          setWishlistProfile('default')
                          setShowWishlistAdvisedBuyOrder(false)
                        }
                      }}
                      value={templateType}
                    >
                      {helpers.listTemplateOptions.map((template) => (
                        <option key={template.value} value={template.value}>
                          {template.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {templateType === 'custom' && (
                    <label>
                      <span>List Behaviour</span>
                      <select onChange={(event) => setListBehavior(event.target.value as ListBehavior)} value={listBehavior}>
                        {helpers.listBehaviorOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    <span>Sort by</span>
                    <select
                      disabled={templateType === 'birthday_calendar'}
                      onChange={(event) => {
                        const nextColumnId = event.target.value || null
                        setSortColumnId(nextColumnId)
                        const nextColumn = visibleColumns(list).find((column) => column.id === nextColumnId)
                        setSortDirection(nextColumn ? helpers.sortDirectionOptions(nextColumn)[0]?.value ?? 'manual' : 'manual')
                      }}
                      value={effectiveSortColumnId ?? ''}
                    >
                      <option value="">Manual order</option>
                      {visibleColumns(list).map((column) => (
                        <option key={column.id} value={column.id}>
                          {column.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Sort Order</span>
                    <select disabled={!sortColumn || templateType === 'birthday_calendar'} onChange={(event) => setSortDirection(event.target.value as ListSortDirection)} value={sortColumn ? effectiveSortDirection : 'manual'}>
                      <option value="manual">Manual</option>
                      {sortColumn &&
                        helpers.sortDirectionOptions(sortColumn).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="list-settings-stack">
                  <label className="list-setting-toggle">
                    <input checked={displayEnabled} onChange={(event) => saveList(event.target.checked)} type="checkbox" />
                    <span>Show List on Board</span>
                  </label>
                  <div className="list-settings-pair">
                    <label className="list-setting-toggle">
                      <input
                        checked={dueDateEnabled}
                        disabled={templateType === 'birthday_calendar'}
                        onChange={(event) => {
                          setDueDateEnabled(event.target.checked)
                          if (!event.target.checked) setDeadlineMandatory(false)
                        }}
                        type="checkbox"
                      />
                      <span>Enable Deadline Field</span>
                    </label>
                    <label className="list-setting-toggle">
                      <input checked={deadlineMandatory} disabled={!dueDateEnabled || templateType === 'birthday_calendar'} onChange={(event) => setDeadlineMandatory(event.target.checked)} type="checkbox" />
                      <span>Deadline Mandatory?</span>
                    </label>
                  </div>
                  {templateType === 'shopping_list' && dueDateEnabled && <p className="list-setting-help">For shopping lists, the deadline field is displayed as Needed By.</p>}
                </div>
              </div>
              <div className="list-general-bottom">
                <section className="list-general-subpanel quick-actions-panel">
                  <h4>List Transfer</h4>
                  <div className="quick-actions-layout">
                    <div className="quick-actions-row quick-actions-row-transfer">
                      <label className="quick-actions-transfer-field">
                        <span>Copy List To:</span>
                        <div className="quick-actions-inline">
                          <select onChange={(event) => setCopyTargetBoardId(event.target.value)} value={copyTargetBoardId}>
                            <option value="">Target board...</option>
                            {boards
                              .filter((board) => board.id !== list.boardId)
                              .map((board) => (
                                <option key={board.id} value={board.id}>
                                  {board.name}
                                </option>
                              ))}
                          </select>
                          <button className="icon-button" disabled={!copyTargetBoardId} onClick={() => runAction(() => window.lpl.copyListToBoard({ listId: list.id, targetBoardId: copyTargetBoardId }))} type="button">
                            Copy
                          </button>
                        </div>
                      </label>
                      <label className="quick-actions-transfer-field">
                        <span>Move List To:</span>
                        <div className="quick-actions-inline">
                          <select onChange={(event) => setMoveTargetBoardId(event.target.value)} value={moveTargetBoardId}>
                            <option value="">Target board...</option>
                            {boards
                              .filter((board) => board.id !== list.boardId)
                              .map((board) => (
                                <option key={board.id} value={board.id}>
                                  {board.name}
                                </option>
                              ))}
                          </select>
                          <button className="icon-button" disabled={!moveTargetBoardId} onClick={() => runAction(() => window.lpl.moveListToBoard({ listId: list.id, targetBoardId: moveTargetBoardId }))} type="button">
                            Move
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>
                </section>
                <section className="list-general-subpanel">
                  <h4>List Size &amp; Grid Placement</h4>
                  <p>Use the controls below to manually adjust the list size &amp; position on the grid</p>
                  <div className="geometry-row geometry-row-wide">
                    {([
                      ['h', 'Height'],
                      ['w', 'Width'],
                      ['x', 'X-Position'],
                      ['y', 'Y-Position']
                    ] as const).map(([key, label]) => (
                      <label key={key}>
                        <span>{label}</span>
                        <input
                          max={key === 'x' || key === 'w' ? 16 : 8}
                          min={displayEnabled && key === 'w' ? helpers.minListGridWidth : displayEnabled && key === 'h' ? helpers.minListGridHeight : 1}
                          onChange={(event) => setGrid((current) => ({ ...current, [key]: Number(event.target.value) }))}
                          type="number"
                          value={grid[key]}
                        />
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'settings' && (
          <section className="list-tab-panel" data-tutorial-id="list-panel-settings">
            {hasTemplateSettings ? (
              <div className="field-grid two">
                {templateType === 'birthday_calendar' && (
                  <label>
                    <span>Board birthday view</span>
                    <select onChange={(event) => setBirthdayBoardView(event.target.value as BirthdayBoardView)} value={birthdayBoardView}>
                      {birthdayBoardViewOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {templateType === 'wishlist' && (
                  <label>
                    <span>Recommendation profile</span>
                    <select onChange={(event) => setWishlistProfile(event.target.value as WishlistRecommendationProfile)} value={wishlistProfile}>
                      {wishlistRecommendationProfileOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <small className="field-help-text">{wishlistRecommendationProfileOptions.find((option) => option.value === wishlistProfile)?.description}</small>
                  </label>
                )}
              </div>
            ) : (
              <div className="empty-editor-state">No template-specific settings for this list.</div>
            )}
          </section>
        )}

        {activeTab === 'structure' && (
          <section className="list-tab-panel list-structure-tab-panel" data-tutorial-id="list-panel-structure">
            <div className={templateType === 'birthday_calendar' ? 'column-list-table has-structure-note' : 'column-list-table'}>
              {templateType === 'birthday_calendar' && <p className="locked-template-note">Birthday Calendar keeps its core fields protected, but you can still add extra fields around them.</p>}
              <form className="add-column-row" onSubmit={addColumn}>
                <input onChange={(event) => setNewColumnName(event.target.value)} placeholder="New column" ref={newColumnInputRef} value={newColumnName} />
                <select onChange={(event) => setNewColumnType(event.target.value as ColumnType)} value={newColumnType}>
                  {columnTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <label className="add-on-top-toggle">
                  <input checked={addColumnOnTop} onChange={(event) => updateAddColumnOnTopPreference(event.target.checked)} type="checkbox" />
                  Add on top
                </label>
                <button className="icon-button" type="submit">
                  <Plus size={16} />
                  Add Column
                </button>
              </form>
              <div className="column-list-header">
                <span>Column Name</span>
                <span>Board Label</span>
                <span>Field Type</span>
                <span>Required</span>
                <span>Show</span>
                <span>Order</span>
                <span>Actions</span>
              </div>
              <div className="column-list-scroll">
                <div className="column-list">
                  {structureRows.map((row, index) =>
                    row.kind === 'column' ? (
                      <ColumnRow
                        column={row.column}
                        draft={columnDrafts[row.column.id] ?? columnDraftFromColumn(row.column)}
                        key={row.key}
                        list={list}
                        locked={false}
                        manualOrderEnabled={columnSortOrder === 'manual'}
                        order={index + 1}
                        orderCount={structureRows.length}
                        onDraftChange={(patch) => updateColumnDraft(row.column, patch)}
                        onOrderChange={(order) => updateColumnOrder(row.column, order)}
                        onSave={() => saveColumnDraft(row.column)}
                        runAction={runAction}
                      />
                    ) : (
                      <SystemColumnRow
                        displayName={row.displayName}
                        key={row.key}
                        manualOrderEnabled={columnSortOrder === 'manual'}
                        name={row.name}
                        onDisplayNameChange={(value) => {
                          if (row.kind === 'system') setSystemDisplayNames((current) => ({ ...current, [row.field]: value }))
                          else setWishlistAdvisedBuyOrderDisplayName(value)
                        }}
                        onOrderChange={(order) => updateSystemFieldOrder(row.key, order)}
                        onSave={saveStructureBoardSettings}
                        onToggle={(checked) => {
                          if (row.kind === 'system') {
                            if (row.field === 'itemId') setShowItemIdOnBoard(checked)
                            if (row.field === 'dependencies') setShowDependenciesOnBoard(checked)
                            if (row.field === 'createdAt') setShowCreatedAtOnBoard(checked)
                            if (row.field === 'createdBy') setShowCreatedByOnBoard(checked)
                            if (row.field === 'status') setShowStatusOnBoard(checked)
                          } else {
                            setShowWishlistAdvisedBuyOrder(checked)
                          }
                        }}
                        order={index + 1}
                        orderCount={structureRows.length}
                        showOnBoard={row.showOnBoard}
                        statusLabel={row.statusLabel}
                        typeLabel={row.typeLabel}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'contents' && (
          <section className="list-tab-panel list-items-tab-panel" data-tutorial-id="list-panel-contents">
            <div className="list-tab-action-row">
              <button className="icon-button" onClick={() => setShowCreateItemModal(true)} type="button">
                <Plus size={16} />
                Add Item
              </button>
              {list.templateType !== 'birthday_calendar' && (
                <button className="icon-button" onClick={addGroup} type="button">
                  <Plus size={16} />
                  Add Group
                </button>
              )}
            </div>
            <div className="admin-table expanded sticky-header-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Group</th>
                    {visibleColumns(list).map((column) => (
                      <th key={column.id}>{column.name}</th>
                    ))}
                    {list.dueDateEnabled && showStatusOnBoard && <th>Status</th>}
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((item) => (
                    <tr key={item.id} onClick={() => setSelectedNode({ kind: 'item', id: item.id })}>
                      <td className="code-cell">{item.displayCode}</td>
                      <td>{helpers.groupName(item.groupId, list)}</td>
                      {visibleColumns(list).map((column) => (
                        <td key={column.id}>{formatCellValue(item.values[column.id], column)}</td>
                      ))}
                      {list.dueDateEnabled && showStatusOnBoard && <td>{item.deadlineStatus}</td>}
                      <td>{helpers.statusLabel(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'summary' && (
          <section className="list-tab-panel list-summary-tab-panel" data-tutorial-id="list-panel-summary">
            <div className="column-list-table">
              <div className="summary-list-header">
                <span>Column</span>
                <span>Behavior</span>
                <span>List Summary</span>
                <span>Board Summary</span>
              </div>
              <div className="summary-list-scroll">
                {visibleColumns(list).map((column) => (
                  <ColumnSummaryRow key={column.id} column={column} list={list} runAction={runAction} />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
      {showCreateItemModal && (
        <ItemEditorPanel
          appSettings={appSettings}
          busy={busy}
          helpers={helpers.sharedItemEditorHelpers}
          item={null}
          mode="create"
          onClose={() => setShowCreateItemModal(false)}
          presentation="modal"
          list={list}
          runAction={runAction}
          snapshot={snapshot}
        />
      )}
      {confirmDialog && (
        <ConfirmActionModal
          busy={busy}
          confirmLabel={confirmDialog.confirmLabel}
          destructive={confirmDialog.destructive}
          message={confirmDialog.message}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={async () => {
            await confirmDialog.onConfirm()
            setConfirmDialog(null)
          }}
          title={confirmDialog.title}
        />
      )}
      {messageDialog && <MessageModal title={messageDialog.title} message={messageDialog.message} onClose={() => setMessageDialog(null)} />}
    </div>
  )

  if (presentation === 'modal' && onClose) {
    return createPortal(
      <div className="modal-backdrop" onClick={onClose} role="presentation">
        <div aria-modal="true" className="modal-card modal-card-large modal-list-editor" onClick={(event) => event.stopPropagation()} role="dialog">
          {content}
        </div>
      </div>,
      document.body
    )
  }

  return content
}
