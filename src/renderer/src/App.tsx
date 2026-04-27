import {
  AlarmClock,
  BookOpenText,
  LayoutGrid,
  List,
  Check,
  ChevronDown,
  ChevronRight,
  CloudSun,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Gift,
  Globe2,
  Grip,
  Pencil,
  Plus,
  Power,
  Save,
  Settings2,
  SunMedium,
  SquarePen,
  Trash2,
  X
} from 'lucide-react'
import { FormEvent, PointerEvent, useEffect, useRef, useState } from 'react'
import type { Dispatch, ReactElement, SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import lplLogo from './assets/lpl_logo.png'
import type {
  AggregationMethod,
  AppSettings,
  AppTheme,
  BirthdayBoardView,
  BoardItem,
  BoardList,
  BoardSnapshot,
  BoardSummary,
  BoardWidget,
  BoardWidgetConfig,
  ChoiceConfig,
  CloseConfirmationMode,
  ColumnType,
  CreateWidgetInput,
  CurrencyCode,
  DateFieldValue,
  DateDisplayFormat,
  DisplayState,
  DurationDisplayFormat,
  ColumnSortOrder,
  FieldValue,
  GroupSummaryConfig,
  GroupSummaryMethod,
  ItemGroup,
  ListBehavior,
  ListColumn,
  ListTemplateType,
  ListSortDirection,
  RecurrenceMode,
  SummarySlot,
  UpdateColumnInput,
  UpdateWidgetInput,
  WidgetType,
  WorldClockLocation
} from '@shared/domain'

type Route = 'admin' | 'display'

type FormValues = Record<string, FieldValue>

type AppActionResult = BoardSnapshot | DisplayState | AppSettings | void
type RunAction = (action: () => Promise<AppActionResult>) => Promise<AppActionResult>

type ColumnDraft = {
  name: string
  type: ColumnType
  required: boolean
  choiceConfig: ChoiceConfig
  choicesDraft: string
  dateDisplayFormat: DateDisplayFormat
  durationDisplayFormat: DurationDisplayFormat
  currencyCode: CurrencyCode
  showOnBoard: boolean
}

type SelectedNode =
  | { kind: 'board'; id: string }
  | { kind: 'list'; id: string }
  | { kind: 'group'; id: string }
  | { kind: 'item'; id: string }
  | { kind: 'widget'; id: string }

type ContextMenuState = {
  x: number
  y: number
  node: SelectedNode
} | null

type BoardRailMenuState = {
  x: number
  y: number
  board: BoardSummary
} | null

type EditableSummarySlot = Omit<SummarySlot, 'value'>

type ConfirmDialogState = {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
} | null

type PromptDialogState = {
  title: string
  label: string
  initialValue: string
  confirmLabel?: string
  onConfirm: (value: string) => void | Promise<void>
} | null

const columnTypes: ColumnType[] = ['text', 'integer', 'decimal', 'currency', 'duration', 'date', 'boolean', 'choice', 'hyperlink']
const columnSortOrderOptions: Array<{ value: ColumnSortOrder; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'manual', label: 'Manual' },
  { value: 'name', label: 'By Name' },
  { value: 'field_type', label: 'By Field Type' },
  { value: 'required', label: 'By Required' },
  { value: 'visibility', label: 'By Visibility' }
]
const currencyOptions: Array<{ code: CurrencyCode; label: string }> = [
  { code: 'RON', label: 'RON - Romanian leu' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'USD', label: 'USD - US dollar' },
  { code: 'GBP', label: 'GBP - Pound sterling' },
  { code: 'CNY', label: 'CNY - Chinese yuan' },
  { code: 'JPY', label: 'JPY - Japanese yen' },
  { code: 'CAD', label: 'CAD - Canadian dollar' },
  { code: 'AUD', label: 'AUD - Australian dollar' },
  { code: 'CHF', label: 'CHF - Swiss franc' },
  { code: 'PLN', label: 'PLN - Polish zloty' }
]
const MIN_LIST_GRID_WIDTH = 2
const MIN_LIST_GRID_HEIGHT = 2
const themeOptions: Array<{ value: AppTheme; label: string; className: string }> = [
  { value: 'midnight_clear', label: 'Midnight Clear', className: 'theme-midnight-clear' },
  { value: 'liquid_gunmetal', label: 'Liquid Gunmetal', className: 'theme-liquid-gunmetal' },
  { value: 'black_glass_blue', label: 'Black Glass Blue', className: 'theme-black-glass-blue' }
]
const weekdayLabels = [
  { short: 'S', long: 'Sun' },
  { short: 'M', long: 'Mon' },
  { short: 'T', long: 'Tue' },
  { short: 'W', long: 'Wed' },
  { short: 'T', long: 'Thu' },
  { short: 'F', long: 'Fri' },
  { short: 'S', long: 'Sat' }
]
const widgetTypes: Array<{ value: WidgetType; label: string; icon: typeof Clock3 }> = [
  { value: 'clock', label: 'Clock', icon: Clock3 },
  { value: 'weather', label: 'Weather', icon: CloudSun },
  { value: 'word_of_day', label: 'Word of the Day', icon: BookOpenText },
  { value: 'world_clocks', label: 'World Clocks', icon: Globe2 },
  { value: 'countdown', label: 'Countdown', icon: AlarmClock }
]
const listTemplateOptions: Array<{ value: ListTemplateType; label: string; description: string }> = [
  { value: 'todo', label: 'To Do', description: 'Tasks with deadlines, priority, people, effort, progress and comments.' },
  { value: 'shopping_list', label: 'Shopping List', description: 'Products, pieces, store, needed-by date, price, calculated cost and link.' },
  { value: 'wishlist', label: 'Wishlist', description: 'Desired products with links and a fun Wishmeter ranking.' },
  { value: 'health', label: 'Health', description: 'One health list with check-ups, recurring appointments, investigations and treatment.' },
  { value: 'trips_events', label: 'Trips & Events', description: 'Plans with start/end dates, type, topic and location.' },
  { value: 'birthday_calendar', label: 'Birthday Calendar', description: 'Birthdays with turning age, location and gift-task action.' },
  { value: 'custom', label: 'Build Custom List', description: 'Start with a single title field and shape the rest yourself.' }
]
const listBehaviorOptions: Array<{ value: ListBehavior; label: string }> = [
  { value: 'tasks', label: 'Task List' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'other', label: 'Other' }
]
const systemBoardSummaryOptions: Array<{ value: AggregationMethod; label: string }> = [
  { value: 'open_tasks', label: 'Board: Open Tasks' },
  { value: 'board_items', label: 'Board: Board Items' },
  { value: 'total_board_entries', label: 'Board: Total Board Entries' },
  { value: 'total_purchases', label: 'Board: Total Purchases' },
  { value: 'total_effort_tasks', label: 'Board: Total Effort on Tasks' },
  { value: 'overdue_items', label: 'Board: Overdue Items' },
  { value: 'overdue_tasks', label: 'Board: Overdue Tasks' },
  { value: 'archived_items', label: 'Board: Archived Items' }
]
const birthdayBoardViewOptions: Array<{ value: BirthdayBoardView; label: string }> = [
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'next_10_days', label: 'Next 10 days' },
  { value: 'next_30_days', label: 'Next 30 days' },
  { value: 'next_2_months', label: 'Next 2 months' },
  { value: 'all', label: 'All birthdays' }
]
const fallbackWorldClockTimeZones = [
  'Europe/Bucharest',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney'
]
const worldClockTimeZones =
  typeof Intl.supportedValuesOf === 'function'
    ? (Intl.supportedValuesOf('timeZone') as string[])
    : fallbackWorldClockTimeZones

function routeFromHash(): Route {
  return window.location.hash.includes('display') ? 'display' : 'admin'
}

function isTextEntryActive(): boolean {
  const element = document.activeElement
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
}

export function App(): ReactElement {
  const [route, setRoute] = useState<Route>(routeFromHash())
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null)
  const [previewSnapshot, setPreviewSnapshot] = useState<BoardSnapshot | null>(null)
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [displayState, setDisplayState] = useState<DisplayState | null>(null)
  const [appSettings, setAppSettings] = useState<AppSettings>({ closeConfirmationMode: 'with_comments', theme: 'midnight_clear', addColumnOnTopByBoard: {} })
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null)
  const [messageDialog, setMessageDialog] = useState<{ title: string; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const editingBoardId = useRef<string | null>(null)

  async function load(nextRoute = route, boardId = editingBoardId.current): Promise<void> {
    const [nextSnapshot, nextPreviewSnapshot, nextBoards, nextDisplayState, nextAppSettings] = await Promise.all([
      nextRoute === 'admin' && boardId ? window.lpl.getBoardSnapshot(boardId, 'admin') : window.lpl.getActiveBoardSnapshot(nextRoute),
      nextRoute === 'admin' && boardId ? window.lpl.getBoardSnapshot(boardId, 'display') : window.lpl.getActiveBoardSnapshot('display'),
      window.lpl.listBoards(),
      window.lpl.getDisplayState(),
      window.lpl.getAppSettings()
    ])
    setSnapshot(nextSnapshot)
    setPreviewSnapshot(nextPreviewSnapshot)
    editingBoardId.current = nextSnapshot.id
    setBoards(nextBoards)
    setDisplayState(nextDisplayState)
    setAppSettings(nextAppSettings)
    setSelectedNode((current) => (current && nodeExists(current, nextSnapshot) ? current : { kind: 'board', id: nextSnapshot.id }))
  }

  async function runAction(action: () => Promise<AppActionResult>): Promise<AppActionResult> {
    setBusy(true)
    try {
      const result = await action()
      if (result && 'lists' in result) {
        setSnapshot(result)
        const nextPreviewSnapshot = await window.lpl.getBoardSnapshot(result.id, 'display')
        setPreviewSnapshot(nextPreviewSnapshot)
        editingBoardId.current = result.id
      }
      if (result && 'displays' in result) setDisplayState(result)
      if (result && 'closeConfirmationMode' in result) setAppSettings(result)
      const [nextBoards, nextDisplayState, nextAppSettings] = await Promise.all([
        window.lpl.listBoards(),
        window.lpl.getDisplayState(),
        window.lpl.getAppSettings()
      ])
      setBoards(nextBoards)
      setDisplayState(nextDisplayState)
      setAppSettings(nextAppSettings)
      return result
    } catch (error) {
      setMessageDialog({
        title: 'Unable to complete action',
        message: error instanceof Error ? error.message : 'Something went wrong.'
      })
      return undefined
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    load(route)
    const unsubscribe = window.lpl.onDataChanged(() => {
      const nextRoute = routeFromHash()
      if (nextRoute === 'admin' && isTextEntryActive()) return
      load(nextRoute, editingBoardId.current)
    })
    const onHashChange = (): void => {
      const nextRoute = routeFromHash()
      setRoute(nextRoute)
      load(nextRoute, editingBoardId.current)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => {
      unsubscribe()
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  if (!snapshot) {
    return <div className="loading">Loading Life Plan Lite...</div>
  }

  const currentThemeClass = themeClassName(appSettings.theme)

  if (route === 'display') {
    return (
      <DisplayBoard
        appSettings={appSettings}
        appThemeClass={currentThemeClass}
        busy={busy}
        runAction={runAction}
        selectedWidgetId={undefined}
        snapshot={snapshot}
        onAdmin={async () => {
          const result = await window.lpl.requestAdminMode()
          if (result.switchInPlace) window.location.hash = '/admin'
        }}
      />
    )
  }

  return (
    <AdminApp
      globalMessageDialog={messageDialog}
      setGlobalMessageDialog={setMessageDialog}
      boards={boards}
      busy={busy}
      displayState={displayState}
      appSettings={appSettings}
      appThemeClass={currentThemeClass}
      previewSnapshot={previewSnapshot ?? snapshot}
      runAction={runAction}
      onSelectBoard={(boardId) => {
        editingBoardId.current = boardId
        setSelectedNode({ kind: 'board', id: boardId })
        load('admin', boardId)
      }}
      selectedNode={selectedNode ?? { kind: 'board', id: snapshot.id }}
      setSelectedNode={setSelectedNode}
      snapshot={snapshot}
    />
  )
}

function AdminApp({
  appSettings,
  appThemeClass,
  boards,
  busy,
  displayState,
  globalMessageDialog,
  previewSnapshot,
  runAction,
  onSelectBoard,
  selectedNode,
  setGlobalMessageDialog,
  setSelectedNode,
  snapshot
}: {
  appSettings: AppSettings
  appThemeClass: string
  boards: BoardSummary[]
  busy: boolean
  displayState: DisplayState | null
  globalMessageDialog: { title: string; message: string } | null
  previewSnapshot: BoardSnapshot
  runAction: RunAction
  onSelectBoard: (boardId: string) => void
  selectedNode: SelectedNode
  setGlobalMessageDialog: Dispatch<SetStateAction<{ title: string; message: string } | null>>
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [boardMenu, setBoardMenu] = useState<BoardRailMenuState>(null)
  const [boardDeleteDialog, setBoardDeleteDialog] = useState<BoardSummary | null>(null)
  const [newListDialogOpen, setNewListDialogOpen] = useState(false)
  const allItems = snapshot.lists.flatMap((list) => list.items)

  function closeMenu(): void {
    setContextMenu(null)
    setBoardMenu(null)
  }

  return (
    <main className={`admin-shell ${appThemeClass}`} onClick={closeMenu}>
      <aside className="side-rail">
        <div className="side-brand" aria-label="Life Plan Lite">
          <img alt="Life Plan Lite" className="side-brand-image" src={lplLogo} />
        </div>
        <section className="side-board-section">
          <p className="side-section-label">Available Boards</p>
          <div className="board-list">
            {boards.map((board) => (
              <button
                className={board.active ? 'nav-button active' : 'nav-button'}
                disabled={busy}
                key={board.id}
                onClick={() => {
                  onSelectBoard(board.id)
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setBoardMenu({
                    x: event.clientX,
                    y: event.clientY,
                    board
                  })
                }}
              >
                {board.name}
              </button>
            ))}
            <button
              className="icon-button wide"
              disabled={busy}
              onClick={async () => {
                const result = await runAction(() => window.lpl.createBoard({ name: 'New Board' }))
                if (result && 'lists' in result) setSelectedNode({ kind: 'board', id: result.id })
              }}
            >
              <Plus size={16} />
              Add Board
            </button>
          </div>
        </section>
        <div className="side-actions">
          <BoardVisibilityControl busy={busy} displayState={displayState} runAction={runAction} />
          <button className="icon-button wide" onClick={() => (window.location.hash = '/display')}>
            <ExternalLink size={18} />
            View Here
          </button>
          <button className="danger-button wide" disabled={busy} onClick={() => window.lpl.closeApp()}>
            <Power size={18} />
            Exit App
          </button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-toolbar">
          <div>
            <p className="eyebrow">Admin Mode</p>
          </div>
          <div className="toolbar-actions" />
        </header>

        <div className="admin-content redesigned">
          <NavigationTree
            boards={boards}
            onRequestNewList={() => setNewListDialogOpen(true)}
            onContextMenu={setContextMenu}
            runAction={runAction}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
            snapshot={snapshot}
          />

          <section className="admin-workspace">
            <div className="workspace-edit">
              <header className="pane-heading workspace-heading">
                <div className="pane-heading-inline">
                  <h3>Edit Panel</h3>
                </div>
              </header>
              <PropertyEditor
                allItems={allItems}
                appSettings={appSettings}
                boards={boards}
                busy={busy}
                runAction={runAction}
                selectedNode={selectedNode}
                setSelectedNode={setSelectedNode}
                snapshot={snapshot}
              />
            </div>

            <div className="workspace-lower">
              <BoardPreviewWidget
                layoutSnapshot={snapshot}
                runAction={runAction}
                selectedNode={selectedNode}
                setSelectedNode={setSelectedNode}
                snapshot={previewSnapshot}
              />
              <ApplicationSettingsPanel appSettings={appSettings} busy={busy} displayState={displayState} runAction={runAction} />
            </div>
          </section>
        </div>
      </section>

      {contextMenu && (
        <TreeContextMenu
          menu={contextMenu}
          onRequestNewList={() => setNewListDialogOpen(true)}
          runAction={runAction}
          setSelectedNode={setSelectedNode}
          snapshot={snapshot}
          onClose={closeMenu}
        />
      )}
      {boardMenu && (
        <BoardRailContextMenu
          board={boardMenu.board}
          onClose={closeMenu}
          onDuplicate={async () => {
            const result = await runAction(() => window.lpl.duplicateBoard({ boardId: boardMenu.board.id }))
            if (result && 'lists' in result) setSelectedNode({ kind: 'board', id: result.id })
            closeMenu()
          }}
          onDelete={() => {
            setBoardDeleteDialog(boardMenu.board)
            closeMenu()
          }}
          x={boardMenu.x}
          y={boardMenu.y}
        />
      )}
      {newListDialogOpen && (
        <NewListTemplateModal
          busy={busy}
          onClose={() => setNewListDialogOpen(false)}
          onSelect={async (templateType) => {
            const result = await runAction(() =>
              window.lpl.createList({
                boardId: snapshot.id,
                name: 'New List',
                templateType
              })
            )
            if (result && 'lists' in result) {
              setSelectedNode({ kind: 'list', id: newestList(result)?.id ?? result.id })
              setNewListDialogOpen(false)
            }
          }}
        />
      )}
      {boardDeleteDialog && (
        <DeleteBoardModal
          board={boardDeleteDialog}
          busy={busy}
          onCancel={() => setBoardDeleteDialog(null)}
          onConfirm={async () => {
            const fallbackBoardId = boards.find((board) => board.id !== boardDeleteDialog.id)?.id ?? null
            const keepBoardId = snapshot.id !== boardDeleteDialog.id ? snapshot.id : fallbackBoardId
            const result = await runAction(() =>
              window.lpl.deleteBoard({
                boardId: boardDeleteDialog.id,
                keepBoardId
              })
            )
            if (result && 'lists' in result) {
              setSelectedNode({ kind: 'board', id: result.id })
              setBoardDeleteDialog(null)
            }
          }}
        />
      )}
      {globalMessageDialog && (
        <MessageModal
          title={globalMessageDialog.title}
          message={globalMessageDialog.message}
          onClose={() => setGlobalMessageDialog(null)}
        />
      )}
    </main>
  )
}

function BoardRailContextMenu({
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
      <button
        onClick={() => {
          onDuplicate()
        }}
        type="button"
      >
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

function ApplicationSettingsPanel({
  appSettings,
  busy,
  displayState,
  runAction
}: {
  appSettings: AppSettings
  busy: boolean
  displayState: DisplayState | null
  runAction: RunAction
}): ReactElement {
  const selectedId = displayState?.selectedDisplayId ?? displayState?.displays[0]?.id ?? ''

  return (
    <aside className="settings-pane">
      <header className="pane-heading">
        <div className="pane-heading-inline">
          <span className="pane-heading-label">Application Settings</span>
        </div>
      </header>
      <div className="display-controls">
        <label>
          <span>Close confirmation</span>
          <select
            disabled={busy}
            onChange={(event) =>
              runAction(() =>
                window.lpl.updateAppSettings({
                  ...appSettings,
                  closeConfirmationMode: event.target.value as CloseConfirmationMode
                })
              )
            }
            value={appSettings.closeConfirmationMode}
          >
            <option value="with_comments">Yes - with comments</option>
            <option value="without_comments">Yes - without comments</option>
            <option value="none">No confirmation</option>
          </select>
        </label>
        <label>
          <span>Display</span>
          <select
            disabled={busy || !displayState?.displays.length}
            onChange={(event) => runAction(() => window.lpl.setDisplayTarget(event.target.value))}
            value={selectedId}
          >
            {displayState?.displays.map((display) => (
              <option key={display.id} value={display.id}>
                {display.label} {display.primary ? '(Primary)' : ''} - {display.bounds.width}x{display.bounds.height}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Theme</span>
          <select
            disabled={busy}
            onChange={(event) =>
              runAction(() =>
                window.lpl.updateAppSettings({
                  ...appSettings,
                  theme: event.target.value as AppTheme
                })
              )
            }
            value={appSettings.theme}
          >
            {themeOptions.map((theme) => (
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </aside>
  )
}

function BoardVisibilityControl({
  busy,
  displayState,
  runAction
}: {
  busy: boolean
  displayState: DisplayState | null
  runAction: RunAction
}): ReactElement {
  return (
    <>
      {displayState?.visible ? (
        <button className="icon-button wide" disabled={busy} onClick={() => runAction(() => window.lpl.hideDisplayWindow())}>
          <EyeOff size={18} />
          Hide Board
        </button>
      ) : (
        <button className="icon-button wide" disabled={busy} onClick={() => runAction(() => window.lpl.openDisplayWindow())}>
          <Eye size={18} />
          Show Board
        </button>
      )}
    </>
  )
}

function NavigationTree({
  boards,
  onRequestNewList,
  onContextMenu,
  runAction,
  selectedNode,
  setSelectedNode,
  snapshot
}: {
  boards: BoardSummary[]
  onRequestNewList: () => void
  onContextMenu: (menu: ContextMenuState) => void
  runAction: RunAction
  selectedNode: SelectedNode
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null)
  const activeBoard = boards.find((board) => board.active)

  function openContext(event: React.MouseEvent, node: SelectedNode): void {
    event.preventDefault()
    event.stopPropagation()
    onContextMenu({ x: event.clientX, y: event.clientY, node })
  }

  function itemNode(item: BoardItem, list: BoardList): ReactElement {
    return (
      <button
        className={nodeClass(selectedNode, { kind: 'item', id: item.id })}
        key={item.id}
        onClick={() => setSelectedNode({ kind: 'item', id: item.id })}
        onContextMenu={(event) => openContext(event, { kind: 'item', id: item.id })}
      >
        <span>{itemTitle(item, list)}</span>
        <small>{item.displayCode}</small>
      </button>
    )
  }

  function renderGroupNode(group: ItemGroup, list: BoardList): ReactElement {
    const groupExpanded = expandedGroups[group.id] ?? true
    const childGroups = list.groups.filter((candidate) => candidate.parentGroupId === group.id)
    const groupItems = list.items.filter((item) => item.groupId === group.id)
    return (
      <div className="tree-group" key={group.id}>
        <button
          className={nodeClass(selectedNode, { kind: 'group', id: group.id })}
          onClick={() => setSelectedNode({ kind: 'group', id: group.id })}
          onContextMenu={(event) => openContext(event, { kind: 'group', id: group.id })}
        >
          <span
            className="tree-expander"
            onClick={(event) => {
              event.stopPropagation()
              setExpandedGroups((current) => ({ ...current, [group.id]: !groupExpanded }))
            }}
          >
            {groupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span>{group.name}</span>
          <small>{group.code}</small>
        </button>
        {groupExpanded && (
          <div className="tree-children items">
            {childGroups.map((child) => renderGroupNode(child, list))}
            {groupItems.map((item) => itemNode(item, list))}
          </div>
        )}
      </div>
    )
  }

  return (
    <nav className="tree-pane" aria-label="Board content tree">
      <header className="pane-heading">
        <div>
          <p className="tree-pane-title">Board Content Management</p>
          <div className="pane-heading-inline tree-subheading">
            <span className="pane-heading-label">Loaded Board:</span>
            <h3 className="pane-heading-subject">{snapshot.name}</h3>
          </div>
        </div>
      </header>
      <div className="loaded-board-panel">
        {snapshot.active ? (
          <p className="active-board-note">This is the currently active Board.</p>
        ) : (
          <div className="inactive-board-note">
            <p>This board is not currently active;</p>
            <p>The active board is {activeBoard?.name ?? 'not set'}.</p>
            <button
              onClick={() => {
                setConfirmDialog({
                  title: 'Make Board Active',
                  message: `You are about to make ${snapshot.name} the active board, replacing ${activeBoard?.name ?? 'the current active board'}. Proceed?`,
                  confirmLabel: 'Make Active',
                  onConfirm: async () => {
                    await runAction(() => window.lpl.setActiveBoard(snapshot.id))
                  }
                })
              }}
              type="button"
            >
              Make this board the active board
            </button>
          </div>
        )}
      </div>
      <div className="tree-section-row">
        <p className="list-section-label">Lists in this board:</p>
        <button
          className="mini-button tree-action-button"
          onClick={onRequestNewList}
          type="button"
        >
          <List size={13} />
          New List
        </button>
      </div>

      <div className="tree-pane-main">
        <div className="tree-list-scroll">
          <div className="tree-children">
            {snapshot.lists.map((list) => {
              const expanded = expandedLists[list.id] ?? true
              return (
                <div className="tree-group list-tree-card" key={list.id}>
                  <button
                    className={nodeClass(selectedNode, { kind: 'list', id: list.id })}
                    onClick={() => setSelectedNode({ kind: 'list', id: list.id })}
                    onContextMenu={(event) => openContext(event, { kind: 'list', id: list.id })}
                  >
                    <span
                      className="tree-expander"
                      onClick={(event) => {
                        event.stopPropagation()
                        setExpandedLists((current) => ({ ...current, [list.id]: !expanded }))
                      }}
                    >
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span>
                      {list.name}: {list.items.length} open items
                    </span>
                    {list.dueDateEnabled && nextDueLabel(list)}
                  </button>
                  {expanded && (
                    <div className="tree-children groups">
                      {list.groups.filter((group) => !group.parentGroupId).map((group) => renderGroupNode(group, list))}
                      <div className="tree-children items root-items">{list.items.filter((item) => !item.groupId).map((item) => itemNode(item, list))}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div className="tree-section-row tree-widget-section-header">
          <p className="list-section-label widget-section-label">Widgets in this board:</p>
          <button
            className="mini-button tree-action-button"
            onClick={async () => {
              const result = await runAction(() =>
                window.lpl.createWidget({
                  boardId: snapshot.id,
                  type: 'clock',
                  name: 'New Widget'
                })
              )
              if (result && 'lists' in result) {
                const created = newestWidget(result)
                if (created) setSelectedNode({ kind: 'widget', id: created.id })
              }
            }}
            type="button"
          >
            <LayoutGrid size={13} />
            New Widget
          </button>
        </div>
        <div className="tree-widget-scroll">
          <div className="tree-widget-grid">
            {snapshot.widgets.map((widget) => {
              const widgetMeta = widgetTypes.find((entry) => entry.value === widget.type)
              const WidgetIcon = widgetMeta?.icon ?? Clock3
              return (
                <button
                  className={nodeClass(selectedNode, { kind: 'widget', id: widget.id })}
                  key={widget.id}
                  onClick={() => setSelectedNode({ kind: 'widget', id: widget.id })}
                  onContextMenu={(event) => openContext(event, { kind: 'widget', id: widget.id })}
                >
                  <span className="widget-node-label">
                    <WidgetIcon size={14} />
                    {widget.name}
                  </span>
                  <small>{widgetMeta?.label ?? 'Widget'}</small>
                </button>
              )
            })}
          </div>
        </div>
      </div>
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
          }}
          title={confirmDialog.title}
        />
      )}
    </nav>
  )
}

function TreeContextMenu({
  menu,
  onClose,
  onRequestNewList,
  runAction,
  setSelectedNode,
  snapshot
}: {
  menu: NonNullable<ContextMenuState>
  onClose: () => void
  onRequestNewList: () => void
  runAction: RunAction
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const nodeList = menu.node.kind === 'list' ? snapshot.lists.find((list) => list.id === menu.node.id) : null
  const nodeGroup =
    menu.node.kind === 'group' ? snapshot.lists.flatMap((list) => list.groups).find((group) => group.id === menu.node.id) : null
  const groupList = nodeGroup ? snapshot.lists.find((list) => list.id === nodeGroup.listId) : null
  const nodeItem =
    menu.node.kind === 'item' ? snapshot.lists.flatMap((list) => list.items).find((item) => item.id === menu.node.id) : null
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
        const created = newestGroup(result.lists.find((list) => list.id === nodeList.id))
        if (created) setSelectedNode({ kind: 'group', id: created.id })
      }
    }
    if (menu.node.kind === 'group' && nodeGroup && groupList) {
      const result = await runAction(() =>
        window.lpl.createItem({
          listId: groupList.id,
          groupId: nodeGroup.id,
          values: blankValues(editableItemColumns(groupList)),
          dependencyItemIds: []
        })
      )
      if (result && 'lists' in result) {
        const created = newestItem(result.lists.find((list) => list.id === groupList.id))
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
          await runAction(() =>
            window.lpl.updateBoard({ boardId: snapshot.id, name, description: snapshot.description, owner: snapshot.owner })
          )
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
          await runAction(() => window.lpl.updateList({ ...listInput(nodeList), name }))
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
      const nameColumn = visibleColumns(itemList)[0]
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

function PropertyEditor({
  allItems,
  appSettings,
  boards,
  busy,
  runAction,
  selectedNode,
  setSelectedNode,
  snapshot
}: {
  allItems: BoardItem[]
  appSettings: AppSettings
  boards: BoardSummary[]
  busy: boolean
  runAction: RunAction
  selectedNode: SelectedNode
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const context = editorWorkspaceContext(selectedNode, snapshot)
  const selectedList =
    selectedNode.kind === 'list'
      ? snapshot.lists.find((list) => list.id === selectedNode.id)
      : selectedNode.kind === 'group'
        ? snapshot.lists.find((list) => list.groups.some((group) => group.id === selectedNode.id))
      : selectedNode.kind === 'item'
        ? snapshot.lists.find((list) => list.items.some((item) => item.id === selectedNode.id))
        : null
  const selectedGroup = selectedList?.groups.find((group) => group.id === selectedNode.id) ?? null
  const selectedItem = selectedList?.items.find((item) => item.id === selectedNode.id) ?? null
  const selectedWidget = selectedNode.kind === 'widget' ? snapshot.widgets.find((widget) => widget.id === selectedNode.id) ?? null : null

  return (
    <section className="property-pane">
      <div className="editor-context-bar">
        <div className="editor-context-inline">
          <span className="editor-context-label">{context.label}</span>
          <strong className="editor-context-subject">{context.subject}</strong>
        </div>
      </div>
      <div className="property-pane-body">
        {selectedNode.kind === 'board' && (
          <BoardEditor
            key={snapshot.id}
            onDuplicate={async () => {
              const result = await runAction(() => window.lpl.duplicateBoard({ boardId: snapshot.id }))
              if (result && 'lists' in result) setSelectedNode({ kind: 'board', id: result.id })
            }}
            runAction={runAction}
            snapshot={snapshot}
          />
        )}
        {selectedNode.kind === 'list' && selectedList && (
          <ListEditorPanel
            allItems={allItems}
            appSettings={appSettings}
            busy={busy}
            boards={boards}
            key={selectedList.id}
            list={selectedList}
            runAction={runAction}
            setSelectedNode={setSelectedNode}
            snapshot={snapshot}
          />
        )}
        {selectedNode.kind === 'group' && selectedGroup && selectedList && (
          <GroupEditorPanel
            allItems={allItems}
            busy={busy}
            group={selectedGroup}
            key={selectedGroup.id}
            list={selectedList}
            runAction={runAction}
            setSelectedNode={setSelectedNode}
            snapshot={snapshot}
          />
        )}
        {selectedNode.kind === 'item' && selectedItem && selectedList && appSettings && (
          <ItemEditorPanel
            appSettings={appSettings}
            busy={busy}
            item={selectedItem}
            key={selectedItem.id}
            list={selectedList}
            runAction={runAction}
            snapshot={snapshot}
          />
        )}
        {selectedNode.kind === 'widget' && selectedWidget && (
          <WidgetEditorPanel key={selectedWidget.id} runAction={runAction} setSelectedNode={setSelectedNode} snapshot={snapshot} widget={selectedWidget} />
        )}
      </div>
    </section>
  )
}

function BoardEditor({
  onDuplicate,
  runAction,
  snapshot
}: {
  onDuplicate: () => void | Promise<void>
  runAction: RunAction
  snapshot: BoardSnapshot
}): ReactElement {
  const [name, setName] = useState(snapshot.name)
  const [description, setDescription] = useState(snapshot.description)
  const [owner, setOwner] = useState(snapshot.owner)
  const [activeTab, setActiveTab] = useState<'properties' | 'summary'>('properties')
  const [summarySlots, setSummarySlots] = useState<EditableSummarySlot[]>(
    snapshot.summarySlots.map(({ value: _value, ...slot }) => slot)
  )
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null)
  const [messageDialog, setMessageDialog] = useState<{ title: string; message: string } | null>(null)

  useEffect(() => {
    setName(snapshot.name)
    setDescription(snapshot.description)
    setOwner(snapshot.owner)
    setSummarySlots(snapshot.summarySlots.map(({ value: _value, ...slot }) => slot))
  }, [snapshot.id, snapshot.summarySlots])

  useEffect(() => {
    setActiveTab('properties')
  }, [snapshot.id])

  const summaryLists = snapshot.lists.filter((list) => list.columns.some((column) => column.boardSummaryEligible))

  function setSlot(slotIndex: number, updater: (slot: EditableSummarySlot) => EditableSummarySlot): void {
    setSummarySlots((current) => current.map((slot) => (slot.slotIndex === slotIndex ? updater(slot) : slot)))
  }

  function eligibleBoardSummaryColumns(listId: string | null): ListColumn[] {
    if (!listId) return []
    const list = snapshot.lists.find((candidate) => candidate.id === listId)
    return list ? visibleColumns(list).filter((column) => column.boardSummaryEligible) : []
  }

  function sourceSelectionValue(slot: EditableSummarySlot): string {
    if (isSystemBoardSummary(slot.aggregationMethod)) return `__board_${slot.aggregationMethod}__`
    return slot.sourceListId ?? ''
  }

  function submit(event: FormEvent): void {
    event.preventDefault()
    const reservedLabel = summarySlots.find((slot) => boardSummaryReservedLabelMessage(slot))
    if (reservedLabel) {
      setMessageDialog({
        title: 'Reserved Summary Label',
        message: boardSummaryReservedLabelMessage(reservedLabel) ?? ''
      })
      return
    }
    runAction(async () => {
      return window.lpl.updateBoard({ boardId: snapshot.id, name, description, owner, summarySlots })
    })
  }

  return (
    <form className="editor-tabbed" onSubmit={submit}>
      <div className="editor-tabbar">
        <button className={activeTab === 'properties' ? 'editor-tab active' : 'editor-tab'} onClick={() => setActiveTab('properties')} type="button">
          Board Properties
        </button>
        <button className={activeTab === 'summary' ? 'editor-tab active' : 'editor-tab'} onClick={() => setActiveTab('summary')} type="button">
          Board Summary
        </button>
      </div>
      <div className="editor-tab-content">
        {activeTab === 'properties' ? (
          <div className="field-grid board-fields board-tab-fields">
            <label>
              <span>Board name</span>
              <input onChange={(event) => setName(event.target.value)} required value={name} />
            </label>
            <label>
              <span>Owner</span>
              <input onChange={(event) => setOwner(event.target.value)} value={owner} />
            </label>
            <label className="board-state-field">
              <span>State</span>
              {snapshot.active ? (
                <div className="board-state-static board-state-control">
                  <span>ACTIVE</span>
                </div>
              ) : (
                <button
                  className="icon-button board-state-control"
                  onClick={() => {
                    setConfirmDialog({
                      title: 'Make Board Active',
                      message: 'This will become the displayed board now. Continue?',
                      confirmLabel: 'Make Active',
                      onConfirm: async () => {
                        await runAction(() => window.lpl.setActiveBoard(snapshot.id))
                      }
                    })
                  }}
                  type="button"
                >
                  <SquarePen size={16} />
                  Make active
                </button>
              )}
            </label>
            <label className="board-wide-field">
              <span>Description</span>
              <input onChange={(event) => setDescription(event.target.value)} value={description} />
            </label>
          </div>
        ) : (
          <div className="board-summary-tab">
            <div className="summary-config-list board-summary-config-list">
              {summarySlots.map((slot) => {
                const fieldOptions = eligibleBoardSummaryColumns(slot.sourceListId)
                return (
                  <div className="board-summary-slot-row" key={slot.slotIndex}>
                    <label>
                      <span>Slot {slot.slotIndex + 1} Label</span>
                      <input
                        onChange={(event) => setSlot(slot.slotIndex, (current) => ({ ...current, label: event.target.value }))}
                        value={slot.label}
                      />
                    </label>
                    <label>
                      <span>Source</span>
                      <select
                        onChange={(event) => {
                          const nextValue = event.target.value
                          if (nextValue.startsWith('__board_')) {
                            const method = nextValue.replace('__board_', '').replace('__', '') as AggregationMethod
                            setSlot(slot.slotIndex, (current) => ({
                              ...current,
                              label: current.label || defaultBoardSummaryLabel(method),
                              sourceListId: null,
                              sourceColumnId: null,
                              aggregationMethod: method
                            }))
                            return
                          }
                          if (!nextValue) {
                            setSlot(slot.slotIndex, (current) => ({
                              ...current,
                              sourceListId: null,
                              sourceColumnId: null,
                              aggregationMethod: 'count'
                            }))
                            return
                          }
                          const nextColumns = eligibleBoardSummaryColumns(nextValue)
                          setSlot(slot.slotIndex, (current) => ({
                            ...current,
                            sourceListId: nextValue,
                            sourceColumnId: nextColumns[0]?.id ?? null,
                            aggregationMethod: nextColumns[0] ? inferredBoardSummaryAggregation(nextColumns[0]) : 'count'
                          }))
                        }}
                        value={sourceSelectionValue(slot)}
                      >
                        <option value="">Empty</option>
                        {systemBoardSummaryOptions.map((option) => (
                          <option key={option.value} value={`__board_${option.value}__`}>
                            {option.label}
                          </option>
                        ))}
                        {summaryLists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Field</span>
                      <select
                        disabled={!slot.sourceListId}
                        onChange={(event) => {
                          const nextColumn = fieldOptions.find((column) => column.id === event.target.value) ?? null
                          setSlot(slot.slotIndex, (current) => ({
                            ...current,
                            sourceColumnId: nextColumn?.id ?? null,
                            aggregationMethod: nextColumn ? inferredBoardSummaryAggregation(nextColumn) : current.aggregationMethod
                          }))
                        }}
                        value={slot.sourceColumnId ?? ''}
                      >
                        <option value="">Select field...</option>
                        {fieldOptions.map((column) => (
                          <option key={column.id} value={column.id}>
                            {column.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <div className="form-actions">
        <button className="icon-button" onClick={() => void onDuplicate()} type="button">
          <Copy size={16} />
          Duplicate Board
        </button>
        <button className="primary-button" type="submit">
          <Save size={16} />
          Save Board
        </button>
      </div>
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
          }}
          title={confirmDialog.title}
        />
      )}
      {messageDialog && <MessageModal title={messageDialog.title} message={messageDialog.message} onClose={() => setMessageDialog(null)} />}
    </form>
  )
}

function boardSummaryReservedLabelMessage(slot: EditableSummarySlot): string | null {
  const normalized = normalizeColumnName(slot.label)
  const reserved = systemBoardSummaryOptions.find((option) => normalizeColumnName(defaultBoardSummaryLabel(option.value)) === normalized)
  if (!reserved) return null
  if (!slot.sourceListId && slot.aggregationMethod === reserved.value) return null
  return `"${defaultBoardSummaryLabel(reserved.value)}" is reserved for the system board summary. Use the ${reserved.label} source, or choose a different label.`
}

function isSystemBoardSummary(method: AggregationMethod): boolean {
  return systemBoardSummaryOptions.some((option) => option.value === method)
}

function defaultBoardSummaryLabel(method: AggregationMethod): string {
  if (method === 'open_tasks') return 'Open Tasks'
  if (method === 'board_items') return 'Board Items'
  if (method === 'total_board_entries') return 'Total Board Entries'
  if (method === 'total_purchases') return 'Total Purchases'
  if (method === 'total_effort_tasks') return 'Total Effort on Tasks'
  if (method === 'overdue_items') return 'Overdue Items'
  if (method === 'overdue_tasks') return 'Overdue Tasks'
  if (method === 'archived_items') return 'Archived Items'
  return ''
}

function isSummarySlotDefined(slot: SummarySlot): boolean {
  return Boolean(slot.sourceListId || isSystemBoardSummary(slot.aggregationMethod))
}

function ListEditorPanel({
  allItems,
  appSettings,
  boards,
  busy,
  list,
  runAction,
  setSelectedNode,
  snapshot
}: {
  allItems: BoardItem[]
  appSettings: AppSettings
  boards: BoardSummary[]
  busy: boolean
  list: BoardList
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
  const [birthdayBoardView, setBirthdayBoardView] = useState<BirthdayBoardView>(list.templateConfig.birthday?.boardView ?? 'this_month')
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
  const birthdaySortColumn = templateType === 'birthday_calendar' ? birthdayCoreColumns(list).find((column) => isBirthdayDateColumn(column)) ?? null : null
  const effectiveSortColumnId = templateType === 'birthday_calendar' ? birthdaySortColumn?.id ?? sortColumnId : sortColumnId
  const effectiveSortDirection: ListSortDirection = templateType === 'birthday_calendar' ? 'asc' : sortDirection
  const sortColumn = effectiveSortColumnId ? visibleColumns(list).find((column) => column.id === effectiveSortColumnId) : null

  useEffect(() => {
    setName(list.name)
    setListBehavior(list.templateConfig.behavior ?? 'other')
    setTemplateType(list.templateType)
    setListBehavior(list.templateConfig.behavior ?? 'other')
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
    setBirthdayBoardView(list.templateConfig.birthday?.boardView ?? 'this_month')
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

  const hasTemplateSettings = templateType === 'birthday_calendar'

  function submit(event: FormEvent): void {
    event.preventDefault()
    saveList(displayEnabled, grid)
  }

  function saveList(
    nextDisplayEnabled = displayEnabled,
    candidateGrid = grid,
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
      ? !displayEnabled || !validDisplayGrid(candidateGrid)
        ? placeListForDisplaySizes(snapshot.lists, snapshot.widgets, list.id, listTemplateGridSizes(templateType))
        : placeListForDisplay(snapshot.lists, snapshot.widgets, list.id, candidateGrid)
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
        templateConfig: listTemplateConfigForSave(templateType, listBehavior, birthdayBoardView),
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
          ...listInput(list),
          deadlineMandatory: draft.required,
          dueDateEnabled: true
        })
      }
      return window.lpl.getBoardSnapshot(list.boardId, 'admin')
    })
  }

  function updateColumnOrder(column: ListColumn, order: number): void {
    const draft = columnDrafts[column.id] ?? columnDraftFromColumn(column)
    runAction(() => window.lpl.updateColumn({ ...columnDraftToInput(column, draft), order }))
  }

  function requestDeleteList(): void {
    setConfirmDialog({
      title: 'Delete List',
      message: `Delete "${list.name}" and all child items?`,
      confirmLabel: 'Delete List',
      destructive: true,
      onConfirm: async () => {
        await runAction(() => window.lpl.deleteList(list.id))
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
        const created = newestGroup(result.lists.find((candidate) => candidate.id === list.id))
        if (created) setSelectedNode({ kind: 'group', id: created.id })
      }
      return result
    })
  }

  return (
    <div className="editor-tabbed editor-tabbed-list">
      <div className="editor-tabbar">
        <div className="editor-tab-buttons">
          <button className={activeTab === 'properties' ? 'editor-tab active' : 'editor-tab'} onClick={() => setActiveTab('properties')} type="button">
            List Properties
          </button>
          <button className={activeTab === 'structure' ? 'editor-tab active' : 'editor-tab'} onClick={() => setActiveTab('structure')} type="button">
            List Structure
          </button>
          <button className={activeTab === 'contents' ? 'editor-tab active' : 'editor-tab'} onClick={() => setActiveTab('contents')} type="button">
            List Contents
          </button>
          <button className={activeTab === 'settings' ? 'editor-tab active' : 'editor-tab'} onClick={() => setActiveTab('settings')} type="button">
            List Settings
          </button>
          <button className={activeTab === 'summary' ? 'editor-tab active' : 'editor-tab'} onClick={() => setActiveTab('summary')} type="button">
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
              {columnSortOrderOptions
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
          <form className="list-tab-panel" onSubmit={submit}>
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
                        setListBehavior(defaultListBehavior(nextType))
                        if (nextType === 'birthday_calendar') {
                          setDueDateEnabled(false)
                          setDeadlineMandatory(false)
                          const birthdayColumn = birthdayCoreColumns(list).find((column) => isBirthdayDateColumn(column))
                          setSortColumnId(birthdayColumn?.id ?? null)
                          setSortDirection('asc')
                        }
                      }}
                      value={templateType}
                    >
                      {listTemplateOptions.map((template) => (
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
                        {listBehaviorOptions.map((option) => (
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
                        setSortDirection(nextColumn ? defaultSortDirection(nextColumn) : 'manual')
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
                    <select
                      disabled={!sortColumn || templateType === 'birthday_calendar'}
                      onChange={(event) => setSortDirection(event.target.value as ListSortDirection)}
                      value={sortColumn ? effectiveSortDirection : 'manual'}
                    >
                      <option value="manual">Manual</option>
                      {sortColumn &&
                        sortDirectionOptions(sortColumn).map((option) => (
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
                      <input
                        checked={deadlineMandatory}
                        disabled={!dueDateEnabled || templateType === 'birthday_calendar'}
                        onChange={(event) => setDeadlineMandatory(event.target.checked)}
                        type="checkbox"
                      />
                      <span>Deadline Mandatory?</span>
                    </label>
                  </div>
                  {templateType === 'shopping_list' && dueDateEnabled && (
                    <p className="list-setting-help">For shopping lists, the deadline field is displayed as Needed By.</p>
                  )}
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
                          <button
                            className="icon-button"
                            disabled={!copyTargetBoardId}
                            onClick={() => runAction(() => window.lpl.copyListToBoard({ listId: list.id, targetBoardId: copyTargetBoardId }))}
                            type="button"
                          >
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
                          <button
                            className="icon-button"
                            disabled={!moveTargetBoardId}
                            onClick={() => runAction(() => window.lpl.moveListToBoard({ listId: list.id, targetBoardId: moveTargetBoardId }))}
                            type="button"
                          >
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
                          min={displayEnabled && key === 'w' ? MIN_LIST_GRID_WIDTH : displayEnabled && key === 'h' ? MIN_LIST_GRID_HEIGHT : 1}
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
          <section className="list-tab-panel">
            {hasTemplateSettings ? (
              <div className="field-grid two">
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
              </div>
            ) : (
              <div className="empty-editor-state">No template-specific settings for this list.</div>
            )}
          </section>
        )}

        {activeTab === 'structure' && (
          <section className="list-tab-panel list-structure-tab-panel">
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
                <span>Field Type</span>
                <span>Required</span>
                <span>Show</span>
                <span>Order</span>
                <span>Actions</span>
              </div>
              <div className="column-list-scroll">
                <div className="column-list">
                  <SystemColumnRow
                    name="Item ID"
                    onToggle={setShowItemIdOnBoard}
                    showOnBoard={showItemIdOnBoard}
                    typeLabel="system"
                  />
                  <SystemColumnRow
                    name="Dependencies"
                    onToggle={setShowDependenciesOnBoard}
                    showOnBoard={showDependenciesOnBoard}
                    typeLabel="system"
                  />
                  <SystemColumnRow
                    name="Created At"
                    onToggle={setShowCreatedAtOnBoard}
                    showOnBoard={showCreatedAtOnBoard}
                    typeLabel="system"
                  />
                  <SystemColumnRow
                    name="Created By"
                    onToggle={setShowCreatedByOnBoard}
                    showOnBoard={showCreatedByOnBoard}
                    typeLabel="system"
                  />
                  <SystemColumnRow
                    name="Status"
                    onToggle={setShowStatusOnBoard}
                    showOnBoard={showStatusOnBoard}
                    typeLabel="system"
                  />
                  {visibleColumns(list).map((column) => (
                    <ColumnRow
                      column={column}
                      draft={columnDrafts[column.id] ?? columnDraftFromColumn(column)}
                      key={column.id}
                      list={list}
                      locked={false}
                      manualOrderEnabled={columnSortOrder === 'manual'}
                      order={visibleColumns(list).findIndex((candidate) => candidate.id === column.id) + 1}
                      orderCount={visibleColumns(list).length}
                      onDraftChange={(patch) => updateColumnDraft(column, patch)}
                      onOrderChange={(order) => updateColumnOrder(column, order)}
                      onSave={() => saveColumnDraft(column)}
                      runAction={runAction}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'contents' && (
          <section className="list-tab-panel list-items-tab-panel">
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
                      <td>{groupName(item.groupId, list)}</td>
                      {visibleColumns(list).map((column) => (
                        <td key={column.id}>{formatCellValue(item.values[column.id], column)}</td>
                      ))}
                      {list.dueDateEnabled && showStatusOnBoard && <td>{item.deadlineStatus}</td>}
                      <td>{statusLabel(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'summary' && (
          <section className="list-tab-panel list-summary-tab-panel">
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
        <BoardItemModal
          allItems={allItems}
          busy={busy}
          item={null}
          list={list}
          mode="create"
          onClose={() => setShowCreateItemModal(false)}
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
    </div>
  )
}

function SystemColumnRow({
  name,
  onToggle,
  showOnBoard,
  typeLabel
}: {
  name: string
  onToggle: (checked: boolean) => void
  showOnBoard: boolean
  typeLabel: string
}): ReactElement {
  return (
    <div className="column-row system-column-row">
      <input disabled value={name} />
      <input disabled value={typeLabel} />
      <span className="readonly-field">System</span>
      <label>
        <input checked={showOnBoard} onChange={(event) => onToggle(event.target.checked)} type="checkbox" />
        Show
      </label>
      <span className="readonly-field column-order-placeholder">-</span>
      <div className="column-actions">
        <button className="mini-button" disabled type="button">
          Save
        </button>
        <button className="mini-button danger-mini" disabled type="button">
          Delete
        </button>
      </div>
    </div>
  )
}

function columnDraftFromColumn(column: ListColumn): ColumnDraft {
  const choiceConfig = column.choiceConfig ?? defaultChoiceConfig(column.name)
  return {
    name: column.name,
    type: column.type,
    required: column.required,
    choiceConfig,
    choicesDraft: choiceConfigToText(choiceConfig),
    dateDisplayFormat: column.dateDisplayFormat,
    durationDisplayFormat: column.durationDisplayFormat,
    currencyCode: column.currencyCode,
    showOnBoard: column.showOnBoard
  }
}

function columnDraftsForList(list: BoardList): Record<string, ColumnDraft> {
  return Object.fromEntries(visibleColumns(list).map((column) => [column.id, columnDraftFromColumn(column)]))
}

function columnDraftChoiceConfig(draft: ColumnDraft): ChoiceConfig | null {
  return draft.type === 'choice'
    ? { ...draft.choiceConfig, options: parseChoiceOptions(draft.choicesDraft, draft.choiceConfig) }
    : null
}

function columnDraftToInput(column: ListColumn, draft: ColumnDraft): UpdateColumnInput {
  return {
    columnId: column.id,
    name: draft.name,
    type: draft.type,
    required: draft.required,
    maxLength: column.maxLength,
    listSummaryEligible: column.listSummaryEligible,
    boardSummaryEligible: column.boardSummaryEligible,
    choiceConfig: columnDraftChoiceConfig(draft),
    dateDisplayFormat: draft.type === 'date' ? draft.dateDisplayFormat : 'date',
    durationDisplayFormat: draft.type === 'duration' ? draft.durationDisplayFormat : 'days_hours',
    recurrence: 'none',
    recurrenceDays: [],
    currencyCode: draft.type === 'currency' ? draft.currencyCode : 'USD',
    showOnBoard: draft.showOnBoard
  }
}

function columnDraftMatchesColumn(draft: ColumnDraft, column: ListColumn): boolean {
  const original = columnDraftFromColumn(column)
  const originalChoice = columnDraftChoiceConfig(original)
  const draftChoice = columnDraftChoiceConfig(draft)
  return (
    draft.name === original.name &&
    draft.type === original.type &&
    draft.required === original.required &&
    draft.dateDisplayFormat === original.dateDisplayFormat &&
    draft.durationDisplayFormat === original.durationDisplayFormat &&
    draft.currencyCode === original.currencyCode &&
    draft.showOnBoard === original.showOnBoard &&
    JSON.stringify(draftChoice) === JSON.stringify(originalChoice)
  )
}

function ColumnRow({
  column,
  draft,
  list,
  locked = false,
  manualOrderEnabled,
  order,
  orderCount,
  onDraftChange,
  onOrderChange,
  onSave,
  runAction
}: {
  column: ListColumn
  draft: ColumnDraft
  list: BoardList
  locked?: boolean
  manualOrderEnabled: boolean
  order: number
  orderCount: number
  onDraftChange: (patch: Partial<ColumnDraft>) => void
  onOrderChange: (order: number) => void
  onSave: () => void
  runAction: RunAction
}): ReactElement {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null)
  const inheritedShoppingCostCurrency =
    list.templateType === 'shopping_list' && normalizeColumnName(column.name) === 'cost'
      ? list.columns.find((candidate) => normalizeColumnName(candidate.name) === 'price / pc')?.currencyCode ?? draft.currencyCode
      : null

  function save(): void {
    onSave()
  }

  function remove(): void {
    setConfirmDialog({
      title: 'Delete Field',
      message: `Delete "${column.name}"? Existing values stored in this field on child items will be deleted.`,
      confirmLabel: 'Delete Field',
      destructive: true,
      onConfirm: async () => {
        await runAction(() => window.lpl.deleteColumn(column.id))
      }
    })
  }

  return (
    <div className={draft.type === 'choice' || draft.type === 'date' || draft.type === 'currency' || draft.type === 'duration' ? 'column-row column-row-with-config' : 'column-row'}>
      <input disabled={column.role === 'deadline' || locked} onChange={(event) => onDraftChange({ name: event.target.value })} value={draft.name} />
      <select
        disabled={column.role === 'deadline' || locked}
        onChange={(event) => {
          const nextType = event.target.value as ColumnType
          const patch: Partial<ColumnDraft> = { type: nextType }
          if (nextType === 'date') {
            patch.dateDisplayFormat = column.role === 'deadline' ? draft.dateDisplayFormat : 'date'
          }
          if (nextType === 'choice') {
            const nextConfig = draft.choiceConfig.options.length ? draft.choiceConfig : defaultChoiceConfig(draft.name)
            patch.choiceConfig = nextConfig
            patch.choicesDraft = choiceConfigToText(nextConfig)
          }
          onDraftChange(patch)
        }}
        value={draft.type}
      >
        {columnTypes.map((candidate) => (
          <option key={candidate} value={candidate}>
            {candidate}
          </option>
        ))}
      </select>
      <label>
        <input checked={draft.required} disabled={locked} onChange={(event) => onDraftChange({ required: event.target.checked })} type="checkbox" />
        Required
      </label>
      <label>
        <input checked={draft.showOnBoard} disabled={locked} onChange={(event) => onDraftChange({ showOnBoard: event.target.checked })} type="checkbox" />
        Show
      </label>
      <select
        aria-label={`${column.name} sort order`}
        disabled={locked || !manualOrderEnabled}
        onChange={(event) => onOrderChange(Number(event.target.value))}
        value={order}
      >
        {Array.from({ length: orderCount }, (_, index) => index + 1).map((position) => (
          <option key={position} value={position}>
            {position}
          </option>
        ))}
      </select>
      <div className="column-actions">
        <button className="mini-button" disabled={locked} onClick={save} type="button">
          Save
        </button>
        <button className="mini-button danger-mini" disabled={locked || list.columns.length <= 1 || column.role === 'deadline'} onClick={remove} type="button">
          Delete
        </button>
      </div>
      {draft.type === 'date' && (
        <div className="date-config-row">
          <label>
            <span>Display</span>
            <select
              disabled={locked}
              onChange={(event) => onDraftChange({ dateDisplayFormat: event.target.value as DateDisplayFormat })}
              value={draft.dateDisplayFormat}
            >
              <option value="date">Date</option>
              <option value="datetime">Date + time</option>
              {column.role !== 'deadline' && <option value="time">Time only</option>}
            </select>
          </label>
        </div>
      )}
      {draft.type === 'currency' && (
        <div className="date-config-row">
          <label>
            <span>{inheritedShoppingCostCurrency ? 'Currency inherited from Price / pc' : 'Currency'}</span>
            <select
              disabled={locked || Boolean(inheritedShoppingCostCurrency)}
              onChange={(event) => onDraftChange({ currencyCode: event.target.value as CurrencyCode })}
              value={inheritedShoppingCostCurrency ?? draft.currencyCode}
            >
              {currencyOptions.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {draft.type === 'duration' && (
        <div className="date-config-row">
          <label>
            <span>Summary Display</span>
            <select disabled={locked} onChange={(event) => onDraftChange({ durationDisplayFormat: event.target.value as DurationDisplayFormat })} value={draft.durationDisplayFormat}>
              <option value="days_hours">Days + hours</option>
              <option value="hours">Total hours</option>
            </select>
          </label>
        </div>
      )}
      {draft.type === 'choice' && (
        <div className="choice-config-row">
          <label>
            <span>Selection</span>
            <select
              disabled={locked}
              onChange={(event) => onDraftChange({ choiceConfig: { ...draft.choiceConfig, selection: event.target.value === 'multi' ? 'multi' : 'single' } })}
              value={draft.choiceConfig.selection}
            >
              <option value="single">Single</option>
              <option value="multi">Multi</option>
            </select>
          </label>
          <label>
            <input
              checked={draft.choiceConfig.ranked}
              disabled={locked}
              onChange={(event) => onDraftChange({ choiceConfig: { ...draft.choiceConfig, ranked: event.target.checked } })}
              type="checkbox"
            />
            Ranked
          </label>
          <label className="choice-options-field">
            <span>Options</span>
            <textarea
              disabled={locked}
              onChange={(event) => onDraftChange({ choicesDraft: event.target.value })}
              rows={Math.min(5, Math.max(3, draft.choicesDraft.split('\n').length))}
              value={draft.choicesDraft}
            />
          </label>
        </div>
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
          }}
          title={confirmDialog.title}
        />
      )}
    </div>
  )
}

function ColumnSummaryRow({
  column,
  list,
  runAction
}: {
  column: ListColumn
  list: BoardList
  runAction: RunAction
}): ReactElement {
  const listSummaryAllowed = supportsListSummaryForColumn(column)
  const boardSummaryAllowed = supportsBoardSummaryForColumn(column)
  const listSummaryCount = list.columns.filter((candidate) => candidate.listSummaryEligible).length
  const boardSummaryCount = list.columns.filter((candidate) => candidate.boardSummaryEligible).length

  function summaryBehaviorLabel(): string {
    if (!listSummaryAllowed && !boardSummaryAllowed) return 'Not summarizable'
    if (column.role === 'deadline' || column.type === 'date') return 'Next due / overdue'
    if (column.type === 'duration') return 'Sum duration'
    if (column.type === 'currency' || column.type === 'integer' || column.type === 'decimal') return 'Sum'
    return 'Count items'
  }

  function updateSummaryFlags(nextListSummaryEligible: boolean, nextBoardSummaryEligible: boolean): void {
    runAction(() =>
      window.lpl.updateColumn({
        columnId: column.id,
        name: column.name,
        type: column.type,
        required: column.required,
        maxLength: column.maxLength,
        listSummaryEligible: nextListSummaryEligible,
        boardSummaryEligible: nextBoardSummaryEligible,
        choiceConfig: column.choiceConfig,
        dateDisplayFormat: column.dateDisplayFormat,
        durationDisplayFormat: column.durationDisplayFormat,
        recurrence: 'none',
        recurrenceDays: [],
        currencyCode: column.currencyCode,
        showOnBoard: column.showOnBoard
      })
    )
  }

  return (
    <div className="summary-row">
      <span>{column.name}</span>
      <span>{summaryBehaviorLabel()}</span>
      <label>
        <input
          checked={column.listSummaryEligible}
          disabled={!listSummaryAllowed || (!column.listSummaryEligible && listSummaryCount >= 3)}
          onChange={(event) => updateSummaryFlags(event.target.checked, column.boardSummaryEligible)}
          type="checkbox"
        />
      </label>
      <label>
        <input
          checked={column.boardSummaryEligible}
          disabled={!boardSummaryAllowed || (!column.boardSummaryEligible && boardSummaryCount >= 5)}
          onChange={(event) => updateSummaryFlags(column.listSummaryEligible, event.target.checked)}
          type="checkbox"
        />
      </label>
    </div>
  )
}

function GroupEditorPanel({
  allItems,
  busy,
  group,
  list,
  runAction,
  setSelectedNode,
  snapshot
}: {
  allItems: BoardItem[]
  busy: boolean
  group: ItemGroup
  list: BoardList
  runAction: RunAction
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const [name, setName] = useState(group.name)
  const [showIdOnBoard, setShowIdOnBoard] = useState(group.showIdOnBoard)
  const [summaries, setSummaries] = useState<GroupSummaryConfig[]>(group.summaries)
  const [showCreateItemModal, setShowCreateItemModal] = useState(false)

  useEffect(() => {
    setName(group.name)
    setShowIdOnBoard(group.showIdOnBoard)
    setSummaries(group.summaries)
  }, [group.id])

  function submit(event: FormEvent): void {
    event.preventDefault()
    runAction(() => window.lpl.updateGroup({ groupId: group.id, parentGroupId: group.parentGroupId, name, showIdOnBoard, summaries }))
  }

  function setSummary(columnId: string, method: GroupSummaryMethod | ''): void {
    setSummaries((current) => {
      const next = current.filter((summary) => summary.columnId !== columnId)
      return method ? [...next, { columnId, method }] : next
    })
  }

  function summaryMethod(columnId: string): GroupSummaryMethod | '' {
    return summaries.find((summary) => summary.columnId === columnId)?.method ?? ''
  }

  return (
    <form className="editor-card" onSubmit={submit}>
      <EditorHeading eyebrow="Group" title={group.name} />
      <div className="field-grid two">
        <label>
          <span>Group name</span>
          <input onChange={(event) => setName(event.target.value)} required value={name} />
        </label>
        <label className="toggle-field">
          <input checked={showIdOnBoard} onChange={(event) => setShowIdOnBoard(event.target.checked)} type="checkbox" />
          <span>Show group ID</span>
        </label>
      </div>
      <section className="inline-config-panel">
        <EditorHeading eyebrow="Display" title="Group Row Summaries" />
        <div className="summary-config-list">
          {visibleColumns(list).map((column) => (
            <label className="summary-config-row" key={column.id}>
              <span>{column.name}</span>
              <select onChange={(event) => setSummary(column.id, event.target.value as GroupSummaryMethod | '')} value={summaryMethod(column.id)}>
                <option value="">Hide</option>
                <option value="sum">Sum</option>
                <option value="max">Max</option>
                <option value="avg">Avg</option>
                <option value="count"># of items</option>
              </select>
            </label>
          ))}
        </div>
      </section>
      <div className="form-actions">
        <button
          className="icon-button"
          onClick={() => setShowCreateItemModal(true)}
          type="button"
        >
          <Plus size={16} />
          Add Item
        </button>
        <button className="danger-button" onClick={() => runAction(() => window.lpl.deleteGroup(group.id))} type="button">
          <Trash2 size={16} />
          Delete Group
        </button>
        <button className="primary-button" type="submit">
          <Save size={16} />
          Save Group
        </button>
      </div>
      {showCreateItemModal && (
        <BoardItemModal
          allItems={allItems}
          busy={busy}
          item={null}
          list={list}
          mode="create"
          onClose={() => setShowCreateItemModal(false)}
          runAction={runAction}
          snapshot={snapshot}
        />
      )}
    </form>
  )
}

function ItemEditorPanel({
  appSettings,
  busy,
  item,
  list,
  runAction,
  snapshot
}: {
  appSettings: AppSettings
  busy: boolean
  item: BoardItem
  list: BoardList
  runAction: RunAction
  snapshot: BoardSnapshot
}): ReactElement {
  const editableColumns = editableItemColumns(list)
  const [values, setValues] = useState<FormValues>(() => valuesForItem(item, editableColumns))
  const [dependencies, setDependencies] = useState<string[]>(item.dependencyItemIds)
  const [groupId, setGroupId] = useState<string | null>(item.groupId)
  const [activeTab, setActiveTab] = useState<'details' | 'dependencies'>('details')
  const [closeDialog, setCloseDialog] = useState<{ action: 'completed' | 'cancelled' } | null>(null)
  const [closeComment, setCloseComment] = useState('')
  const [closing, setClosing] = useState(false)
  const confirmationMode = appSettings.closeConfirmationMode

  useEffect(() => {
    setValues(valuesForItem(item, editableColumns))
    setDependencies(item.dependencyItemIds)
    setGroupId(item.groupId)
    setActiveTab('details')
  }, [item.id])

  function setValue(column: ListColumn, value: FieldValue): void {
    setValues((current) => ({ ...current, [column.id]: coerceInputValue(column, value) }))
  }

  function submit(event: FormEvent): void {
    event.preventDefault()
    runAction(() => window.lpl.updateItem({ itemId: item.id, groupId, values, dependencyItemIds: dependencies }))
  }

  function requestClose(action: 'completed' | 'cancelled'): void {
    if (confirmationMode === 'none') {
      void confirmClose(action, null)
      return
    }
    setCloseComment('')
    setCloseDialog({ action })
  }

  async function confirmClose(action: 'completed' | 'cancelled', comment: string | null): Promise<void> {
    setClosing(true)
    try {
      await runAction(() => window.lpl.closeItem({ itemId: item.id, action, comment, archiveScope: 'draft' }))
      setCloseDialog(null)
      setCloseComment('')
    } finally {
      setClosing(false)
    }
  }

  return (
    <>
      <form className="editor-tabbed" onSubmit={submit}>
        <div className="editor-tabbar">
          <button className={activeTab === 'details' ? 'editor-tab active' : 'editor-tab'} onClick={() => setActiveTab('details')} type="button">
            Item Details
          </button>
          <button className={activeTab === 'dependencies' ? 'editor-tab active' : 'editor-tab'} onClick={() => setActiveTab('dependencies')} type="button">
            Dependencies
          </button>
        </div>
        <div className="editor-tab-content">
          {activeTab === 'details' && (
            <section className="list-tab-panel item-tab-panel">
              <div className="field-grid two">
                <label>
                  <span>Group</span>
                  <select onChange={(event) => setGroupId(event.target.value || null)} value={groupId ?? ''}>
                    <option value="">List root</option>
                    {groupOptions(list).map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ItemFields columns={editableColumns} setValue={setValue} values={values} />
            </section>
          )}
          {activeTab === 'dependencies' && (
            <section className="list-tab-panel item-tab-panel dependency-tab-panel">
              <DependencyTreePicker
                currentItemId={item.id}
                dependencies={dependencies}
                setDependencies={setDependencies}
                snapshot={snapshot}
              />
            </section>
          )}
        </div>
        <div className="form-actions">
          {item.publicationStatus !== 'draft' && (
            <button className="icon-button" disabled={busy || closing} onClick={() => requestClose('completed')} type="button">
              <Check size={16} />
              Mark Done
            </button>
          )}
          <button className="danger-button" disabled={busy || closing} onClick={() => runAction(() => window.lpl.deleteItem(item.id))} type="button">
            <Trash2 size={16} />
            Delete
          </button>
          <button className="primary-button" type="submit">
            <Save size={16} />
            Save Item
          </button>
        </div>
      </form>
      {closeDialog && (
        <CloseItemModal
          action={closeDialog.action}
          busy={busy || closing}
          comments={closeComment}
          itemTitle={itemTitle(item, list)}
          mode={confirmationMode}
          onCancel={() => {
            setCloseDialog(null)
            setCloseComment('')
          }}
          onCommentsChange={setCloseComment}
          onConfirm={() => confirmClose(closeDialog.action, confirmationMode === 'with_comments' ? closeComment : null)}
        />
      )}
    </>
  )
}

function WidgetEditorPanel({
  runAction,
  setSelectedNode,
  snapshot,
  widget
}: {
  runAction: RunAction
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
  widget: BoardWidget
}): ReactElement {
  const [name, setName] = useState(widget.name)
  const [displayEnabled, setDisplayEnabled] = useState(widget.displayEnabled)
  const [grid, setGrid] = useState(widget.grid)
  const [type, setType] = useState<WidgetType>(widget.type)
  const [config, setConfig] = useState<BoardWidgetConfig>(widget.config)
  const [messageDialog, setMessageDialog] = useState<{ title: string; message: string } | null>(null)

  useEffect(() => {
    setName(widget.name)
    setDisplayEnabled(widget.displayEnabled)
    setGrid(widget.grid)
    setType(widget.type)
    setConfig(widget.config)
  }, [widget.id])

  function submit(event: FormEvent): void {
    event.preventDefault()
    const nextGrid = displayEnabled ? normalizeWidgetDisplayGrid(grid, type, config) : { x: 0, y: 0, w: 0, h: 0 }
    if (displayEnabled && !canPlaceWidgetGrid(nextGrid, snapshot.lists, snapshot.widgets, widget.id, type, config)) {
      setMessageDialog({
        title: 'Widget Placement Conflict',
        message: 'This widget overlaps another visible board element. Move or resize it first.'
      })
      return
    }
    void runAction(() =>
      window.lpl.updateWidget({
        widgetId: widget.id,
        type,
        name,
        displayEnabled,
        grid: nextGrid,
        config
      })
    )
  }

  function updateWorldClockConfig(updater: (current: NonNullable<BoardWidgetConfig['worldClocks']>) => NonNullable<BoardWidgetConfig['worldClocks']>): void {
    setConfig((current) => {
      const nextWorldClocks = updater(current.worldClocks ?? defaultWorldClockConfig())
      const nextConfig = { worldClocks: nextWorldClocks }
      setGrid((currentGrid) => normalizeWidgetDisplayGrid(currentGrid, 'world_clocks', nextConfig))
      return nextConfig
    })
  }

  function addWorldClock(): void {
    updateWorldClockConfig((current) => {
      if (current.locations.length >= 16) return current
      const id = `clock-${crypto.randomUUID?.() ?? Date.now().toString(36)}`
      return {
        ...current,
        locations: [...current.locations, { id, label: 'New Clock', timeZone: 'UTC' }]
      }
    })
  }

  function removeWorldClock(locationId: string): void {
    updateWorldClockConfig((current) => {
      if (current.locations.length <= 2) return current
      return {
        ...current,
        locations: current.locations.filter((location) => location.id !== locationId)
      }
    })
  }

  return (
    <form className="editor-card" onSubmit={submit}>
      <EditorHeading eyebrow="Widget" title={widget.name} />
        <div className="field-grid two">
          <label>
            <span>Widget name</span>
            <input autoFocus={widget.name === 'New Widget'} onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label>
            <span>Widget type</span>
            <select
              onChange={(event) => {
                const nextType = event.target.value as WidgetType
                const nextConfig = defaultConfigForWidgetType(nextType)
                setType(nextType)
                setConfig(nextConfig)
                setGrid((current) => normalizeWidgetDisplayGrid(current, nextType, nextConfig))
                if (name === 'New Widget' || name === widgetTypes.find((entry) => entry.value === type)?.label) {
                  setName(widgetTypes.find((entry) => entry.value === nextType)?.label ?? 'Widget')
                }
              }}
              value={type}
            >
            {widgetTypes.map((widgetType) => (
              <option key={widgetType.value} value={widgetType.value}>
                {widgetType.label}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle-field">
          <input checked={displayEnabled} onChange={(event) => setDisplayEnabled(event.target.checked)} type="checkbox" />
          <span>Show widget on board</span>
        </label>
        <div className="geometry-row widget-geometry-row">
          {(['w', 'h', 'x', 'y'] as const).map((key) => (
            <label key={key}>
              <span>Grid {key.toUpperCase()}</span>
              <input
                max={key === 'x' || key === 'w' ? 16 : 8}
                min={key === 'w' || key === 'h' ? 2 : 1}
                onChange={(event) => setGrid((current) => ({ ...current, [key]: Number(event.target.value) }))}
                type="number"
                value={grid[key]}
              />
            </label>
          ))}
        </div>
      </div>

      <section className="inline-config-panel">
        <EditorHeading eyebrow="Configuration" title={widgetTypes.find((entry) => entry.value === type)?.label ?? 'Widget'} />
        {type === 'clock' && (
          <label className="toggle-field">
            <input
              checked={config.clock?.showSeconds !== false}
              onChange={(event) => setConfig({ clock: { showSeconds: event.target.checked } })}
              type="checkbox"
            />
            <span>Show seconds</span>
          </label>
        )}
        {type === 'weather' && (
          <label>
            <span>Temperature unit</span>
            <select
              onChange={(event) => setConfig({ weather: { temperatureUnit: event.target.value === 'fahrenheit' ? 'fahrenheit' : 'celsius' } })}
              value={config.weather?.temperatureUnit ?? 'celsius'}
            >
              <option value="celsius">Celsius</option>
              <option value="fahrenheit">Fahrenheit</option>
            </select>
          </label>
        )}
        {type === 'word_of_day' && (
          <label>
            <span>Accent mood</span>
            <input
              onChange={(event) => setConfig({ wordOfDay: { accent: event.target.value } })}
              value={config.wordOfDay?.accent ?? 'calm'}
            />
          </label>
        )}
        {type === 'world_clocks' && (
          <div className="world-clock-config">
            <datalist id="world-clock-timezones">
              {worldClockTimeZones.map((timeZone) => (
                <option key={timeZone} value={timeZone} />
              ))}
            </datalist>
            <label>
              <span>Display style</span>
              <select
                onChange={(event) => updateWorldClockConfig((current) => ({ ...current, style: event.target.value === 'analogue' ? 'analogue' : 'digital' }))}
                value={config.worldClocks?.style ?? 'digital'}
              >
                <option value="digital">Digital</option>
                <option value="analogue">Analogue</option>
              </select>
            </label>
            <label className="toggle-field">
              <input
                checked={Boolean(config.worldClocks?.showSeconds)}
                onChange={(event) => updateWorldClockConfig((current) => ({ ...current, showSeconds: event.target.checked }))}
                type="checkbox"
              />
              <span>Show seconds</span>
            </label>
            {(config.worldClocks?.locations ?? defaultWorldClockConfig().locations).map((location) => (
              <div className="world-clock-config-row" key={location.id}>
                <input
                  onChange={(event) =>
                    updateWorldClockConfig((current) => ({
                      ...current,
                      locations: current.locations.map((candidate) => (candidate.id === location.id ? { ...candidate, label: event.target.value } : candidate))
                    }))
                  }
                  placeholder="Label"
                  value={location.label}
                />
                <input
                  list="world-clock-timezones"
                  onChange={(event) =>
                    updateWorldClockConfig((current) => ({
                      ...current,
                      locations: current.locations.map((candidate) => (candidate.id === location.id ? { ...candidate, timeZone: event.target.value } : candidate))
                    }))
                  }
                  placeholder="Time zone"
                  value={location.timeZone}
                />
                <button
                  className="icon-button compact-icon-button danger-subtle-button"
                  disabled={(config.worldClocks?.locations ?? defaultWorldClockConfig().locations).length <= 2}
                  onClick={() => removeWorldClock(location.id)}
                  title="Remove clock"
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              className="icon-button compact-icon-button"
              disabled={(config.worldClocks?.locations ?? defaultWorldClockConfig().locations).length >= 16}
              onClick={addWorldClock}
              type="button"
            >
              <Plus size={14} />
              Add Clock
            </button>
          </div>
        )}
        {type === 'countdown' && (
          <div className="field-grid two">
            <label>
              <span>Countdown label</span>
              <input
                onChange={(event) => setConfig({ countdown: { label: event.target.value, targetAt: config.countdown?.targetAt ?? '' } })}
                value={config.countdown?.label ?? 'Next milestone'}
              />
            </label>
            <label>
              <span>Target date & time</span>
              <input
                onChange={(event) => setConfig({ countdown: { label: config.countdown?.label ?? 'Next milestone', targetAt: event.target.value } })}
                type="datetime-local"
                value={config.countdown?.targetAt ?? ''}
              />
            </label>
          </div>
        )}
      </section>

      <div className="form-actions">
        <button
          className="danger-button"
          onClick={async () => {
            await runAction(() => window.lpl.deleteWidget(widget.id))
            setSelectedNode({ kind: 'board', id: snapshot.id })
          }}
          type="button"
        >
          <Trash2 size={16} />
          Delete Widget
        </button>
        <button className="primary-button" type="submit">
          <Save size={16} />
          Save Widget
        </button>
      </div>
      {messageDialog && <MessageModal title={messageDialog.title} message={messageDialog.message} onClose={() => setMessageDialog(null)} />}
    </form>
  )
}

function BoardPreviewWidget({
  layoutSnapshot,
  runAction,
  selectedNode,
  setSelectedNode,
  snapshot
}: {
  layoutSnapshot: BoardSnapshot
  runAction: RunAction
  selectedNode: SelectedNode
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  return (
    <aside className="preview-widget">
      <header className="pane-heading">
        <div className="pane-heading-inline">
          <span className="pane-heading-label">Live Layout:</span>
          <h3 className="pane-heading-subject">16 x 8 Grid</h3>
        </div>
      </header>
      <div className="preview-canvas">
        <DisplayBoard
          compact
          editable
          onListChange={(list, grid) => {
            const sourceList = layoutSnapshot.lists.find((entry) => entry.id === list.id) ?? list
            const placement = resolveListGridChange(sourceList, grid, layoutSnapshot.lists, layoutSnapshot.widgets)
            if (!placement) return
            if (placement.message) return
            runAction(async () => {
              if ((placement.movedWidgets?.length ?? 0) > 0) {
                return window.lpl.updateBoardLayouts({
                  lists: [{ listId: sourceList.id, grid: placement.grid }, ...placement.moved.map((moved) => ({ listId: moved.list.id, grid: moved.grid }))],
                  widgets: (placement.movedWidgets ?? []).map((moved) => ({ widgetId: moved.widget.id, grid: moved.grid }))
                })
              }
              if (placement.moved.length > 0) {
                return window.lpl.updateListLayouts([
                  { listId: sourceList.id, grid: placement.grid },
                  ...placement.moved.map((moved) => ({ listId: moved.list.id, grid: moved.grid }))
                ])
              }
              return window.lpl.updateList({ ...listInput(sourceList), grid: placement.grid })
            })
          }}
          onListSelect={(listId) => setSelectedNode({ kind: 'list', id: listId })}
          onWidgetChange={(widget, grid) => {
            const sourceWidget = layoutSnapshot.widgets.find((entry) => entry.id === widget.id) ?? widget
            const nextGrid = normalizeWidgetDisplayGrid(grid, sourceWidget.type, sourceWidget.config)
            const placement = resolveWidgetGridChange(sourceWidget, nextGrid, layoutSnapshot.widgets, layoutSnapshot.lists)
            if (!placement) return
            runAction(async () => {
              if ((placement.movedLists?.length ?? 0) > 0) {
                return window.lpl.updateBoardLayouts({
                  lists: (placement.movedLists ?? []).map((moved) => ({ listId: moved.list.id, grid: moved.grid })),
                  widgets: [{ widgetId: sourceWidget.id, grid: placement.grid }, ...placement.moved.map((moved) => ({ widgetId: moved.widget.id, grid: moved.grid }))]
                })
              }
              if (placement.moved.length > 0) {
                return window.lpl.updateWidgetLayouts([
                  { widgetId: sourceWidget.id, grid: placement.grid },
                  ...placement.moved.map((moved) => ({ widgetId: moved.widget.id, grid: moved.grid }))
                ])
              }
              return window.lpl.updateWidget({ ...widgetInput(sourceWidget), grid: placement.grid })
            })
          }}
          onWidgetSelect={(widgetId) => setSelectedNode({ kind: 'widget', id: widgetId })}
          selectedListId={selectedNode.kind === 'list' ? selectedNode.id : undefined}
          selectedWidgetId={selectedNode.kind === 'widget' ? selectedNode.id : undefined}
          snapshot={snapshot}
        />
      </div>
    </aside>
  )
}

function DisplayBoard({
  appSettings,
  appThemeClass,
  busy = false,
  compact = false,
  editable = false,
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
  busy?: boolean
  compact?: boolean
  editable?: boolean
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
  const allItems = snapshot.lists.flatMap((list) => list.items)
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
        return list ? itemTitle(closeDialog.item, list) : closeDialog.item.displayCode
      })()
    : ''
  const dialogList = itemDialog ? snapshot.lists.find((list) => list.id === itemDialog.listId) ?? null : null
  const dialogItem =
    itemDialog?.mode === 'edit' && dialogList ? dialogList.items.find((item) => item.id === itemDialog.itemId) ?? null : null
  const listSettingsList = listSettingsListId ? snapshot.lists.find((list) => list.id === listSettingsListId) ?? null : null
  const showItemDialog = Boolean(itemDialog && dialogList && (itemDialog.mode === 'create' || dialogItem))

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
      <div className="board-shell">
        <header className="display-top-band">
          <div className="display-title">
            <p className="eyebrow">{snapshot.mode === 'display' ? 'Display Mode' : 'Preview'}</p>
            <h2>{snapshot.name}</h2>
          </div>
          <div className="top-summary">
            {snapshot.summarySlots.filter(isSummarySlotDefined).map((slot) => (
              <div className="summary-slot top" key={slot.slotIndex}>
                <span>{slot.label}</span>
                <strong>{slot.value}</strong>
              </div>
            ))}
          </div>
          <div className="display-top-actions">
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
          {snapshot.lists.map((list) => (
            <BoardListView
              compact={compact}
              editable={editable}
              key={list.id}
              list={list}
              onAddItem={enableBoardInteraction ? (listId) => setItemDialog({ mode: 'create', listId }) : undefined}
              onChange={onListChange}
              onCloseItem={enableCloseActions ? requestClose : undefined}
              onEditList={enableBoardInteraction ? (listId) => setListSettingsListId(listId) : undefined}
              onGiftItem={enableBoardInteraction ? (listId, itemId) => {
                const list = snapshot.lists.find((entry) => entry.id === listId)
                const item = list?.items.find((entry) => entry.id === itemId)
                if (list && item) setGiftDialog({ item, list })
              } : undefined}
              onOpenItem={enableBoardInteraction ? (listId, itemId) => setItemDialog({ mode: 'edit', listId, itemId }) : undefined}
              onSelect={onListSelect}
              rowActionBusy={closingItemId !== null}
              selected={list.id === selectedListId}
            />
          ))}
          {snapshot.widgets.map((widget) => (
            <BoardWidgetView
              compact={compact}
              editable={editable}
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
        <BoardItemModal
          allItems={allItems}
          busy={busy}
          item={itemDialog.mode === 'edit' ? dialogItem : null}
          list={dialogList}
          mode={itemDialog.mode}
          onClose={() => setItemDialog(null)}
          runAction={runAction}
          snapshot={snapshot}
        />
      )}
      {enableBoardInteraction && listSettingsList && runAction && (
        <BoardListSettingsModal
          list={listSettingsList}
          onClose={() => setListSettingsListId(null)}
          runAction={runAction}
          snapshot={snapshot}
        />
      )}
      {enableBoardInteraction && giftDialog && runAction && (
        <BirthdayGiftModal
          birthdayItem={giftDialog.item}
          birthdayList={giftDialog.list}
          lists={snapshot.lists.filter((list) => list.id !== giftDialog.list.id && list.templateType !== 'birthday_calendar')}
          onClose={() => setGiftDialog(null)}
          runAction={runAction}
        />
      )}
      {summaryDialogMode && (
        <DaySummaryModal mode={summaryDialogMode} onClose={() => setSummaryDialogMode(null)} snapshot={snapshot} />
      )}
      {messageDialog && <MessageModal title={messageDialog.title} message={messageDialog.message} onClose={() => setMessageDialog(null)} />}
    </section>
  )
}

function MessageModal({
  message,
  onClose,
  title
}: {
  message: string
  onClose: () => void
  title: string
}): ReactElement {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="modal-card message-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Notice</p>
            <h3>{title}</h3>
          </div>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button className="primary-button" onClick={onClose} type="button">
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmActionModal({
  busy,
  confirmLabel = 'Confirm',
  destructive = false,
  message,
  onCancel,
  onConfirm,
  title
}: {
  busy: boolean
  confirmLabel?: string
  destructive?: boolean
  message: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
  title: string
}): ReactElement {
  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div aria-modal="true" className="modal-card message-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Confirm</p>
            <h3>{title}</h3>
          </div>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button className="icon-button" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className={destructive ? 'danger-button' : 'primary-button'} disabled={busy} onClick={() => void onConfirm()} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function PromptModal({
  busy,
  confirmLabel = 'Save',
  initialValue,
  label,
  onCancel,
  onConfirm,
  title
}: {
  busy: boolean
  confirmLabel?: string
  initialValue: string
  label: string
  onCancel: () => void
  onConfirm: (value: string) => void | Promise<void>
  title: string
}): ReactElement {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div aria-modal="true" className="modal-card message-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Edit</p>
            <h3>{title}</h3>
          </div>
        </div>
        <div className="modal-body">
          <label className="modal-field">
            <span>{label}</span>
            <input autoFocus onChange={(event) => setValue(event.target.value)} value={value} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="icon-button" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={busy || !value.trim()}
            onClick={() => void onConfirm(value.trim())}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteBoardModal({
  board,
  busy,
  onCancel,
  onConfirm
}: {
  board: BoardSummary
  busy: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}): ReactElement {
  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div aria-modal="true" className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Delete Board</p>
            <h3>{board.name}</h3>
          </div>
        </div>
        <div className="modal-body">
          <p>This will delete the board and all of its structure.</p>
          <p>Active tasks from this board will be moved to the archive as cancelled.</p>
        </div>
        <div className="modal-actions">
          <button className="icon-button" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="danger-button" disabled={busy} onClick={() => void onConfirm()} type="button">
            <Trash2 size={16} />
            Delete Board
          </button>
        </div>
      </div>
    </div>
  )
}

function NewListTemplateModal({
  busy,
  onClose,
  onSelect
}: {
  busy: boolean
  onClose: () => void
  onSelect: (templateType: ListTemplateType) => void | Promise<void>
}): ReactElement {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="modal-card modal-card-wide template-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">New List</p>
            <h3>Choose a list template</h3>
          </div>
        </div>
        <div className="modal-body">
          <div className="template-choice-grid">
            {listTemplateOptions.map((template) => (
              <button
                className="template-choice-card"
                disabled={busy}
                key={template.value}
                onClick={() => void onSelect(template.value)}
                type="button"
              >
                <strong>{template.label}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="icon-button" disabled={busy} onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function themeClassName(theme: AppTheme): string {
  return themeOptions.find((entry) => entry.value === theme)?.className ?? 'theme-midnight-clear'
}

function widgetTypeLabel(type: WidgetType): string {
  return widgetTypes.find((entry) => entry.value === type)?.label ?? 'Widget'
}

type WidgetAspectSpec = {
  ratioW: number
  ratioH: number
  minScale: number
}

function widgetAspectSpec(type: WidgetType, config: BoardWidgetConfig): WidgetAspectSpec {
  if (type === 'word_of_day') return { ratioW: 3, ratioH: 2, minScale: 1 }
  if (type === 'world_clocks') {
    const count = clamp(config.worldClocks?.locations?.length ?? 2, 2, 16)
    return { ratioW: count, ratioH: 2, minScale: 1 }
  }
  return { ratioW: 1, ratioH: 1, minScale: 2 }
}

function widgetScaleBounds(spec: WidgetAspectSpec): { min: number; max: number } {
  return {
    min: spec.minScale,
    max: Math.max(spec.minScale, Math.min(Math.floor(16 / spec.ratioW), Math.floor(8 / spec.ratioH)))
  }
}

function widgetGridForScale(spec: WidgetAspectSpec, scale: number): Pick<BoardWidget['grid'], 'w' | 'h'> {
  return {
    w: spec.ratioW * scale,
    h: spec.ratioH * scale
  }
}

function compactWidgetSummary(widget: BoardWidget): string {
  if (widget.type === 'weather') return 'Current location'
  if (widget.type === 'word_of_day') return 'Daily prompt'
  if (widget.type === 'world_clocks') {
    const count = widget.config.worldClocks?.locations?.length ?? 0
    return count > 0 ? `${count} zone${count === 1 ? '' : 's'}` : 'World time'
  }
  if (widget.type === 'countdown') return widget.config.countdown?.label?.trim() || 'Target date'
  return 'Time & date'
}

function editorWorkspaceTitle(selectedNode: SelectedNode, snapshot: BoardSnapshot): string {
  if (selectedNode.kind === 'board') return 'Board Properties'
  if (selectedNode.kind === 'list') {
    const list = snapshot.lists.find((entry) => entry.id === selectedNode.id)
    return list ? `List: ${list.name}` : 'List Properties'
  }
  if (selectedNode.kind === 'group') {
    const group = snapshot.lists.flatMap((list) => list.groups).find((entry) => entry.id === selectedNode.id)
    return group ? `Group: ${group.name}` : 'Group Properties'
  }
  if (selectedNode.kind === 'item') {
    const itemList = snapshot.lists.find((list) => list.items.some((item) => item.id === selectedNode.id))
    const item = itemList?.items.find((entry) => entry.id === selectedNode.id)
    return item && itemList ? `Item: ${itemTitle(item, itemList)}` : 'Item Properties'
  }
  const widget = snapshot.widgets.find((entry) => entry.id === selectedNode.id)
  return widget ? `Widget: ${widget.name}` : 'Widget Properties'
}

function editorWorkspaceContext(selectedNode: SelectedNode, snapshot: BoardSnapshot): {
  label: string
  subject: string
} {
  if (selectedNode.kind === 'board') {
    return { label: 'CURRENTLY EDITING:', subject: 'Board Properties' }
  }
  if (selectedNode.kind === 'list') {
    const list = snapshot.lists.find((entry) => entry.id === selectedNode.id)
    return { label: 'CURRENTLY EDITING LIST:', subject: list?.name ?? 'List Properties' }
  }
  if (selectedNode.kind === 'group') {
    const group = snapshot.lists.flatMap((list) => list.groups).find((entry) => entry.id === selectedNode.id)
    return { label: 'CURRENTLY EDITING GROUP:', subject: group?.name ?? 'Group Properties' }
  }
  if (selectedNode.kind === 'item') {
    const itemList = snapshot.lists.find((list) => list.items.some((item) => item.id === selectedNode.id))
    const item = itemList?.items.find((entry) => entry.id === selectedNode.id)
    return {
      label: 'CURRENTLY EDITING ITEM:',
      subject: item && itemList ? itemTitle(item, itemList) : 'Item Properties'
    }
  }
  const widget = snapshot.widgets.find((entry) => entry.id === selectedNode.id)
  return { label: 'CURRENTLY EDITING WIDGET:', subject: widget?.name ?? 'Widget Properties' }
}

function BoardListView({
  compact,
  editable,
  list,
  onAddItem,
  onChange,
  onCloseItem,
  onEditList,
  onGiftItem,
  onOpenItem,
  onSelect,
  rowActionBusy,
  selected
}: {
  compact: boolean
  editable: boolean
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
}): ReactElement {
  const columns = boardVisibleColumns(list)
  const rows = boardDisplayRows(list)
  const displayColumns = birthdayBoardColumns(list, columns)
  const listSummaries = listSummaryValues(list)
  const itemCount = list.items.length
  const groupCount = list.groups.length
  const drag = useRef<{
    mode: 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
    x: number
    y: number
    grid: BoardList['grid']
    rect: DOMRect
  } | null>(null)

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
        ? pointerMoveGrid(drag.current.grid, drag.current.rect, event.clientX, event.clientY)
        : resizeGrid(
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
            <div className="board-list-summaries">
              {listSummaries.map((summary) => (
                <span className="board-list-summary" key={summary.columnId}>
                  <em>{summary.label}</em>
                  <strong>{summary.value}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
        {editable ? <Grip size={16} /> : list.dueDateEnabled && <span className="due-chip">{deadlineDisplayLabel(list)}</span>}
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {list.showItemIdOnBoard && <th>ID</th>}
                {list.showDependenciesOnBoard && <th>Dep</th>}
                {list.showCreatedAtOnBoard && <th>Created At</th>}
                {list.showCreatedByOnBoard && <th>Created By</th>}
                  {displayColumns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  {list.dueDateEnabled && list.showStatusOnBoard && <th>Status</th>}
                  {(onCloseItem || onGiftItem) && <th className="row-actions-heading" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                row.kind === 'group' ? (
                  <tr className="group-heading-row" key={`group-${row.group.id}`}>
                    {list.showItemIdOnBoard && <td className="code-cell">{row.group.showIdOnBoard ? row.group.code : ''}</td>}
                    {list.showDependenciesOnBoard && <td />}
                    {list.showCreatedAtOnBoard && <td />}
                    {list.showCreatedByOnBoard && <td />}
                    {displayColumns.map((column, index) => (
                      <td key={column.key}>
                        {column.kind === 'real' ? formatGroupCell(row.group, column.column, list, index === 0) : ''}
                      </td>
                    ))}
                    {list.dueDateEnabled && list.showStatusOnBoard && <td />}
                    {(onCloseItem || onGiftItem) && <td />}
                  </tr>
                ) : (
                  <tr
                    className={`${deadlineRowClass(row.item) ?? ''} ${onOpenItem ? 'board-item-row clickable-row' : 'board-item-row'}`.trim()}
                    key={row.item.id}
                    onClick={() => onOpenItem?.(list.id, row.item.id)}
                  >
                    {list.showItemIdOnBoard && <td className="code-cell">{row.item.displayCode}</td>}
                    {list.showDependenciesOnBoard && <td>{row.item.dependencyCodes.join(', ') || '-'}</td>}
                    {list.showCreatedAtOnBoard && <td>{formatSystemDate(row.item.createdAt)}</td>}
                    {list.showCreatedByOnBoard && <td>{row.item.createdBy}</td>}
                    {displayColumns.map((column) => (
                      <td key={column.key}>
                        {column.kind === 'real'
                          ? formatBirthdayAwareCellValue(row.item, column.column, list)
                          : birthdayTurningLabel(row.item, list)}
                      </td>
                    ))}
                    {list.dueDateEnabled && list.showStatusOnBoard && <td>{row.item.deadlineStatus}</td>}
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
        </div>
      )}
      {editable &&
        (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const).map((handle) => (
          <button
            className={`resize-handle ${handle}`}
            key={handle}
            onPointerDown={(event) => startDrag(event, handle)}
            type="button"
          />
        ))}
    </article>
  )
}

function BoardWidgetView({
  compact,
  editable,
  onChange,
  onSelect,
  selected,
  widget
}: {
  compact: boolean
  editable: boolean
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
        ? pointerMoveWidgetGridWithOffset(
            drag.current.grid,
            drag.current.rect,
            event.clientX,
            event.clientY,
            drag.current.grabOffsetX,
            drag.current.grabOffsetY
          )
        : resizeWidgetGrid(
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
          <button
            className={`resize-handle ${handle}`}
            key={handle}
            onPointerDown={(event) => startDrag(event, handle)}
            type="button"
          />
        ))}
    </article>
  )
}

function WidgetTypeIcon({ type }: { type: WidgetType }): ReactElement {
  const entry = widgetTypes.find((candidate) => candidate.value === type)
  const Icon = entry?.icon ?? Clock3
  return <Icon size={16} />
}

function WidgetRenderer({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  if (compact) return <CompactWidgetPreview widget={widget} />
  if (widget.type === 'weather') return <WeatherWidget compact={compact} widget={widget} />
  if (widget.type === 'word_of_day') return <WordOfDayWidget compact={compact} widget={widget} />
  if (widget.type === 'world_clocks') return <WorldClocksWidget compact={compact} widget={widget} />
  if (widget.type === 'countdown') return <CountdownWidget compact={compact} widget={widget} />
  return <ClockWidget compact={compact} widget={widget} />
}

function CompactWidgetPreview({ widget }: { widget: BoardWidget }): ReactElement {
  return (
    <div className="compact-widget-preview">
      <div className="compact-widget-name">{widget.name}</div>
    </div>
  )
}

function ClockWidget({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  const now = useNow(widget.config.clock?.showSeconds ? 1000 : 60000)
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).formatToParts(now)
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  const dayPeriod = (parts.find((part) => part.type === 'dayPeriod')?.value ?? 'AM').toUpperCase()
  const seconds = now.toLocaleTimeString(undefined, { second: '2-digit' })

  return (
    <div className={`widget-content clock-widget ${compact ? 'compact-widget' : ''}`}>
      <span className="clock-date-line">{formatWidgetDate(now)}</span>
      <div className="clock-segment-row" role="presentation">
        <div className="clock-segment">
          <span>{hour}</span>
        </div>
        <div className="clock-segment">
          <span>{minute}</span>
        </div>
        <div className="clock-segment meridiem">
          <span>{dayPeriod}</span>
        </div>
      </div>
      {widget.config.clock?.showSeconds && <span className="clock-seconds-line">Seconds {seconds}</span>}
    </div>
  )
}

function WeatherWidget({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  const [state, setState] = useState<{ loading: boolean; text: string; detail: string }>({
    loading: true,
    text: 'Loading weather',
    detail: 'Detecting current location...'
  })

  useEffect(() => {
    let cancelled = false
    async function loadWeather(): Promise<void> {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 15 * 60 * 1000 })
        )
        const unit = widget.config.weather?.temperatureUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius'
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&current=temperature_2m,apparent_temperature,weather_code,is_day&temperature_unit=${unit}&timezone=auto`
        )
        const payload = (await response.json()) as {
          current?: { temperature_2m?: number; apparent_temperature?: number; weather_code?: number; is_day?: number }
        }
        if (cancelled) return
        const current = payload.current
        if (!current || current.temperature_2m === undefined) throw new Error('No weather data returned.')
        const unitSymbol = unit === 'fahrenheit' ? 'F' : 'C'
        setState({
          loading: false,
          text: `${Math.round(current.temperature_2m)}°${unitSymbol}`,
          detail: `${weatherCodeLabel(current.weather_code ?? 0, current.is_day === 1)} · Feels like ${Math.round(current.apparent_temperature ?? current.temperature_2m)}°${unitSymbol}`
        })
      } catch {
        if (cancelled) return
        setState({
          loading: false,
          text: 'Weather unavailable',
          detail: 'Location permission or weather service unavailable.'
        })
      }
    }
    void loadWeather()
    const timer = window.setInterval(() => void loadWeather(), 15 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [widget.config.weather?.temperatureUnit, widget.id])

  return (
    <div className={`widget-content weather-widget ${compact ? 'compact-widget' : ''}`}>
      <span className="widget-kicker">Current location</span>
      <strong>{state.text}</strong>
      <p>{state.loading ? 'Updating…' : state.detail}</p>
    </div>
  )
}

function WordOfDayWidget({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  const today = new Date()
  const index = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 86400000) % wordBank.length
  const word = wordBank[index]
  return (
    <div className={`widget-content word-widget ${compact ? 'compact-widget' : ''}`}>
      <span className="widget-kicker">Word of the day</span>
      <strong>{word.word}</strong>
      <p>{word.meaning}</p>
    </div>
  )
}

function WorldClocksWidget({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  const now = useNow(widget.config.worldClocks?.showSeconds ? 1000 : 60000)
  const locations = widget.config.worldClocks?.locations ?? []
  const analogue = widget.config.worldClocks?.style === 'analogue'
  return (
    <div className={`widget-content world-clocks-widget ${compact ? 'compact-widget' : ''} ${analogue ? 'analogue-mode' : 'digital-mode'}`}>
      {locations.map((location) => (
        <div className={`world-clock-tile ${analogue ? 'analogue-tile' : 'digital-tile'}`} key={location.id}>
          <span>{location.label}</span>
          {analogue ? (
            <AnalogueClockFace now={now} showSeconds={Boolean(widget.config.worldClocks?.showSeconds)} timeZone={location.timeZone} />
          ) : (
            <strong>
              {new Intl.DateTimeFormat(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                second: widget.config.worldClocks?.showSeconds ? '2-digit' : undefined,
                timeZone: location.timeZone
              }).format(now)}
            </strong>
          )}
          <small>{timeZoneOffsetLabel(location.timeZone, now)}</small>
        </div>
      ))}
    </div>
  )
}

function CountdownWidget({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  const now = useNow(1000)
  const targetText = widget.config.countdown?.targetAt ?? ''
  const label = widget.config.countdown?.label?.trim() || 'Next milestone'
  const target = targetText ? new Date(targetText) : null
  const validTarget = target && !Number.isNaN(target.getTime()) ? target : null

  if (!validTarget) {
    return (
      <div className={`widget-content countdown-widget ${compact ? 'compact-widget' : ''}`}>
        <span className="widget-kicker">{label}</span>
        <strong>No target set</strong>
        <p>Add a date and time in widget settings.</p>
      </div>
    )
  }

  const diff = validTarget.getTime() - now.getTime()
  const absolute = Math.abs(diff)
  const totalMinutes = Math.floor(absolute / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  return (
    <div className={`widget-content countdown-widget ${compact ? 'compact-widget' : ''}`}>
      <span className="widget-kicker">{label}</span>
      <div className="countdown-value-row">
        <div className="countdown-badge">
          <strong>{days}</strong>
          <span>days</span>
        </div>
        <div className="countdown-badge">
          <strong>{hours}</strong>
          <span>hours</span>
        </div>
        <div className="countdown-badge">
          <strong>{minutes}</strong>
          <span>min</span>
        </div>
      </div>
      <p>{diff >= 0 ? `Until ${formatWidgetDateTime(validTarget)}` : `Passed ${compactDuration(absolute)} ago`}</p>
    </div>
  )
}

function AnalogueClockFace({
  now,
  showSeconds,
  timeZone
}: {
  now: Date
  showSeconds: boolean
  timeZone: string
}): ReactElement {
  const parts = zonedTimeParts(now, timeZone)
  const hourAngle = ((parts.hour % 12) + parts.minute / 60) * 30
  const minuteAngle = (parts.minute + parts.second / 60) * 6
  const secondAngle = parts.second * 6

  return (
    <div className="analogue-clock-face" role="img">
      <div className="analogue-hand hour-hand" style={{ transform: `translateX(-50%) rotate(${hourAngle}deg)` }} />
      <div className="analogue-hand minute-hand" style={{ transform: `translateX(-50%) rotate(${minuteAngle}deg)` }} />
      {showSeconds && <div className="analogue-hand second-hand" style={{ transform: `translateX(-50%) rotate(${secondAngle}deg)` }} />}
      <div className="analogue-center-dot" />
    </div>
  )
}

function BoardItemModal({
  allItems,
  busy,
  initialGroupId,
  item,
  list,
  mode,
  onClose,
  runAction,
  snapshot
}: {
  allItems: BoardItem[]
  busy: boolean
  initialGroupId?: string | null
  item: BoardItem | null
  list: BoardList
  mode: 'create' | 'edit'
  onClose: () => void
  runAction: RunAction
  snapshot: BoardSnapshot
}): ReactElement {
  const editableColumns = editableItemColumns(list)
  const [values, setValues] = useState<FormValues>(() => (item ? valuesForItem(item, editableColumns) : blankValues(editableColumns)))
  const [dependencies, setDependencies] = useState<string[]>(item?.dependencyItemIds ?? [])
  const [groupId, setGroupId] = useState<string | null>(item?.groupId ?? initialGroupId ?? null)

  useEffect(() => {
    setValues(item ? valuesForItem(item, editableColumns) : blankValues(editableColumns))
    setDependencies(item?.dependencyItemIds ?? [])
    setGroupId(item?.groupId ?? initialGroupId ?? null)
  }, [initialGroupId, item?.id, list.id])

  function setValue(column: ListColumn, value: FieldValue): void {
    setValues((current) => ({ ...current, [column.id]: coerceInputValue(column, value) }))
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const result = await runAction(async () => {
      if (mode === 'edit' && item) {
        return window.lpl.updateItem({ itemId: item.id, groupId, values, dependencyItemIds: dependencies })
      }

      return window.lpl.createItem({ listId: list.id, groupId, values, dependencyItemIds: dependencies })
    })
    if (result && 'lists' in result) onClose()
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className="modal-card modal-card-large"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <form onSubmit={(event) => void submit(event)}>
          <div className="modal-header">
            <div>
              <p className="eyebrow">{mode === 'edit' ? 'Edit Item' : 'Quick Add Item'}</p>
              <h3>{mode === 'edit' && item ? itemTitle(item, list) : list.name}</h3>
            </div>
          </div>
          <div className="modal-body modal-body-form">
            <div className="field-grid two">
              <label>
                <span>Group</span>
                <select onChange={(event) => setGroupId(event.target.value || null)} value={groupId ?? ''}>
                  <option value="">List root</option>
                  {groupOptions(list).map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ItemFields columns={editableColumns} setValue={setValue} values={values} />
            <DependencyTreePicker
              currentItemId={item?.id ?? ''}
              dependencies={dependencies}
              setDependencies={setDependencies}
              snapshot={snapshot}
            />
          </div>
          <div className="modal-actions">
            <button className="icon-button" disabled={busy} onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" disabled={busy} type="submit">
              <Save size={16} />
              {mode === 'edit' ? 'Save Item' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

function BoardListSettingsModal({
  list,
  onClose,
  runAction,
  snapshot
}: {
  list: BoardList
  onClose: () => void
  runAction: RunAction
  snapshot: BoardSnapshot
}): ReactElement {
  const [name, setName] = useState(list.name)
  const [listBehavior, setListBehavior] = useState<ListBehavior>(list.templateConfig.behavior ?? 'other')
  const [displayEnabled, setDisplayEnabled] = useState(list.displayEnabled)
  const [dueDateEnabled, setDueDateEnabled] = useState(list.dueDateEnabled)
  const [deadlineMandatory, setDeadlineMandatory] = useState(list.deadlineMandatory)
  const [sortColumnId, setSortColumnId] = useState<string | null>(list.sortColumnId)
  const [sortDirection, setSortDirection] = useState<ListSortDirection>(list.sortDirection)
  const [showItemIdOnBoard, setShowItemIdOnBoard] = useState(list.showItemIdOnBoard)
  const [showDependenciesOnBoard, setShowDependenciesOnBoard] = useState(list.showDependenciesOnBoard)
  const [showCreatedAtOnBoard, setShowCreatedAtOnBoard] = useState(list.showCreatedAtOnBoard)
  const [showCreatedByOnBoard, setShowCreatedByOnBoard] = useState(list.showCreatedByOnBoard)
  const [showStatusOnBoard, setShowStatusOnBoard] = useState(list.showStatusOnBoard)
  const [birthdayBoardView, setBirthdayBoardView] = useState<BirthdayBoardView>(list.templateConfig.birthday?.boardView ?? 'this_month')
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnType, setNewColumnType] = useState<ColumnType>('text')
  const [messageDialog, setMessageDialog] = useState<{ title: string; message: string } | null>(null)
  const [columnDrafts, setColumnDrafts] = useState<Record<string, ColumnDraft>>(() => columnDraftsForList(list))
  const birthdaySortColumn = list.templateType === 'birthday_calendar' ? birthdayCoreColumns(list).find((column) => isBirthdayDateColumn(column)) ?? null : null
  const effectiveSortColumnId = list.templateType === 'birthday_calendar' ? birthdaySortColumn?.id ?? sortColumnId : sortColumnId
  const effectiveSortDirection: ListSortDirection = list.templateType === 'birthday_calendar' ? 'asc' : sortDirection
  const sortColumn = effectiveSortColumnId ? visibleColumns(list).find((column) => column.id === effectiveSortColumnId) : null

  useEffect(() => {
    setName(list.name)
    setDisplayEnabled(list.displayEnabled)
    setDueDateEnabled(list.dueDateEnabled)
    setDeadlineMandatory(list.deadlineMandatory)
    setSortColumnId(list.sortColumnId)
    setSortDirection(list.sortDirection)
    setShowItemIdOnBoard(list.showItemIdOnBoard)
    setShowDependenciesOnBoard(list.showDependenciesOnBoard)
    setShowCreatedAtOnBoard(list.showCreatedAtOnBoard)
    setShowCreatedByOnBoard(list.showCreatedByOnBoard)
    setShowStatusOnBoard(list.showStatusOnBoard)
    setBirthdayBoardView(list.templateConfig.birthday?.boardView ?? 'this_month')
    setColumnDrafts(columnDraftsForList(list))
  }, [
    list.deadlineMandatory,
    list.displayEnabled,
    list.dueDateEnabled,
    list.id,
    list.name,
    list.showCreatedAtOnBoard,
    list.showCreatedByOnBoard,
    list.showStatusOnBoard,
    list.showDependenciesOnBoard,
    list.showItemIdOnBoard,
    list.sortColumnId,
    list.sortDirection
  ])

  useEffect(() => {
    setColumnDrafts((current) => {
      const next: Record<string, ColumnDraft> = {}
      for (const column of visibleColumns(list)) {
        next[column.id] = current[column.id] ?? columnDraftFromColumn(column)
      }
      return next
    })
  }, [list.columns, list.dueDateEnabled])

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const placement = displayEnabled
      ? placeListForDisplay(
          snapshot.lists,
          snapshot.widgets,
          list.id,
          validDisplayGrid(list.grid) ? list.grid : { x: 1, y: 1, w: MIN_LIST_GRID_WIDTH, h: MIN_LIST_GRID_HEIGHT }
        )
      : { grid: { x: 0, y: 0, w: 0, h: 0 }, moved: [] }

    if (displayEnabled && !placement) {
      setMessageDialog({
        title: 'No Space Available',
        message: 'This list cannot be shown because the board has no available 4 x 2 slot. Hide another list or resize the layout first.'
      })
      return
    }

    const nextGrid = placement?.grid ?? { x: 0, y: 0, w: 0, h: 0 }
    const result = await runAction(async () => {
      if ((placement?.moved.length ?? 0) > 0) {
        await window.lpl.updateListLayouts([
          { listId: list.id, grid: nextGrid },
          ...(placement?.moved ?? []).map((moved) => ({ listId: moved.list.id, grid: moved.grid }))
        ])
      }
      for (const column of visibleColumns(list)) {
        const draft = columnDrafts[column.id]
        if (draft && !columnDraftMatchesColumn(draft, column)) {
          await window.lpl.updateColumn(columnDraftToInput(column, draft))
        }
      }
      return window.lpl.updateList({
        listId: list.id,
        name,
        templateType: list.templateType,
        templateConfig: listTemplateConfigForSave(list.templateType, listBehavior, birthdayBoardView),
        grid: nextGrid,
        dueDateEnabled,
        dueDateColumnId: list.dueDateColumnId,
        deadlineMandatory,
        columnSortOrder: list.columnSortOrder,
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
    if (result && 'lists' in result) onClose()
  }

  function addColumn(): void {
    if (!newColumnName.trim()) return
    runAction(() => window.lpl.createColumn({ listId: list.id, name: newColumnName, type: newColumnType }))
    setNewColumnName('')
    setNewColumnType('text')
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
          ...listInput(list),
          deadlineMandatory: draft.required,
          dueDateEnabled: true
        })
      }
      return window.lpl.getBoardSnapshot(list.boardId, 'admin')
    })
  }

  function updateColumnOrder(column: ListColumn, order: number): void {
    const draft = columnDrafts[column.id] ?? columnDraftFromColumn(column)
    runAction(() => window.lpl.updateColumn({ ...columnDraftToInput(column, draft), order }))
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className="modal-card modal-card-wide"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <form onSubmit={(event) => void submit(event)}>
          <div className="modal-header">
            <div>
              <p className="eyebrow">List Settings</p>
              <h3>{list.name}</h3>
            </div>
          </div>
          <div className="modal-body modal-body-form">
            <section className="modal-section">
              <div className="field-grid two">
                <label>
                  <span>List name</span>
                  <input onChange={(event) => setName(event.target.value)} required value={name} />
                </label>
                {list.templateType === 'custom' && (
                  <label>
                    <span>List Behaviour</span>
                    <select onChange={(event) => setListBehavior(event.target.value as ListBehavior)} value={listBehavior}>
                      {listBehaviorOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="toggle-field">
                  <input checked={displayEnabled} onChange={(event) => setDisplayEnabled(event.target.checked)} type="checkbox" />
                  <span>Show list on board</span>
                </label>
                <label className="toggle-field">
                  <input
                    checked={dueDateEnabled}
                    onChange={(event) => {
                      setDueDateEnabled(event.target.checked)
                      if (!event.target.checked) setDeadlineMandatory(false)
                    }}
                    type="checkbox"
                  />
                  <span>List has deadline</span>
                </label>
                <label className="toggle-field">
                  <input
                    checked={deadlineMandatory}
                    disabled={!dueDateEnabled}
                    onChange={(event) => setDeadlineMandatory(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Deadline mandatory</span>
                </label>
                <label>
                  <span>Sort by</span>
                  <select
                    disabled={list.templateType === 'birthday_calendar'}
                    onChange={(event) => {
                      const nextColumnId = event.target.value || null
                      setSortColumnId(nextColumnId)
                      const nextColumn = visibleColumns(list).find((column) => column.id === nextColumnId)
                      setSortDirection(nextColumn ? defaultSortDirection(nextColumn) : 'manual')
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
                  <span>Sort order</span>
                  <select
                    disabled={!sortColumn || list.templateType === 'birthday_calendar'}
                    onChange={(event) => setSortDirection(event.target.value as ListSortDirection)}
                    value={sortColumn ? effectiveSortDirection : 'manual'}
                  >
                    <option value="manual">Manual</option>
                    {sortColumn &&
                      sortDirectionOptions(sortColumn).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </label>
                {list.templateType === 'birthday_calendar' && (
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
              </div>
            </section>
            <section className="modal-section">
              <EditorHeading eyebrow="Display" title="Board Columns" />
              {list.templateType === 'birthday_calendar' && <p className="locked-template-note">Birthday Calendar keeps its core fields protected, but you can still add extra fields around them.</p>}
              <div className="column-list">
                <SystemColumnRow
                  name="Item ID"
                  onToggle={setShowItemIdOnBoard}
                  showOnBoard={showItemIdOnBoard}
                  typeLabel="system"
                />
                <SystemColumnRow
                  name="Dependencies"
                  onToggle={setShowDependenciesOnBoard}
                  showOnBoard={showDependenciesOnBoard}
                  typeLabel="system"
                />
                <SystemColumnRow
                  name="Created At"
                  onToggle={setShowCreatedAtOnBoard}
                  showOnBoard={showCreatedAtOnBoard}
                  typeLabel="system"
                />
                <SystemColumnRow
                  name="Created By"
                  onToggle={setShowCreatedByOnBoard}
                  showOnBoard={showCreatedByOnBoard}
                  typeLabel="system"
                />
                <SystemColumnRow
                  name="Status"
                  onToggle={setShowStatusOnBoard}
                  showOnBoard={showStatusOnBoard}
                  typeLabel="system"
                />
                {visibleColumns(list).map((column) => (
                  <ColumnRow
                    column={column}
                    draft={columnDrafts[column.id] ?? columnDraftFromColumn(column)}
                    key={column.id}
                    list={list}
                    locked={false}
                    manualOrderEnabled={list.columnSortOrder === 'manual'}
                    order={visibleColumns(list).findIndex((candidate) => candidate.id === column.id) + 1}
                    orderCount={visibleColumns(list).length}
                    onDraftChange={(patch) => updateColumnDraft(column, patch)}
                    onOrderChange={(order) => updateColumnOrder(column, order)}
                    onSave={() => saveColumnDraft(column)}
                    runAction={runAction}
                  />
                ))}
              </div>
              <div className="add-column-row">
                <input onChange={(event) => setNewColumnName(event.target.value)} placeholder="New column" value={newColumnName} />
                <select onChange={(event) => setNewColumnType(event.target.value as ColumnType)} value={newColumnType}>
                  {columnTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <button className="icon-button" onClick={addColumn} type="button">
                  <Plus size={16} />
                  Add Field
                </button>
              </div>
            </section>
          </div>
          <div className="modal-actions">
            <button className="icon-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" type="submit">
              <Save size={16} />
              Save List
            </button>
          </div>
        </form>
        {messageDialog && <MessageModal title={messageDialog.title} message={messageDialog.message} onClose={() => setMessageDialog(null)} />}
      </div>
    </div>
  )
}

function CloseItemModal({
  action,
  busy,
  comments,
  itemTitle,
  mode,
  onCancel,
  onCommentsChange,
  onConfirm
}: {
  action: 'completed' | 'cancelled'
  busy: boolean
  comments: string
  itemTitle: string
  mode: CloseConfirmationMode
  onCancel: () => void
  onCommentsChange: (value: string) => void
  onConfirm: () => void | Promise<void>
}): ReactElement {
  const message =
    mode === 'without_comments'
      ? action === 'completed'
        ? 'You are about to mark this item as completed. Please confirm.'
        : 'You are about to cancel this task before completion. Please confirm.'
      : action === 'completed'
        ? 'You are about to mark this item as completed. Do you want to log any comments?'
        : 'You are about to cancel this task before completion. Do you want to log any comments?'

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        aria-modal="true"
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Close Item</p>
            <h3>{itemTitle}</h3>
          </div>
        </div>
        <div className="modal-body">
          <p>{message}</p>
          {mode === 'with_comments' && (
            <label className="modal-field">
              <span>Comments</span>
              <textarea
                onChange={(event) => onCommentsChange(event.target.value)}
                placeholder="Add an optional note for the closure log"
                rows={4}
                value={comments}
              />
            </label>
          )}
        </div>
        <div className="modal-actions">
          <button className="icon-button" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={busy} onClick={() => void onConfirm()} type="button">
            {action === 'completed' ? 'Mark Completed' : 'Cancel Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BirthdayGiftModal({
  birthdayItem,
  birthdayList,
  lists,
  onClose,
  runAction
}: {
  birthdayItem: BoardItem
  birthdayList: BoardList
  lists: BoardList[]
  onClose: () => void
  runAction: RunAction
}): ReactElement {
  const birthdayName = itemTitle(birthdayItem, birthdayList)
  const birthdayColumn = birthdayCoreColumns(birthdayList).find((column) => isBirthdayDateColumn(column))
  const occurrence = birthdayColumn ? birthdayOccurrenceDate(birthdayItem.values[birthdayColumn.id]) : null
  const [targetListId, setTargetListId] = useState(lists[0]?.id ?? '')
  const [title, setTitle] = useState(`Get present for ${birthdayName}`)
  const [deadline, setDeadline] = useState(occurrence ? localDateTimeInputValue(dayBeforeBirthday(occurrence)) : '')

  useEffect(() => {
    setTargetListId(lists[0]?.id ?? '')
    setTitle(`Get present for ${birthdayName}`)
    setDeadline(occurrence ? localDateTimeInputValue(dayBeforeBirthday(occurrence)) : '')
  }, [birthdayItem.id, birthdayList.id, lists.length])

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const targetList = lists.find((list) => list.id === targetListId)
    if (!targetList) return
    const values = blankValues(editableItemColumns(targetList))
    const nameColumn = editableItemColumns(targetList)[0]
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
  mode,
  onClose,
  snapshot
}: {
  mode: 'today' | 'next24h'
  onClose: () => void
  snapshot: BoardSnapshot
}): ReactElement {
  const entries = collectDaySummaryEntries(snapshot, mode)
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

function ItemFields({
  columns,
  setValue,
  values
}: {
  columns: ListColumn[]
  setValue: (column: ListColumn, value: FieldValue) => void
  values: FormValues
}): ReactElement {
  return (
    <div className="field-grid two">
      {columns.map((column) => {
        if (isItemLevelRecurringTimeColumn(column)) {
          const dateValue = dateFieldValue(values[column.id])
          return (
            <div className="item-recurring-field" key={column.id}>
              <label>
                <span>{column.name}</span>
                <input
                  onChange={(event) => setValue(column, { ...dateValue, value: event.target.value })}
                  required={column.required}
                  type="time"
                  value={dateValue.value}
                />
              </label>
              <label>
                <span>Recurrence</span>
                <select
                  onChange={(event) => {
                    const recurrence = event.target.value as RecurrenceMode
                    setValue(column, {
                      ...dateValue,
                      recurrence,
                      recurrenceDays: recurrenceNeedsWeekdays(recurrence) ? dateValue.recurrenceDays : [],
                      recurrenceInterval: recurrenceNeedsInterval(recurrence) ? dateValue.recurrenceInterval : 1
                    })
                  }}
                  value={dateValue.recurrence}
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="interval_weeks">Every x weeks</option>
                  <option value="monthly">Monthly</option>
                  <option value="interval_months">Every x months</option>
                  <option value="custom_weekdays">Weekdays...</option>
                </select>
              </label>
              {recurrenceNeedsInterval(dateValue.recurrence) && (
                <label>
                  <span>{dateValue.recurrence === 'interval_months' ? 'Months' : 'Weeks'}</span>
                  <input
                    min={1}
                    onChange={(event) =>
                      setValue(column, {
                        ...dateValue,
                        recurrenceInterval: normalizeRecurrenceInterval(Number.parseInt(event.target.value, 10))
                      })
                    }
                    type="number"
                    value={dateValue.recurrenceInterval}
                  />
                </label>
              )}
              {recurrenceNeedsWeekdays(dateValue.recurrence) && (
                <fieldset className="weekday-picker">
                  <legend>Days</legend>
                  {weekdayLabels.map((day, index) => (
                    <label key={day.long}>
                      <input
                        checked={dateValue.recurrenceDays.includes(index)}
                        onChange={(event) =>
                          setValue(column, {
                            ...dateValue,
                            recurrenceDays: event.target.checked
                              ? [...dateValue.recurrenceDays, index].sort((a, b) => a - b)
                              : dateValue.recurrenceDays.filter((dayIndex) => dayIndex !== index)
                          })
                        }
                        type="checkbox"
                      />
                      {day.short}
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
          )
        }
        return (
          <label key={column.id}>
            <span>{column.type === 'currency' ? `${column.name} (${column.currencyCode})` : column.name}</span>
            {column.type === 'boolean' ? (
              <input checked={Boolean(values[column.id])} onChange={(event) => setValue(column, event.target.checked)} type="checkbox" />
            ) : column.type === 'choice' ? (
              <select
                multiple={column.choiceConfig?.selection === 'multi'}
                onChange={(event) =>
                  setValue(
                    column,
                    column.choiceConfig?.selection === 'multi'
                      ? Array.from(event.target.selectedOptions, (option) => option.value)
                      : event.target.value
                  )
                }
                required={column.required}
                value={choiceInputValue(values[column.id], column)}
              >
                {column.choiceConfig?.selection !== 'multi' && <option value="">None</option>}
                {(column.choiceConfig?.options ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                maxLength={column.maxLength ?? undefined}
                onChange={(event) => setValue(column, event.target.value)}
                required={column.required}
                type={inputType(column)}
                value={inputValue(values[column.id], column)}
              />
            )}
          </label>
        )
      })}
    </div>
  )
}

function DependencyTreePicker({
  currentItemId,
  dependencies,
  setDependencies,
  snapshot
}: {
  currentItemId: string
  dependencies: string[]
  setDependencies: Dispatch<SetStateAction<string[]>>
  snapshot: BoardSnapshot
}): ReactElement {
  const [boardExpanded, setBoardExpanded] = useState(false)
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setBoardExpanded(false)
    setExpandedLists({})
    setExpandedGroups({})
  }, [snapshot.id, currentItemId])

  function toggleItemDependency(itemId: string, checked: boolean): void {
    setDependencies((current) => (checked ? [...current, itemId] : current.filter((id) => id !== itemId)))
  }

  function renderItemRow(item: BoardItem, list: BoardList, depth: number): ReactElement {
    return (
      <div className="dependency-tree-row" key={item.id}>
        <label className="dependency-tree-item" style={{ paddingInlineStart: `${0.65 + depth * 1.05}rem` }}>
          <input
            checked={dependencies.includes(item.id)}
            onChange={(event) => toggleItemDependency(item.id, event.target.checked)}
            type="checkbox"
          />
          <span>{itemTitle(item, list)}</span>
          <small>{item.displayCode}</small>
        </label>
      </div>
    )
  }

  function renderGroupRows(group: ItemGroup, list: BoardList, depth: number): ReactElement {
    const expanded = expandedGroups[group.id] ?? true
    const childGroups = list.groups.filter((candidate) => candidate.parentGroupId === group.id)
    const childItems = list.items.filter((candidate) => candidate.groupId === group.id && candidate.id !== currentItemId)
    const hasChildren = childGroups.length > 0 || childItems.length > 0

    return (
      <div key={group.id}>
        <button
          className="dependency-tree-branch dependency-tree-level-group"
          onClick={() => {
            if (hasChildren) {
              setExpandedGroups((current) => ({ ...current, [group.id]: !expanded }))
            }
          }}
          style={{ paddingInlineStart: `${0.65 + depth * 1.05}rem` }}
          type="button"
        >
          <span className="dependency-tree-expander">
            {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span />}
          </span>
          <span>{group.name}</span>
          <small>{group.code}</small>
        </button>
        {expanded && (
          <>
            {childGroups.map((child) => renderGroupRows(child, list, depth + 1))}
            {childItems.map((child) => renderItemRow(child, list, depth + 1))}
          </>
        )}
      </div>
    )
  }

  function renderListRows(list: BoardList): ReactElement {
    const expanded = expandedLists[list.id] ?? true
    const childGroups = list.groups.filter((group) => !group.parentGroupId)
    const rootItems = list.items.filter((candidate) => !candidate.groupId && candidate.id !== currentItemId)
    const hasChildren = childGroups.length > 0 || rootItems.length > 0

    return (
      <div key={list.id}>
        <button
          className="dependency-tree-branch dependency-tree-level-list"
          onClick={() => {
            if (hasChildren) {
              setExpandedLists((current) => ({ ...current, [list.id]: !expanded }))
            }
          }}
          style={{ paddingInlineStart: '1.7rem' }}
          type="button"
        >
          <span className="dependency-tree-expander">
            {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span />}
          </span>
          <span>{list.name}</span>
          <small>{list.code}</small>
        </button>
        {expanded && (
          <>
            {childGroups.map((group) => renderGroupRows(group, list, 2))}
            {rootItems.map((rootItem) => renderItemRow(rootItem, list, 2))}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="dependency-tree-panel">
      <div className="dependency-tree-toolbar">
        <span>Board Dependency Tree</span>
        <small>Select the tasks this item depends on.</small>
      </div>
      <div className="dependency-tree-scroll">
        <button className="dependency-tree-branch dependency-tree-level-board" onClick={() => setBoardExpanded((current) => !current)} type="button">
          <span className="dependency-tree-expander">{boardExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
          <span>{snapshot.name}</span>
          <small>{snapshot.lists.length} lists</small>
        </button>
        {boardExpanded && (
          <div className="dependency-tree-body">
            {snapshot.lists.map((boardList) => renderListRows(boardList))}
          </div>
        )}
      </div>
    </div>
  )
}

function EditorHeading({ eyebrow, title }: { eyebrow: string; title: string }): ReactElement {
  return (
    <header className="panel-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
    </header>
  )
}

function CollapsibleEditorSectionHeader({
  expanded,
  onToggle,
  title
}: {
  expanded: boolean
  onToggle: () => void
  title: string
}): ReactElement {
  return (
    <button className="editor-section-toggle" onClick={onToggle} type="button">
      <span className="editor-section-toggle-main">
        <span className="editor-section-toggle-icon">{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
        <h3>{title}</h3>
      </span>
    </button>
  )
}

function nodeClass(selected: SelectedNode, node: SelectedNode): string {
  return selected.kind === node.kind && selected.id === node.id ? 'tree-node active' : 'tree-node'
}

function nodeExists(node: SelectedNode, snapshot: BoardSnapshot): boolean {
  if (node.kind === 'board') return node.id === snapshot.id
  if (node.kind === 'list') return snapshot.lists.some((list) => list.id === node.id)
  if (node.kind === 'group') return snapshot.lists.some((list) => list.groups.some((group) => group.id === node.id))
  if (node.kind === 'item') return snapshot.lists.some((list) => list.items.some((item) => item.id === node.id))
  return snapshot.widgets.some((widget) => widget.id === node.id)
}

function newestList(snapshot: BoardSnapshot): BoardList | undefined {
  return [...snapshot.lists].sort((a, b) => b.order - a.order)[0]
}

function newestItem(list: BoardList | undefined): BoardItem | undefined {
  return list ? [...list.items].sort((a, b) => b.order - a.order)[0] : undefined
}

function newestGroup(list: BoardList | undefined): ItemGroup | undefined {
  return list ? [...list.groups].sort((a, b) => b.order - a.order)[0] : undefined
}

function newestWidget(snapshot: BoardSnapshot): BoardWidget | undefined {
  return [...snapshot.widgets].sort((a, b) => b.order - a.order)[0]
}

function nextOpenDisplaySlot(lists: BoardList[]): BoardList['grid'] | null {
  const occupied = lists.filter((list) => list.displayEnabled && validDisplayGrid(list.grid)).map((list) => list.grid)
  for (let y = 1; y <= 9 - MIN_LIST_GRID_HEIGHT; y += MIN_LIST_GRID_HEIGHT) {
    for (let x = 1; x <= 17 - MIN_LIST_GRID_WIDTH; x += 1) {
      const candidate = { x, y, w: MIN_LIST_GRID_WIDTH, h: MIN_LIST_GRID_HEIGHT }
      if (!occupied.some((grid) => gridsOverlap(grid, candidate))) return candidate
    }
  }
  return null
}

function placeListForDisplay(
  lists: BoardList[],
  widgets: BoardWidget[],
  listId: string,
  preferredGrid: BoardList['grid']
): { grid: BoardList['grid']; moved: { list: BoardList; grid: BoardList['grid'] }[] } | null {
  const others = lists.filter((list) => list.id !== listId && list.displayEnabled && validDisplayGrid(list.grid))
  const widgetGrids = widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)
  const normalized = normalizeDisplayGrid(preferredGrid)
  if (canPlaceAgainst(normalized, [...others.map((list) => list.grid), ...widgetGrids])) return { grid: normalized, moved: [] }

  const open = firstOpenSlot([...others.map((list) => list.grid), ...widgetGrids])
  if (open) return { grid: open, moved: [] }

  const pushed = pushRightPlacement(others, widgetGrids)
  return pushed ? { grid: pushed.grid, moved: pushed.moved } : null
}

function placeListForDisplaySizes(
  lists: BoardList[],
  widgets: BoardWidget[],
  listId: string,
  sizes: Array<Pick<BoardList['grid'], 'w' | 'h'>>
): { grid: BoardList['grid']; moved: { list: BoardList; grid: BoardList['grid'] }[] } | null {
  const others = lists.filter((list) => list.id !== listId && list.displayEnabled && validDisplayGrid(list.grid))
  const occupied = [...others.map((list) => list.grid), ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)]
  for (const size of sizes) {
    for (let y = 1; y <= 9 - size.h; y += 1) {
      for (let x = 1; x <= 17 - size.w; x += 1) {
        const candidate = { x, y, w: size.w, h: size.h }
        if (canPlaceAgainst(candidate, occupied)) return { grid: candidate, moved: [] }
      }
    }
  }
  return placeListForDisplay(lists, widgets, listId, { x: 1, y: 1, ...sizes[sizes.length - 1] })
}

function listTemplateGridSizes(templateType: ListTemplateType): Array<Pick<BoardList['grid'], 'w' | 'h'>> {
  if (templateType === 'todo') return [{ w: 6, h: 4 }, { w: 6, h: 3 }, { w: 6, h: 2 }, { w: 5, h: 4 }, { w: 5, h: 3 }, { w: 5, h: 2 }, { w: 4, h: 3 }, { w: 4, h: 2 }]
  if (templateType === 'shopping_list') return [{ w: 4, h: 4 }, { w: 4, h: 3 }, { w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }]
  if (templateType === 'health') return [{ w: 5, h: 4 }, { w: 5, h: 3 }, { w: 4, h: 4 }, { w: 4, h: 3 }, { w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }]
  if (templateType === 'wishlist' || templateType === 'birthday_calendar') return [{ w: 6, h: 4 }, { w: 6, h: 3 }, { w: 5, h: 4 }, { w: 5, h: 3 }, { w: 4, h: 4 }, { w: 4, h: 3 }, { w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }]
  return [{ w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }]
}

function pushRightPlacement(
  lists: BoardList[],
  occupiedExternal: BoardList['grid'][]
): { grid: BoardList['grid']; moved: { list: BoardList; grid: BoardList['grid'] }[] } | null {
  for (let y = 1; y <= 9 - MIN_LIST_GRID_HEIGHT; y += MIN_LIST_GRID_HEIGHT) {
    const rowLists = lists
      .filter((list) => list.grid.y <= y && y + MIN_LIST_GRID_HEIGHT - 1 < list.grid.y + list.grid.h)
      .sort((a, b) => a.grid.x - b.grid.x)
    const allRowGrids = [...lists.filter((list) => !rowLists.includes(list)).map((list) => list.grid), ...occupiedExternal]

    for (let insertX = 1; insertX <= 17 - MIN_LIST_GRID_WIDTH; insertX += 1) {
      const candidate = { x: insertX, y, w: MIN_LIST_GRID_WIDTH, h: MIN_LIST_GRID_HEIGHT }
      const moved: { list: BoardList; grid: BoardList['grid'] }[] = []
      const rowGrids = rowLists.map((list) => ({ list, grid: { ...list.grid } }))

      let changed = true
      while (changed && rowGrids.some((entry) => gridsOverlap(entry.grid, candidate))) {
        changed = false
        const overlapping = rowGrids
          .filter((entry) => gridsOverlap(entry.grid, candidate))
          .sort((a, b) => b.grid.x - a.grid.x)[0]
        if (!overlapping) break
        const blocking = rightBlockingEntry(overlapping, rowGrids)
        const target = blocking ?? overlapping
        if (target.grid.x + target.grid.w > 16) break
        target.grid = { ...target.grid, x: target.grid.x + 1 }
        changed = true
      }

      const nextRow = rowGrids.map((entry) => entry.grid)
      if (
        canPlaceAgainst(candidate, [...allRowGrids, ...nextRow]) &&
        nextRow.every((grid, index) => !nextRow.some((other, otherIndex) => index !== otherIndex && gridsOverlap(grid, other)))
      ) {
        for (const entry of rowGrids) {
          const original = entry.list.grid
          if (entry.grid.x !== original.x || entry.grid.y !== original.y || entry.grid.w !== original.w || entry.grid.h !== original.h) {
            moved.push({ list: entry.list, grid: entry.grid })
          }
        }
        return { grid: candidate, moved }
      }
    }
  }
  return null
}

function rightBlockingEntry(
  entry: { list: BoardList; grid: BoardList['grid'] },
  row: { list: BoardList; grid: BoardList['grid'] }[]
): { list: BoardList; grid: BoardList['grid'] } | null {
  return (
    row
      .filter((candidate) => candidate.list.id !== entry.list.id && candidate.grid.x >= entry.grid.x + entry.grid.w)
      .sort((a, b) => a.grid.x - b.grid.x)[0] ?? null
  )
}

function firstOpenSlot(occupied: BoardList['grid'][]): BoardList['grid'] | null {
  for (let y = 1; y <= 9 - MIN_LIST_GRID_HEIGHT; y += MIN_LIST_GRID_HEIGHT) {
    for (let x = 1; x <= 17 - MIN_LIST_GRID_WIDTH; x += 1) {
      const candidate = { x, y, w: MIN_LIST_GRID_WIDTH, h: MIN_LIST_GRID_HEIGHT }
      if (canPlaceAgainst(candidate, occupied)) return candidate
    }
  }
  return null
}

function normalizeDisplayGrid(grid: BoardList['grid']): BoardList['grid'] {
  if (!validDisplayGrid(grid)) return { x: 1, y: 1, w: MIN_LIST_GRID_WIDTH, h: MIN_LIST_GRID_HEIGHT }
  return { x: grid.x, y: grid.y, w: Math.max(MIN_LIST_GRID_WIDTH, grid.w), h: Math.max(MIN_LIST_GRID_HEIGHT, grid.h) }
}

function validDisplayGrid(grid: BoardList['grid']): boolean {
  return (
    grid.x >= 1 &&
    grid.y >= 1 &&
    grid.w >= MIN_LIST_GRID_WIDTH &&
    grid.h >= MIN_LIST_GRID_HEIGHT &&
    grid.x + grid.w <= 17 &&
    grid.y + grid.h <= 9
  )
}

function canPlaceAgainst(grid: BoardList['grid'], occupied: BoardList['grid'][]): boolean {
  return validDisplayGrid(grid) && !occupied.some((candidate) => gridsOverlap(grid, candidate))
}

function canPlaceGrid(grid: BoardList['grid'], lists: BoardList[], widgets: BoardWidget[], currentListId: string): boolean {
  if (grid.x < 1 || grid.y < 1 || grid.w < MIN_LIST_GRID_WIDTH || grid.h < MIN_LIST_GRID_HEIGHT) return false
  if (grid.x + grid.w > 17 || grid.y + grid.h > 9) return false
  return (
    !lists.some((list) => list.displayEnabled && list.id !== currentListId && gridsOverlap(grid, list.grid)) &&
    !widgets.some((widget) => widget.displayEnabled && gridsOverlap(grid, widget.grid))
  )
}

function resolveListGridChange(
  list: BoardList,
  candidate: BoardList['grid'],
  lists: BoardList[],
  widgets: BoardWidget[]
): { grid: BoardList['grid']; moved: { list: BoardList; grid: BoardList['grid'] }[]; movedWidgets?: { widget: BoardWidget; grid: BoardWidget['grid'] }[]; message?: string } | null {
  const normalized = normalizeDisplayGrid(candidate)
  if (canPlaceGrid(normalized, lists, widgets, list.id)) return { grid: normalized, moved: [] }

  const mixedHorizontalReflow = resolveHorizontalMixedReflow({ kind: 'list', id: list.id, grid: list.grid, list }, normalized, lists, widgets)
  if (mixedHorizontalReflow) return { grid: mixedHorizontalReflow.grid, moved: mixedHorizontalReflow.movedLists, movedWidgets: mixedHorizontalReflow.movedWidgets }

  const mixedVerticalReflow = resolveVerticalMixedReflow({ kind: 'list', id: list.id, grid: list.grid, list }, normalized, lists, widgets)
  if (mixedVerticalReflow) return { grid: mixedVerticalReflow.grid, moved: mixedVerticalReflow.movedLists, movedWidgets: mixedVerticalReflow.movedWidgets }

  const overlappingLists = lists.filter(
    (entry) => entry.displayEnabled && entry.id !== list.id && validDisplayGrid(entry.grid) && gridsOverlap(normalized, entry.grid)
  )
  const overlappingWidgets = widgets.filter(
    (entry) => entry.displayEnabled && validWidgetGrid(entry.grid) && gridsOverlap(normalized, entry.grid)
  )

  const horizontalReflow = resolveHorizontalListReflow(list, normalized, lists, widgets)
  if (horizontalReflow) return horizontalReflow

  const verticalReflow = resolveVerticalListReflow(list, normalized, lists, widgets)
  if (verticalReflow) return verticalReflow

  const bestEffortMove = resolveBestEffortListMove(list, normalized, lists, widgets)
  if (bestEffortMove) return bestEffortMove

  const mixedOverlaps = [...overlappingLists.map((entry) => ({ kind: 'list' as const, id: entry.id, grid: entry.grid, list: entry })), ...overlappingWidgets.map((entry) => ({ kind: 'widget' as const, id: entry.id, grid: entry.grid, widget: entry }))]
  if (mixedOverlaps.length === 1) {
    const mixedSwap = resolveMixedSwap({ kind: 'list', id: list.id, grid: list.grid, list }, normalized, mixedOverlaps[0], lists, widgets)
    if (mixedSwap) return { grid: mixedSwap.grid, moved: mixedSwap.movedLists, movedWidgets: mixedSwap.movedWidgets }
  }

  if (overlappingLists.length === 1) {
    const target = overlappingLists[0]
    if (sameGridSize(normalized, target.grid)) {
      const swappedTargetGrid = { ...target.grid, x: list.grid.x, y: list.grid.y }
      const remainingLists = lists.filter((entry) => entry.id !== list.id && entry.id !== target.id)
      const canSwap =
        canPlaceAgainst(swappedTargetGrid, [
          ...remainingLists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid),
          ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)
        ]) && canPlaceAgainst(normalized, [
          ...remainingLists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid),
          ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)
        ])

      if (canSwap) return { grid: normalized, moved: [{ list: target, grid: swappedTargetGrid }] }
    }

    return {
      grid: list.grid,
      moved: [],
      message:
        'You are attempting to swap positions of two lists of different sizes. Position swapping is only possible if the two items are of the same size.'
    }
  }

  return null
}

function resolveWidgetGridChange(
  widget: BoardWidget,
  candidate: BoardWidget['grid'],
  widgets: BoardWidget[],
  lists: BoardList[]
): { grid: BoardWidget['grid']; moved: { widget: BoardWidget; grid: BoardWidget['grid'] }[]; movedLists?: { list: BoardList; grid: BoardList['grid'] }[] } | null {
  if (canPlaceWidgetGrid(candidate, lists, widgets, widget.id, widget.type, widget.config)) return { grid: candidate, moved: [] }

  const mixedHorizontalReflow = resolveHorizontalMixedReflow({ kind: 'widget', id: widget.id, grid: widget.grid, widget }, candidate, lists, widgets)
  if (mixedHorizontalReflow) return { grid: mixedHorizontalReflow.grid, moved: mixedHorizontalReflow.movedWidgets, movedLists: mixedHorizontalReflow.movedLists }

  const mixedVerticalReflow = resolveVerticalMixedReflow({ kind: 'widget', id: widget.id, grid: widget.grid, widget }, candidate, lists, widgets)
  if (mixedVerticalReflow) return { grid: mixedVerticalReflow.grid, moved: mixedVerticalReflow.movedWidgets, movedLists: mixedVerticalReflow.movedLists }

  const overlappingWidgets = widgets.filter(
    (entry) => entry.displayEnabled && entry.id !== widget.id && validWidgetGrid(entry.grid) && gridsOverlap(candidate, entry.grid)
  )
  const overlappingLists = lists.filter(
    (entry) => entry.displayEnabled && validDisplayGrid(entry.grid) && gridsOverlap(candidate, entry.grid)
  )

  const horizontalReflow = resolveHorizontalWidgetReflow(widget, candidate, widgets, lists)
  if (horizontalReflow) return horizontalReflow

  const verticalReflow = resolveVerticalWidgetReflow(widget, candidate, widgets, lists)
  if (verticalReflow) return verticalReflow

  const bestEffortMove = resolveBestEffortWidgetMove(widget, candidate, widgets, lists)
  if (bestEffortMove) return bestEffortMove

  const mixedOverlaps = [...overlappingWidgets.map((entry) => ({ kind: 'widget' as const, id: entry.id, grid: entry.grid, widget: entry })), ...overlappingLists.map((entry) => ({ kind: 'list' as const, id: entry.id, grid: entry.grid, list: entry }))]
  if (mixedOverlaps.length === 1) {
    const mixedSwap = resolveMixedSwap({ kind: 'widget', id: widget.id, grid: widget.grid, widget }, candidate, mixedOverlaps[0], lists, widgets)
    if (mixedSwap) return { grid: mixedSwap.grid, moved: mixedSwap.movedWidgets, movedLists: mixedSwap.movedLists }
  }

  if (overlappingWidgets.length === 1) {
    const target = overlappingWidgets[0]
    if (sameGridSize(candidate, target.grid)) {
      const swappedTargetGrid = { ...target.grid, x: widget.grid.x, y: widget.grid.y }
      const remainingWidgets = widgets.filter((entry) => entry.id !== widget.id && entry.id !== target.id)
      const canSwap =
        canPlaceAgainst(swappedTargetGrid, [
          ...lists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid),
          ...remainingWidgets.filter((entry) => entry.displayEnabled).map((entry) => entry.grid)
        ]) && canPlaceAgainst(candidate, [
          ...lists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid),
          ...remainingWidgets.filter((entry) => entry.displayEnabled).map((entry) => entry.grid)
        ])

      if (canSwap) return { grid: candidate, moved: [{ widget: target, grid: swappedTargetGrid }] }
    }
  }

  return null
}

function gridsOverlap(a: BoardList['grid'], b: BoardList['grid']): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function sameGridSize(a: BoardList['grid'], b: BoardList['grid']): boolean {
  return a.w === b.w && a.h === b.h
}

function sameGridPosition(a: BoardList['grid'], b: BoardList['grid']): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
}

function sameRowBand(a: BoardList['grid'], b: BoardList['grid']): boolean {
  return a.y === b.y && a.h === b.h
}

function sameColumnBand(a: BoardList['grid'], b: BoardList['grid']): boolean {
  return a.x === b.x && a.w === b.w
}

function validWidgetGrid(grid: BoardWidget['grid']): boolean {
  return grid.x >= 1 && grid.y >= 1 && grid.w >= 2 && grid.h >= 2 && grid.x + grid.w <= 17 && grid.y + grid.h <= 9
}

type LayoutElement =
  | { kind: 'list'; id: string; grid: BoardList['grid']; list: BoardList }
  | { kind: 'widget'; id: string; grid: BoardWidget['grid']; widget: BoardWidget }

type MixedLayoutChange = {
  grid: BoardList['grid']
  movedLists: { list: BoardList; grid: BoardList['grid'] }[]
  movedWidgets: { widget: BoardWidget; grid: BoardWidget['grid'] }[]
}

function allLayoutElements(lists: BoardList[], widgets: BoardWidget[]): LayoutElement[] {
  return [
    ...lists.filter((entry) => entry.displayEnabled).map((list) => ({ kind: 'list' as const, id: list.id, grid: list.grid, list })),
    ...widgets.filter((entry) => entry.displayEnabled).map((widget) => ({ kind: 'widget' as const, id: widget.id, grid: widget.grid, widget }))
  ]
}

function validLayoutGrid(element: LayoutElement): boolean {
  return element.kind === 'list' ? validDisplayGrid(element.grid) : validWidgetGrid(element.grid)
}

function resolveHorizontalListReflow(
  list: BoardList,
  candidate: BoardList['grid'],
  lists: BoardList[],
  widgets: BoardWidget[]
): { grid: BoardList['grid']; moved: { list: BoardList; grid: BoardList['grid'] }[] } | null {
  if (candidate.y !== list.grid.y || candidate.h !== list.grid.h) return null

  const rowPeers = lists
    .filter((entry) => entry.displayEnabled && entry.id !== list.id && validDisplayGrid(entry.grid) && sameRowBand(entry.grid, list.grid))
    .sort((a, b) => a.grid.x - b.grid.x)
  if (rowPeers.length === 0) return null

  const peers = affectedHorizontalPeers(list, candidate, rowPeers)
  if (peers.length === 0) return null

  const overlappingPeers = peers.filter((entry) => gridsOverlap(entry.grid, candidate))
  const desiredOrder = [...peers]
  const insertIndex = horizontalInsertIndex(list, candidate, desiredOrder, overlappingPeers)
  desiredOrder.splice(insertIndex, 0, list)

  const positioned = positionHorizontalRun(desiredOrder, list.id, candidate)
  const occupiedExternal = [
    ...lists
      .filter((entry) => entry.displayEnabled && entry.id !== list.id && !peers.some((peer) => peer.id === entry.id))
      .map((entry) => entry.grid),
    ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)
  ]

  if (!validatePositionedRun(positioned, occupiedExternal)) return null
  return positionedResult(list.id, positioned)
}

function resolveHorizontalWidgetReflow(
  widget: BoardWidget,
  candidate: BoardWidget['grid'],
  widgets: BoardWidget[],
  lists: BoardList[]
): { grid: BoardWidget['grid']; moved: { widget: BoardWidget; grid: BoardWidget['grid'] }[] } | null {
  if (candidate.y !== widget.grid.y || candidate.h !== widget.grid.h) return null

  const rowPeers = widgets
    .filter((entry) => entry.displayEnabled && entry.id !== widget.id && validWidgetGrid(entry.grid) && sameRowBand(entry.grid, widget.grid))
    .sort((a, b) => a.grid.x - b.grid.x)
  if (rowPeers.length === 0) return null

  const peers = affectedHorizontalWidgetPeers(widget, candidate, rowPeers)
  if (peers.length === 0) return null

  const overlappingPeers = peers.filter((entry) => gridsOverlap(entry.grid, candidate))
  const desiredOrder = [...peers]
  const insertIndex = horizontalWidgetInsertIndex(widget, candidate, desiredOrder, overlappingPeers)
  desiredOrder.splice(insertIndex, 0, widget)

  const positioned = positionHorizontalWidgetRun(desiredOrder, widget.id, candidate)
  const occupiedExternal = [
    ...lists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid),
    ...widgets
      .filter((entry) => entry.displayEnabled && entry.id !== widget.id && !peers.some((peer) => peer.id === entry.id))
      .map((entry) => entry.grid)
  ]

  if (!validateWidgetPositionedRun(positioned, occupiedExternal)) return null
  return widgetPositionedResult(widget.id, positioned)
}

function resolveHorizontalMixedReflow(
  moving: LayoutElement,
  candidate: BoardList['grid'],
  lists: BoardList[],
  widgets: BoardWidget[]
): MixedLayoutChange | null {
  if (candidate.y !== moving.grid.y || candidate.h !== moving.grid.h) return null

  const peers = allLayoutElements(lists, widgets)
    .filter((entry) => entry.id !== moving.id && sameRowBand(entry.grid, moving.grid) && validLayoutGrid(entry))
    .sort((a, b) => a.grid.x - b.grid.x)
  if (peers.length === 0) return null

  const corridorStart = Math.min(moving.grid.x, candidate.x)
  const corridorEnd = Math.max(moving.grid.x + moving.grid.w - 1, candidate.x + candidate.w - 1)
  const affected = peers.filter((entry) => rangesOverlap(entry.grid.x, entry.grid.x + entry.grid.w - 1, corridorStart, corridorEnd))
  if (affected.length === 0) return null

  const overlappingPeers = affected.filter((entry) => gridsOverlap(entry.grid, candidate))
  const ordered = [...affected]
  const insertIndex = genericInsertIndex(moving, candidate, ordered, overlappingPeers, 'horizontal')
  ordered.splice(insertIndex, 0, moving)

  const positioned = positionHorizontalMixedRun(ordered, moving.id, candidate)
  const affectedIds = new Set(affected.map((entry) => entry.id))
  const occupiedExternal = allLayoutElements(lists, widgets)
    .filter((entry) => entry.id !== moving.id && !affectedIds.has(entry.id))
    .map((entry) => entry.grid)

  if (!validateMixedPositionedRun(positioned, occupiedExternal)) return null
  return mixedPositionedResult(moving.id, positioned)
}

function horizontalInsertIndex(
  list: BoardList,
  candidate: BoardList['grid'],
  orderedPeers: BoardList[],
  overlappingPeers: BoardList[]
): number {
  if (overlappingPeers.length > 0) {
    if (candidate.x > list.grid.x) {
      return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[overlappingPeers.length - 1].id) + 1
    }
    if (candidate.x < list.grid.x) {
      return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[0].id)
    }
  }

  const candidateCenter = candidate.x + candidate.w / 2
  const byCenter = orderedPeers.findIndex((entry) => candidateCenter < entry.grid.x + entry.grid.w / 2)
  return byCenter === -1 ? orderedPeers.length : byCenter
}

function positionHorizontalRun(
  ordered: BoardList[],
  movingListId: string,
  candidate: BoardList['grid']
): { list: BoardList; grid: BoardList['grid'] }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingListId)
  const placed = new Map<string, BoardList['grid']>()
  placed.set(movingListId, { ...candidate })

  let nextX = candidate.x
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextX -= entry.grid.w
    placed.set(entry.id, { ...entry.grid, x: nextX, y: candidate.y })
  }

  let trailingX = candidate.x + candidate.w
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: trailingX, y: candidate.y })
    trailingX += entry.grid.w
  }

  const positioned = ordered.map((entry) => ({ list: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minX = Math.min(...positioned.map((entry) => entry.grid.x))
  if (minX < 1) {
    for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x + (1 - minX) }
  }

  const maxX = Math.max(...positioned.map((entry) => entry.grid.x + entry.grid.w - 1))
  if (maxX > 16) {
    for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x - (maxX - 16) }
  }

  return positioned
}

function positionHorizontalWidgetRun(
  ordered: BoardWidget[],
  movingWidgetId: string,
  candidate: BoardWidget['grid']
): { widget: BoardWidget; grid: BoardWidget['grid'] }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingWidgetId)
  const placed = new Map<string, BoardWidget['grid']>()
  placed.set(movingWidgetId, { ...candidate })

  let nextX = candidate.x
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextX -= entry.grid.w
    placed.set(entry.id, { ...entry.grid, x: nextX, y: candidate.y })
  }

  let trailingX = candidate.x + candidate.w
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: trailingX, y: candidate.y })
    trailingX += entry.grid.w
  }

  const positioned = ordered.map((entry) => ({ widget: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minX = Math.min(...positioned.map((entry) => entry.grid.x))
  if (minX < 1) {
    for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x + (1 - minX) }
  }

  const maxX = Math.max(...positioned.map((entry) => entry.grid.x + entry.grid.w - 1))
  if (maxX > 16) {
    for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x - (maxX - 16) }
  }

  return positioned
}

function resolveVerticalListReflow(
  list: BoardList,
  candidate: BoardList['grid'],
  lists: BoardList[],
  widgets: BoardWidget[]
): { grid: BoardList['grid']; moved: { list: BoardList; grid: BoardList['grid'] }[] } | null {
  if (candidate.x !== list.grid.x || candidate.w !== list.grid.w) return null

  const columnPeers = lists
    .filter((entry) => entry.displayEnabled && entry.id !== list.id && validDisplayGrid(entry.grid) && sameColumnBand(entry.grid, list.grid))
    .sort((a, b) => a.grid.y - b.grid.y)
  if (columnPeers.length === 0) return null

  const peers = affectedVerticalPeers(list, candidate, columnPeers)
  if (peers.length === 0) return null

  const overlappingPeers = peers.filter((entry) => gridsOverlap(entry.grid, candidate))
  const desiredOrder = [...peers]
  const insertIndex = verticalInsertIndex(list, candidate, desiredOrder, overlappingPeers)
  desiredOrder.splice(insertIndex, 0, list)

  const positioned = positionVerticalRun(desiredOrder, list.id, candidate)
  const occupiedExternal = [
    ...lists
      .filter((entry) => entry.displayEnabled && entry.id !== list.id && !peers.some((peer) => peer.id === entry.id))
      .map((entry) => entry.grid),
    ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)
  ]

  if (!validatePositionedRun(positioned, occupiedExternal)) return null
  return positionedResult(list.id, positioned)
}

function resolveVerticalWidgetReflow(
  widget: BoardWidget,
  candidate: BoardWidget['grid'],
  widgets: BoardWidget[],
  lists: BoardList[]
): { grid: BoardWidget['grid']; moved: { widget: BoardWidget; grid: BoardWidget['grid'] }[] } | null {
  if (candidate.x !== widget.grid.x || candidate.w !== widget.grid.w) return null

  const columnPeers = widgets
    .filter((entry) => entry.displayEnabled && entry.id !== widget.id && validWidgetGrid(entry.grid) && sameColumnBand(entry.grid, widget.grid))
    .sort((a, b) => a.grid.y - b.grid.y)
  if (columnPeers.length === 0) return null

  const peers = affectedVerticalWidgetPeers(widget, candidate, columnPeers)
  if (peers.length === 0) return null

  const overlappingPeers = peers.filter((entry) => gridsOverlap(entry.grid, candidate))
  const desiredOrder = [...peers]
  const insertIndex = verticalWidgetInsertIndex(widget, candidate, desiredOrder, overlappingPeers)
  desiredOrder.splice(insertIndex, 0, widget)

  const positioned = positionVerticalWidgetRun(desiredOrder, widget.id, candidate)
  const occupiedExternal = [
    ...lists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid),
    ...widgets
      .filter((entry) => entry.displayEnabled && entry.id !== widget.id && !peers.some((peer) => peer.id === entry.id))
      .map((entry) => entry.grid)
  ]

  if (!validateWidgetPositionedRun(positioned, occupiedExternal)) return null
  return widgetPositionedResult(widget.id, positioned)
}

function resolveVerticalMixedReflow(
  moving: LayoutElement,
  candidate: BoardList['grid'],
  lists: BoardList[],
  widgets: BoardWidget[]
): MixedLayoutChange | null {
  if (candidate.x !== moving.grid.x || candidate.w !== moving.grid.w) return null

  const peers = allLayoutElements(lists, widgets)
    .filter((entry) => entry.id !== moving.id && sameColumnBand(entry.grid, moving.grid) && validLayoutGrid(entry))
    .sort((a, b) => a.grid.y - b.grid.y)
  if (peers.length === 0) return null

  const corridorStart = Math.min(moving.grid.y, candidate.y)
  const corridorEnd = Math.max(moving.grid.y + moving.grid.h - 1, candidate.y + candidate.h - 1)
  const affected = peers.filter((entry) => rangesOverlap(entry.grid.y, entry.grid.y + entry.grid.h - 1, corridorStart, corridorEnd))
  if (affected.length === 0) return null

  const overlappingPeers = affected.filter((entry) => gridsOverlap(entry.grid, candidate))
  const ordered = [...affected]
  const insertIndex = genericInsertIndex(moving, candidate, ordered, overlappingPeers, 'vertical')
  ordered.splice(insertIndex, 0, moving)

  const positioned = positionVerticalMixedRun(ordered, moving.id, candidate)
  const affectedIds = new Set(affected.map((entry) => entry.id))
  const occupiedExternal = allLayoutElements(lists, widgets)
    .filter((entry) => entry.id !== moving.id && !affectedIds.has(entry.id))
    .map((entry) => entry.grid)

  if (!validateMixedPositionedRun(positioned, occupiedExternal)) return null
  return mixedPositionedResult(moving.id, positioned)
}

function affectedHorizontalPeers(list: BoardList, candidate: BoardList['grid'], peers: BoardList[]): BoardList[] {
  const corridorStart = Math.min(list.grid.x, candidate.x)
  const corridorEnd = Math.max(list.grid.x + list.grid.w - 1, candidate.x + candidate.w - 1)
  return peers.filter((entry) => rangesOverlap(entry.grid.x, entry.grid.x + entry.grid.w - 1, corridorStart, corridorEnd))
}

function affectedVerticalPeers(list: BoardList, candidate: BoardList['grid'], peers: BoardList[]): BoardList[] {
  const corridorStart = Math.min(list.grid.y, candidate.y)
  const corridorEnd = Math.max(list.grid.y + list.grid.h - 1, candidate.y + candidate.h - 1)
  return peers.filter((entry) => rangesOverlap(entry.grid.y, entry.grid.y + entry.grid.h - 1, corridorStart, corridorEnd))
}

function affectedHorizontalWidgetPeers(widget: BoardWidget, candidate: BoardWidget['grid'], peers: BoardWidget[]): BoardWidget[] {
  const corridorStart = Math.min(widget.grid.x, candidate.x)
  const corridorEnd = Math.max(widget.grid.x + widget.grid.w - 1, candidate.x + candidate.w - 1)
  return peers.filter((entry) => rangesOverlap(entry.grid.x, entry.grid.x + entry.grid.w - 1, corridorStart, corridorEnd))
}

function affectedVerticalWidgetPeers(widget: BoardWidget, candidate: BoardWidget['grid'], peers: BoardWidget[]): BoardWidget[] {
  const corridorStart = Math.min(widget.grid.y, candidate.y)
  const corridorEnd = Math.max(widget.grid.y + widget.grid.h - 1, candidate.y + candidate.h - 1)
  return peers.filter((entry) => rangesOverlap(entry.grid.y, entry.grid.y + entry.grid.h - 1, corridorStart, corridorEnd))
}

function resolveMixedSwap(
  moving: LayoutElement,
  candidate: BoardList['grid'],
  target: LayoutElement,
  lists: BoardList[],
  widgets: BoardWidget[]
): MixedLayoutChange | null {
  if (!sameGridSize(candidate, target.grid)) return null
  const swappedTargetGrid = { ...target.grid, x: moving.grid.x, y: moving.grid.y }
  const occupied = allLayoutElements(lists, widgets)
    .filter((entry) => entry.id !== moving.id && entry.id !== target.id)
    .map((entry) => entry.grid)
  const canSwap = canPlaceAgainst(swappedTargetGrid, occupied) && canPlaceAgainst(candidate, occupied)
  if (!canSwap) return null
  return mixedPositionedResult(moving.id, [
    { element: moving, grid: candidate },
    { element: target, grid: swappedTargetGrid }
  ])
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA <= endB && endA >= startB
}

function resolveBestEffortListMove(
  list: BoardList,
  candidate: BoardList['grid'],
  lists: BoardList[],
  widgets: BoardWidget[]
): { grid: BoardList['grid']; moved: { list: BoardList; grid: BoardList['grid'] }[] } | null {
  const others = lists.filter((entry) => entry.displayEnabled && entry.id !== list.id)
  const occupied = [...others.map((entry) => entry.grid), ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)]
  const dx = candidate.x - list.grid.x
  const dy = candidate.y - list.grid.y

  const candidates: BoardList['grid'][] = []
  for (let y = 1; y <= 9 - candidate.h; y += 1) {
    for (let x = 1; x <= 17 - candidate.w; x += 1) {
      const probe = { ...candidate, x, y }
      if (canPlaceAgainst(probe, occupied)) candidates.push(probe)
    }
  }

  if (candidates.length === 0) return null

  const directional = candidates
    .filter((probe) => matchesMoveDirection(list.grid, candidate, probe))
    .sort((a, b) => compareBestEffortGrid(list.grid, candidate, a, b, dx, dy))

  const chosen = (directional[0] ?? candidates.sort((a, b) => compareBestEffortGrid(list.grid, candidate, a, b, dx, dy))[0]) ?? null
  if (!chosen || sameGridPosition(chosen, list.grid)) return null
  return { grid: chosen, moved: [] }
}

function resolveBestEffortWidgetMove(
  widget: BoardWidget,
  candidate: BoardWidget['grid'],
  widgets: BoardWidget[],
  lists: BoardList[]
): { grid: BoardWidget['grid']; moved: { widget: BoardWidget; grid: BoardWidget['grid'] }[] } | null {
  const others = widgets.filter((entry) => entry.displayEnabled && entry.id !== widget.id)
  const occupied = [...others.map((entry) => entry.grid), ...lists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid)]
  const dx = candidate.x - widget.grid.x
  const dy = candidate.y - widget.grid.y

  const candidates: BoardWidget['grid'][] = []
  for (let y = 1; y <= 9 - candidate.h; y += 1) {
    for (let x = 1; x <= 17 - candidate.w; x += 1) {
      const probe = { ...candidate, x, y }
      if (canPlaceAgainst(probe, occupied)) candidates.push(probe)
    }
  }

  if (candidates.length === 0) return null

  const directional = candidates
    .filter((probe) => matchesMoveDirection(widget.grid, candidate, probe))
    .sort((a, b) => compareBestEffortGrid(widget.grid, candidate, a, b, dx, dy))

  const chosen = (directional[0] ?? candidates.sort((a, b) => compareBestEffortGrid(widget.grid, candidate, a, b, dx, dy))[0]) ?? null
  if (!chosen || sameGridPosition(chosen, widget.grid)) return null
  return { grid: chosen, moved: [] }
}

function matchesMoveDirection(origin: BoardList['grid'], candidate: BoardList['grid'], probe: BoardList['grid']): boolean {
  const dx = candidate.x - origin.x
  const dy = candidate.y - origin.y
  const horizontalOkay = dx === 0 || Math.sign(probe.x - origin.x) === Math.sign(dx) || probe.x === origin.x
  const verticalOkay = dy === 0 || Math.sign(probe.y - origin.y) === Math.sign(dy) || probe.y === origin.y
  return horizontalOkay && verticalOkay
}

function compareBestEffortGrid(
  origin: BoardList['grid'],
  candidate: BoardList['grid'],
  a: BoardList['grid'],
  b: BoardList['grid'],
  dx: number,
  dy: number
): number {
  const scoreA = bestEffortScore(origin, candidate, a, dx, dy)
  const scoreB = bestEffortScore(origin, candidate, b, dx, dy)
  if (scoreA.progress !== scoreB.progress) return scoreB.progress - scoreA.progress
  if (scoreA.distance !== scoreB.distance) return scoreA.distance - scoreB.distance
  if (scoreA.secondary !== scoreB.secondary) return scoreA.secondary - scoreB.secondary
  return scoreA.tertiary - scoreB.tertiary
}

function bestEffortScore(
  origin: BoardList['grid'],
  candidate: BoardList['grid'],
  probe: BoardList['grid'],
  dx: number,
  dy: number
): { progress: number; distance: number; secondary: number; tertiary: number } {
  const progressX = dx === 0 ? 0 : Math.max(0, Math.sign(dx) * (probe.x - origin.x))
  const progressY = dy === 0 ? 0 : Math.max(0, Math.sign(dy) * (probe.y - origin.y))
  const distance = Math.abs(probe.x - candidate.x) + Math.abs(probe.y - candidate.y)
  const secondary = Math.abs(probe.x - candidate.x)
  const tertiary = Math.abs(probe.y - candidate.y)
  return { progress: progressX + progressY, distance, secondary, tertiary }
}

function verticalInsertIndex(
  list: BoardList,
  candidate: BoardList['grid'],
  orderedPeers: BoardList[],
  overlappingPeers: BoardList[]
): number {
  if (overlappingPeers.length > 0) {
    if (candidate.y > list.grid.y) {
      return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[overlappingPeers.length - 1].id) + 1
    }
    if (candidate.y < list.grid.y) {
      return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[0].id)
    }
  }

  const candidateCenter = candidate.y + candidate.h / 2
  const byCenter = orderedPeers.findIndex((entry) => candidateCenter < entry.grid.y + entry.grid.h / 2)
  return byCenter === -1 ? orderedPeers.length : byCenter
}

function horizontalWidgetInsertIndex(
  widget: BoardWidget,
  candidate: BoardWidget['grid'],
  orderedPeers: BoardWidget[],
  overlappingPeers: BoardWidget[]
): number {
  if (overlappingPeers.length > 0) {
    if (candidate.x > widget.grid.x) {
      return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[overlappingPeers.length - 1].id) + 1
    }
    if (candidate.x < widget.grid.x) {
      return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[0].id)
    }
  }

  const candidateCenter = candidate.x + candidate.w / 2
  const byCenter = orderedPeers.findIndex((entry) => candidateCenter < entry.grid.x + entry.grid.w / 2)
  return byCenter === -1 ? orderedPeers.length : byCenter
}

function verticalWidgetInsertIndex(
  widget: BoardWidget,
  candidate: BoardWidget['grid'],
  orderedPeers: BoardWidget[],
  overlappingPeers: BoardWidget[]
): number {
  if (overlappingPeers.length > 0) {
    if (candidate.y > widget.grid.y) {
      return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[overlappingPeers.length - 1].id) + 1
    }
    if (candidate.y < widget.grid.y) {
      return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[0].id)
    }
  }

  const candidateCenter = candidate.y + candidate.h / 2
  const byCenter = orderedPeers.findIndex((entry) => candidateCenter < entry.grid.y + entry.grid.h / 2)
  return byCenter === -1 ? orderedPeers.length : byCenter
}

function genericInsertIndex(
  moving: LayoutElement,
  candidate: BoardList['grid'],
  orderedPeers: LayoutElement[],
  overlappingPeers: LayoutElement[],
  axis: 'horizontal' | 'vertical'
): number {
  const movingCoord = axis === 'horizontal' ? moving.grid.x : moving.grid.y
  const candidateCoord = axis === 'horizontal' ? candidate.x : candidate.y
  if (overlappingPeers.length > 0) {
    if (candidateCoord > movingCoord) {
      return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[overlappingPeers.length - 1].id) + 1
    }
    if (candidateCoord < movingCoord) {
      return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[0].id)
    }
  }

  const candidateCenter =
    axis === 'horizontal' ? candidate.x + candidate.w / 2 : candidate.y + candidate.h / 2
  const byCenter = orderedPeers.findIndex((entry) =>
    candidateCenter < (axis === 'horizontal' ? entry.grid.x + entry.grid.w / 2 : entry.grid.y + entry.grid.h / 2)
  )
  return byCenter === -1 ? orderedPeers.length : byCenter
}

function positionVerticalRun(
  ordered: BoardList[],
  movingListId: string,
  candidate: BoardList['grid']
): { list: BoardList; grid: BoardList['grid'] }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingListId)
  const placed = new Map<string, BoardList['grid']>()
  placed.set(movingListId, { ...candidate })

  let nextY = candidate.y
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextY -= entry.grid.h
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: nextY })
  }

  let trailingY = candidate.y + candidate.h
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: trailingY })
    trailingY += entry.grid.h
  }

  const positioned = ordered.map((entry) => ({ list: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minY = Math.min(...positioned.map((entry) => entry.grid.y))
  if (minY < 1) {
    for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y + (1 - minY) }
  }

  const maxY = Math.max(...positioned.map((entry) => entry.grid.y + entry.grid.h - 1))
  if (maxY > 8) {
    for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y - (maxY - 8) }
  }

  return positioned
}

function positionVerticalWidgetRun(
  ordered: BoardWidget[],
  movingWidgetId: string,
  candidate: BoardWidget['grid']
): { widget: BoardWidget; grid: BoardWidget['grid'] }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingWidgetId)
  const placed = new Map<string, BoardWidget['grid']>()
  placed.set(movingWidgetId, { ...candidate })

  let nextY = candidate.y
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextY -= entry.grid.h
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: nextY })
  }

  let trailingY = candidate.y + candidate.h
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: trailingY })
    trailingY += entry.grid.h
  }

  const positioned = ordered.map((entry) => ({ widget: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minY = Math.min(...positioned.map((entry) => entry.grid.y))
  if (minY < 1) {
    for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y + (1 - minY) }
  }

  const maxY = Math.max(...positioned.map((entry) => entry.grid.y + entry.grid.h - 1))
  if (maxY > 8) {
    for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y - (maxY - 8) }
  }

  return positioned
}

function positionHorizontalMixedRun(
  ordered: LayoutElement[],
  movingId: string,
  candidate: BoardList['grid']
): { element: LayoutElement; grid: BoardList['grid'] }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingId)
  const placed = new Map<string, BoardList['grid']>()
  placed.set(movingId, { ...candidate })

  let nextX = candidate.x
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextX -= entry.grid.w
    placed.set(entry.id, { ...entry.grid, x: nextX, y: candidate.y })
  }

  let trailingX = candidate.x + candidate.w
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: trailingX, y: candidate.y })
    trailingX += entry.grid.w
  }

  const positioned = ordered.map((entry) => ({ element: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minX = Math.min(...positioned.map((entry) => entry.grid.x))
  if (minX < 1) {
    for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x + (1 - minX) }
  }

  const maxX = Math.max(...positioned.map((entry) => entry.grid.x + entry.grid.w - 1))
  if (maxX > 16) {
    for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x - (maxX - 16) }
  }

  return positioned
}

function positionVerticalMixedRun(
  ordered: LayoutElement[],
  movingId: string,
  candidate: BoardList['grid']
): { element: LayoutElement; grid: BoardList['grid'] }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingId)
  const placed = new Map<string, BoardList['grid']>()
  placed.set(movingId, { ...candidate })

  let nextY = candidate.y
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextY -= entry.grid.h
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: nextY })
  }

  let trailingY = candidate.y + candidate.h
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: trailingY })
    trailingY += entry.grid.h
  }

  const positioned = ordered.map((entry) => ({ element: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minY = Math.min(...positioned.map((entry) => entry.grid.y))
  if (minY < 1) {
    for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y + (1 - minY) }
  }

  const maxY = Math.max(...positioned.map((entry) => entry.grid.y + entry.grid.h - 1))
  if (maxY > 8) {
    for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y - (maxY - 8) }
  }

  return positioned
}

function validatePositionedRun(positioned: { list: BoardList; grid: BoardList['grid'] }[], occupiedExternal: BoardList['grid'][]): boolean {
  for (let index = 0; index < positioned.length; index += 1) {
    const entry = positioned[index]
    if (!validDisplayGrid(entry.grid)) return false
    const occupied = [...occupiedExternal, ...positioned.filter((_, otherIndex) => otherIndex !== index).map((item) => item.grid)]
    if (!canPlaceAgainst(entry.grid, occupied)) return false
  }
  return true
}

function validateWidgetPositionedRun(
  positioned: { widget: BoardWidget; grid: BoardWidget['grid'] }[],
  occupiedExternal: BoardList['grid'][]
): boolean {
  for (let index = 0; index < positioned.length; index += 1) {
    const entry = positioned[index]
    if (!validWidgetGrid(entry.grid)) return false
    const occupied = [...occupiedExternal, ...positioned.filter((_, otherIndex) => otherIndex !== index).map((item) => item.grid)]
    if (!canPlaceAgainst(entry.grid, occupied)) return false
  }
  return true
}

function validateMixedPositionedRun(
  positioned: { element: LayoutElement; grid: BoardList['grid'] }[],
  occupiedExternal: BoardList['grid'][]
): boolean {
  for (let index = 0; index < positioned.length; index += 1) {
    const entry = positioned[index]
    const valid = entry.element.kind === 'list' ? validDisplayGrid(entry.grid) : validWidgetGrid(entry.grid)
    if (!valid) return false
    const occupied = [...occupiedExternal, ...positioned.filter((_, otherIndex) => otherIndex !== index).map((item) => item.grid)]
    if (!canPlaceAgainst(entry.grid, occupied)) return false
  }
  return true
}

function positionedResult(
  movingListId: string,
  positioned: { list: BoardList; grid: BoardList['grid'] }[]
): { grid: BoardList['grid']; moved: { list: BoardList; grid: BoardList['grid'] }[] } {
  const moving = positioned.find((entry) => entry.list.id === movingListId)
  return {
    grid: moving?.grid ?? positioned[0].grid,
    moved: positioned
      .filter((entry) => entry.list.id !== movingListId && !sameGridPosition(entry.grid, entry.list.grid))
      .map((entry) => ({ list: entry.list, grid: entry.grid }))
  }
}

function widgetPositionedResult(
  movingWidgetId: string,
  positioned: { widget: BoardWidget; grid: BoardWidget['grid'] }[]
): { grid: BoardWidget['grid']; moved: { widget: BoardWidget; grid: BoardWidget['grid'] }[] } {
  const moving = positioned.find((entry) => entry.widget.id === movingWidgetId)
  return {
    grid: moving?.grid ?? positioned[0].grid,
    moved: positioned
      .filter((entry) => entry.widget.id !== movingWidgetId && !sameGridPosition(entry.grid, entry.widget.grid))
      .map((entry) => ({ widget: entry.widget, grid: entry.grid }))
  }
}

function mixedPositionedResult(
  movingId: string,
  positioned: { element: LayoutElement; grid: BoardList['grid'] }[]
): MixedLayoutChange {
  const moving = positioned.find((entry) => entry.element.id === movingId)
  return {
    grid: moving?.grid ?? positioned[0].grid,
    movedLists: positioned
      .filter((entry) => entry.element.kind === 'list' && entry.element.id !== movingId && !sameGridPosition(entry.grid, entry.element.grid))
      .map((entry) => ({ list: (entry.element as Extract<LayoutElement, { kind: 'list' }>).list, grid: entry.grid })),
    movedWidgets: positioned
      .filter((entry) => entry.element.kind === 'widget' && entry.element.id !== movingId && !sameGridPosition(entry.grid, entry.element.grid))
      .map((entry) => ({ widget: (entry.element as Extract<LayoutElement, { kind: 'widget' }>).widget, grid: entry.grid }))
  }
}

function moveGrid(grid: BoardList['grid'], dx: number, dy: number): BoardList['grid'] {
  return {
    ...grid,
    x: clamp(grid.x + dx, 1, 17 - grid.w),
    y: clamp(grid.y + dy, 1, 9 - grid.h)
  }
}

function pointerMoveGrid(grid: BoardList['grid'], rect: DOMRect, pointerX: number, pointerY: number): BoardList['grid'] {
  const unitW = rect.width / 16
  const unitH = rect.height / 8
  const centeredX = Math.round((pointerX - rect.left) / unitW - grid.w / 2 + 0.5) + 1
  const centeredY = Math.round((pointerY - rect.top) / unitH - grid.h / 2 + 0.5) + 1
  return {
    ...grid,
    x: clamp(centeredX, 1, 17 - grid.w),
    y: clamp(centeredY, 1, 9 - grid.h)
  }
}

function resizeGrid(
  grid: BoardList['grid'],
  handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
  dx: number,
  dy: number
): BoardList['grid'] {
  let next = { ...grid }
  if (handle.includes('e')) next.w = clamp(grid.w + dx, MIN_LIST_GRID_WIDTH, 17 - grid.x)
  if (handle.includes('s')) next.h = clamp(grid.h + dy, MIN_LIST_GRID_HEIGHT, 9 - grid.y)
  if (handle.includes('w')) {
    const newX = clamp(grid.x + dx, 1, grid.x + grid.w - MIN_LIST_GRID_WIDTH)
    next = { ...next, x: newX, w: grid.w + (grid.x - newX) }
  }
  if (handle.includes('n')) {
    const newY = clamp(grid.y + dy, 1, grid.y + grid.h - MIN_LIST_GRID_HEIGHT)
    next = { ...next, y: newY, h: grid.h + (grid.y - newY) }
  }
  return next
}

function moveWidgetGrid(grid: BoardWidget['grid'], dx: number, dy: number): BoardWidget['grid'] {
  return {
    ...grid,
    x: clamp(grid.x + dx, 1, 17 - grid.w),
    y: clamp(grid.y + dy, 1, 9 - grid.h)
  }
}

function pointerMoveWidgetGrid(grid: BoardWidget['grid'], rect: DOMRect, pointerX: number, pointerY: number): BoardWidget['grid'] {
  const unitW = rect.width / 16
  const unitH = rect.height / 8
  const centeredX = Math.round((pointerX - rect.left) / unitW - grid.w / 2 + 0.5) + 1
  const centeredY = Math.round((pointerY - rect.top) / unitH - grid.h / 2 + 0.5) + 1
  return {
    ...grid,
    x: clamp(centeredX, 1, 17 - grid.w),
    y: clamp(centeredY, 1, 9 - grid.h)
  }
}

function pointerMoveWidgetGridWithOffset(
  grid: BoardWidget['grid'],
  rect: DOMRect,
  pointerX: number,
  pointerY: number,
  offsetX: number,
  offsetY: number
): BoardWidget['grid'] {
  const unitW = rect.width / 16
  const unitH = rect.height / 8
  const left = pointerX - rect.left - offsetX
  const top = pointerY - rect.top - offsetY
  const x = Math.round(left / unitW) + 1
  const y = Math.round(top / unitH) + 1
  return {
    ...grid,
    x: clamp(x, 1, 17 - grid.w),
    y: clamp(y, 1, 9 - grid.h)
  }
}

function resizeWidgetGrid(
  grid: BoardWidget['grid'],
  type: WidgetType,
  config: BoardWidgetConfig,
  handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
  dx: number,
  dy: number
): BoardWidget['grid'] {
  let raw = { ...grid }
  if (handle.includes('e')) raw.w = clamp(grid.w + dx, 1, 17 - grid.x)
  if (handle.includes('s')) raw.h = clamp(grid.h + dy, 1, 9 - grid.y)
  if (handle.includes('w')) {
    const newX = clamp(grid.x + dx, 1, grid.x + grid.w - 1)
    raw = { ...raw, x: newX, w: grid.w + (grid.x - newX) }
  }
  if (handle.includes('n')) {
    const newY = clamp(grid.y + dy, 1, grid.y + grid.h - 1)
    raw = { ...raw, y: newY, h: grid.h + (grid.y - newY) }
  }

  const spec = widgetAspectSpec(type, config)
  const scaleBounds = widgetScaleBounds(spec)
  const widthDrivenScale = raw.w / spec.ratioW
  const heightDrivenScale = raw.h / spec.ratioH
  const desiredScale =
    handle === 'e' || handle === 'w'
      ? widthDrivenScale
      : handle === 'n' || handle === 's'
        ? heightDrivenScale
        : Math.max(widthDrivenScale, heightDrivenScale)

  const maxWidth = handle.includes('w') ? grid.x + grid.w - 1 : 17 - grid.x
  const maxHeight = handle.includes('n') ? grid.y + grid.h - 1 : 9 - grid.y
  const maxScale = Math.max(
    scaleBounds.min,
    Math.min(scaleBounds.max, Math.floor(maxWidth / spec.ratioW), Math.floor(maxHeight / spec.ratioH))
  )
  const scale = clamp(Math.round(desiredScale), scaleBounds.min, maxScale)
  const sized = widgetGridForScale(spec, scale)
  const x = handle.includes('w') ? grid.x + grid.w - sized.w : grid.x
  const y = handle.includes('n') ? grid.y + grid.h - sized.h : grid.y

  return {
    x: clamp(x, 1, 17 - sized.w),
    y: clamp(y, 1, 9 - sized.h),
    ...sized
  }
}

function normalizeWidgetDisplayGrid(grid: BoardWidget['grid'], type: WidgetType, config: BoardWidgetConfig): BoardWidget['grid'] {
  const spec = widgetAspectSpec(type, config)
  const scaleBounds = widgetScaleBounds(spec)
  const desiredScale = Math.max(grid.w / spec.ratioW, grid.h / spec.ratioH)
  const scale = clamp(Math.round(desiredScale), scaleBounds.min, scaleBounds.max)
  const { w, h } = widgetGridForScale(spec, scale)
  return {
    x: clamp(grid.x, 1, 17 - w),
    y: clamp(grid.y, 1, 9 - h),
    w,
    h
  }
}

function canPlaceWidgetGrid(
  grid: BoardWidget['grid'],
  lists: BoardList[],
  widgets: BoardWidget[],
  currentWidgetId: string,
  type: WidgetType,
  config: BoardWidgetConfig
): boolean {
  const normalized = normalizeWidgetDisplayGrid(grid, type, config)
  return (
    !lists.some((list) => list.displayEnabled && gridsOverlap(normalized, list.grid)) &&
    !widgets.some((widget) => widget.displayEnabled && widget.id !== currentWidgetId && gridsOverlap(normalized, widget.grid))
  )
}

function visibleColumns(list: BoardList): ListColumn[] {
  return list.columns.filter(
    (column) =>
      column.name !== 'Item ID' &&
      !column.name.toLowerCase().includes('dependency') &&
      (column.role !== 'deadline' || list.dueDateEnabled)
  )
}

function isComputedTemplateColumn(list: BoardList, column: ListColumn): boolean {
  return list.templateType === 'shopping_list' && normalizeColumnName(column.name) === 'cost'
}

function editableItemColumns(list: BoardList): ListColumn[] {
  return visibleColumns(list).filter((column) => !isComputedTemplateColumn(list, column))
}

function boardVisibleColumns(list: BoardList): ListColumn[] {
  if (list.templateType === 'birthday_calendar') {
    return birthdayCoreColumns(list).filter((column) => !isBirthdayBirthYearColumn(column))
  }
  return visibleColumns(list).filter((column) => column.showOnBoard)
}

function blankValues(columns: ListColumn[]): FormValues {
  return columns.reduce<FormValues>((acc, column) => {
    acc[column.id] = column.type === 'boolean' ? false : column.type === 'choice' && column.choiceConfig?.selection === 'multi' ? [] : ''
    return acc
  }, {})
}

function valuesForItem(item: BoardItem, columns: ListColumn[]): FormValues {
  return columns.reduce<FormValues>((acc, column) => {
    acc[column.id] =
      item.values[column.id] ?? (column.type === 'boolean' ? false : column.type === 'choice' && column.choiceConfig?.selection === 'multi' ? [] : '')
    return acc
  }, {})
}

function itemTitle(item: BoardItem, list: BoardList): string {
  const nameColumn = visibleColumns(list)[0]
  return String(item.values[nameColumn?.id] ?? item.displayCode)
}

function normalizeColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

const summaryCountTextColumns = new Set(['item name', 'task', 'task name', 'product', 'entry', 'title', 'name'].map((name) => normalizeColumnName(name)))
const summaryDateColumns = new Set(['deadline', 'needed by', 'appointment date', 'birthday', 'start'].map((name) => normalizeColumnName(name)))
const nonSummaryNumericColumns = new Set(['year of birth', 'birth year', '% done'].map((name) => normalizeColumnName(name)))

function supportsListSummaryForColumn(column: Pick<ListColumn, 'name' | 'type' | 'role'>): boolean {
  const normalizedName = normalizeColumnName(column.name)
  if (column.role === 'deadline') return true
  if (column.type === 'text') return summaryCountTextColumns.has(normalizedName)
  if (column.type === 'currency') return normalizedName !== 'price / pc'
  if (column.type === 'integer' || column.type === 'decimal' || column.type === 'duration') return !nonSummaryNumericColumns.has(normalizedName)
  if (column.type === 'date') return summaryDateColumns.has(normalizedName)
  return false
}

function supportsBoardSummaryForColumn(column: Pick<ListColumn, 'name' | 'type' | 'role'>): boolean {
  return supportsListSummaryForColumn(column)
}

function inferredBoardSummaryAggregation(column: Pick<ListColumn, 'type' | 'role'>): AggregationMethod {
  if (column.role === 'deadline' || column.type === 'date') return 'next_due'
  if (column.type === 'currency' || column.type === 'integer' || column.type === 'decimal' || column.type === 'duration') return 'sum'
  return 'count'
}

function nextDueLabel(list: BoardList): ReactElement {
  if (!list.dueDateColumnId) return <em>Next due date: <strong>-</strong></em>
  const deadlines = list.items
    .map((item) => dateStringFromField(item.values[list.dueDateColumnId ?? '']))
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value.includes('T') ? value : `${value}T00:00:00`))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => first.getTime() - second.getTime())

  if (deadlines.length === 0) return <em>Next due date: <strong>-</strong></em>
  const now = Date.now()
  const upcoming = deadlines.find((date) => date.getTime() >= now) ?? deadlines[0]
  const diff = upcoming.getTime() - now
  const prefix = diff < 0 ? 'overdue by' : 'in'
  const tone = deadlineToneFromDiff(diff)
  const deadlineColumn = list.columns.find((column) => column.id === list.dueDateColumnId)
  const overdueCount = list.items.filter((item) => item.isOverdue).length
  return (
    <em>
      Next due date:{' '}
      <strong className={`deadline-text ${deadlineClass(tone)}`}>{prefix} {compactDuration(Math.abs(diff))}</strong>
      {deadlineColumn?.listSummaryEligible && overdueCount > 0 ? <strong className="deadline-text deadline-overdue"> • {overdueCount} overdue</strong> : null}
    </em>
  )
}

function deadlineDisplayLabel(list: BoardList): string {
  const column = list.columns.find((candidate) => candidate.id === list.dueDateColumnId)
  return column?.name?.trim() || (list.templateType === 'shopping_list' ? 'Needed By' : 'Deadline')
}

function compactDuration(milliseconds: number): string {
  const hours = Math.max(1, Math.ceil(milliseconds / (60 * 60 * 1000)))
  if (hours < 24) return `${hours} h`
  const days = Math.ceil(hours / 24)
  return `${days} d`
}

function deadlineToneFromDiff(milliseconds: number): BoardItem['deadlineTone'] {
  if (milliseconds < 0) return 'overdue'
  if (milliseconds <= 12 * 60 * 60 * 1000) return 'critical'
  if (milliseconds <= 24 * 60 * 60 * 1000) return 'urgent'
  if (milliseconds <= 2 * 24 * 60 * 60 * 1000) return 'soon'
  if (milliseconds <= 5 * 24 * 60 * 60 * 1000) return 'ok'
  return 'none'
}

function deadlineClass(tone: BoardItem['deadlineTone']): string {
  if (tone === 'overdue') return 'deadline-overdue'
  if (tone === 'critical') return 'deadline-critical'
  if (tone === 'urgent') return 'deadline-urgent'
  if (tone === 'soon') return 'deadline-soon'
  if (tone === 'ok') return 'deadline-ok'
  return 'deadline-none'
}

function dateStringFromField(value: FieldValue | undefined): string | null {
  if (isDateFieldValue(value)) return value.value || null
  return typeof value === 'string' && value.length > 0 ? value : null
}

function groupName(groupId: string | null, list: BoardList): string {
  if (!groupId) return '-'
  return list.groups.find((group) => group.id === groupId)?.name ?? '-'
}

function groupOptions(list: BoardList): Array<{ id: string; label: string }> {
  const options: Array<{ id: string; label: string }> = []
  const appendGroups = (parentGroupId: string | null, depth: number): void => {
    list.groups
      .filter((group) => group.parentGroupId === parentGroupId)
      .forEach((group) => {
        options.push({ id: group.id, label: `${'  '.repeat(depth)}${group.name}` })
        appendGroups(group.id, depth + 1)
      })
  }
  appendGroups(null, 0)
  return options
}

function boardDisplayRows(list: BoardList): Array<{ kind: 'group'; group: ItemGroup } | { kind: 'item'; item: BoardItem }> {
  if (list.templateType === 'birthday_calendar') {
    return birthdayFilteredItems(list).map((item) => ({ kind: 'item', item }))
  }
  const rows: Array<{ kind: 'group'; group: ItemGroup } | { kind: 'item'; item: BoardItem }> = []
  list.items
    .filter((item) => !item.groupId)
    .forEach((item) => rows.push({ kind: 'item', item }))

  const appendGroupRows = (parentGroupId: string | null): void => {
    list.groups
      .filter((group) => group.parentGroupId === parentGroupId)
      .forEach((group) => {
        const groupItems = list.items.filter((item) => item.groupId === group.id)
        const hasChildren = list.groups.some((candidate) => candidate.parentGroupId === group.id)
        if (groupItems.length === 0 && !hasChildren) return
        rows.push({ kind: 'group', group })
        groupItems.forEach((item) => rows.push({ kind: 'item', item }))
        appendGroupRows(group.id)
      })
  }
  appendGroupRows(null)
  return rows
}

function formatGroupCell(group: ItemGroup, column: ListColumn, list: BoardList, includeName: boolean): string | ReactElement {
  const summary = groupSummaryValue(group, column, list)
  if (!includeName) return summary
  return (
    <span className="group-name-cell">
      <strong>{group.name}</strong>
      {summary && <em>{summary}</em>}
    </span>
  )
}

function groupSummaryValue(group: ItemGroup, column: ListColumn, list: BoardList): string {
  const config = group.summaries.find((summary) => summary.columnId === column.id)
  if (!config) return ''
  const items = list.items.filter((item) => item.groupId === group.id)
  if (config.method === 'count') return String(items.length)

  const values = items
    .map((item) => item.values[column.id])
    .filter(
      (value): value is Exclude<FieldValue, null> =>
        value !== null && value !== undefined && value !== '' && !Array.isArray(value) && !isDateFieldValue(value)
    )

  if (values.length === 0) return '-'

  if (config.method === 'max') {
    if (column.type === 'integer' || column.type === 'decimal' || column.type === 'currency') {
      return formatValue(Math.max(...values.map(Number)), column)
    }
    const max = [...values].sort((first, second) => String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: 'base' })).at(-1)
    return max === undefined ? '-' : formatValue(max, column)
  }

  const numericValues = values.map(Number).filter(Number.isFinite)
  if (numericValues.length === 0) return '-'
  const total = numericValues.reduce((sum, value) => sum + value, 0)
  return formatValue(config.method === 'avg' ? total / numericValues.length : total, column)
}

function listSummaryValues(list: BoardList): Array<{ columnId: string; label: string; value: string }> {
  return visibleColumns(list)
    .filter((column) => column.listSummaryEligible)
    .slice(0, 3)
    .map((column) => ({
      columnId: column.id,
      label: listSummaryLabel(column),
      value: listSummaryValue(list, column)
    }))
}

function listSummaryLabel(column: ListColumn): string {
  if (column.role === 'deadline' || column.type === 'date') return 'Due'
  if (column.type === 'duration') return column.name
  if (column.type === 'text') return 'Count'
  return column.name
}

function listSummaryValue(list: BoardList, column: ListColumn): string {
  if (column.role === 'deadline' || column.type === 'date') {
    const datedItems = list.items
      .map((item) => {
        const raw = dateFieldValue(item.values[column.id]).value
        const date = raw ? parseColumnDateValue(raw, column) : null
        return date ? { item, date } : null
      })
      .filter((entry): entry is { item: BoardItem; date: Date } => entry !== null)
      .sort((left, right) => left.date.getTime() - right.date.getTime())
    if (datedItems.length === 0) return '-'
    const overdueCount = datedItems.filter((entry) => entry.item.isOverdue).length
    if (overdueCount > 0) return `${overdueCount} overdue`
    return formatSummaryWhen(datedItems[0].date)
  }

  if (column.type === 'text') return String(list.items.length)

  const total = list.items.reduce((sum, item) => {
    const value = item.values[column.id]
    return typeof value === 'number' && Number.isFinite(value) ? sum + value : sum
  }, 0)
  return formatValue(total, column)
}

function sortDirectionOptions(column: ListColumn): { value: Exclude<ListSortDirection, 'manual'>; label: string }[] {
  if (column.role === 'deadline') {
    return [
      { value: 'asc', label: 'Closest deadline first' },
      { value: 'desc', label: 'Farthest deadline first' }
    ]
  }
  if (column.type === 'date') {
    return [
      { value: 'asc', label: 'Oldest to newest' },
      { value: 'desc', label: 'Newest to oldest' }
    ]
  }
  if (column.type === 'currency') {
    return [
      { value: 'desc', label: 'Most expensive first' },
      { value: 'asc', label: 'Cheapest first' }
    ]
  }
  if (column.type === 'integer' || column.type === 'decimal') {
    return [
      { value: 'desc', label: 'Highest first' },
      { value: 'asc', label: 'Lowest first' }
    ]
  }
  if (column.type === 'boolean') {
    return [
      { value: 'desc', label: 'Y / True on top' },
      { value: 'asc', label: 'N / False on top' }
    ]
  }
  if (column.type === 'choice' && column.choiceConfig?.ranked) {
    return [
      { value: 'asc', label: 'Highest rank first' },
      { value: 'desc', label: 'Lowest rank first' }
    ]
  }
  return [
    { value: 'asc', label: 'A to Z' },
    { value: 'desc', label: 'Z to A' }
  ]
}

function defaultSortDirection(column: ListColumn): Exclude<ListSortDirection, 'manual'> {
  if (column.type === 'integer' || column.type === 'decimal' || column.type === 'currency' || column.type === 'boolean') return 'desc'
  return 'asc'
}

function defaultChoiceConfig(name: string): ChoiceConfig {
  const priority = name.toLowerCase().includes('priority')
  const wishmeter = name.toLowerCase().includes('wishmeter')
  const labels = wishmeter
    ? ["It's so fluffy I'm gonna die!", 'My precious!', 'Shut up and take my money!', 'Gotta get me one of those!', 'Asking for a friend...']
    : priority
      ? ['Highest', 'High', 'Medium', 'Low', 'Lowest']
      : ['Option 1', 'Option 2', 'Option 3']
  return {
    selection: 'single',
    ranked: priority || wishmeter,
    options: labels.map((label, index) => ({ id: choiceId(label, index), label, rank: index + 1 }))
  }
}

function choiceConfigToText(config: ChoiceConfig): string {
  return config.options.map((option) => `${option.rank}. ${option.label}`).join('\n')
}

function parseChoiceOptions(text: string, existing?: ChoiceConfig): ChoiceConfig['options'] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^(\d+)\s*[).:|-]\s*(.+)$/)
      const label = match ? match[2].trim() : line
      const previous = existing?.options.find((option) => option.label === label) ?? existing?.options[index]
      return {
        id: previous?.id ?? choiceId(label, index),
        label,
        rank: match ? Number(match[1]) : index + 1
      }
    })
}

function choiceId(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || `choice-${index + 1}`
}

function listInput(list: BoardList): Parameters<typeof window.lpl.updateList>[0] {
  return {
    listId: list.id,
    name: list.name,
    templateType: list.templateType,
    templateConfig: list.templateConfig,
    grid: list.grid,
    dueDateEnabled: list.dueDateEnabled,
    dueDateColumnId: list.dueDateColumnId,
    deadlineMandatory: list.deadlineMandatory,
    columnSortOrder: list.columnSortOrder,
    sortColumnId: list.sortColumnId,
    sortDirection: list.sortDirection,
    displayEnabled: list.displayEnabled,
    showItemIdOnBoard: list.showItemIdOnBoard,
    showDependenciesOnBoard: list.showDependenciesOnBoard,
    showCreatedAtOnBoard: list.showCreatedAtOnBoard,
    showCreatedByOnBoard: list.showCreatedByOnBoard,
    showStatusOnBoard: list.showStatusOnBoard
  }
}

function defaultListBehavior(templateType: ListTemplateType): ListBehavior {
  if (templateType === 'todo') return 'tasks'
  if (templateType === 'shopping_list' || templateType === 'wishlist') return 'purchases'
  if (templateType === 'health' || templateType === 'trips_events' || templateType === 'birthday_calendar') return 'calendar'
  return 'other'
}

function listTemplateConfigForSave(templateType: ListTemplateType, behavior: ListBehavior, birthdayBoardView: BirthdayBoardView) {
  return {
    behavior: templateType === 'custom' ? behavior : defaultListBehavior(templateType),
    ...(templateType === 'birthday_calendar' ? { birthday: { boardView: birthdayBoardView } } : {})
  }
}

type BoardDisplayColumn =
  | { kind: 'real'; key: string; label: string; column: ListColumn }
  | { kind: 'birthday_turning'; key: string; label: string }

function birthdayCoreColumns(list: BoardList): ListColumn[] {
  return visibleColumns(list).filter((column) => {
    const normalized = normalizeColumnName(column.name)
    return normalized === 'name' || normalized === 'person name' || normalized === 'birthday' || normalized === 'year of birth' || normalized === 'birth year'
  })
}

function isBirthdayDateColumn(column: ListColumn): boolean {
  return normalizeColumnName(column.name) === 'birthday'
}

function isBirthdayBirthYearColumn(column: ListColumn): boolean {
  const normalized = normalizeColumnName(column.name)
  return normalized === 'birth year' || normalized === 'year of birth'
}

function birthdayBoardColumns(list: BoardList, columns: ListColumn[]): BoardDisplayColumn[] {
  if (list.templateType !== 'birthday_calendar') return columns.map((column) => ({ kind: 'real', key: column.id, label: column.name, column }))
  const core = birthdayCoreColumns(list)
  return [
    ...core
      .filter((column) => {
        const normalized = normalizeColumnName(column.name)
        return normalized !== 'birth year' && normalized !== 'year of birth'
      })
      .map((column) => ({ kind: 'real' as const, key: column.id, label: column.name, column })),
    { kind: 'birthday_turning', key: 'birthday-turning', label: 'Turning' }
  ]
}

function birthdayFilteredItems(list: BoardList, now = new Date()): BoardItem[] {
  const birthdayColumn = birthdayCoreColumns(list).find((column) => isBirthdayDateColumn(column))
  if (!birthdayColumn) return list.items
  const mode = list.templateConfig.birthday?.boardView ?? 'this_month'
  const end = birthdayRangeEnd(now, mode)
  return [...list.items]
    .map((item) => ({ item, occurrence: birthdayOccurrenceDate(item.values[birthdayColumn.id], now) }))
    .filter((entry) => (mode === 'all' ? true : entry.occurrence !== null && entry.occurrence.getTime() <= end.getTime()))
    .sort((first, second) => {
      if (!first.occurrence) return 1
      if (!second.occurrence) return -1
      return first.occurrence.getTime() - second.occurrence.getTime()
    })
    .map((entry) => entry.item)
}

function birthdayRangeEnd(now: Date, mode: BirthdayBoardView): Date {
  const start = new Date(now)
  if (mode === 'this_week') {
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    end.setDate(start.getDate() + (6 - start.getDay()))
    return end
  }
  if (mode === 'this_month') return new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
  if (mode === 'next_10_days') return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 10, 23, 59, 59, 999)
  if (mode === 'next_30_days') return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 30, 23, 59, 59, 999)
  if (mode === 'next_2_months') return new Date(start.getFullYear(), start.getMonth() + 2, start.getDate(), 23, 59, 59, 999)
  return new Date(8640000000000000)
}

function birthdayOccurrenceDate(value: FieldValue | undefined, now = new Date()): Date | null {
  const birthday = dateStringFromField(value)
  if (!birthday) return null
  const source = new Date(birthday.includes('T') ? birthday : `${birthday}T00:00:00`)
  if (Number.isNaN(source.getTime())) return null
  const occurrence = new Date(now.getFullYear(), source.getMonth(), source.getDate(), 9, 0, 0, 0)
  if (occurrence.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    occurrence.setFullYear(occurrence.getFullYear() + 1)
  }
  return occurrence
}

function birthdayTurningLabel(item: BoardItem, list: BoardList): string {
  const birthYearColumn = birthdayCoreColumns(list).find((column) => isBirthdayBirthYearColumn(column))
  const birthdayColumn = birthdayCoreColumns(list).find((column) => isBirthdayDateColumn(column))
  const year = birthYearColumn ? Number(item.values[birthYearColumn.id]) : NaN
  const occurrence = birthdayColumn ? birthdayOccurrenceDate(item.values[birthdayColumn.id]) : null
  if (!Number.isFinite(year) || !occurrence) return '-'
  return `Turning ${occurrence.getFullYear() - year}`
}

function formatBirthdayAwareCellValue(item: BoardItem, column: ListColumn, list: BoardList): string | ReactElement {
  if (list.templateType === 'birthday_calendar' && isBirthdayDateColumn(column)) {
    const occurrence = birthdayOccurrenceDate(item.values[column.id])
    return occurrence ? formatBirthdayMonthDay(occurrence) : '-'
  }
  return formatCellValue(item.values[column.id], column)
}

function formatBirthdayMonthDay(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function dayBeforeBirthday(date: Date): Date {
  const next = new Date(date)
  next.setDate(next.getDate() - 1)
  next.setHours(18, 0, 0, 0)
  return next
}

function localDateTimeInputValue(date: Date): string {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

type SummaryEntry = {
  id: string
  title: string
  subtitle: string
  source: string
  when: Date
  whenLabel: string
}

function collectDaySummaryEntries(snapshot: BoardSnapshot, mode: 'today' | 'next24h'): SummaryEntry[] {
  const start = new Date()
  const end = mode === 'today' ? endOfToday(start) : new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const entries: SummaryEntry[] = []

  for (const list of snapshot.lists) {
    if (list.templateType === 'birthday_calendar') {
      const birthdayColumn = birthdayCoreColumns(list).find((column) => isBirthdayDateColumn(column))
      for (const item of list.items) {
        const occurrence = birthdayColumn ? birthdayOccurrenceDate(item.values[birthdayColumn.id], start) : null
        if (!occurrence || occurrence < start || occurrence > end) continue
        entries.push({
          id: `birthday-${item.id}`,
          title: `${itemTitle(item, list)} birthday`,
          subtitle: birthdayTurningLabel(item, list),
          source: list.name,
          when: occurrence,
          whenLabel: formatSummaryWhen(occurrence)
        })
      }
      continue
    }

    for (const item of list.items) {
      for (const column of visibleColumns(list).filter((column) => column.type === 'date' || column.role === 'deadline')) {
        const occurrences = dateOccurrencesInWindow(item.values[column.id], column, start, end)
        for (const occurrence of occurrences) {
          entries.push({
            id: `${item.id}-${column.id}-${occurrence.toISOString()}`,
            title: itemTitle(item, list),
            subtitle: column.role === 'deadline' ? item.deadlineStatus : column.name,
            source: list.name,
            when: occurrence,
            whenLabel: formatSummaryWhen(occurrence)
          })
        }
      }
    }
  }

  return entries.sort((first, second) => first.when.getTime() - second.when.getTime())
}

function dateOccurrencesInWindow(value: FieldValue | undefined, column: ListColumn, start: Date, end: Date): Date[] {
  const dateValue = dateFieldValue(value)
  if (!dateValue.value) return []
  if (column.dateDisplayFormat === 'time') {
    return recurringTimeOccurrences(dateValue, start, end)
  }
  const single = parseColumnDateValue(dateValue.value, column)
  return single && single >= start && single <= end ? [single] : []
}

function parseColumnDateValue(value: string, column: ListColumn): Date | null {
  if (column.role === 'deadline' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`)
  }
  const candidate = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(candidate.getTime()) ? null : candidate
}

function recurringTimeOccurrences(value: DateFieldValue, start: Date, end: Date): Date[] {
  const [hour, minute] = (value.value || '00:00').split(':').map((part) => Number(part))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return []
  if (value.recurrence === 'none') {
    const single = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour, minute, 0, 0)
    return single >= start && single <= end ? [single] : []
  }
  const occurrences: Date[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour, minute, 0, 0)
  while (cursor <= end) {
    if (recurrenceMatchesDay(cursor, value.recurrence, value.recurrenceDays, value.recurrenceInterval)) {
      if (cursor >= start && cursor <= end) occurrences.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return occurrences
}

function recurrenceMatchesDay(date: Date, recurrence: RecurrenceMode, days: number[], interval = 1): boolean {
  if (recurrence === 'daily') return true
  if (recurrence === 'weekly' || recurrence === 'custom_weekdays') return days.length === 0 ? true : days.includes(date.getDay())
  if (recurrence === 'interval_weeks') {
    const weekMatches = days.length === 0 ? true : days.includes(date.getDay())
    const weekIndex = Math.floor(startOfToday(date).getTime() / (7 * 24 * 60 * 60 * 1000))
    return weekMatches && weekIndex % normalizeRecurrenceInterval(interval) === 0
  }
  if (recurrence === 'monthly') return date.getDate() === 1
  if (recurrence === 'interval_months') {
    const monthIndex = date.getFullYear() * 12 + date.getMonth()
    return date.getDate() === 1 && monthIndex % normalizeRecurrenceInterval(interval) === 0
  }
  return false
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function endOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
}

function formatSummaryWhen(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function widgetInput(widget: BoardWidget): Parameters<typeof window.lpl.updateWidget>[0] {
  return {
    widgetId: widget.id,
    type: widget.type,
    name: widget.name,
    displayEnabled: widget.displayEnabled,
    grid: widget.grid,
    config: widget.config
  }
}

function defaultWorldClockConfig(): NonNullable<BoardWidgetConfig['worldClocks']> {
  return {
    locations: [
      { id: 'bucharest', label: 'Bucharest', timeZone: 'Europe/Bucharest' },
      { id: 'london', label: 'London', timeZone: 'Europe/London' },
      { id: 'new-york', label: 'New York', timeZone: 'America/New_York' },
      { id: 'tokyo', label: 'Tokyo', timeZone: 'Asia/Tokyo' }
    ],
    showSeconds: false,
    style: 'digital'
  }
}

function defaultConfigForWidgetType(type: WidgetType): BoardWidgetConfig {
  if (type === 'weather') return { weather: { temperatureUnit: 'celsius' } }
  if (type === 'word_of_day') return { wordOfDay: { accent: 'calm' } }
  if (type === 'world_clocks') return { worldClocks: defaultWorldClockConfig() }
  if (type === 'countdown') return { countdown: { label: 'Next milestone', targetAt: '' } }
  return { clock: { showSeconds: true } }
}

function formatWidgetDate(date: Date): string {
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' })
  const month = date.toLocaleDateString(undefined, { month: 'long' })
  const year = date.getFullYear()
  return `${weekday}, ${month} ${ordinalDay(date.getDate())}, ${year}`
}

function formatWidgetDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function ordinalDay(day: number): string {
  const mod100 = day % 100
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`
  const mod10 = day % 10
  if (mod10 === 1) return `${day}st`
  if (mod10 === 2) return `${day}nd`
  if (mod10 === 3) return `${day}rd`
  return `${day}th`
}

function zonedTimeParts(date: Date, timeZone: string): { hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone
  })
  const parts = formatter.formatToParts(date)
  return {
    hour: Number(parts.find((part) => part.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find((part) => part.type === 'minute')?.value ?? '0'),
    second: Number(parts.find((part) => part.type === 'second')?.value ?? '0')
  }
}

function timeZoneOffsetLabel(timeZone: string, date: Date): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset'
  }).formatToParts(date)
  return formatted.find((part) => part.type === 'timeZoneName')?.value ?? timeZone
}

function inputType(column: ListColumn): string {
  if (column.role === 'deadline') return column.dateDisplayFormat === 'datetime' ? 'datetime-local' : 'date'
  if (column.type === 'date') {
    if (column.dateDisplayFormat === 'datetime') return 'datetime-local'
    if (column.dateDisplayFormat === 'time') return 'time'
    return 'date'
  }
  if (column.type === 'hyperlink') return 'url'
  if (column.type === 'duration') return 'text'
  if (column.type === 'integer' || column.type === 'decimal' || column.type === 'currency') return 'number'
  return 'text'
}

function inputValue(value: FieldValue | undefined, column: ListColumn): string {
  if (value === null || value === undefined || Array.isArray(value)) return ''
  if (isDateFieldValue(value)) return inputValue(value.value, column)
  if (column.type === 'duration' && typeof value === 'number') return durationInputValue(value)
  if (column.role === 'deadline' && typeof value === 'string') {
    if (column.dateDisplayFormat === 'datetime' && value.length === 10) return `${value}T00:00`
    if (column.dateDisplayFormat === 'date' && value.includes('T')) return value.slice(0, 10)
  }
  if (column.type === 'date' && typeof value === 'string') {
    if (column.dateDisplayFormat === 'datetime' && value.length === 10) return `${value}T00:00`
    if (column.dateDisplayFormat === 'date' && value.includes('T')) return value.slice(0, 10)
    if (column.dateDisplayFormat === 'time') return value.includes('T') ? value.slice(11, 16) : value.slice(0, 5)
  }
  return String(value)
}

function choiceInputValue(value: FieldValue | undefined, column: ListColumn): string | string[] {
  if (column.choiceConfig?.selection === 'multi') return Array.isArray(value) ? value : value ? [String(value)] : []
  return Array.isArray(value) ? (value[0] ?? '') : value ? String(value) : ''
}

function coerceInputValue(column: ListColumn, value: FieldValue): FieldValue {
  if (isDateFieldValue(value)) return value.value ? value : null
  if (column.type === 'boolean') return Boolean(value)
  if (column.type === 'choice') return value === '' ? null : value
  if (value === '') return null
  if (column.type === 'integer') return Number.parseInt(String(value), 10)
  if (column.type === 'decimal' || column.type === 'currency') return Number.parseFloat(String(value))
  if (column.type === 'duration') return parseDurationInput(String(value))
  return String(value)
}

function parseDurationInput(value: string): number | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  const hourMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*h$/)
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60)
  const parts = trimmed.split(':').map((part) => part.trim())
  if (parts.length === 2) {
    const hours = Number(parts[0])
    const minutes = Number(parts[1])
    if (Number.isFinite(hours) && Number.isFinite(minutes) && minutes >= 0 && minutes < 60) return Math.round(hours * 60 + minutes)
  }
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 60)
  return Number.NaN
}

function durationInputValue(minutes: number): string {
  if (!Number.isFinite(minutes)) return ''
  const totalMinutes = Math.max(0, Math.round(minutes))
  const hours = Math.floor(totalMinutes / 60)
  const remainderMinutes = totalMinutes % 60
  return `${hours}:${String(remainderMinutes).padStart(2, '0')}`
}

function formatDurationMinutes(minutes: number, displayFormat: DurationDisplayFormat = 'days_hours'): string {
  if (!Number.isFinite(minutes)) return '-'
  const totalMinutes = Math.max(0, Math.round(minutes))
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (displayFormat === 'hours') return `${hours}:${String(mins).padStart(2, '0')}`
  const days = Math.floor(hours / 24)
  const remainderHours = hours % 24
  return days > 0
    ? `${days}:${String(remainderHours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
    : `${remainderHours}:${String(mins).padStart(2, '0')}`
}

function formatValue(value: FieldValue | undefined, column: ListColumn): string {
  if (isDateFieldValue(value)) {
    if (!value.value) return '-'
    if (column.type === 'date' && column.dateDisplayFormat === 'time') {
      return recurrenceLabel(value.recurrence, value.recurrenceDays, formatTimeValue(value.value), value.recurrenceInterval)
    }
    return formatValue(value.value, column)
  }
  if (Array.isArray(value)) {
    return value.map((entry) => choiceLabel(entry, column)).join(', ')
  }
  if (value === null || value === undefined || value === '') return '-'
  if (column.type === 'choice') return choiceLabel(String(value), column)
  if (column.type === 'boolean') return value ? 'Yes' : 'No'
  if (column.type === 'currency' && typeof value === 'number') {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: column.currencyCode }).format(value)
  }
  if (column.type === 'duration' && typeof value === 'number') return formatDurationMinutes(value, column.durationDisplayFormat)
  if (normalizeColumnName(column.name) === '% done' && typeof value === 'number') return `${value}%`
  if (column.type === 'date' && typeof value === 'string') {
    if (column.dateDisplayFormat === 'datetime') return formatDateTimeValue(value)
    if (column.dateDisplayFormat === 'time') {
      return formatTimeValue(value)
    }
    return formatDateValue(value)
  }
  return String(value)
}

function formatDateValue(value: string): string {
  if (!value.includes('T') && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function formatDateTimeValue(value: string): string {
  if (!value.includes('T') && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDateValue(value)
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatSystemDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatTimeValue(value: string): string {
  const candidate = value.includes('T') ? value : `1970-01-01T${value}`
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(candidate))
}

function isDateFieldValue(value: FieldValue | undefined): value is DateFieldValue {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'value' in value)
}

function dateFieldValue(value: FieldValue | undefined): DateFieldValue {
  if (isDateFieldValue(value)) {
    const recurrence = value.recurrence ?? 'none'
    return {
      value: value.value,
      recurrence,
      recurrenceDays: recurrenceNeedsWeekdays(recurrence) ? normalizeRecurrenceDays(value.recurrenceDays) : [],
      recurrenceInterval: normalizeRecurrenceInterval(value.recurrenceInterval)
    }
  }
  return {
    value: typeof value === 'string' ? value : '',
    recurrence: 'none',
    recurrenceDays: [],
    recurrenceInterval: 1
  }
}

function isItemLevelRecurringTimeColumn(column: ListColumn): boolean {
  return column.type === 'date' && column.role !== 'deadline' && column.dateDisplayFormat === 'time'
}

function recurrenceLabel(recurrence: RecurrenceMode, days: number[], time: string, interval = 1): string {
  if (recurrence === 'daily') return `Daily, ${time}`
  if (recurrence === 'weekly') return `${daysLabel(days, 'Weekly')}, ${time}`
  if (recurrence === 'interval_weeks') return `${daysLabel(days, `Every ${normalizeRecurrenceInterval(interval)} weeks`)}, ${time}`
  if (recurrence === 'monthly') return `Monthly, ${time}`
  if (recurrence === 'interval_months') return `Every ${normalizeRecurrenceInterval(interval)} months, ${time}`
  if (recurrence === 'custom_weekdays') return `${daysLabel(days, 'Selected days')}, ${time}`
  return time
}

function daysLabel(days: number[], fallback: string): string {
  if (days.length === 0) return fallback
  return days.map((day) => weekdayLabels[day]?.long).filter(Boolean).join(', ')
}

function recurrenceNeedsWeekdays(recurrence: RecurrenceMode): boolean {
  return recurrence === 'weekly' || recurrence === 'interval_weeks' || recurrence === 'custom_weekdays'
}

function recurrenceNeedsInterval(recurrence: RecurrenceMode): boolean {
  return recurrence === 'interval_weeks' || recurrence === 'interval_months'
}

function normalizeRecurrenceDays(days: number[] | undefined): number[] {
  return [...new Set((days ?? []).map((day) => Math.trunc(day)).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b)
}

function normalizeRecurrenceInterval(interval: number | undefined): number {
  return Number.isFinite(interval) ? Math.max(1, Math.min(24, Math.trunc(interval ?? 1))) : 1
}

function formatCellValue(value: FieldValue | undefined, column: ListColumn): string | ReactElement {
  if (column.type !== 'hyperlink') return formatValue(value, column)
  const label = formatValue(value, column)
  if (label === '-') return label
  return (
    <button
      className="link-cell-button"
      onClick={(event) => {
        event.stopPropagation()
        window.lpl.openExternalUrl(label)
      }}
      type="button"
    >
      {linkLabel(label)}
    </button>
  )
}

function linkLabel(value: string): string {
  try {
    const url = new URL(value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`)
    return url.hostname.replace(/^www\./, '') || value
  } catch {
    return value
  }
}

function choiceLabel(value: string, column: ListColumn): string {
  return column.choiceConfig?.options.find((option) => option.id === value || option.label === value)?.label ?? value
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

function weatherCodeLabel(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? 'Clear sky' : 'Clear night'
  if (code === 1 || code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code === 45 || code === 48) return 'Fog'
  if (code >= 51 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Showers'
  if (code >= 95) return 'Storms'
  return 'Weather update'
}

const wordBank = [
  { word: 'Steady', meaning: 'Move with calm consistency, even when the day is noisy.' },
  { word: 'Clarity', meaning: 'Let the next right thing matter more than everything at once.' },
  { word: 'Gentle', meaning: 'A softer pace can still carry real momentum.' },
  { word: 'Resolve', meaning: 'Commit quietly, then keep going.' },
  { word: 'Balance', meaning: 'Make room for what restores you, not only what demands you.' },
  { word: 'Focus', meaning: 'Protect attention like a finite resource.' },
  { word: 'Courage', meaning: 'Small brave actions count more than perfect plans.' }
]

function statusLabel(item: BoardItem): string {
  if (item.publicationStatus === 'dirty') return 'Unpublished edits'
  if (item.publicationStatus === 'draft') return 'Draft'
  return item.operationalState === 'completed' ? 'Completed' : 'Published'
}

function deadlineRowClass(item: BoardItem): string | undefined {
  return item.deadlineTone === 'none' ? undefined : deadlineClass(item.deadlineTone)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
