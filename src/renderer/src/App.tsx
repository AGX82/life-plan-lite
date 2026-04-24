import {
  AlarmClock,
  BookOpenText,
  Check,
  ChevronDown,
  ChevronRight,
  CloudSun,
  Clock3,
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
  Send,
  Settings2,
  SunMedium,
  SquarePen,
  Trash2,
  X
} from 'lucide-react'
import { FormEvent, PointerEvent, useEffect, useRef, useState } from 'react'
import type { Dispatch, ReactElement, SetStateAction } from 'react'
import type {
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
  FieldValue,
  GroupSummaryConfig,
  GroupSummaryMethod,
  ItemGroup,
  ListColumn,
  ListTemplateType,
  ListSortDirection,
  RecurrenceMode,
  UpdateWidgetInput,
  WidgetType,
  WorldClockLocation
} from '@shared/domain'

type Route = 'admin' | 'display'

type FormValues = Record<string, FieldValue>

type AppActionResult = BoardSnapshot | DisplayState | AppSettings | void
type RunAction = (action: () => Promise<AppActionResult>) => Promise<AppActionResult>

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

const columnTypes: ColumnType[] = ['text', 'integer', 'decimal', 'currency', 'date', 'boolean', 'choice', 'hyperlink']
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
const MIN_LIST_GRID_WIDTH = 4
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
const listTemplateOptions: Array<{ value: ListTemplateType; label: string }> = [
  { value: 'standard', label: 'Standard List' },
  { value: 'birthday_calendar', label: 'Birthday Calendar' }
]
const birthdayBoardViewOptions: Array<{ value: BirthdayBoardView; label: string }> = [
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'next_10_days', label: 'Next 10 days' },
  { value: 'next_2_months', label: 'Next 2 months' },
  { value: 'all', label: 'All birthdays' }
]
const worldClockTimeZones = [
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
  const [appSettings, setAppSettings] = useState<AppSettings>({ closeConfirmationMode: 'with_comments', theme: 'midnight_clear' })
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null)
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
      window.alert(error instanceof Error ? error.message : 'Something went wrong.')
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
  previewSnapshot,
  runAction,
  onSelectBoard,
  selectedNode,
  setSelectedNode,
  snapshot
}: {
  appSettings: AppSettings
  appThemeClass: string
  boards: BoardSummary[]
  busy: boolean
  displayState: DisplayState | null
  previewSnapshot: BoardSnapshot
  runAction: RunAction
  onSelectBoard: (boardId: string) => void
  selectedNode: SelectedNode
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [newWidgetType, setNewWidgetType] = useState<WidgetType>('clock')
  const [newListTemplateType, setNewListTemplateType] = useState<ListTemplateType>('standard')
  const allItems = snapshot.lists.flatMap((list) => list.items)
  const hasBoardChanges = allItems.some((item) => item.publicationStatus !== 'published')

  function closeMenu(): void {
    setContextMenu(null)
  }

  return (
    <main className={`admin-shell ${appThemeClass}`} onClick={closeMenu}>
      <aside className="side-rail">
        <h1 aria-label="Life Plan Lite" className="side-app-title">
          <span className="cap-word">
            <span className="cap-initial">L</span>
            <span className="cap-rest">IFE</span>
          </span>
          <span className="cap-word">
            <span className="cap-initial">P</span>
            <span className="cap-rest">LAN</span>
          </span>
          <span className="cap-word">
            <span className="cap-initial">L</span>
            <span className="cap-rest">ITE</span>
          </span>
        </h1>
        <div className="board-list">
          {boards.map((board) => (
            <button
              className={board.active ? 'nav-button active' : 'nav-button'}
              disabled={busy}
              key={board.id}
              onClick={() => {
                onSelectBoard(board.id)
              }}
            >
              {board.name}
            </button>
          ))}
          <button
            className="icon-button wide"
            onClick={async () => {
              const result = await runAction(() => window.lpl.createBoard({ name: 'New Board' }))
              if (result && 'lists' in result) setSelectedNode({ kind: 'board', id: result.id })
            }}
          >
            <Plus size={16} />
            Add Board
          </button>
        </div>
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
          <div className="toolbar-actions">
            <button className="primary-button" disabled={busy || !hasBoardChanges} onClick={() => runAction(() => window.lpl.publishBoard(snapshot.id))}>
              <Send size={18} />
              Publish Item Drafts
            </button>
          </div>
        </header>

        <div className="admin-content redesigned">
          <NavigationTree
            boards={boards}
            newListTemplateType={newListTemplateType}
            newWidgetType={newWidgetType}
            onContextMenu={setContextMenu}
            runAction={runAction}
            selectedNode={selectedNode}
            setNewListTemplateType={setNewListTemplateType}
            setNewWidgetType={setNewWidgetType}
            setSelectedNode={setSelectedNode}
            snapshot={snapshot}
          />

          <section className="admin-workspace">
            <div className="workspace-edit">
              <header className="workspace-heading">
                <span className="workspace-heading-label">Currently Editing:</span>
                <h3>{editorWorkspaceTitle(selectedNode, snapshot)}</h3>
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
                listTemplateType={newListTemplateType}
                widgetType={newWidgetType}
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
          runAction={runAction}
          setSelectedNode={setSelectedNode}
          snapshot={snapshot}
          onClose={closeMenu}
        />
      )}
    </main>
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
  newListTemplateType,
  newWidgetType,
  onContextMenu,
  runAction,
  selectedNode,
  setNewListTemplateType,
  setNewWidgetType,
  setSelectedNode,
  snapshot
}: {
  boards: BoardSummary[]
  newListTemplateType: ListTemplateType
  newWidgetType: WidgetType
  onContextMenu: (menu: ContextMenuState) => void
  runAction: RunAction
  selectedNode: SelectedNode
  setNewListTemplateType: Dispatch<SetStateAction<ListTemplateType>>
  setNewWidgetType: Dispatch<SetStateAction<WidgetType>>
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
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
          <h3>Loaded Board: {snapshot.name}</h3>
        </div>
        <div className="tree-header-actions">
          <select className="mini-select" onChange={(event) => setNewListTemplateType(event.target.value as ListTemplateType)} value={newListTemplateType}>
            {listTemplateOptions.map((template) => (
              <option key={template.value} value={template.value}>
                {template.label}
              </option>
            ))}
          </select>
          <button
            className="mini-button"
            onClick={async () => {
              const result = await runAction(() =>
                window.lpl.createList({
                  boardId: snapshot.id,
                  name: newListTemplateType === 'birthday_calendar' ? 'Birthday Calendar' : 'New List',
                  templateType: newListTemplateType
                })
              )
              if (result && 'lists' in result) setSelectedNode({ kind: 'list', id: newestList(result)?.id ?? result.id })
            }}
            type="button"
          >
            <Plus size={13} />
            List
          </button>
          <select className="mini-select" onChange={(event) => setNewWidgetType(event.target.value as WidgetType)} value={newWidgetType}>
            {widgetTypes.map((widgetType) => (
              <option key={widgetType.value} value={widgetType.value}>
                {widgetType.label}
              </option>
            ))}
          </select>
          <button
            className="mini-button"
            onClick={async () => {
              const result = await runAction(() =>
                window.lpl.createWidget({
                  boardId: snapshot.id,
                  type: newWidgetType,
                  name: widgetTypes.find((entry) => entry.value === newWidgetType)?.label ?? 'Widget'
                })
              )
              if (result && 'lists' in result) {
                const created = newestWidget(result)
                if (created) setSelectedNode({ kind: 'widget', id: created.id })
              }
            }}
            type="button"
          >
            <Plus size={13} />
            Widget
          </button>
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
                if (
                  window.confirm(
                    `You are about to make ${snapshot.name} the active board, replacing ${activeBoard?.name ?? 'the current active board'}; Proceed?`
                  )
                ) {
                  runAction(() => window.lpl.setActiveBoard(snapshot.id))
                }
              }}
              type="button"
            >
              Make this board the active board
            </button>
          </div>
        )}
        <p className="list-section-label">Lists in this board:</p>
      </div>

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
                <span>{list.name}: {list.items.length} open items</span>
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

        <p className="list-section-label widget-section-label">Widgets in this board:</p>
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
    </nav>
  )
}

function TreeContextMenu({
  menu,
  onClose,
  runAction,
  setSelectedNode,
  snapshot
}: {
  menu: NonNullable<ContextMenuState>
  onClose: () => void
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

  async function addChild(): Promise<void> {
    if (menu.node.kind === 'board') {
      const result = await runAction(() => window.lpl.createList({ boardId: snapshot.id, name: 'New List' }))
      if (result && 'lists' in result) setSelectedNode({ kind: 'list', id: newestList(result)?.id ?? result.id })
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
          values: blankValues(visibleColumns(groupList)),
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
      const name = window.prompt('Board name', snapshot.name)
      if (name)
        await runAction(() =>
          window.lpl.updateBoard({ boardId: snapshot.id, name, description: snapshot.description, owner: snapshot.owner })
        )
    }
    if (menu.node.kind === 'list' && nodeList) {
      const name = window.prompt('List name', nodeList.name)
      if (name) await runAction(() => window.lpl.updateList({ ...listInput(nodeList), name }))
    }
    if (nodeGroup) {
      const name = window.prompt('Group name', nodeGroup.name)
      if (name)
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
    if (nodeItem && itemList) {
      const nameColumn = visibleColumns(itemList)[0]
      const name = window.prompt('Item name', String(nodeItem.values[nameColumn.id] ?? ''))
      if (name) {
        await runAction(() =>
          window.lpl.updateItem({
            itemId: nodeItem.id,
            groupId: nodeItem.groupId,
            values: { ...nodeItem.values, [nameColumn.id]: name },
            dependencyItemIds: nodeItem.dependencyItemIds
          })
        )
      }
    }
    if (nodeWidget) {
      const name = window.prompt('Widget name', nodeWidget.name)
      if (name) {
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
    }
  }

  async function deleteNode(): Promise<void> {
    if (menu.node.kind === 'list' && nodeList && window.confirm(`Delete "${nodeList.name}" and all child items?`)) {
      await runAction(() => window.lpl.deleteList(nodeList.id))
      setSelectedNode({ kind: 'board', id: snapshot.id })
    }
    if (nodeGroup && window.confirm(`Delete "${nodeGroup.name}"? Child tasks will be moved back to the list root.`)) {
      await runAction(() => window.lpl.deleteGroup(nodeGroup.id))
      setSelectedNode(groupList ? { kind: 'list', id: groupList.id } : { kind: 'board', id: snapshot.id })
    }
    if (nodeItem && window.confirm(`Delete "${nodeItem.displayCode}"?`)) {
      await runAction(() => window.lpl.deleteItem(nodeItem.id))
      setSelectedNode(itemList ? { kind: 'list', id: itemList.id } : { kind: 'board', id: snapshot.id })
    }
    if (nodeWidget && window.confirm(`Delete "${nodeWidget.name}"?`)) {
      await runAction(() => window.lpl.deleteWidget(nodeWidget.id))
      setSelectedNode({ kind: 'board', id: snapshot.id })
    }
  }

  return (
    <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
      {menu.node.kind !== 'item' && menu.node.kind !== 'widget' && (
        <button onClick={addChild}>
          <Plus size={14} />
          {menu.node.kind === 'board' ? 'Add New List' : menu.node.kind === 'list' ? 'Add New Group' : 'Add New Item'}
        </button>
      )}
      <button onClick={() => setSelectedNode(menu.node)}>
        <Pencil size={14} />
        Edit
      </button>
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
  )
}

function PropertyEditor({
  allItems,
  appSettings,
  boards,
  busy,
  listTemplateType,
  runAction,
  selectedNode,
  setSelectedNode,
  snapshot,
  widgetType
}: {
  allItems: BoardItem[]
  appSettings: AppSettings
  boards: BoardSummary[]
  busy: boolean
  listTemplateType: ListTemplateType
  runAction: RunAction
  selectedNode: SelectedNode
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
  widgetType: WidgetType
}): ReactElement {
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
      {selectedNode.kind === 'board' && (
        <BoardEditor
          key={snapshot.id}
          listTemplateType={listTemplateType}
          runAction={runAction}
          setSelectedNode={setSelectedNode}
          snapshot={snapshot}
          widgetType={widgetType}
        />
      )}
      {selectedNode.kind === 'list' && selectedList && (
        <ListEditorPanel
          boards={boards}
          key={selectedList.id}
          list={selectedList}
          runAction={runAction}
          setSelectedNode={setSelectedNode}
          snapshot={snapshot}
        />
      )}
      {selectedNode.kind === 'group' && selectedGroup && selectedList && (
        <GroupEditorPanel group={selectedGroup} key={selectedGroup.id} list={selectedList} runAction={runAction} setSelectedNode={setSelectedNode} />
      )}
      {selectedNode.kind === 'item' && selectedItem && selectedList && appSettings && (
        <ItemEditorPanel
          allItems={allItems}
          appSettings={appSettings}
          busy={busy}
          item={selectedItem}
          key={selectedItem.id}
          list={selectedList}
          runAction={runAction}
        />
      )}
      {selectedNode.kind === 'widget' && selectedWidget && (
        <WidgetEditorPanel key={selectedWidget.id} runAction={runAction} setSelectedNode={setSelectedNode} snapshot={snapshot} widget={selectedWidget} />
      )}
    </section>
  )
}

function BoardEditor({
  listTemplateType,
  runAction,
  setSelectedNode,
  snapshot,
  widgetType
}: {
  listTemplateType: ListTemplateType
  runAction: RunAction
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
  widgetType: WidgetType
}): ReactElement {
  const [name, setName] = useState(snapshot.name)
  const [description, setDescription] = useState(snapshot.description)
  const [owner, setOwner] = useState(snapshot.owner)

  useEffect(() => {
    setName(snapshot.name)
    setDescription(snapshot.description)
    setOwner(snapshot.owner)
  }, [snapshot.id])

  function submit(event: FormEvent): void {
    event.preventDefault()
    runAction(() => window.lpl.updateBoard({ boardId: snapshot.id, name, description, owner }))
  }

  return (
    <form className="editor-card" onSubmit={submit}>
      <EditorHeading eyebrow="Board" title={snapshot.name} />
      <div className="field-grid two">
        <label>
          <span>Board name</span>
          <input onChange={(event) => setName(event.target.value)} required value={name} />
        </label>
        <label>
          <span>Owner</span>
          <input onChange={(event) => setOwner(event.target.value)} value={owner} />
        </label>
        <label className="wide-field">
          <span>Description</span>
          <input onChange={(event) => setDescription(event.target.value)} value={description} />
        </label>
        <label className="radio-field">
          <input
            checked={snapshot.active}
            onChange={() => {
              if (!snapshot.active && window.confirm('This will become the displayed board now. Continue?')) {
                runAction(() => window.lpl.setActiveBoard(snapshot.id))
              }
            }}
            type="radio"
          />
          <span>Make active</span>
        </label>
      </div>
      <div className="form-actions">
        <button
          className="icon-button"
          onClick={async () => {
            const result = await runAction(() =>
              window.lpl.createList({
                boardId: snapshot.id,
                name: listTemplateType === 'birthday_calendar' ? 'Birthday Calendar' : 'New List',
                templateType: listTemplateType
              })
            )
            if (result && 'lists' in result) {
              const created = newestList(result)
              if (created) setSelectedNode({ kind: 'list', id: created.id })
            }
          }}
          type="button"
        >
          <Plus size={16} />
          Add List
        </button>
        <button
          className="icon-button"
          onClick={async () => {
            const result = await runAction(() =>
              window.lpl.createWidget({
                boardId: snapshot.id,
                type: widgetType,
                name: widgetTypes.find((entry) => entry.value === widgetType)?.label ?? 'Widget'
              })
            )
            if (result && 'lists' in result) {
              const created = newestWidget(result)
              if (created) setSelectedNode({ kind: 'widget', id: created.id })
            }
          }}
          type="button"
        >
          <Plus size={16} />
          Add Widget
        </button>
        <button className="primary-button" type="submit">
          <Save size={16} />
          Save Board
        </button>
      </div>
    </form>
  )
}

function ListEditorPanel({
  boards,
  list,
  runAction,
  setSelectedNode,
  snapshot
}: {
  boards: BoardSummary[]
  list: BoardList
  runAction: RunAction
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const [name, setName] = useState(list.name)
  const [grid, setGrid] = useState(list.grid)
  const [displayEnabled, setDisplayEnabled] = useState(list.displayEnabled)
  const [dueDateEnabled, setDueDateEnabled] = useState(list.dueDateEnabled)
  const [deadlineMandatory, setDeadlineMandatory] = useState(list.deadlineMandatory)
  const [sortColumnId, setSortColumnId] = useState<string | null>(list.sortColumnId)
  const [sortDirection, setSortDirection] = useState<ListSortDirection>(list.sortDirection)
  const [showItemIdOnBoard, setShowItemIdOnBoard] = useState(list.showItemIdOnBoard)
  const [showDependenciesOnBoard, setShowDependenciesOnBoard] = useState(list.showDependenciesOnBoard)
  const [showCreatedAtOnBoard, setShowCreatedAtOnBoard] = useState(list.showCreatedAtOnBoard)
  const [showCreatedByOnBoard, setShowCreatedByOnBoard] = useState(list.showCreatedByOnBoard)
  const [birthdayBoardView, setBirthdayBoardView] = useState<BirthdayBoardView>(list.templateConfig.birthday?.boardView ?? 'this_month')
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnType, setNewColumnType] = useState<ColumnType>('text')
  const [targetBoardId, setTargetBoardId] = useState('')
  const sortColumn = sortColumnId ? visibleColumns(list).find((column) => column.id === sortColumnId) : null

  useEffect(() => {
    setName(list.name)
    setGrid(list.grid)
    setDisplayEnabled(list.displayEnabled)
    setDueDateEnabled(list.dueDateEnabled)
    setDeadlineMandatory(list.deadlineMandatory)
    setSortColumnId(list.sortColumnId)
    setSortDirection(list.sortDirection)
    setShowItemIdOnBoard(list.showItemIdOnBoard)
    setShowDependenciesOnBoard(list.showDependenciesOnBoard)
    setShowCreatedAtOnBoard(list.showCreatedAtOnBoard)
    setShowCreatedByOnBoard(list.showCreatedByOnBoard)
    setBirthdayBoardView(list.templateConfig.birthday?.boardView ?? 'this_month')
    setTargetBoardId(boards.find((board) => board.id !== list.boardId)?.id ?? '')
  }, [list.id])

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
    } = {}
  ): void {
    const nextShowItemIdOnBoard = systemVisibility.showItemIdOnBoard ?? showItemIdOnBoard
    const nextShowDependenciesOnBoard = systemVisibility.showDependenciesOnBoard ?? showDependenciesOnBoard
    const nextShowCreatedAtOnBoard = systemVisibility.showCreatedAtOnBoard ?? showCreatedAtOnBoard
    const nextShowCreatedByOnBoard = systemVisibility.showCreatedByOnBoard ?? showCreatedByOnBoard
    const placement = nextDisplayEnabled
      ? placeListForDisplay(snapshot.lists, snapshot.widgets, list.id, candidateGrid)
      : { grid: { x: 0, y: 0, w: 0, h: 0 }, moved: [] }
    if (nextDisplayEnabled && !placement) {
      window.alert('This list cannot be shown because the board has no available 4 x 2 slot. Hide another list or resize the layout first.')
      return
    }
    const nextGrid = placement?.grid ?? { x: 0, y: 0, w: 0, h: 0 }

    setDisplayEnabled(nextDisplayEnabled)
    setGrid(nextGrid)
    setShowItemIdOnBoard(nextShowItemIdOnBoard)
    setShowDependenciesOnBoard(nextShowDependenciesOnBoard)
    setShowCreatedAtOnBoard(nextShowCreatedAtOnBoard)
    setShowCreatedByOnBoard(nextShowCreatedByOnBoard)
    runAction(async () => {
      for (const moved of placement?.moved ?? []) {
        await window.lpl.updateList({ ...listInput(moved.list), grid: moved.grid })
      }
        return window.lpl.updateList({
          listId: list.id,
          name,
          templateType: list.templateType,
          templateConfig: list.templateType === 'birthday_calendar' ? { birthday: { boardView: birthdayBoardView } } : {},
          grid: nextGrid,
          dueDateEnabled,
        dueDateColumnId: list.dueDateColumnId,
        deadlineMandatory,
        sortColumnId,
        sortDirection: sortColumnId ? sortDirection : 'manual',
        displayEnabled: nextDisplayEnabled,
        showItemIdOnBoard: nextShowItemIdOnBoard,
        showDependenciesOnBoard: nextShowDependenciesOnBoard,
        showCreatedAtOnBoard: nextShowCreatedAtOnBoard,
        showCreatedByOnBoard: nextShowCreatedByOnBoard
      })
    })
  }

  function addColumn(event: FormEvent): void {
    event.preventDefault()
    if (!newColumnName.trim()) return
    runAction(() => window.lpl.createColumn({ listId: list.id, name: newColumnName, type: newColumnType }))
    setNewColumnName('')
    setNewColumnType('text')
  }

  return (
    <div className="editor-stack">
      <form className="editor-card" onSubmit={submit}>
        <EditorHeading eyebrow="List" title={list.name} />
        <div className="field-grid list-fields">
          <label>
            <span>List name</span>
            <input onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label className="toggle-field">
            <input checked={displayEnabled} onChange={(event) => saveList(event.target.checked)} type="checkbox" />
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
              onChange={(event) => {
                const nextColumnId = event.target.value || null
                setSortColumnId(nextColumnId)
                const nextColumn = visibleColumns(list).find((column) => column.id === nextColumnId)
                setSortDirection(nextColumn ? defaultSortDirection(nextColumn) : 'manual')
              }}
              value={sortColumnId ?? ''}
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
              disabled={!sortColumn}
              onChange={(event) => setSortDirection(event.target.value as ListSortDirection)}
              value={sortColumn ? sortDirection : 'manual'}
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
          <div className="geometry-row">
            {(['w', 'h', 'x', 'y'] as const).map((key) => (
              <label key={key}>
                <span>Grid {key.toUpperCase()}</span>
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
        <div className="form-actions">
          <select className="target-board-select" onChange={(event) => setTargetBoardId(event.target.value)} value={targetBoardId}>
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
            disabled={!targetBoardId}
            onClick={() => runAction(() => window.lpl.copyListToBoard({ listId: list.id, targetBoardId }))}
            type="button"
          >
            Copy To
          </button>
          <button
            className="icon-button"
            disabled={!targetBoardId}
            onClick={() => runAction(() => window.lpl.moveListToBoard({ listId: list.id, targetBoardId }))}
            type="button"
          >
            Move To
          </button>
          <button
            className="icon-button"
            onClick={async () => {
              const result = await runAction(() =>
                window.lpl.createItem({ listId: list.id, groupId: null, values: blankValues(visibleColumns(list)), dependencyItemIds: [] })
              )
              if (result && 'lists' in result) {
                const created = newestItem(result.lists.find((candidate) => candidate.id === list.id))
                if (created) setSelectedNode({ kind: 'item', id: created.id })
              }
            }}
            type="button"
          >
            <Plus size={16} />
            Add Item
          </button>
          {list.templateType !== 'birthday_calendar' && (
            <button
              className="icon-button"
              onClick={async () => {
                const result = await runAction(() => window.lpl.createGroup({ listId: list.id, name: 'New Group' }))
                if (result && 'lists' in result) {
                  const created = newestGroup(result.lists.find((candidate) => candidate.id === list.id))
                  if (created) setSelectedNode({ kind: 'group', id: created.id })
                }
              }}
              type="button"
            >
              <Plus size={16} />
              Add Group
            </button>
          )}
          <button className="primary-button" type="submit">
            <Save size={16} />
            Save List
          </button>
        </div>
      </form>

      <section className="editor-card">
        <EditorHeading eyebrow="Columns" title="List Fields" />
        {list.templateType === 'birthday_calendar' && <p className="locked-template-note">Birthday Calendar fields are locked to preserve calendar behavior.</p>}
        <div className="column-list">
          <SystemColumnRow
            name="Item ID"
            onToggle={(checked) => saveList(displayEnabled, grid, { showItemIdOnBoard: checked })}
            showOnBoard={showItemIdOnBoard}
            typeLabel="system"
          />
          <SystemColumnRow
            name="Dependencies"
            onToggle={(checked) => saveList(displayEnabled, grid, { showDependenciesOnBoard: checked })}
            showOnBoard={showDependenciesOnBoard}
            typeLabel="system"
          />
          <SystemColumnRow
            name="Created At"
            onToggle={(checked) => saveList(displayEnabled, grid, { showCreatedAtOnBoard: checked })}
            showOnBoard={showCreatedAtOnBoard}
            typeLabel="system"
          />
          <SystemColumnRow
            name="Created By"
            onToggle={(checked) => saveList(displayEnabled, grid, { showCreatedByOnBoard: checked })}
            showOnBoard={showCreatedByOnBoard}
            typeLabel="system"
          />
          {visibleColumns(list).map((column) => (
            <ColumnRow column={column} key={column.id} list={list} locked={list.templateType === 'birthday_calendar'} runAction={runAction} />
          ))}
        </div>
        {list.templateType !== 'birthday_calendar' && (
          <form className="add-column-row" onSubmit={addColumn}>
            <input onChange={(event) => setNewColumnName(event.target.value)} placeholder="New column" value={newColumnName} />
            <select onChange={(event) => setNewColumnType(event.target.value as ColumnType)} value={newColumnType}>
              {columnTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <button className="icon-button" type="submit">
              <Plus size={16} />
              Add Field
            </button>
          </form>
        )}
      </section>

      <section className="editor-card">
        <EditorHeading eyebrow="Items" title="List Items" />
        <div className="admin-table expanded">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Group</th>
                {visibleColumns(list).map((column) => (
                  <th key={column.id}>{column.name}</th>
                ))}
                {list.dueDateEnabled && <th>Deadline Status</th>}
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
                  {list.dueDateEnabled && <td>{item.deadlineStatus}</td>}
                  <td>{statusLabel(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
      <span className="readonly-field">-</span>
      <label>
        <input checked={showOnBoard} onChange={(event) => onToggle(event.target.checked)} type="checkbox" />
        Show
      </label>
      <button className="mini-button" disabled type="button">
        Save
      </button>
      <button className="mini-button danger-mini" disabled type="button">
        Delete
      </button>
    </div>
  )
}

function ColumnRow({
  column,
  list,
  locked = false,
  runAction
}: {
  column: ListColumn
  list: BoardList
  locked?: boolean
  runAction: RunAction
}): ReactElement {
  const [name, setName] = useState(column.name)
  const [type, setType] = useState<ColumnType>(column.type)
  const [required, setRequired] = useState(column.required)
  const [summaryEligible, setSummaryEligible] = useState(column.summaryEligible)
  const [choiceConfig, setChoiceConfig] = useState<ChoiceConfig>(() => column.choiceConfig ?? defaultChoiceConfig(column.name))
  const [choicesDraft, setChoicesDraft] = useState(choiceConfigToText(column.choiceConfig ?? defaultChoiceConfig(column.name)))
  const [dateDisplayFormat, setDateDisplayFormat] = useState<DateDisplayFormat>(column.dateDisplayFormat)
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(column.currencyCode)
  const [showOnBoard, setShowOnBoard] = useState(column.showOnBoard)

  useEffect(() => {
    setName(column.name)
    setType(column.type)
    setRequired(column.required)
    setSummaryEligible(column.summaryEligible)
    setChoiceConfig(column.choiceConfig ?? defaultChoiceConfig(column.name))
    setChoicesDraft(choiceConfigToText(column.choiceConfig ?? defaultChoiceConfig(column.name)))
    setDateDisplayFormat(column.dateDisplayFormat)
    setCurrencyCode(column.currencyCode)
    setShowOnBoard(column.showOnBoard)
  }, [column.id])

  function save(): void {
    const nextChoiceConfig =
      type === 'choice'
        ? { ...choiceConfig, options: parseChoiceOptions(choicesDraft, choiceConfig) }
        : null
    runAction(() =>
      window.lpl.updateColumn({
        columnId: column.id,
        name,
        type,
        required,
        maxLength: column.maxLength,
        summaryEligible,
        choiceConfig: nextChoiceConfig,
        dateDisplayFormat: type === 'date' ? dateDisplayFormat : 'date',
        recurrence: 'none',
        recurrenceDays: [],
        currencyCode: type === 'currency' ? currencyCode : 'USD',
        showOnBoard
      })
    )
  }

  function remove(): void {
    if (window.confirm(`Delete "${column.name}"? Existing values stored in this field on child items will be deleted.`)) {
      runAction(() => window.lpl.deleteColumn(column.id))
    }
  }

  return (
    <div className={type === 'choice' || type === 'date' || type === 'currency' ? 'column-row column-row-with-config' : 'column-row'}>
      <input disabled={column.role === 'deadline' || locked} onChange={(event) => setName(event.target.value)} value={name} />
      <select
        disabled={column.role === 'deadline' || locked}
        onChange={(event) => {
          const nextType = event.target.value as ColumnType
          setType(nextType)
          if (nextType === 'date') {
            setDateDisplayFormat(column.role === 'deadline' ? 'datetime' : 'date')
          }
          if (nextType === 'choice') {
            const nextConfig = choiceConfig.options.length ? choiceConfig : defaultChoiceConfig(name)
            setChoiceConfig(nextConfig)
            setChoicesDraft(choiceConfigToText(nextConfig))
          }
        }}
        value={type}
      >
        {columnTypes.map((candidate) => (
          <option key={candidate} value={candidate}>
            {candidate}
          </option>
        ))}
      </select>
      <label>
        <input checked={required} disabled={locked} onChange={(event) => setRequired(event.target.checked)} type="checkbox" />
        Required
      </label>
      <label>
        <input checked={summaryEligible} disabled={locked} onChange={(event) => setSummaryEligible(event.target.checked)} type="checkbox" />
        Summary
      </label>
      <label>
        <input checked={showOnBoard} disabled={locked} onChange={(event) => setShowOnBoard(event.target.checked)} type="checkbox" />
        Show
      </label>
      <button className="mini-button" disabled={locked} onClick={save} type="button">
        Save
      </button>
      <button className="mini-button danger-mini" disabled={locked || list.columns.length <= 1 || column.role === 'deadline'} onClick={remove} type="button">
        Delete
      </button>
      {type === 'date' && (
        <div className="date-config-row">
          <label>
            <span>Display</span>
            <select
              disabled={column.role === 'deadline' || locked}
              onChange={(event) => setDateDisplayFormat(event.target.value as DateDisplayFormat)}
              value={column.role === 'deadline' ? 'datetime' : dateDisplayFormat}
            >
              <option value="date">Date</option>
              <option value="datetime">Date + time</option>
              <option value="time">Time only</option>
            </select>
          </label>
        </div>
      )}
      {type === 'currency' && (
        <div className="date-config-row">
          <label>
            <span>Currency</span>
            <select disabled={locked} onChange={(event) => setCurrencyCode(event.target.value as CurrencyCode)} value={currencyCode}>
              {currencyOptions.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {type === 'choice' && (
        <div className="choice-config-row">
          <label>
            <span>Selection</span>
            <select
              disabled={locked}
              onChange={(event) => setChoiceConfig((current) => ({ ...current, selection: event.target.value === 'multi' ? 'multi' : 'single' }))}
              value={choiceConfig.selection}
            >
              <option value="single">Single</option>
              <option value="multi">Multi</option>
            </select>
          </label>
          <label>
            <input
              checked={choiceConfig.ranked}
              disabled={locked}
              onChange={(event) => setChoiceConfig((current) => ({ ...current, ranked: event.target.checked }))}
              type="checkbox"
            />
            Ranked
          </label>
          <label className="choice-options-field">
            <span>Options</span>
            <textarea
              disabled={locked}
              onChange={(event) => setChoicesDraft(event.target.value)}
              rows={Math.min(5, Math.max(3, choicesDraft.split('\n').length))}
              value={choicesDraft}
            />
          </label>
        </div>
      )}
    </div>
  )
}

function GroupEditorPanel({
  group,
  list,
  runAction,
  setSelectedNode
}: {
  group: ItemGroup
  list: BoardList
  runAction: RunAction
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
}): ReactElement {
  const [name, setName] = useState(group.name)
  const [showIdOnBoard, setShowIdOnBoard] = useState(group.showIdOnBoard)
  const [summaries, setSummaries] = useState<GroupSummaryConfig[]>(group.summaries)

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
          onClick={async () => {
            const result = await runAction(() =>
              window.lpl.createItem({ listId: list.id, groupId: group.id, values: blankValues(visibleColumns(list)), dependencyItemIds: [] })
            )
            if (result && 'lists' in result) {
              const created = newestItem(result.lists.find((candidate) => candidate.id === list.id))
              if (created) setSelectedNode({ kind: 'item', id: created.id })
            }
          }}
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
    </form>
  )
}

function ItemEditorPanel({
  allItems,
  appSettings,
  busy,
  item,
  list,
  runAction
}: {
  allItems: BoardItem[]
  appSettings: AppSettings
  busy: boolean
  item: BoardItem
  list: BoardList
  runAction: RunAction
}): ReactElement {
  const editableColumns = visibleColumns(list)
  const [values, setValues] = useState<FormValues>(() => valuesForItem(item, editableColumns))
  const [dependencies, setDependencies] = useState<string[]>(item.dependencyItemIds)
  const [groupId, setGroupId] = useState<string | null>(item.groupId)
  const [closeDialog, setCloseDialog] = useState<{ action: 'completed' | 'cancelled' } | null>(null)
  const [closeComment, setCloseComment] = useState('')
  const [closing, setClosing] = useState(false)
  const confirmationMode = appSettings.closeConfirmationMode

  useEffect(() => {
    setValues(valuesForItem(item, editableColumns))
    setDependencies(item.dependencyItemIds)
    setGroupId(item.groupId)
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
      <form className="editor-card" onSubmit={submit}>
        <EditorHeading eyebrow="Item" title={item.displayCode} />
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
        <DependencyPicker allItems={allItems.filter((candidate) => candidate.id !== item.id)} dependencies={dependencies} setDependencies={setDependencies} />
        <div className="form-actions">
          {item.publicationStatus !== 'draft' && (
            <button className="icon-button" disabled={busy || closing} onClick={() => requestClose('completed')} type="button">
              <Check size={16} />
              Mark Done
            </button>
          )}
          {item.publicationStatus !== 'published' && (
            <button className="icon-button" disabled={busy || closing} onClick={() => runAction(() => window.lpl.publishItem(item.id))} type="button">
              <Send size={16} />
              Publish
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

  useEffect(() => {
    setName(widget.name)
    setDisplayEnabled(widget.displayEnabled)
    setGrid(widget.grid)
    setType(widget.type)
    setConfig(widget.config)
  }, [widget.id])

  function submit(event: FormEvent): void {
    event.preventDefault()
    const nextGrid = displayEnabled ? normalizeWidgetDisplayGrid(grid) : { x: 0, y: 0, w: 0, h: 0 }
    if (displayEnabled && !canPlaceWidgetGrid(nextGrid, snapshot.lists, snapshot.widgets, widget.id)) {
      window.alert('This widget overlaps another visible board element. Move or resize it first.')
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

  return (
    <form className="editor-card" onSubmit={submit}>
      <EditorHeading eyebrow="Widget" title={widget.name} />
      <div className="field-grid two">
        <label>
          <span>Widget name</span>
          <input onChange={(event) => setName(event.target.value)} required value={name} />
        </label>
        <label>
          <span>Widget type</span>
          <select
            onChange={(event) => {
              const nextType = event.target.value as WidgetType
              setType(nextType)
              setConfig(defaultConfigForWidgetType(nextType))
              setName(widgetTypes.find((entry) => entry.value === nextType)?.label ?? 'Widget')
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
            <label>
              <span>Display style</span>
              <select
                onChange={(event) =>
                  setConfig((current) => ({
                    worldClocks: {
                      locations: current.worldClocks?.locations ?? defaultWorldClockConfig().locations,
                      showSeconds: current.worldClocks?.showSeconds ?? false,
                      style: event.target.value === 'analogue' ? 'analogue' : 'digital'
                    }
                  }))
                }
                value={config.worldClocks?.style ?? 'digital'}
              >
                <option value="digital">Digital</option>
                <option value="analogue">Analogue</option>
              </select>
            </label>
            <label className="toggle-field">
              <input
                checked={Boolean(config.worldClocks?.showSeconds)}
                onChange={(event) =>
                  setConfig((current) => ({
                    worldClocks: {
                      locations: current.worldClocks?.locations ?? defaultWorldClockConfig().locations,
                      showSeconds: event.target.checked,
                      style: current.worldClocks?.style ?? 'digital'
                    }
                  }))
                }
                type="checkbox"
              />
              <span>Show seconds</span>
            </label>
            {(config.worldClocks?.locations ?? defaultWorldClockConfig().locations).map((location) => (
              <div className="world-clock-config-row" key={location.id}>
                <input
                  onChange={(event) =>
                    setConfig((current) => ({
                      worldClocks: {
                        locations: (current.worldClocks?.locations ?? defaultWorldClockConfig().locations).map((candidate) =>
                          candidate.id === location.id ? { ...candidate, label: event.target.value } : candidate
                        ),
                        showSeconds: current.worldClocks?.showSeconds ?? false,
                        style: current.worldClocks?.style ?? 'digital'
                      }
                    }))
                  }
                  placeholder="Label"
                  value={location.label}
                />
                <select
                  onChange={(event) =>
                    setConfig((current) => ({
                      worldClocks: {
                        locations: (current.worldClocks?.locations ?? defaultWorldClockConfig().locations).map((candidate) =>
                          candidate.id === location.id ? { ...candidate, timeZone: event.target.value } : candidate
                        ),
                        showSeconds: current.worldClocks?.showSeconds ?? false,
                        style: current.worldClocks?.style ?? 'digital'
                      }
                    }))
                  }
                  value={location.timeZone}
                >
                  {worldClockTimeZones.map((timeZone) => (
                    <option key={timeZone} value={timeZone}>
                      {timeZone}
                    </option>
                  ))}
                </select>
              </div>
            ))}
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
          <h3>16 x 8 Grid</h3>
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
            runAction(async () => {
              for (const moved of placement.moved) {
                await window.lpl.updateList({ ...listInput(moved.list), grid: moved.grid })
              }
              return window.lpl.updateList({ ...listInput(sourceList), grid: placement.grid })
            })
          }}
          onListSelect={(listId) => setSelectedNode({ kind: 'list', id: listId })}
          onWidgetChange={(widget, grid) => {
            const sourceWidget = layoutSnapshot.widgets.find((entry) => entry.id === widget.id) ?? widget
            if (canPlaceWidgetGrid(grid, layoutSnapshot.lists, layoutSnapshot.widgets, widget.id)) {
              runAction(() => window.lpl.updateWidget({ ...widgetInput(sourceWidget), grid }))
            }
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
      window.alert(error instanceof Error ? error.message : 'Unable to close the item right now.')
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
            {snapshot.summarySlots.map((slot) => (
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
    </section>
  )
}

function themeClassName(theme: AppTheme): string {
  return themeOptions.find((entry) => entry.value === theme)?.className ?? 'theme-midnight-clear'
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
    const dx = Math.round((event.clientX - drag.current.x) / unitW)
    const dy = Math.round((event.clientY - drag.current.y) / unitH)
    const next =
      drag.current.mode === 'move' ? moveGrid(drag.current.grid, dx, dy) : resizeGrid(drag.current.grid, drag.current.mode, dx, dy)
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
          <h3>{list.name}</h3>
        </div>
        {editable ? <Grip size={16} /> : list.dueDateEnabled && <span className="due-chip">Deadline</span>}
      </header>
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
               {list.dueDateEnabled && <th>Deadline</th>}
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
                  {list.dueDateEnabled && <td />}
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
                  {list.dueDateEnabled && <td>{row.item.deadlineStatus}</td>}
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
    grid: BoardWidget['grid']
    rect: DOMRect
  } | null>(null)

  function startDrag(event: PointerEvent, mode: NonNullable<typeof drag.current>['mode']): void {
    if (!editable) return
    const grid = event.currentTarget.closest('.board-grid')?.getBoundingClientRect()
    if (!grid) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    drag.current = { mode, x: event.clientX, y: event.clientY, grid: widget.grid, rect: grid }
  }

  function finishDrag(event: PointerEvent): void {
    if (!drag.current || !onChange) return
    const unitW = drag.current.rect.width / 16
    const unitH = drag.current.rect.height / 8
    const dx = Math.round((event.clientX - drag.current.x) / unitW)
    const dy = Math.round((event.clientY - drag.current.y) / unitH)
    const next =
      drag.current.mode === 'move' ? moveWidgetGrid(drag.current.grid, dx, dy) : resizeWidgetGrid(drag.current.grid, drag.current.mode, dx, dy)
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
          <h3>{widget.name}</h3>
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
  if (widget.type === 'weather') return <WeatherWidget compact={compact} widget={widget} />
  if (widget.type === 'word_of_day') return <WordOfDayWidget compact={compact} widget={widget} />
  if (widget.type === 'world_clocks') return <WorldClocksWidget compact={compact} widget={widget} />
  if (widget.type === 'countdown') return <CountdownWidget compact={compact} widget={widget} />
  return <ClockWidget compact={compact} widget={widget} />
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
  item,
  list,
  mode,
  onClose,
  runAction
}: {
  allItems: BoardItem[]
  busy: boolean
  item: BoardItem | null
  list: BoardList
  mode: 'create' | 'edit'
  onClose: () => void
  runAction: RunAction
}): ReactElement {
  const editableColumns = visibleColumns(list)
  const [values, setValues] = useState<FormValues>(() => (item ? valuesForItem(item, editableColumns) : blankValues(editableColumns)))
  const [dependencies, setDependencies] = useState<string[]>(item?.dependencyItemIds ?? [])
  const [groupId, setGroupId] = useState<string | null>(item?.groupId ?? null)

  useEffect(() => {
    setValues(item ? valuesForItem(item, editableColumns) : blankValues(editableColumns))
    setDependencies(item?.dependencyItemIds ?? [])
    setGroupId(item?.groupId ?? null)
  }, [item?.id, list.id])

  function setValue(column: ListColumn, value: FieldValue): void {
    setValues((current) => ({ ...current, [column.id]: coerceInputValue(column, value) }))
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const result = await runAction(async () => {
      if (mode === 'edit' && item) {
        await window.lpl.updateItem({ itemId: item.id, groupId, values, dependencyItemIds: dependencies })
        return window.lpl.publishItem(item.id)
      }

      const created = await window.lpl.createItem({ listId: list.id, groupId, values, dependencyItemIds: dependencies })
      if (!('lists' in created)) return created
      const createdList = created.lists.find((candidate) => candidate.id === list.id)
      const newest = newestItem(createdList)
      return newest ? window.lpl.publishItem(newest.id) : created
    })
    if (result && 'lists' in result) onClose()
  }

  return (
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
            <DependencyPicker allItems={allItems.filter((candidate) => candidate.id !== item?.id)} dependencies={dependencies} setDependencies={setDependencies} />
          </div>
          <div className="modal-actions">
            <button className="icon-button" disabled={busy} onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" disabled={busy} type="submit">
              <Save size={16} />
              {mode === 'edit' ? 'Save & Publish' : 'Add & Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
  const [displayEnabled, setDisplayEnabled] = useState(list.displayEnabled)
  const [dueDateEnabled, setDueDateEnabled] = useState(list.dueDateEnabled)
  const [deadlineMandatory, setDeadlineMandatory] = useState(list.deadlineMandatory)
  const [sortColumnId, setSortColumnId] = useState<string | null>(list.sortColumnId)
  const [sortDirection, setSortDirection] = useState<ListSortDirection>(list.sortDirection)
  const [showItemIdOnBoard, setShowItemIdOnBoard] = useState(list.showItemIdOnBoard)
  const [showDependenciesOnBoard, setShowDependenciesOnBoard] = useState(list.showDependenciesOnBoard)
  const [showCreatedAtOnBoard, setShowCreatedAtOnBoard] = useState(list.showCreatedAtOnBoard)
  const [showCreatedByOnBoard, setShowCreatedByOnBoard] = useState(list.showCreatedByOnBoard)
  const [birthdayBoardView, setBirthdayBoardView] = useState<BirthdayBoardView>(list.templateConfig.birthday?.boardView ?? 'this_month')
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnType, setNewColumnType] = useState<ColumnType>('text')
  const sortColumn = sortColumnId ? visibleColumns(list).find((column) => column.id === sortColumnId) : null

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
    setBirthdayBoardView(list.templateConfig.birthday?.boardView ?? 'this_month')
  }, [
    list.deadlineMandatory,
    list.displayEnabled,
    list.dueDateEnabled,
    list.id,
    list.name,
    list.showCreatedAtOnBoard,
    list.showCreatedByOnBoard,
    list.showDependenciesOnBoard,
    list.showItemIdOnBoard,
    list.sortColumnId,
    list.sortDirection
  ])

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
      window.alert('This list cannot be shown because the board has no available 4 x 2 slot. Hide another list or resize the layout first.')
      return
    }

    const nextGrid = placement?.grid ?? { x: 0, y: 0, w: 0, h: 0 }
    const result = await runAction(async () => {
      for (const moved of placement?.moved ?? []) {
        await window.lpl.updateList({ ...listInput(moved.list), grid: moved.grid })
      }
      return window.lpl.updateList({
        listId: list.id,
        name,
        templateType: list.templateType,
        templateConfig: list.templateType === 'birthday_calendar' ? { birthday: { boardView: birthdayBoardView } } : {},
        grid: nextGrid,
        dueDateEnabled,
        dueDateColumnId: list.dueDateColumnId,
        deadlineMandatory,
        sortColumnId,
        sortDirection: sortColumnId ? sortDirection : 'manual',
        displayEnabled,
        showItemIdOnBoard,
        showDependenciesOnBoard,
        showCreatedAtOnBoard,
        showCreatedByOnBoard
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
                    onChange={(event) => {
                      const nextColumnId = event.target.value || null
                      setSortColumnId(nextColumnId)
                      const nextColumn = visibleColumns(list).find((column) => column.id === nextColumnId)
                      setSortDirection(nextColumn ? defaultSortDirection(nextColumn) : 'manual')
                    }}
                    value={sortColumnId ?? ''}
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
                    disabled={!sortColumn}
                    onChange={(event) => setSortDirection(event.target.value as ListSortDirection)}
                    value={sortColumn ? sortDirection : 'manual'}
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
              {list.templateType === 'birthday_calendar' && <p className="locked-template-note">Birthday Calendar fields are locked to preserve calendar behavior.</p>}
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
                {visibleColumns(list).map((column) => (
                  <ColumnRow column={column} key={column.id} list={list} locked={list.templateType === 'birthday_calendar'} runAction={runAction} />
                ))}
              </div>
              {list.templateType !== 'birthday_calendar' && (
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
              )}
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
  const birthdayColumn = birthdayCoreColumns(birthdayList).find((column) => column.name === 'Birthday')
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
    const values = blankValues(visibleColumns(targetList))
    const nameColumn = visibleColumns(targetList)[0]
    if (nameColumn) values[nameColumn.id] = title
    if (targetList.dueDateEnabled && targetList.dueDateColumnId && deadline) {
      values[targetList.dueDateColumnId] = deadline
    }
    const result = await runAction(async () => {
      const created = await window.lpl.createItem({ listId: targetList.id, groupId: null, values, dependencyItemIds: [] })
      if (!('lists' in created)) return created
      const createdList = created.lists.find((candidate) => candidate.id === targetList.id)
      const newest = newestItem(createdList)
      return newest ? window.lpl.publishItem(newest.id) : created
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
                      recurrenceDays: recurrenceNeedsWeekdays(recurrence) ? dateValue.recurrenceDays : []
                    })
                  }}
                  value={dateValue.recurrence}
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every two weeks</option>
                  <option value="custom_weekdays">Weekdays...</option>
                </select>
              </label>
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
            <span>{column.name}</span>
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

function DependencyPicker({
  allItems,
  dependencies,
  setDependencies
}: {
  allItems: BoardItem[]
  dependencies: string[]
  setDependencies: Dispatch<SetStateAction<string[]>>
}): ReactElement {
  return (
    <fieldset className="dependency-picker">
      <legend>Dependencies</legend>
      <div>
        {allItems.map((item) => (
          <label key={item.id}>
            <input
              checked={dependencies.includes(item.id)}
              onChange={(event) => {
                setDependencies((current) =>
                  event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)
                )
              }}
              type="checkbox"
            />
            <span>{item.displayCode}</span>
          </label>
        ))}
      </div>
    </fieldset>
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
): { grid: BoardList['grid']; moved: { list: BoardList; grid: BoardList['grid'] }[] } | null {
  const normalized = normalizeDisplayGrid(candidate)
  if (canPlaceGrid(normalized, lists, widgets, list.id)) return { grid: normalized, moved: [] }

  const overlappingLists = lists.filter(
    (entry) => entry.displayEnabled && entry.id !== list.id && validDisplayGrid(entry.grid) && gridsOverlap(normalized, entry.grid)
  )
  if (overlappingLists.length !== 1) return null

  const target = overlappingLists[0]
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

  if (!canSwap) return null
  return { grid: normalized, moved: [{ list: target, grid: swappedTargetGrid }] }
}

function gridsOverlap(a: BoardList['grid'], b: BoardList['grid']): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function moveGrid(grid: BoardList['grid'], dx: number, dy: number): BoardList['grid'] {
  return {
    ...grid,
    x: clamp(grid.x + dx, 1, 17 - grid.w),
    y: clamp(grid.y + dy, 1, 9 - grid.h)
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

function resizeWidgetGrid(
  grid: BoardWidget['grid'],
  handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
  dx: number,
  dy: number
): BoardWidget['grid'] {
  let next = { ...grid }
  if (handle.includes('e')) next.w = clamp(grid.w + dx, 2, 17 - grid.x)
  if (handle.includes('s')) next.h = clamp(grid.h + dy, 2, 9 - grid.y)
  if (handle.includes('w')) {
    const newX = clamp(grid.x + dx, 1, grid.x + grid.w - 2)
    next = { ...next, x: newX, w: grid.w + (grid.x - newX) }
  }
  if (handle.includes('n')) {
    const newY = clamp(grid.y + dy, 1, grid.y + grid.h - 2)
    next = { ...next, y: newY, h: grid.h + (grid.y - newY) }
  }
  return next
}

function normalizeWidgetDisplayGrid(grid: BoardWidget['grid']): BoardWidget['grid'] {
  const w = clamp(grid.w, 2, 16)
  const h = clamp(grid.h, 2, 8)
  return {
    x: clamp(grid.x, 1, 17 - w),
    y: clamp(grid.y, 1, 9 - h),
    w,
    h
  }
}

function canPlaceWidgetGrid(grid: BoardWidget['grid'], lists: BoardList[], widgets: BoardWidget[], currentWidgetId: string): boolean {
  const normalized = normalizeWidgetDisplayGrid(grid)
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

function boardVisibleColumns(list: BoardList): ListColumn[] {
  if (list.templateType === 'birthday_calendar') {
    return birthdayCoreColumns(list).filter((column) => column.name !== 'Birth Year')
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

function nextDueLabel(list: BoardList): ReactElement {
  if (!list.dueDateColumnId) return <em>Next due date: <strong>-</strong></em>
  const deadlines = list.items
    .map((item) => dateStringFromField(item.values[list.dueDateColumnId ?? '']))
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value.includes('T') ? value : `${value}T23:59:59`))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => first.getTime() - second.getTime())

  if (deadlines.length === 0) return <em>Next due date: <strong>-</strong></em>
  const now = Date.now()
  const upcoming = deadlines.find((date) => date.getTime() >= now) ?? deadlines[0]
  const diff = upcoming.getTime() - now
  const prefix = diff < 0 ? 'overdue by' : 'in'
  const tone = deadlineToneFromDiff(diff)
  return <em>Next due date: <strong className={`deadline-text ${deadlineClass(tone)}`}>{prefix} {compactDuration(Math.abs(diff))}</strong></em>
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
  const labels = priority ? ['Highest', 'High', 'Medium', 'Low', 'Lowest'] : ['Option 1', 'Option 2', 'Option 3']
  return {
    selection: 'single',
    ranked: priority,
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
    sortColumnId: list.sortColumnId,
    sortDirection: list.sortDirection,
    displayEnabled: list.displayEnabled,
    showItemIdOnBoard: list.showItemIdOnBoard,
    showDependenciesOnBoard: list.showDependenciesOnBoard,
    showCreatedAtOnBoard: list.showCreatedAtOnBoard,
    showCreatedByOnBoard: list.showCreatedByOnBoard
  }
}

type BoardDisplayColumn =
  | { kind: 'real'; key: string; label: string; column: ListColumn }
  | { kind: 'birthday_turning'; key: string; label: string }

function birthdayCoreColumns(list: BoardList): ListColumn[] {
  return visibleColumns(list).filter((column) => column.name === 'Person Name' || column.name === 'Birthday' || column.name === 'Birth Year')
}

function birthdayBoardColumns(list: BoardList, columns: ListColumn[]): BoardDisplayColumn[] {
  if (list.templateType !== 'birthday_calendar') return columns.map((column) => ({ kind: 'real', key: column.id, label: column.name, column }))
  const core = birthdayCoreColumns(list)
  return [
    ...core
      .filter((column) => column.name !== 'Birth Year')
      .map((column) => ({ kind: 'real' as const, key: column.id, label: column.name, column })),
    { kind: 'birthday_turning', key: 'birthday-turning', label: 'Turning' }
  ]
}

function birthdayFilteredItems(list: BoardList, now = new Date()): BoardItem[] {
  const birthdayColumn = birthdayCoreColumns(list).find((column) => column.name === 'Birthday')
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
  const birthYearColumn = birthdayCoreColumns(list).find((column) => column.name === 'Birth Year')
  const birthdayColumn = birthdayCoreColumns(list).find((column) => column.name === 'Birthday')
  const year = birthYearColumn ? Number(item.values[birthYearColumn.id]) : NaN
  const occurrence = birthdayColumn ? birthdayOccurrenceDate(item.values[birthdayColumn.id]) : null
  if (!Number.isFinite(year) || !occurrence) return '-'
  return `Turning ${occurrence.getFullYear() - year}`
}

function formatBirthdayAwareCellValue(item: BoardItem, column: ListColumn, list: BoardList): string | ReactElement {
  if (list.templateType === 'birthday_calendar' && column.name === 'Birthday') {
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
      const birthdayColumn = birthdayCoreColumns(list).find((column) => column.name === 'Birthday')
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
    return new Date(`${value}T23:59:00`)
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
    if (recurrenceMatchesDay(cursor, value.recurrence, value.recurrenceDays)) {
      if (cursor >= start && cursor <= end) occurrences.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return occurrences
}

function recurrenceMatchesDay(date: Date, recurrence: RecurrenceMode, days: number[]): boolean {
  if (recurrence === 'daily') return true
  if (recurrence === 'weekly' || recurrence === 'custom_weekdays') return days.length === 0 ? true : days.includes(date.getDay())
  if (recurrence === 'biweekly') return days.length === 0 ? true : days.includes(date.getDay())
  return false
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
  if (column.role === 'deadline') return 'datetime-local'
  if (column.type === 'date') {
    if (column.dateDisplayFormat === 'datetime') return 'datetime-local'
    if (column.dateDisplayFormat === 'time') return 'time'
    return 'date'
  }
  if (column.type === 'hyperlink') return 'url'
  if (column.type === 'integer' || column.type === 'decimal' || column.type === 'currency') return 'number'
  return 'text'
}

function inputValue(value: FieldValue | undefined, column: ListColumn): string {
  if (value === null || value === undefined || Array.isArray(value)) return ''
  if (isDateFieldValue(value)) return inputValue(value.value, column)
  if (column.role === 'deadline' && typeof value === 'string' && value.length === 10) return `${value}T23:59`
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
  return String(value)
}

function formatValue(value: FieldValue | undefined, column: ListColumn): string {
  if (isDateFieldValue(value)) {
    if (!value.value) return '-'
    if (column.type === 'date' && column.dateDisplayFormat === 'time') {
      return recurrenceLabel(value.recurrence, value.recurrenceDays, formatTimeValue(value.value))
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
  if (column.type === 'date' && typeof value === 'string') {
    if (column.role === 'deadline' || column.dateDisplayFormat === 'datetime') return formatDateTimeValue(value)
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
      recurrenceDays: recurrenceNeedsWeekdays(recurrence) ? normalizeRecurrenceDays(value.recurrenceDays) : []
    }
  }
  return {
    value: typeof value === 'string' ? value : '',
    recurrence: 'none',
    recurrenceDays: []
  }
}

function isItemLevelRecurringTimeColumn(column: ListColumn): boolean {
  return column.type === 'date' && column.role !== 'deadline' && column.dateDisplayFormat === 'time'
}

function recurrenceLabel(recurrence: RecurrenceMode, days: number[], time: string): string {
  if (recurrence === 'daily') return `Daily, ${time}`
  if (recurrence === 'weekly') return `${daysLabel(days, 'Weekly')}, ${time}`
  if (recurrence === 'biweekly') return `${daysLabel(days, 'Every two weeks')}, ${time}`
  if (recurrence === 'custom_weekdays') return `${daysLabel(days, 'Selected days')}, ${time}`
  return time
}

function daysLabel(days: number[], fallback: string): string {
  if (days.length === 0) return fallback
  return days.map((day) => weekdayLabels[day]?.long).filter(Boolean).join(', ')
}

function recurrenceNeedsWeekdays(recurrence: RecurrenceMode): boolean {
  return recurrence === 'weekly' || recurrence === 'biweekly' || recurrence === 'custom_weekdays'
}

function normalizeRecurrenceDays(days: number[] | undefined): number[] {
  return [...new Set((days ?? []).map((day) => Math.trunc(day)).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b)
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
