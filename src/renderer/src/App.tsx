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
import { Fragment, FormEvent, PointerEvent, useEffect, useRef, useState } from 'react'
import type { CSSProperties, Dispatch, ReactElement, SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import type {
  AppActionResult,
  BoardRailMenuState,
  ConfirmDialogState,
  ContextMenuState,
  EditableSummarySlot,
  HelpArticle,
  HelpArticleSection,
  PromptDialogState,
  Route,
  RunAction,
  SelectedNode,
  TutorialScene,
  TutorialSession,
  TutorialStep,
  TutorialTargetId
} from './app/types'
import lplLogo from './assets/lpl_logo.png'
import { CollapsibleEditorSectionHeader, EditorHeading } from './editors/chrome'
import { GroupEditorPanel } from './editors/groupEditor'
import {
  choiceLabel,
  dateFieldValue,
  formatCellValue,
  formatValue,
  formatSystemDate,
  isDateFieldValue,
  normalizeRecurrenceInterval,
  weekdayLabels
} from './editors/itemFieldHelpers'
import { CloseItemModal, ItemEditorPanel } from './editors/itemEditor'
import { DisplayBoard } from './board-display'
import type { BoardDisplayHelpers } from './board-display'
import {
  canPlaceWidgetGrid as layoutCanPlaceWidgetGrid,
  listTemplateGridSizes as layoutListTemplateGridSizes,
  normalizeWidgetDisplayGrid as layoutNormalizeWidgetDisplayGrid,
  placeListForDisplay as layoutPlaceListForDisplay,
  placeListForDisplaySizes as layoutPlaceListForDisplaySizes,
  pointerMoveGrid as layoutPointerMoveGrid,
  pointerMoveWidgetGridWithOffset as layoutPointerMoveWidgetGridWithOffset,
  resizeGrid as layoutResizeGrid,
  resizeWidgetGrid as layoutResizeWidgetGrid,
  resolveListGridChange as layoutResolveListGridChange,
  resolveWidgetGridChange as layoutResolveWidgetGridChange,
  validDisplayGrid as layoutValidDisplayGrid
} from './layout-engine'
import {
  isProjectMilestoneLikeType as projectIsMilestoneLikeType,
  projectEditableFieldColumns as projectEditableColumns,
  projectParentOptions as projectParentSelectionOptions,
  projectRootItemsForBucket as projectRootBucketItems,
  projectTypeFromValues as projectTypeFromProjectValues,
  renderProjectDependencyItemRows as renderProjectDependencyRows,
  submitProjectAwareItemMutation as submitProjectMutation
} from './project'
import { ConfigurationWizard as WizardFlow } from './wizard'
import type { WizardHelpers } from './wizard'
import { columnDraftFromColumn, columnDraftMatchesColumn, columnDraftsForList, columnDraftToInput } from './list-editor/drafts'
import type { ColumnDraft } from './list-editor/drafts'
import { ListEditorPanel } from './list-editor'
import type { ListEditorHelpers } from './list-editor'
import {
  birthdayBoardViewOptions,
  columnTypes,
  currencyOptions,
  wishlistRecommendationProfileOptions
} from './list-editor/options'
import { ColumnRow, ColumnSummaryRow, SystemColumnRow } from './list-editor/rows'
import {
  inferredBoardSummaryAggregation,
  normalizedBoardFieldOrderKeys,
  orderedStructureFieldEntries
} from './list-editor/structure'
import {
  blankValues,
  choiceId,
  choiceConfigToText,
  dateStringFromField,
  defaultChoiceConfig,
  editableItemColumns,
  itemTitle,
  localDateTimeInputValue,
  normalizeColumnName,
  parseChoiceOptions,
  parseColumnDateValue,
  valuesForItem,
  visibleColumns
} from './lists/helpers'
import { DeleteBoardModal, NewListTemplateModal, PromptModal } from './modals/appModals'
import { ConfirmActionModal, MessageModal } from './modals/dialogs'
import { BoardRailContextMenu, TreeContextMenu } from './navigation/contextMenus'
import type { TreeContextMenuHelpers } from './navigation/contextMenus'
import { WidgetEditorPanel } from './widget-editor'
import type { WidgetEditorHelpers } from './widget-editor'
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
  WeatherApproximateLocation,
  WeatherLocationSearchResult,
  WishlistRecommendationProfile,
  WorldClockLocation
} from '@shared/domain'
import HelpModal from './help/HelpModal'
import { getListTemplateModule } from './templates/registry'
import type { BoardDisplayColumn } from './templates/types'
import { tutorialSteps } from './tutorial/tutorialContent'
import {
  clamp,
  compactWidgetSummary,
  defaultConfigForWidgetType,
  defaultWeatherConfig,
  defaultWorldClockConfig,
  WidgetRenderer,
  weatherLocationSearchError,
  widgetAspectSpec,
  widgetGridForScale,
  widgetScaleBounds,
  WidgetTypeIcon,
  widgetTypeLabel,
  widgetTypes
} from './widgets'

type FormValues = Record<string, FieldValue>

const sharedItemEditorHelpers = {
  blankValues,
  editableItemColumns,
  groupOptions,
  isProjectMilestoneLikeType: projectIsMilestoneLikeType,
  itemTitle,
  projectEditableFieldColumns: projectEditableColumns,
  projectParentOptions: projectParentSelectionOptions,
  projectRootItemsForBucket: projectRootBucketItems,
  projectTypeFromValues: projectTypeFromProjectValues,
  renderProjectDependencyItemRows: renderProjectDependencyRows,
  submitProjectAwareItemMutation: submitProjectMutation,
  valuesForItem,
  wishlistScoreTooltip
}


const columnSortOrderOptions: Array<{ value: ColumnSortOrder; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'manual', label: 'Manual' },
  { value: 'name', label: 'By Name' },
  { value: 'field_type', label: 'By Field Type' },
  { value: 'required', label: 'By Required' },
  { value: 'visibility', label: 'By Visibility' }
]
const MIN_LIST_GRID_WIDTH = 2
const MIN_LIST_GRID_HEIGHT = 2
const themeOptions: Array<{ value: AppTheme; label: string; className: string }> = [
  { value: 'midnight_clear', label: 'Midnight Clear', className: 'theme-midnight-clear' },
  { value: 'liquid_gunmetal', label: 'Liquid Gunmetal', className: 'theme-liquid-gunmetal' },
  { value: 'black_glass_blue', label: 'Black Glass Blue', className: 'theme-black-glass-blue' }
]
const defaultAppSettings: AppSettings = {
  closeConfirmationMode: 'with_comments',
  theme: 'midnight_clear',
  addColumnOnTopByBoard: {},
  wizardCompleted: false,
  tutorialCompleted: false
}
const listTemplateOptions: Array<{ value: ListTemplateType; label: string; description: string }> = [
  { value: 'todo', label: 'To Do', description: 'Tasks with deadlines, priority, people, effort, progress and comments.' },
  { value: 'shopping_list', label: 'Shopping List', description: 'Products, pieces, store, needed-by date, price, calculated cost and link.' },
  { value: 'wishlist', label: 'Wishlist', description: 'Desired products with links and a fun Wishmeter ranking.' },
  { value: 'project', label: 'Project', description: 'High-level project tracking with hierarchy, milestones, dependencies, and gantt context.' },
  { value: 'health', label: 'Health', description: 'One health list with check-ups, recurring appointments, investigations and treatment.' },
  { value: 'trips_events', label: 'Trips & Events', description: 'Plans with start/end dates, type, topic and location.' },
  { value: 'birthday_calendar', label: 'Birthday Calendar', description: 'Birthdays with turning age, location and gift-task action.' },
  { value: 'custom', label: 'Build Custom List', description: 'Start with a single title field and shape the rest yourself.' }
]

type WizardTemplateType = Exclude<ListTemplateType, 'custom'>
type WizardMode = 'firstRun' | 'quickAdd' | 'newBoard' | 'reset'
type WizardStepId = 'mode' | 'welcome' | 'templates' | 'lists' | 'specifics' | 'sorting' | 'finalTouches' | 'widgets' | 'done'
type WizardListDraft = {
  id: string
  templateType: WizardTemplateType
  name: string
  sortField: string
  sortDirection: ListSortDirection
  displayEnabled: boolean
  dueDateEnabled: boolean
  deadlineMandatory: boolean
}
type WizardWidgetDraft = {
  id: string
  name: string
  type: WidgetType
  displayEnabled: boolean
  layout: string
}
type WizardGrid = { x: number; y: number; w: number; h: number }
type WizardLayoutPlan = {
  listGrids: Map<string, WizardGrid>
  widgetGrids: Map<string, WizardGrid>
  unplacedListIds: string[]
  unplacedWidgetIds: string[]
}
type WizardData = {
  mode: WizardMode
  targetBoardId: string | null
  userName: string
  boardName: string
  listDrafts: WizardListDraft[]
  useStoreList: boolean
  storeText: string
  birthdayBoardView: BirthdayBoardView
  widgets: WizardWidgetDraft[]
}
const wizardTemplateOptions = listTemplateOptions.filter((option): option is { value: WizardTemplateType; label: string; description: string } => option.value !== 'custom')
const wizardDefaultTemplates: WizardTemplateType[] = ['todo', 'shopping_list', 'wishlist', 'birthday_calendar']
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
const wizardWidgetLayoutOptions: Record<WidgetType, string[]> = {
  clock: ['Segmented', 'Split Date'],
  weather: ['Default'],
  word_of_day: ['Default'],
  world_clocks: ['Panel'],
  countdown: ['Segmented']
}
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

const sharedListEditorHelpers: ListEditorHelpers = {
  birthdayCoreColumns,
  columnSortOrderOptions,
  defaultListBehavior,
  groupName,
  isBirthdayDateColumn,
  listBehaviorOptions,
  listInput,
  listTemplateConfigForSave,
  listTemplateGridSizes: layoutListTemplateGridSizes,
  listTemplateOptions,
  minListGridHeight: MIN_LIST_GRID_HEIGHT,
  minListGridWidth: MIN_LIST_GRID_WIDTH,
  newestGroup,
  placeListForDisplay: layoutPlaceListForDisplay,
  placeListForDisplaySizes: layoutPlaceListForDisplaySizes,
  sharedItemEditorHelpers,
  sortDirectionOptions,
  statusLabel,
  validDisplayGrid: layoutValidDisplayGrid
}

const sharedTreeContextMenuHelpers: TreeContextMenuHelpers = {
  blankValues,
  editableItemColumns,
  listInput,
  newestGroup,
  newestItem,
  visibleColumns
}

const sharedWidgetEditorHelpers: WidgetEditorHelpers = {
  canPlaceWidgetGrid: layoutCanPlaceWidgetGrid,
  defaultConfigForWidgetType,
  defaultWeatherConfig,
  defaultWorldClockConfig,
  normalizeWidgetDisplayGrid: layoutNormalizeWidgetDisplayGrid,
  weatherLocationSearchError,
  widgetTypes,
  wizardWidgetLayoutOptions,
  worldClockTimeZones
}

const sharedBoardDisplayHelpers: BoardDisplayHelpers = {
  birthdayOccurrenceDate,
  birthdayCoreColumns,
  blankValues,
  boardDisplayRows,
  boardSortMetaForDisplayColumn,
  boardVisibleColumns,
  boardVisibleItemCount,
  collectDaySummaryEntries,
  dayBeforeBirthday,
  deadlineDisplayLabel,
  deadlineRowClass,
  editableItemColumns,
  formatBoardDisplayValue,
  formatGroupCell,
  formatSystemDate,
  isBirthdayDateColumn,
  isSummarySlotDefined,
  itemEditorHelpers: sharedItemEditorHelpers,
  itemTitle,
  listEditorHelpers: sharedListEditorHelpers,
  listSummaryValues,
  localDateTimeInputValue,
  normalizeColumnName,
  orderedBoardRenderFields,
  pointerMoveGrid: layoutPointerMoveGrid,
  pointerMoveWidgetGridWithOffset: layoutPointerMoveWidgetGridWithOffset,
  resizeGrid: layoutResizeGrid,
  resizeWidgetGrid: layoutResizeWidgetGrid,
  sortBoardDisplayRows,
  summaryToneForSlot,
  visibleColumns
}

const sharedWizardHelpers: WizardHelpers = {
  birthdayBoardViewOptions,
  createWizardListDraft,
  createWizardWidgetDraft,
  wizardDefaultSortDirection,
  wizardDefaultTemplates,
  wizardDeadlineApplicable,
  wizardSortDirectionOptions,
  wizardSortOptions,
  wizardSteps,
  wizardTemplateLabel,
  wizardTemplateOptions,
  wizardWidgetLayoutOptions,
  widgetTypes
}

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
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings)
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null)
  const [messageDialog, setMessageDialog] = useState<{ title: string; message: string } | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [tutorialSession, setTutorialSession] = useState<TutorialSession | null>(null)
  const [launchTutorialAfterWizard, setLaunchTutorialAfterWizard] = useState(false)
  const [busy, setBusy] = useState(false)
  const editingBoardId = useRef<string | null>(null)
  const tutorialReturnSelection = useRef<SelectedNode | null>(null)

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
    if (nextRoute === 'admin' && !nextAppSettings.wizardCompleted) setWizardOpen(true)
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

  async function markWizardComplete(mode: WizardMode): Promise<void> {
    if (mode === 'firstRun') {
      const result = await runAction(async () => {
        const resetSnapshot = await window.lpl.resetAppToFirstRun()
        await window.lpl.updateAppSettings({ ...defaultAppSettings, wizardCompleted: true, tutorialCompleted: false })
        return resetSnapshot
      })
      if (result && 'lists' in result) {
        editingBoardId.current = result.id
        setSelectedNode({ kind: 'board', id: result.id })
        await load('admin', result.id)
      }
      setWizardOpen(false)
      return
    }
    if (mode === 'reset') {
      await load('admin', editingBoardId.current)
      setWizardOpen(false)
      return
    }
    await runAction(() => window.lpl.updateAppSettings({ ...appSettings, wizardCompleted: true }))
    setWizardOpen(false)
  }

  async function prepareWizardReset(): Promise<BoardSnapshot | undefined> {
    const result = await runAction(async () => {
      const resetSnapshot = await window.lpl.resetAppToFirstRun()
      await window.lpl.updateAppSettings({ ...defaultAppSettings, wizardCompleted: true, tutorialCompleted: false })
      return resetSnapshot
    })
    if (result && 'lists' in result) {
      editingBoardId.current = result.id
      setSelectedNode({ kind: 'board', id: result.id })
      await load('admin', result.id)
    }
    return result && 'lists' in result ? result : undefined
  }

  async function applyWizard(data: WizardData): Promise<BoardSnapshot | undefined> {
    let hiddenDisplayNames: string[] = []
    const result = await runAction(async () => {
      const baseSnapshot = snapshot
      if (!baseSnapshot) throw new Error('No board is available for the wizard setup.')
      const reuseInitialSeedBoard =
        (data.mode === 'firstRun' || data.mode === 'reset') &&
        (!appSettings.wizardCompleted || data.mode === 'reset') &&
        boards.length === 1 &&
        baseSnapshot.name === 'Life Plan Lite'
      let createdBoardId: string | null = null

      try {
        let nextSnapshot =
          data.mode === 'quickAdd' && data.targetBoardId
            ? await window.lpl.getBoardSnapshot(data.targetBoardId, 'admin')
            : reuseInitialSeedBoard
              ? await window.lpl.updateBoard({
                  boardId: baseSnapshot.id,
                  name: data.boardName,
                  description: '',
                  owner: data.userName,
                  summarySlots: defaultWizardSummarySlots()
                })
              : await window.lpl.createBoard({ name: data.boardName })
        if (!reuseInitialSeedBoard && data.mode !== 'quickAdd') createdBoardId = nextSnapshot.id
        if (data.mode !== 'quickAdd' && !reuseInitialSeedBoard) {
          nextSnapshot = await window.lpl.updateBoard({
            boardId: nextSnapshot.id,
            name: data.boardName,
            description: '',
            owner: data.userName,
            summarySlots: defaultWizardSummarySlots()
          })
        }
        if (reuseInitialSeedBoard) {
          for (const list of [...nextSnapshot.lists]) {
            nextSnapshot = await window.lpl.deleteList(list.id)
          }
          for (const widget of [...nextSnapshot.widgets]) {
            nextSnapshot = await window.lpl.deleteWidget(widget.id)
          }
        }
        const baseOccupied =
          data.mode === 'quickAdd'
            ? [
                ...nextSnapshot.lists.filter((list) => list.displayEnabled).map((list) => list.grid),
                ...nextSnapshot.widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)
              ]
            : []
        const layoutPlan = planWizardBoardLayout(data.listDrafts, data.widgets, baseOccupied)
        const hiddenNames: string[] = []
        const listLayoutUpdates: Parameters<typeof window.lpl.updateBoardLayouts>[0]['lists'] = []
        const widgetLayoutUpdates: Parameters<typeof window.lpl.updateBoardLayouts>[0]['widgets'] = []

        for (const draft of data.listDrafts) {
          const beforeIds = new Set(nextSnapshot.lists.map((list) => list.id))
          nextSnapshot = await window.lpl.createList({
            boardId: nextSnapshot.id,
            name: draft.name,
            templateType: draft.templateType
          })
          const createdList = nextSnapshot.lists.find((list) => !beforeIds.has(list.id)) ?? newestList(nextSnapshot)
          if (!createdList) continue
          const configuredList = configureWizardList(createdList, draft, data, null)
          nextSnapshot = await window.lpl.updateList(configuredList)
          const updatedList = nextSnapshot.lists.find((list) => list.id === createdList.id)
          if (updatedList) {
            const plannedGrid = layoutPlan.listGrids.get(draft.id)
            if (plannedGrid) listLayoutUpdates.push({ listId: updatedList.id, grid: plannedGrid })
            else if (draft.displayEnabled && layoutPlan.unplacedListIds.includes(draft.id)) hiddenNames.push(updatedList.name)
            if (data.useStoreList && draft.templateType === 'shopping_list') {
              const storeColumn = updatedList.columns.find((column) => normalizeColumnName(column.name) === 'store')
              const storeOptions = wizardStoreOptions(data.storeText)
              if (storeColumn && storeOptions.length > 0) {
                nextSnapshot = await window.lpl.updateColumn({
                  columnId: storeColumn.id,
                  name: storeColumn.name,
                  type: 'choice',
                  required: storeColumn.required,
                  maxLength: storeColumn.maxLength,
                  listSummaryEligible: storeColumn.listSummaryEligible,
                  boardSummaryEligible: storeColumn.boardSummaryEligible,
                  choiceConfig: {
                    selection: 'single',
                    ranked: false,
                    options: storeOptions.map((label, index) => ({ id: choiceId(label, index), label, rank: index + 1 }))
                  },
                  dateDisplayFormat: storeColumn.dateDisplayFormat,
                  durationDisplayFormat: storeColumn.durationDisplayFormat,
                  recurrence: storeColumn.recurrence,
                  recurrenceDays: storeColumn.recurrenceDays,
                  currencyCode: storeColumn.currencyCode,
                  showOnBoard: storeColumn.showOnBoard,
                  order: storeColumn.order
                })
              }
            }
          }
        }

        for (const widgetDraft of data.widgets) {
          const beforeIds = new Set(nextSnapshot.widgets.map((widget) => widget.id))
          nextSnapshot = await window.lpl.createWidget({
            boardId: nextSnapshot.id,
            type: widgetDraft.type,
            name: widgetDraft.name
          })
          const createdWidget = nextSnapshot.widgets.find((widget) => !beforeIds.has(widget.id)) ?? newestWidget(nextSnapshot)
          if (!createdWidget) continue
          const config = wizardWidgetConfig(widgetDraft, createdWidget.config)
          nextSnapshot = await window.lpl.updateWidget({
            widgetId: createdWidget.id,
            type: widgetDraft.type,
            name: widgetDraft.name,
            displayEnabled: false,
            grid: { x: 0, y: 0, w: 0, h: 0 },
            config
          })
          const plannedGrid = layoutPlan.widgetGrids.get(widgetDraft.id)
          if (plannedGrid) widgetLayoutUpdates.push({ widgetId: createdWidget.id, grid: plannedGrid })
          else if (widgetDraft.displayEnabled && layoutPlan.unplacedWidgetIds.includes(widgetDraft.id)) hiddenNames.push(widgetDraft.name)
        }

        if (listLayoutUpdates.length > 0 || widgetLayoutUpdates.length > 0) {
          nextSnapshot = await window.lpl.updateBoardLayouts({
            lists: listLayoutUpdates,
            widgets: widgetLayoutUpdates
          })
        }

        if (data.mode !== 'quickAdd' && !reuseInitialSeedBoard) {
          nextSnapshot = await window.lpl.setActiveBoard(nextSnapshot.id)
        }

        await window.lpl.updateAppSettings({ ...appSettings, wizardCompleted: true })
        hiddenDisplayNames = hiddenNames
        return nextSnapshot
      } catch (error) {
        if (createdBoardId) {
          try {
            await window.lpl.deleteBoard({ boardId: createdBoardId, keepBoardId: baseSnapshot.id })
          } catch {}
        } else if (reuseInitialSeedBoard && (data.mode === 'firstRun' || data.mode === 'reset')) {
          try {
            await window.lpl.resetAppToFirstRun()
          } catch {}
        }
        throw error
      }
    })
    if (result && 'lists' in result) {
      editingBoardId.current = result.id
      setSelectedNode({ kind: 'board', id: result.id })
      if ((data.mode === 'firstRun' || data.mode === 'reset') && !appSettings.tutorialCompleted) setLaunchTutorialAfterWizard(true)
      if (hiddenDisplayNames.length > 0) {
        setMessageDialog({
          title: 'Some items were created but not displayed',
          message:
            "The LPL Wizard couldn't resolve a suitable layout configuration given your list & widgets selection. Your lists and widgets have been created, but the following are not currently displayed:\n\n" +
            hiddenDisplayNames.map((name) => `- ${name}`).join('\n') +
            '\n\nUse the live layout to reorganize the board and spaces, and you can change their visibility back on from the edit panel - List Structure.'
        })
      }
      setWizardOpen(true)
      return result
    }
    return undefined
  }

  function openTutorial(): void {
    tutorialReturnSelection.current = selectedNode ?? (snapshot ? { kind: 'board', id: snapshot.id } : null)
    const adminSnapshot = createTutorialSnapshot('admin')
    const displaySnapshot = createTutorialSnapshot('display')
    setTutorialSession({
      scene: 'admin',
      adminSnapshot,
      displaySnapshot,
      boards: createTutorialBoards(adminSnapshot),
      selectedNode: { kind: 'board', id: adminSnapshot.id }
    })
  }

  async function closeTutorial(): Promise<void> {
    await runAction(() => window.lpl.updateAppSettings({ ...appSettings, tutorialCompleted: true }))
    setTutorialSession(null)
    const returnSelection = tutorialReturnSelection.current
    tutorialReturnSelection.current = null
    if (returnSelection) setSelectedNode(returnSelection)
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
  const tutorialOpen = Boolean(tutorialSession)
  const effectiveRoute = tutorialSession?.scene ?? route
  const effectiveSnapshot = tutorialSession ? (tutorialSession.scene === 'display' ? tutorialSession.displaySnapshot : tutorialSession.adminSnapshot) : snapshot
  const effectivePreviewSnapshot = tutorialSession?.displaySnapshot ?? previewSnapshot ?? snapshot
  const effectiveBoards = tutorialSession?.boards ?? boards
  const effectiveSelectedNode = tutorialSession?.selectedNode ?? selectedNode ?? { kind: 'board', id: effectiveSnapshot.id }
  const effectiveBusy = busy || tutorialOpen
  const tutorialRunAction: RunAction = async () => undefined

  const content =
    effectiveRoute === 'display' ? (
      <DisplayBoard
        appSettings={appSettings}
        appThemeClass={currentThemeClass}
        boards={effectiveBoards}
        busy={effectiveBusy}
        helpers={sharedBoardDisplayHelpers}
        runAction={tutorialOpen ? tutorialRunAction : runAction}
        selectedListId={effectiveSelectedNode.kind === 'list' ? effectiveSelectedNode.id : undefined}
        selectedWidgetId={effectiveSelectedNode.kind === 'widget' ? effectiveSelectedNode.id : undefined}
        snapshot={effectiveSnapshot}
        onAdmin={async () => {
          const result = await window.lpl.requestAdminMode()
          if (result.switchInPlace) window.location.hash = '/admin'
        }}
      />
    ) : (
      <AdminApp
      globalMessageDialog={messageDialog}
      setGlobalMessageDialog={setMessageDialog}
      boards={effectiveBoards}
      busy={effectiveBusy}
      displayState={displayState}
      appSettings={appSettings}
      appThemeClass={currentThemeClass}
      previewSnapshot={effectivePreviewSnapshot}
      runAction={tutorialOpen ? tutorialRunAction : runAction}
      tutorialMode={tutorialOpen}
      wizardOpen={wizardOpen}
      onSelectBoard={(boardId) => {
        if (tutorialSession) {
          setTutorialSession((current) => (current ? { ...current, selectedNode: { kind: 'board', id: boardId } } : current))
          return
        }
        editingBoardId.current = boardId
        setSelectedNode({ kind: 'board', id: boardId })
        load('admin', boardId)
      }}
      onApplyWizard={applyWizard}
      onCloseTutorial={() => void closeTutorial()}
      onCloseWizard={() => {
        setWizardOpen(false)
        if (launchTutorialAfterWizard && !appSettings.tutorialCompleted) {
          setLaunchTutorialAfterWizard(false)
          openTutorial()
          return
        }
        setLaunchTutorialAfterWizard(false)
      }}
      onMarkWizardComplete={markWizardComplete}
      onOpenTutorial={openTutorial}
      onOpenWizard={() => setWizardOpen(true)}
      onPrepareWizardReset={prepareWizardReset}
      selectedNode={effectiveSelectedNode}
      setSelectedNode={tutorialSession ? ((value) => setTutorialSession((current) => {
        if (!current) return current
        const nextValue = typeof value === 'function' ? value(current.selectedNode) : value
        return nextValue ? { ...current, selectedNode: nextValue } : current
      })) : setSelectedNode}
      snapshot={effectiveSnapshot}
    />
    )

  return (
    <>
      {content}
      {tutorialSession && (
        <GuidedTutorial
          onClose={closeTutorial}
          scene={tutorialSession.scene}
          selectedNode={tutorialSession.selectedNode}
          setScene={(scene) => setTutorialSession((current) => (current ? { ...current, scene } : current))}
          setSelectedNode={(value) =>
            setTutorialSession((current) => {
              if (!current) return current
              const nextValue = typeof value === 'function' ? value(current.selectedNode) : value
              return nextValue ? { ...current, selectedNode: nextValue } : current
            })
          }
          snapshot={tutorialSession.scene === 'display' ? tutorialSession.displaySnapshot : tutorialSession.adminSnapshot}
        />
      )}
    </>
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
  tutorialMode,
  wizardOpen,
  onSelectBoard,
  onApplyWizard,
  onCloseTutorial,
  onCloseWizard,
  onMarkWizardComplete,
  onOpenTutorial,
  onOpenWizard,
  onPrepareWizardReset,
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
  tutorialMode: boolean
  wizardOpen: boolean
  onSelectBoard: (boardId: string) => void
  onApplyWizard: (data: WizardData) => Promise<BoardSnapshot | undefined>
  onCloseTutorial: () => void
  onCloseWizard: () => void
  onMarkWizardComplete: (mode: WizardMode) => Promise<void>
  onOpenTutorial: () => void
  onOpenWizard: () => void
  onPrepareWizardReset: () => Promise<BoardSnapshot | undefined>
  selectedNode: SelectedNode
  setGlobalMessageDialog: Dispatch<SetStateAction<{ title: string; message: string } | null>>
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [boardMenu, setBoardMenu] = useState<BoardRailMenuState>(null)
  const [boardDeleteDialog, setBoardDeleteDialog] = useState<BoardSummary | null>(null)
  const [newListDialogOpen, setNewListDialogOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
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
        <section className="side-board-section" data-tutorial-id="boards-list">
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
          <button className="icon-button wide" data-tutorial-id="wizard-launch" disabled={busy} onClick={onOpenWizard} type="button">
            <Settings2 size={18} />
            LPL Wizard
          </button>
          <button className="icon-button wide" data-tutorial-id="tutorial-launch" disabled={busy} onClick={() => setHelpOpen(true)} type="button">
            <BookOpenText size={18} />
            Help
          </button>
          <div className="side-action-group" data-tutorial-id="board-display-actions">
            <BoardVisibilityControl busy={busy} displayState={displayState} runAction={runAction} />
            <button
              className="icon-button wide"
              data-tutorial-id="view-here-action"
              onClick={() => {
                if (!tutorialMode) window.location.hash = '/display'
              }}
            >
              <ExternalLink size={18} />
              View Here
            </button>
          </div>
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
            <div className="workspace-edit" data-tutorial-id="edit-panel">
              <header className="pane-heading workspace-heading">
                <div className="pane-heading-inline">
                  <h3>Edit Panel</h3>
                </div>
              </header>
              <PropertyEditor
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
          helpers={sharedTreeContextMenuHelpers}
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
          templates={listTemplateOptions}
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
      {helpOpen && (
        <HelpModal
          onClose={() => setHelpOpen(false)}
          onStartTour={() => {
            setHelpOpen(false)
            onOpenTutorial()
          }}
        />
      )}
      {wizardOpen && (
        <WizardFlow
          boards={boards}
          busy={busy}
          firstRun={!appSettings.wizardCompleted}
          helpers={sharedWizardHelpers}
          logoSrc={lplLogo}
          onApply={onApplyWizard}
          onClose={onCloseWizard}
          onMarkComplete={onMarkWizardComplete}
          onPrepareReset={onPrepareWizardReset}
          setGlobalMessageDialog={setGlobalMessageDialog}
          snapshot={snapshot}
        />
      )}
    </main>
  )
}

function ConfigurationWizard({
  boards,
  busy,
  firstRun,
  onApply,
  onClose,
  onMarkComplete,
  onPrepareReset,
  setGlobalMessageDialog,
  snapshot
}: {
  boards: BoardSummary[]
  busy: boolean
  firstRun: boolean
  onApply: (data: WizardData) => Promise<BoardSnapshot | undefined>
  onClose: () => void
  onMarkComplete: (mode: WizardMode) => Promise<void>
  onPrepareReset: () => Promise<BoardSnapshot | undefined>
  setGlobalMessageDialog: Dispatch<SetStateAction<{ title: string; message: string } | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const [mode, setMode] = useState<WizardMode>(firstRun ? 'firstRun' : 'newBoard')
  const [targetBoardId, setTargetBoardId] = useState(() => boards.find((board) => board.active)?.id ?? snapshot.id)
  const [step, setStep] = useState<WizardStepId>(firstRun ? 'welcome' : 'mode')
  const [userName, setUserName] = useState('User')
  const [boardName, setBoardName] = useState('My Life Plan Lite')
  const [boardNameTouched, setBoardNameTouched] = useState(false)
  const [selectedTemplates, setSelectedTemplates] = useState<WizardTemplateType[]>(wizardDefaultTemplates)
  const [listDrafts, setListDrafts] = useState<WizardListDraft[]>(() => wizardDefaultTemplates.map((templateType) => createWizardListDraft(templateType)))
  const [useStoreList, setUseStoreList] = useState(false)
  const [storeText, setStoreText] = useState('')
  const [birthdayBoardView, setBirthdayBoardView] = useState<BirthdayBoardView>('next_30_days')
  const [widgets, setWidgets] = useState<WizardWidgetDraft[]>([])
  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [resetPrepared, setResetPrepared] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const steps = wizardSteps(listDrafts)
  const currentStepIndex = Math.max(0, steps.indexOf(step))
  const hasShopping = listDrafts.some((list) => list.templateType === 'shopping_list')
  const hasBirthdays = listDrafts.some((list) => list.templateType === 'birthday_calendar')

  function wizardData(): WizardData {
    return {
      mode,
      targetBoardId: mode === 'quickAdd' ? targetBoardId : null,
      userName: userName.trim() || 'User',
      boardName: boardName.trim() || 'My Life Plan Lite',
      listDrafts,
      useStoreList: hasShopping && useStoreList,
      storeText,
      birthdayBoardView,
      widgets
    }
  }

  function startWizardMode(nextMode: WizardMode): void {
    if (nextMode === 'reset') {
      setResetConfirmOpen(true)
      return
    }
    setMode(nextMode)
    setResetPrepared(false)
    if (nextMode === 'quickAdd') {
      setStep('templates')
      setBoardNameTouched(true)
      return
    }
    setStep('welcome')
    setBoardNameTouched(false)
    setBoardName(userName.trim() && userName.trim().toLowerCase() !== 'user' ? `${userName.trim()}'s Life Plan Lite` : 'My Life Plan Lite')
  }

  async function confirmResetMode(): Promise<void> {
    const result = await onPrepareReset()
    if (!result) return
    setResetConfirmOpen(false)
    setResetPrepared(true)
    setMode('reset')
    setStep('welcome')
    setBoardNameTouched(false)
    setBoardName('My Life Plan Lite')
  }

  function setUser(value: string): void {
    setUserName(value)
    if (!boardNameTouched) {
      const trimmed = value.trim()
      setBoardName(trimmed && trimmed.toLowerCase() !== 'user' ? `${trimmed}'s Life Plan Lite` : 'My Life Plan Lite')
    }
  }

  function toggleTemplate(templateType: WizardTemplateType): void {
    setSelectedTemplates((current) => {
      const selected = current.includes(templateType)
      const next = selected ? current.filter((value) => value !== templateType) : [...current, templateType]
      setListDrafts((drafts) => {
        if (selected) return drafts.filter((draft) => draft.templateType !== templateType)
        return [...drafts, createWizardListDraft(templateType)]
      })
      return next
    })
  }

  function updateListDraft(id: string, patch: Partial<WizardListDraft>): void {
    setListDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)))
  }

  function addListDraft(templateType: WizardTemplateType): void {
    if (listDrafts.length >= 16) {
      setGlobalMessageDialog({ title: 'List limit reached', message: 'You can display a maximum of 16 lists on a single board.' })
      return
    }
    setListDrafts((current) => {
      const nextDraft = createWizardListDraft(templateType, current.filter((draft) => draft.templateType === templateType).length + 1)
      const lastMatchingIndex = [...current].reverse().findIndex((draft) => draft.templateType === templateType)
      if (lastMatchingIndex < 0) return [...current, nextDraft]
      const insertAt = current.length - lastMatchingIndex
      const next = [...current]
      next.splice(insertAt, 0, nextDraft)
      return next
    })
  }

  function updateWidgetDraft(id: string, patch: Partial<WizardWidgetDraft>): void {
    setWidgets((current) =>
      current.map((widget) => {
        if (widget.id !== id) return widget
        const type = patch.type ?? widget.type
        const layoutOptions = wizardWidgetLayoutOptions[type]
        const layout = patch.layout ?? (patch.type && !layoutOptions.includes(widget.layout) ? layoutOptions[0] : widget.layout)
        return { ...widget, ...patch, type, layout }
      })
    )
  }

  function addWidgetDraft(): void {
    setWidgets((current) => [...current, createWizardWidgetDraft('New Widget', 'clock')])
  }

  function deleteWidgetDraft(id: string): void {
    setWidgets((current) => current.filter((widget) => widget.id !== id))
  }

  function resetForAnotherBoard(): void {
    setMode('newBoard')
    setStep('welcome')
    setBoardNameTouched(false)
    setBoardName(userName.trim() && userName.trim().toLowerCase() !== 'user' ? `${userName.trim()}'s Life Plan Lite` : 'My Life Plan Lite')
  }

  async function finishWizard(): Promise<void> {
    setSkipDialogOpen(false)
    if (listDrafts.length === 0) {
      setGlobalMessageDialog({ title: 'Choose at least one list', message: 'Please select at least one list type before finishing the wizard.' })
      setStep('templates')
      return
    }
    const result = await onApply(wizardData())
    if (result) setStep('done')
  }

  function goNext(): void {
    if (step === 'templates' && selectedTemplates.length === 0) {
      setGlobalMessageDialog({ title: 'Choose at least one list', message: 'Please select at least one list type to include in your board.' })
      return
    }
    const nextStep = steps[currentStepIndex + 1]
    if (nextStep) setStep(nextStep)
  }

  function goBack(): void {
    const previousStep = steps[currentStepIndex - 1]
    if (previousStep) setStep(previousStep)
  }

  const backplate = (
    <div className="wizard-brand-panel">
      <img alt="Life Plan Lite" className="wizard-logo" src={lplLogo} />
    </div>
  )

  return (
    <div className="wizard-backdrop" role="presentation">
      <div aria-modal="true" className="wizard-card" role="dialog">
        <div className="wizard-body">
          {backplate}
          <div className="wizard-content">
            {step === 'mode' && (
              <section className="wizard-panel">
                <h2>What would you like the wizard to do?</h2>
                <p>Use the wizard to quickly add structure without going through each list tab manually.</p>
                <div className="wizard-mode-grid">
                  <button className="wizard-mode-card" onClick={() => startWizardMode('quickAdd')} type="button">
                    <strong>Quick-add lists</strong>
                    <small>Add several configured lists to an existing board.</small>
                    <select disabled={busy} onClick={(event) => event.stopPropagation()} onChange={(event) => setTargetBoardId(event.target.value)} value={targetBoardId}>
                      {boards.map((board) => (
                        <option key={board.id} value={board.id}>
                          {board.name}{board.active ? ' (active)' : ''}
                        </option>
                      ))}
                    </select>
                  </button>
                  <button className="wizard-mode-card" onClick={() => startWizardMode('newBoard')} type="button">
                    <strong>Create a new board</strong>
                    <small>Build a new board without touching existing boards or data.</small>
                  </button>
                  <button className="wizard-mode-card danger" onClick={() => startWizardMode('reset')} type="button">
                    <strong>Reset to first run</strong>
                    <small>Clear all boards and data after confirmation, then rebuild or leave the app empty.</small>
                  </button>
                </div>
              </section>
            )}

            {step === 'welcome' && (
              <section className="wizard-panel">
                <h2>{mode === 'firstRun' ? 'Hello and welcome to Life Plan Lite!' : mode === 'reset' ? 'Let’s rebuild Life Plan Lite!' : 'Let’s configure a new board!'}</h2>
                <p>
                  {mode === 'firstRun'
                    ? 'Let’s take a moment to configure your app! This quick setup tutorial will help you understand the key features and functionalities of LPL and guide you through the process of creating your first board.'
                    : mode === 'reset'
                      ? 'The app has already been cleared to first-run state. You can rebuild from the wizard now, close it and configure the board manually, or come back to the wizard later.'
                      : 'Let’s create another board using the same quick configuration flow. Existing boards and data will not be changed.'}
                </p>
                <p className="wizard-lead">Let&apos;s start with the basics:</p>
                <div className="wizard-form-grid">
                  <label>
                    <span>Who is using this board?</span>
                    <input disabled={busy} onChange={(event) => setUser(event.target.value)} value={userName} />
                  </label>
                  <label>
                    <span>How would you like the board to be called?</span>
                    <input
                      disabled={busy}
                      onChange={(event) => {
                        setBoardNameTouched(true)
                        setBoardName(event.target.value)
                      }}
                      value={boardName}
                    />
                  </label>
                </div>
              </section>
            )}

            {step === 'templates' && (
              <section className="wizard-panel">
                <h2>Let&apos;s chose the list types you plan to use!</h2>
                <p>Please select from the option below the types of lists you want to be included in your board:</p>
                <div className="wizard-template-grid">
                  {wizardTemplateOptions.map((option) => {
                    const selected = selectedTemplates.includes(option.value)
                    return (
                      <button className={selected ? 'wizard-template-card selected' : 'wizard-template-card'} key={option.value} onClick={() => toggleTemplate(option.value)} type="button">
                        <span className="wizard-check">{selected ? <Check size={13} /> : null}</span>
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="wizard-note">You can always add more lists based on those templates at a later point, in the LPL Edit Menu</p>
              </section>
            )}

            {step === 'lists' && (
              <section className="wizard-panel">
                <h2>Let&apos;s define and name your lists!</h2>
                <p>You can choose to create one or more lists of each type by clicking the &quot;+&quot; next to the list.</p>
                <div className="wizard-table-scroll">
                  <div className="wizard-table two-col">
                    <strong>List Type</strong>
                    <strong>List Name</strong>
                    <span />
                    {listDrafts.map((draft, index) => {
                      const firstOfType = listDrafts.findIndex((candidate) => candidate.templateType === draft.templateType) === index
                      return (
                        <div className="wizard-table-row" key={draft.id}>
                          <input disabled readOnly value={wizardTemplateLabel(draft.templateType)} />
                          <input disabled={busy} onChange={(event) => updateListDraft(draft.id, { name: event.target.value })} value={draft.name} />
                          {firstOfType ? (
                            <button className="wizard-round-button" disabled={busy || listDrafts.length >= 16} onClick={() => addListDraft(draft.templateType)} title="Add another list of this type" type="button">
                              <Plus size={14} />
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <p className="wizard-note">Note: You can create as many lists as you like, but you can only have a maximum of 16 lists displayed at any time in a single board</p>
              </section>
            )}

            {step === 'specifics' && (
              <section className="wizard-panel">
                <h2>A couple list-specific settings...</h2>
                {hasShopping && (
                  <div className="wizard-question-block">
                    <p className="wizard-question">Do you want to define a list of stores to be used with the Shopping List?</p>
                    <p className="wizard-helper">Having this list defined doesn&apos;t force you to always add a store or to only use entries from this field. It just makes it easier to build some quick lists per store. You can always change this option later, in the Edit Panel - List Structure.</p>
                    <div className="wizard-radio-row">
                      <label className="wizard-radio">
                        <input checked={useStoreList} disabled={busy} onChange={() => setUseStoreList(true)} type="radio" />
                        <span>Yes</span>
                      </label>
                      <textarea disabled={busy || !useStoreList} onChange={(event) => setStoreText(event.target.value)} value={storeText} />
                      <label className="wizard-radio">
                        <input checked={!useStoreList} disabled={busy} onChange={() => setUseStoreList(false)} type="radio" />
                        <span>No, maybe later</span>
                      </label>
                    </div>
                    <p className="wizard-note compact">Please add one item per row</p>
                  </div>
                )}
                {hasBirthdays && (
                  <div className="wizard-question-block">
                    <p className="wizard-question">What interval do you want to use for upcoming birthdays?</p>
                    <select disabled={busy} onChange={(event) => setBirthdayBoardView(event.target.value as BirthdayBoardView)} value={birthdayBoardView}>
                      {birthdayBoardViewOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="wizard-note compact">You can always change this option later, in the Edit Panel - List Structure</p>
                  </div>
                )}
              </section>
            )}

            {step === 'sorting' && (
              <section className="wizard-panel">
                <h2>Let&apos;s also define the sort order for you lists</h2>
                <p>Define the default ordering criteria for each list.</p>
                <div className="wizard-table-scroll">
                  <div className="wizard-table three-col">
                    <strong>List Name</strong>
                    <strong>Sort by</strong>
                    <strong>Sorting Order</strong>
                    {listDrafts.map((draft) => {
                      const options = wizardSortOptions(draft.templateType)
                      const birthdayLocked = draft.templateType === 'birthday_calendar'
                      return (
                        <div className="wizard-table-row" key={draft.id}>
                          <input disabled readOnly value={draft.name} />
                          <select disabled={busy || birthdayLocked} onChange={(event) => updateListDraft(draft.id, { sortField: event.target.value, sortDirection: wizardDefaultSortDirection(draft.templateType, event.target.value) })} value={draft.sortField}>
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <select disabled={busy || birthdayLocked || draft.sortField === 'manual'} onChange={(event) => updateListDraft(draft.id, { sortDirection: event.target.value as ListSortDirection })} value={draft.sortDirection}>
                            {wizardSortDirectionOptions(draft.templateType, draft.sortField).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <p className="wizard-note">You can always change this options later, in the Edit Panel - List Structure</p>
              </section>
            )}

            {step === 'finalTouches' && (
              <section className="wizard-panel">
                <h2>Almost there, a couple of final touches!</h2>
                <p>Please select which of the defined lists you want displayed in the board, for which we should enable the “deadline” field and whether this field should be mandatory</p>
                <div className="wizard-table-scroll">
                  <div className="wizard-table final-col">
                    {listDrafts.map((draft) => {
                      const deadlineEnabled = wizardDeadlineApplicable(draft.templateType)
                      return (
                        <div className="wizard-table-row" key={draft.id}>
                          <input disabled readOnly value={draft.name} />
                          <label className="wizard-inline-check">
                            <input checked={draft.displayEnabled} disabled={busy} onChange={(event) => updateListDraft(draft.id, { displayEnabled: event.target.checked })} type="checkbox" />
                            <span>Show</span>
                          </label>
                          {deadlineEnabled ? (
                            <label className="wizard-inline-check">
                              <input checked={draft.dueDateEnabled} disabled={busy} onChange={(event) => updateListDraft(draft.id, { dueDateEnabled: event.target.checked, deadlineMandatory: event.target.checked ? draft.deadlineMandatory : false })} type="checkbox" />
                              <span>Deadline Enabled</span>
                            </label>
                          ) : (
                            <span className="wizard-na">n/a</span>
                          )}
                          {deadlineEnabled ? (
                            <label className="wizard-inline-check">
                              <input checked={draft.deadlineMandatory} disabled={busy || !draft.dueDateEnabled} onChange={(event) => updateListDraft(draft.id, { deadlineMandatory: event.target.checked })} type="checkbox" />
                              <span>Deadline Mandatory</span>
                            </label>
                          ) : (
                            <span className="wizard-na">n/a</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <p className="wizard-note">Note: the deadline field for the shopping list is labeled as “Needed by” but it shares the same functionality as other deadline fields.</p>
              </section>
            )}

            {step === 'widgets' && (
              <section className="wizard-panel">
                <h2>Widgets! They&apos;re Here!</h2>
                <p>Want to spruce-up your boards? Add some widgets!</p>
                <button className="wizard-add-button" disabled={busy} onClick={addWidgetDraft} type="button">Add Widget</button>
                <p className="wizard-lead">Widgets in you Board:</p>
                {widgets.length > 0 ? (
                  <div className="wizard-table widget-col">
                    <strong>Name</strong>
                    <strong>Type</strong>
                    <strong>Layout</strong>
                    <strong>Show</strong>
                    <span />
                    {widgets.map((widget) => (
                      <div className="wizard-table-row" key={widget.id}>
                        <input disabled={busy} onChange={(event) => updateWidgetDraft(widget.id, { name: event.target.value })} value={widget.name} />
                        <select disabled={busy} onChange={(event) => updateWidgetDraft(widget.id, { type: event.target.value as WidgetType })} value={widget.type}>
                          {widgetTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <select disabled={busy} onChange={(event) => updateWidgetDraft(widget.id, { layout: event.target.value })} value={widget.layout}>
                          {wizardWidgetLayoutOptions[widget.type].map((layout) => (
                            <option key={layout} value={layout}>
                              {layout}
                            </option>
                          ))}
                        </select>
                        <label className="wizard-inline-check">
                          <input checked={widget.displayEnabled} disabled={busy} onChange={(event) => updateWidgetDraft(widget.id, { displayEnabled: event.target.checked })} type="checkbox" />
                          <span>Show</span>
                        </label>
                        <button className="wizard-round-button danger" disabled={busy} onClick={() => deleteWidgetDraft(widget.id)} title="Delete widget" type="button">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="wizard-note">No widgets selected yet. Use Add Widget if you want to include one on this board.</p>
                )}
              </section>
            )}

            {step === 'done' && (
              <section className="wizard-panel">
                <h2>We&apos;re all done!</h2>
                <p>
                  Congratulations, your first board in configured and saved!<br />
                  You can now start using your board and building a <strong>Life <span>Plan</span> Lite!</strong>
                </p>
                <p>Remember, you can always run this wizard again to build new boards, or even to completely reset your LPL to first run state cleaning all the boards and data.</p>
                <div className="wizard-done-actions">
                  <p>Before closing, do you want to create one more board now?</p>
                  <button className="icon-button" disabled={busy} onClick={resetForAnotherBoard} type="button">Let&apos;s build one more board</button>
                  <button className="primary-button" disabled={busy} onClick={onClose} type="button">Let&apos;s get Life <span>Planning!</span></button>
                </div>
              </section>
            )}
          </div>
        </div>
        {step === 'mode' && (
          <footer className="wizard-footer single">
            <button className="wizard-skip" disabled={busy} onClick={onClose} type="button">Close Wizard</button>
          </footer>
        )}
        {step !== 'done' && step !== 'mode' && (
          <footer className="wizard-footer">
            <div className="wizard-footer-left">
              {mode === 'reset' && resetPrepared && step === 'welcome' ? (
                <button className="icon-button wizard-back" disabled={busy} onClick={() => void onMarkComplete(mode)} type="button">Close Wizard</button>
              ) : currentStepIndex > 0 ? (
                <button className="wizard-back" disabled={busy} onClick={goBack} type="button">Back</button>
              ) : (
                <span />
              )}
            </div>
            <div className="wizard-footer-right">
              <button className="wizard-skip" disabled={busy} onClick={() => setSkipDialogOpen(true)} type="button">Skip Configuration Wizard</button>
              {step === 'widgets' ? (
                <button className="primary-button wizard-next" disabled={busy} onClick={() => void finishWizard()} type="button">Finish</button>
              ) : (
                <button className="primary-button wizard-next" disabled={busy} onClick={goNext} type="button">Next</button>
              )}
            </div>
          </footer>
        )}
      </div>
      {skipDialogOpen && (
        <div className="modal-backdrop nested" onClick={() => setSkipDialogOpen(false)} role="presentation">
          <div aria-modal="true" className="modal-card message-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Wizard</p>
                <h3>Close Configuration Wizard?</h3>
              </div>
            </div>
            <div className="modal-body">
              <p>
                {mode === 'reset' && resetPrepared
                  ? 'The reset has already been applied. You can finish rebuilding now, or close the wizard and leave the app empty for manual setup later.'
                  : 'You can apply the information entered so far and create the board now, or close the wizard without applying anything.'}
              </p>
            </div>
            <div className="modal-actions">
              <button className="icon-button" disabled={busy} onClick={() => setSkipDialogOpen(false)} type="button">Continue Wizard</button>
              <button className="icon-button" disabled={busy} onClick={() => void onMarkComplete(mode)} type="button">
                {mode === 'reset' && resetPrepared ? 'Close Wizard' : 'Close Without Applying'}
              </button>
              <button className="primary-button" disabled={busy} onClick={() => void finishWizard()} type="button">Apply Current Setup</button>
            </div>
          </div>
        </div>
      )}
      {resetConfirmOpen && (
        <ConfirmActionModal
          busy={busy}
          confirmLabel="Reset App"
          destructive
          message="This will permanently delete all existing boards, lists, items, widgets, archive entries, and app settings. The app will then return to an empty first-run state. Continue?"
          onCancel={() => setResetConfirmOpen(false)}
          onConfirm={() => void confirmResetMode()}
          title="Reset Life Plan Lite?"
        />
      )}
    </div>
  )
}

function GuidedTutorial({
  onClose,
  scene,
  selectedNode,
  setScene,
  setSelectedNode,
  snapshot
}: {
  onClose: () => void
  scene: TutorialScene
  selectedNode: SelectedNode
  setScene: (scene: TutorialScene) => void
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const steps = tutorialSteps(snapshot)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [contentStepIndex, setContentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [cardVisible, setCardVisible] = useState(false)
  const [contentMasked, setContentMasked] = useState(false)
  const activeStep = steps[Math.min(activeStepIndex, steps.length - 1)]
  const contentStep = steps[Math.min(contentStepIndex, steps.length - 1)]
  const timers = useRef<number[]>([])

  function queueTimer(callback: () => void, delay: number): void {
    const timer = window.setTimeout(() => {
      timers.current = timers.current.filter((entry) => entry !== timer)
      callback()
    }, delay)
    timers.current.push(timer)
  }

  function clearTimers(): void {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
  }

  function goToStep(nextIndex: number): void {
    if (nextIndex < 0 || nextIndex >= steps.length || nextIndex === activeStepIndex) return
    const currentStep = steps[activeStepIndex]
    const nextStep = steps[nextIndex]
    const sameFrame = currentStep.scene === nextStep.scene && currentStep.targetId === nextStep.targetId
    clearTimers()
    setCardVisible(false)
    if (!sameFrame) setContentMasked(true)
    queueTimer(() => {
      setActiveStepIndex(nextIndex)
      queueTimer(
        () => {
          setContentStepIndex(nextIndex)
          if (!sameFrame) setContentMasked(false)
          setCardVisible(true)
        },
        sameFrame ? 180 : 460
      )
    }, 180)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' && activeStepIndex < steps.length - 1) goToStep(activeStepIndex + 1)
      if (event.key === 'ArrowLeft' && activeStepIndex > 0) goToStep(activeStepIndex - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeStepIndex, onClose, steps.length])

  useEffect(() => {
    setCardVisible(false)
    setContentMasked(false)
    queueTimer(() => setCardVisible(true), 420)
    return clearTimers
  }, [])

  useEffect(() => {
    if (!activeStep) return
    if (activeStep.scene !== scene) setScene(activeStep.scene)
    if (activeStep.selection && !sameSelectedNode(selectedNode, activeStep.selection)) {
      setSelectedNode(activeStep.selection)
    }

    const updateTarget = (): void => {
      if (activeStep.clickTargetId) {
        const clickTarget = document.querySelector<HTMLElement>(`[data-tutorial-id="${activeStep.clickTargetId}"]`)
        if (activeStep.activateTarget && clickTarget instanceof HTMLButtonElement) clickTarget.click()
      }
      const target = document.querySelector<HTMLElement>(`[data-tutorial-id="${activeStep.targetId}"]`)
      if (!target) {
        setTargetRect(null)
        return
      }
      if (activeStep.activateTarget && target instanceof HTMLButtonElement) target.click()
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      setTargetRect(target.getBoundingClientRect())
    }

    const timer = window.setTimeout(updateTarget, activeStep.scene === scene ? 40 : 120)
    window.addEventListener('resize', updateTarget)
    window.addEventListener('scroll', updateTarget, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', updateTarget)
      window.removeEventListener('scroll', updateTarget, true)
    }
  }, [activeStep, scene, selectedNode, setScene, setSelectedNode])

  if (!activeStep || !contentStep) {
    return (
      <div className="tutorial-overlay" role="presentation">
        <section aria-modal="true" className="tutorial-card visible" role="dialog">
          <div className="tutorial-card-body">
            <p className="eyebrow">Tutorial</p>
            <h3>Nothing to show yet</h3>
            <p>The guided tour needs an admin workspace to point at.</p>
          </div>
          <div className="tutorial-actions">
            <button className="primary-button" onClick={onClose} type="button">Close Tutorial</button>
          </div>
        </section>
      </div>
    )
  }

  const highlightStyle = activeStep.maskless ? undefined : tutorialHighlightStyle(targetRect)
  const cardStyle = tutorialCardStyle(targetRect, contentStep.centerCard ?? false)
  const maskStyles = activeStep.maskless ? [] : tutorialMaskStyles(targetRect)

  return (
    <div className="tutorial-overlay" role="presentation">
      {maskStyles.map((style, index) => (
        <div className="tutorial-mask" key={index} style={style} />
      ))}
      <div className={contentMasked ? 'tutorial-transition-shroud visible' : 'tutorial-transition-shroud'} />
      {highlightStyle && <div className="tutorial-highlight" style={highlightStyle} />}
      <section aria-modal="true" className={cardVisible ? 'tutorial-card visible' : 'tutorial-card'} role="dialog" style={cardStyle}>
        <div className="tutorial-card-body">
          <p className="eyebrow">Tutorial</p>
          <div className="tutorial-progress">
            <span>Step {contentStepIndex + 1} of {steps.length}</span>
          </div>
          <h3>{contentStep.title}</h3>
          <p>{contentStep.body}</p>
        </div>
        <div className="tutorial-actions">
          <button className="icon-button" onClick={onClose} type="button">Skip Tutorial</button>
          <div className="tutorial-actions-right">
            <button className="icon-button" disabled={activeStepIndex === 0} onClick={() => goToStep(activeStepIndex - 1)} type="button">Back</button>
            {activeStepIndex === steps.length - 1 ? (
              <button className="primary-button" onClick={onClose} type="button">Finish</button>
            ) : (
              <button className="primary-button" onClick={() => goToStep(activeStepIndex + 1)} type="button">Next</button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}


function sameSelectedNode(left: SelectedNode | null, right: SelectedNode | undefined): boolean {
  if (!left || !right) return false
  return left.kind === right.kind && left.id === right.id
}

function tutorialHighlightStyle(rect: DOMRect | null): CSSProperties | undefined {
  if (!rect) return undefined
  const padding = 8
  return {
    top: Math.max(10, rect.top - padding),
    left: Math.max(10, rect.left - padding),
    width: Math.min(window.innerWidth - 20, rect.width + padding * 2),
    height: Math.min(window.innerHeight - 20, rect.height + padding * 2)
  }
}

function tutorialCardStyle(rect: DOMRect | null, centerCard = false): CSSProperties {
  const cardWidth = Math.min(380, window.innerWidth - 32)
  const cardHeight = 270
  if (centerCard || !rect) {
    return {
      top: Math.max(24, Math.round((window.innerHeight - cardHeight) / 2)),
      left: Math.max(16, Math.round((window.innerWidth - cardWidth) / 2)),
      width: cardWidth
    }
  }

  const margin = 16
  const gap = 18
  const belowSpace = window.innerHeight - rect.bottom - margin
  const aboveSpace = rect.top - margin
  const rightSpace = window.innerWidth - rect.right - margin
  const leftSpace = rect.left - margin

  if (belowSpace >= cardHeight) {
    return {
      top: rect.bottom + gap,
      left: clamp(rect.left, margin, window.innerWidth - cardWidth - margin),
      width: cardWidth
    }
  }

  if (aboveSpace >= cardHeight) {
    return {
      top: rect.top - cardHeight - gap,
      left: clamp(rect.left, margin, window.innerWidth - cardWidth - margin),
      width: cardWidth
    }
  }

  if (rightSpace >= cardWidth) {
    return {
      top: clamp(rect.top, margin, window.innerHeight - cardHeight - margin),
      left: rect.right + gap,
      width: cardWidth
    }
  }

  if (leftSpace >= cardWidth) {
    return {
      top: clamp(rect.top, margin, window.innerHeight - cardHeight - margin),
      left: rect.left - cardWidth - gap,
      width: cardWidth
    }
  }

  return {
    top: Math.max(margin, Math.round((window.innerHeight - cardHeight) / 2)),
    left: Math.max(margin, Math.round((window.innerWidth - cardWidth) / 2)),
    width: cardWidth
  }
}

function tutorialMaskStyles(rect: DOMRect | null): CSSProperties[] {
  const base: CSSProperties = {
    position: 'fixed',
    background: 'rgba(0, 3, 6, 0.58)',
    backdropFilter: 'blur(4px) saturate(92%)'
  }
  if (!rect) {
    return [{ ...base, inset: 0 }]
  }
  const padding = 8
  const top = Math.max(0, rect.top - padding)
  const left = Math.max(0, rect.left - padding)
  const right = Math.min(window.innerWidth, rect.right + padding)
  const bottom = Math.min(window.innerHeight, rect.bottom + padding)

  return [
    { ...base, top: 0, left: 0, width: '100vw', height: top },
    { ...base, top, left: 0, width: left, height: Math.max(0, bottom - top) },
    { ...base, top, left: right, width: Math.max(0, window.innerWidth - right), height: Math.max(0, bottom - top) },
    { ...base, top: bottom, left: 0, width: '100vw', height: Math.max(0, window.innerHeight - bottom) }
  ]
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
    <aside className="settings-pane" data-tutorial-id="app-settings">
      <header className="pane-heading">
        <div className="pane-heading-inline">
          <span className="pane-heading-label">Application Settings</span>
        </div>
      </header>
      <div className="display-controls">
        <label data-tutorial-id="close-confirmation">
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
        <label data-tutorial-id="display-target">
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
        <label data-tutorial-id="theme-select">
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
        <button className="icon-button wide" data-tutorial-id="show-board" disabled={busy} onClick={() => runAction(() => window.lpl.hideDisplayWindow())}>
          <EyeOff size={18} />
          Hide Board
        </button>
      ) : (
        <button className="icon-button wide" data-tutorial-id="show-board" disabled={busy} onClick={() => runAction(() => window.lpl.openDisplayWindow())}>
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
    <nav className="tree-pane" aria-label="Board content tree" data-tutorial-id="tree">
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
      <div className="tree-pane-main">
        <div className="tree-section-block" data-tutorial-id="tree-lists-section">
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
        </div>
        <div className="tree-section-block tree-widget-section-block" data-tutorial-id="tree-widgets-section">
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

function PropertyEditor({
  appSettings,
  boards,
  busy,
  runAction,
  selectedNode,
  setSelectedNode,
  snapshot
}: {
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
            appSettings={appSettings}
            busy={busy}
            boards={boards}
            helpers={sharedListEditorHelpers}
            key={selectedList.id}
            list={selectedList}
            runAction={runAction}
            setSelectedNode={setSelectedNode}
            snapshot={snapshot}
          />
        )}
        {selectedNode.kind === 'group' && selectedGroup && selectedList && (
          <GroupEditorPanel
            appSettings={appSettings}
            busy={busy}
            group={selectedGroup}
            itemEditorHelpers={sharedItemEditorHelpers}
            key={selectedGroup.id}
            list={selectedList}
            runAction={runAction}
            snapshot={snapshot}
            visibleColumns={visibleColumns}
          />
        )}
        {selectedNode.kind === 'item' && selectedItem && selectedList && appSettings && (
          <ItemEditorPanel
            appSettings={appSettings}
            busy={busy}
            helpers={sharedItemEditorHelpers}
            item={selectedItem}
            key={selectedItem.id}
            list={selectedList}
            runAction={runAction}
            snapshot={snapshot}
          />
        )}
        {selectedNode.kind === 'widget' && selectedWidget && (
          <WidgetEditorPanel helpers={sharedWidgetEditorHelpers} key={selectedWidget.id} runAction={runAction} setSelectedNode={setSelectedNode} snapshot={snapshot} widget={selectedWidget} />
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
      <div className="editor-tabbar" data-tutorial-id="list-editor-tabs">
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
    <aside className="preview-widget" data-tutorial-id="live-layout">
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
          helpers={sharedBoardDisplayHelpers}
          onListChange={(list, grid) => {
            const sourceList = layoutSnapshot.lists.find((entry) => entry.id === list.id) ?? list
            const placement = layoutResolveListGridChange(sourceList, grid, layoutSnapshot.lists, layoutSnapshot.widgets)
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
            const nextGrid = layoutNormalizeWidgetDisplayGrid(grid, sourceWidget.type, sourceWidget.config)
            const placement = layoutResolveWidgetGridChange(sourceWidget, nextGrid, layoutSnapshot.widgets, layoutSnapshot.lists)
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

function boardColumnLabel(column: ListColumn): string {
  return column.displayName?.trim() || column.name
}

function systemBoardLabel(
  list: BoardList,
  key: 'itemId' | 'dependencies' | 'createdAt' | 'createdBy' | 'status',
  fallback: string
): string {
  return list.templateConfig.systemDisplayNames?.[key]?.trim() || fallback
}

type SystemBoardFieldKey = 'itemId' | 'dependencies' | 'createdAt' | 'createdBy' | 'status'
type BoardRenderFieldEntry =
  | { kind: 'system'; key: `system:${SystemBoardFieldKey}`; field: SystemBoardFieldKey; label: string }
  | { kind: 'display'; key: string; column: BoardDisplayColumn; label: string }

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
  if (templateType === 'project') return [{ w: 10, h: 4 }, { w: 10, h: 3 }, { w: 11, h: 4 }, { w: 12, h: 4 }, { w: 10, h: 2 }]
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

function projectEditableFieldColumns(list: BoardList, columns: ListColumn[], values: FormValues): ListColumn[] {
  if (list.templateType !== 'project') return columns
  const type = projectTypeFromValues(list, values)
  if (!isProjectMilestoneLikeType(type)) return columns
  return columns
    .filter((column) => {
      const normalized = normalizeColumnName(column.name)
      return !['responsible', 'planned end', 'actual end', 'effort', 'output / deliverable'].includes(normalized)
    })
    .map((column) => {
      const normalized = normalizeColumnName(column.name)
      if (normalized === 'planned start') return { ...column, name: 'Planned Date' }
      if (normalized === 'actual start') return { ...column, name: 'Actual Date' }
      return column
    })
}

function boardVisibleColumns(list: BoardList): ListColumn[] {
  if (list.templateType === 'birthday_calendar') {
    return birthdayCoreColumns(list).filter((column) => !isBirthdayBirthYearColumn(column))
  }
  return visibleColumns(list).filter((column) => column.showOnBoard)
}

type SubmitProjectItemMutationInput = {
  mode: 'create' | 'edit'
  item: BoardItem | null
  list: BoardList
  groupId: string | null
  parentItemId: string | null
  values: FormValues
  dependencyItemIds: string[]
}

async function submitProjectAwareItemMutation(input: SubmitProjectItemMutationInput): Promise<BoardSnapshot> {
  if (input.list.templateType !== 'project') {
    if (input.mode === 'edit' && input.item) {
      return window.lpl.updateItem({
        itemId: input.item.id,
        groupId: input.groupId,
        parentItemId: input.parentItemId,
        values: input.values,
        dependencyItemIds: input.dependencyItemIds
      })
    }
    return window.lpl.createItem({
      listId: input.list.id,
      groupId: input.groupId,
      parentItemId: input.parentItemId,
      values: input.values,
      dependencyItemIds: input.dependencyItemIds
    })
  }

  const normalizedValues = normalizeProjectSubmissionValues(input.list, input.values)
  const dependencyAligned = alignProjectMilestonePlannedDate(input.list, normalizedValues, input.dependencyItemIds)
  if (dependencyAligned.message) window.alert(dependencyAligned.message)
  const normalizedParentItemId = isProjectMilestoneLikeType(projectTypeFromValues(input.list, normalizedValues)) ? null : input.parentItemId
  const reconciliation = reconcileProjectParentDateRanges(input.list, input.item, normalizedParentItemId, dependencyAligned.values)
  for (const update of reconciliation.parentUpdates) {
    await window.lpl.updateItem({
      itemId: update.item.id,
      groupId: update.item.groupId,
      parentItemId: update.item.parentItemId,
      values: update.values,
      dependencyItemIds: update.item.dependencyItemIds
    })
  }

  if (input.mode === 'edit' && input.item) {
    return window.lpl.updateItem({
      itemId: input.item.id,
      groupId: input.groupId,
      parentItemId: normalizedParentItemId,
      values: reconciliation.values,
      dependencyItemIds: input.dependencyItemIds
    })
  }

  return window.lpl.createItem({
    listId: input.list.id,
    groupId: input.groupId,
    parentItemId: normalizedParentItemId,
    values: reconciliation.values,
    dependencyItemIds: input.dependencyItemIds
  })
}

function normalizeProjectSubmissionValues(list: BoardList, values: FormValues): FormValues {
  if (list.templateType !== 'project') return values
  const type = projectTypeFromValues(list, values)
  if (!isProjectMilestoneLikeType(type)) return values
  const nextValues = { ...values }
  const columns = projectDateColumns(list)
  if (columns.plannedStart && columns.plannedEnd) {
    nextValues[columns.plannedEnd.id] = nextValues[columns.plannedStart.id] ?? ''
  }
  if (columns.actualStart && columns.actualEnd) {
    nextValues[columns.actualEnd.id] = nextValues[columns.actualStart.id] ?? ''
  }
  for (const column of list.columns) {
    const normalized = normalizeColumnName(column.name)
    if (['responsible', 'effort', 'output / deliverable'].includes(normalized)) {
      nextValues[column.id] = column.type === 'boolean' ? false : column.type === 'choice' && column.choiceConfig?.selection === 'multi' ? [] : ''
    }
  }
  return nextValues
}

function alignProjectMilestonePlannedDate(
  list: BoardList,
  values: FormValues,
  dependencyItemIds: string[]
): { values: FormValues; message: string | null } {
  if (list.templateType !== 'project') return { values, message: null }
  if (projectTypeFromValues(list, values) !== 'milestone') return { values, message: null }
  if (dependencyItemIds.length === 0) return { values, message: null }

  const columns = projectDateColumns(list)
  const plannedStartColumn = columns.plannedStart
  const plannedEndColumn = columns.plannedEnd
  const currentPlannedDate = projectFieldDateValue(values, plannedStartColumn)
  const latestDependencyDate = projectLatestDependencyPlannedDate(list, dependencyItemIds)
  if (!plannedStartColumn || !latestDependencyDate) return { values, message: null }
  if (currentPlannedDate && currentPlannedDate.getTime() >= latestDependencyDate.getTime()) return { values, message: null }

  const nextValues = { ...values }
  nextValues[plannedStartColumn.id] = formatProjectDateForMutation(latestDependencyDate, plannedStartColumn)
  if (plannedEndColumn) nextValues[plannedEndColumn.id] = formatProjectDateForMutation(latestDependencyDate, plannedEndColumn)

  return {
    values: nextValues,
    message: `Milestone planned date was updated to ${projectTimelineLabel(latestDependencyDate)} so it does not fall before the latest planned completion of its dependencies.`
  }
}

function reconcileProjectParentDateRanges(
  list: BoardList,
  item: BoardItem | null,
  parentItemId: string | null,
  values: FormValues
): {
  values: FormValues
  parentUpdates: Array<{ item: BoardItem; values: FormValues }>
} {
  const columns = projectDateColumns(list)
  const parentChain = parentItemId ? projectParentChain(list, parentItemId) : []

  const childPlannedStart = projectFieldDateValue(values, columns.plannedStart)
  const childPlannedEnd = projectFieldDateValue(values, columns.plannedEnd)
  const childActualStart = projectFieldDateValue(values, columns.actualStart)
  const childActualEnd = projectFieldDateValue(values, columns.actualEnd)
  const itemType = projectTypeFromValues(list, values)

  const conflicts = [
    ...projectRangeConflicts(list, parentChain, columns.plannedStart, columns.plannedEnd, childPlannedStart, childPlannedEnd),
    ...projectRangeConflicts(list, parentChain, columns.actualStart, columns.actualEnd, childActualStart, childActualEnd),
    ...(itemType === 'task'
      ? projectTimelineConflicts(list, columns, {
          plannedStart: childPlannedStart,
          plannedEnd: childPlannedEnd,
          actualStart: childActualStart,
          actualEnd: childActualEnd
        })
      : [])
  ]
  if (conflicts.length === 0) return { values, parentUpdates: [] }

  const shouldExtendParents = window.confirm(
    `One or more project dates fall outside the current parent or project timeline.\n\n${conflicts.join('\n')}\n\nPress OK to extend the parent range(s) or project boundary items to fit the child.\nPress Cancel to confine the child dates inside the current ranges.`
  )

  if (shouldExtendParents) {
    return {
      values,
      parentUpdates: [
        ...projectParentRangeUpdates(parentChain, columns, {
          plannedStart: childPlannedStart,
          plannedEnd: childPlannedEnd,
          actualStart: childActualStart,
          actualEnd: childActualEnd
        }),
        ...(itemType === 'task'
          ? projectTimelineBoundaryUpdates(list, columns, {
              plannedStart: childPlannedStart,
              plannedEnd: childPlannedEnd,
              actualStart: childActualStart,
              actualEnd: childActualEnd
            })
          : [])
      ]
    }
  }

  return {
    values: confineProjectChildDatesToTimeline(
      list,
      confineProjectChildDates(values, parentChain, columns),
      columns,
      itemType === 'task'
    ),
    parentUpdates: []
  }
}

function projectDateColumns(list: BoardList): {
  plannedStart: ListColumn | null
  plannedEnd: ListColumn | null
  actualStart: ListColumn | null
  actualEnd: ListColumn | null
} {
  return {
    plannedStart: list.columns.find((column) => normalizeColumnName(column.name) === 'planned start') ?? null,
    plannedEnd: list.columns.find((column) => normalizeColumnName(column.name) === 'planned end') ?? null,
    actualStart: list.columns.find((column) => normalizeColumnName(column.name) === 'actual start') ?? null,
    actualEnd: list.columns.find((column) => normalizeColumnName(column.name) === 'actual end') ?? null
  }
}

function projectParentChain(list: BoardList, parentItemId: string): BoardItem[] {
  const itemsById = projectItemMap(list)
  const chain: BoardItem[] = []
  let cursor = itemsById.get(parentItemId) ?? null
  while (cursor) {
    chain.push(cursor)
    cursor = cursor.parentItemId ? (itemsById.get(cursor.parentItemId) ?? null) : null
  }
  return chain
}

function projectTimelineBoundaryItems(list: BoardList): { projectStart: BoardItem | null; projectEnd: BoardItem | null } {
  const orderedItems = [...list.items].sort((left, right) => left.order - right.order)
  return {
    projectStart: orderedItems.find((item) => projectItemType(item, list) === 'project start') ?? null,
    projectEnd: orderedItems.find((item) => projectItemType(item, list) === 'project end') ?? null
  }
}

function projectFieldDateValue(values: FormValues | Record<string, FieldValue>, column: ListColumn | null): Date | null {
  if (!column) return null
  const raw = dateStringFromField(values[column.id])
  return raw ? parseColumnDateValue(raw, column) : null
}

function formatProjectDateForMutation(date: Date, column: ListColumn | null): string {
  if (!column || column.dateDisplayFormat === 'date') return date.toISOString().slice(0, 10)
  if (column.dateDisplayFormat === 'datetime') return localDateTimeInputValue(date)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function projectRangeConflicts(
  list: BoardList,
  parentChain: BoardItem[],
  startColumn: ListColumn | null,
  endColumn: ListColumn | null,
  childStart: Date | null,
  childEnd: Date | null
): string[] {
  const conflicts: string[] = []
  for (const parent of parentChain) {
    const parentStart = projectFieldDateValue(parent.values, startColumn)
    const parentEnd = projectFieldDateValue(parent.values, endColumn)
    if (childStart && parentStart && childStart.getTime() < parentStart.getTime()) {
      conflicts.push(`${itemTitle(parent, list)} ${startColumn?.name ?? 'Start'} would need to move earlier.`)
    }
    if (childStart && !parentStart && startColumn) {
      conflicts.push(`${itemTitle(parent, list)} is missing ${startColumn.name}.`)
    }
    if (childEnd && parentEnd && childEnd.getTime() > parentEnd.getTime()) {
      conflicts.push(`${itemTitle(parent, list)} ${endColumn?.name ?? 'End'} would need to move later.`)
    }
    if (childEnd && !parentEnd && endColumn) {
      conflicts.push(`${itemTitle(parent, list)} is missing ${endColumn.name}.`)
    }
  }
  return conflicts
}

function projectTimelineConflicts(
  list: BoardList,
  columns: ReturnType<typeof projectDateColumns>,
  childDates: { plannedStart: Date | null; plannedEnd: Date | null; actualStart: Date | null; actualEnd: Date | null }
): string[] {
  const conflicts: string[] = []
  const boundaries = projectTimelineBoundaryItems(list)
  const projectPlannedStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.plannedStart) : null
  const projectPlannedEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.plannedStart) : null
  const projectActualStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.actualStart) : null
  const projectActualEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.actualStart) : null

  if (projectPlannedStart && childDates.plannedStart && childDates.plannedStart.getTime() < projectPlannedStart.getTime()) {
    conflicts.push(`Planned start begins before Project Start (${projectTimelineLabel(projectPlannedStart)}).`)
  }
  if (projectPlannedEnd && childDates.plannedEnd && childDates.plannedEnd.getTime() > projectPlannedEnd.getTime()) {
    conflicts.push(`Planned end falls after Project End (${projectTimelineLabel(projectPlannedEnd)}).`)
  }
  if (projectActualStart && childDates.actualStart && childDates.actualStart.getTime() < projectActualStart.getTime()) {
    conflicts.push(`Actual start begins before Project Start (${projectTimelineLabel(projectActualStart)}).`)
  }
  if (projectActualEnd && childDates.actualEnd && childDates.actualEnd.getTime() > projectActualEnd.getTime()) {
    conflicts.push(`Actual end falls after Project End (${projectTimelineLabel(projectActualEnd)}).`)
  }

  return conflicts
}

function projectParentRangeUpdates(
  parentChain: BoardItem[],
  columns: ReturnType<typeof projectDateColumns>,
  childDates: { plannedStart: Date | null; plannedEnd: Date | null; actualStart: Date | null; actualEnd: Date | null }
): Array<{ item: BoardItem; values: FormValues }> {
  return parentChain
    .map((parent) => {
      const values: FormValues = {}
      const updates: Array<[ListColumn | null, Date | null, Date | null, 'min' | 'max']> = [
        [columns.plannedStart, projectFieldDateValue(parent.values, columns.plannedStart), childDates.plannedStart, 'min'],
        [columns.plannedEnd, projectFieldDateValue(parent.values, columns.plannedEnd), childDates.plannedEnd, 'max'],
        [columns.actualStart, projectFieldDateValue(parent.values, columns.actualStart), childDates.actualStart, 'min'],
        [columns.actualEnd, projectFieldDateValue(parent.values, columns.actualEnd), childDates.actualEnd, 'max']
      ]
      for (const [column, parentDate, childDate, mode] of updates) {
        if (!column || !childDate) continue
        const shouldWrite =
          !parentDate || (mode === 'min' ? childDate.getTime() < parentDate.getTime() : childDate.getTime() > parentDate.getTime())
        if (shouldWrite) values[column.id] = formatProjectDateForMutation(childDate, column)
      }
      return Object.keys(values).length > 0 ? { item: parent, values } : null
    })
    .filter((entry): entry is { item: BoardItem; values: FormValues } => entry !== null)
}

function projectTimelineBoundaryUpdates(
  list: BoardList,
  columns: ReturnType<typeof projectDateColumns>,
  childDates: { plannedStart: Date | null; plannedEnd: Date | null; actualStart: Date | null; actualEnd: Date | null }
): Array<{ item: BoardItem; values: FormValues }> {
  const boundaries = projectTimelineBoundaryItems(list)
  const updates = new Map<string, { item: BoardItem; values: FormValues }>()

  const updateBoundaryDate = (item: BoardItem | null, sourceDate: Date | null, startColumn: ListColumn | null, endColumn: ListColumn | null): void => {
    if (!item || !sourceDate || !startColumn) return
    const current = updates.get(item.id) ?? { item, values: valuesForItem(item, editableItemColumns(list)) }
    current.values[startColumn.id] = formatProjectDateForMutation(sourceDate, startColumn)
    if (endColumn) current.values[endColumn.id] = formatProjectDateForMutation(sourceDate, endColumn)
    updates.set(item.id, current)
  }

  const currentProjectPlannedStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.plannedStart) : null
  const currentProjectPlannedEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.plannedStart) : null
  const currentProjectActualStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.actualStart) : null
  const currentProjectActualEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.actualStart) : null

  if (childDates.plannedStart && (!currentProjectPlannedStart || childDates.plannedStart.getTime() < currentProjectPlannedStart.getTime())) {
    updateBoundaryDate(boundaries.projectStart, childDates.plannedStart, columns.plannedStart, columns.plannedEnd)
  }
  if (childDates.plannedEnd && (!currentProjectPlannedEnd || childDates.plannedEnd.getTime() > currentProjectPlannedEnd.getTime())) {
    updateBoundaryDate(boundaries.projectEnd, childDates.plannedEnd, columns.plannedStart, columns.plannedEnd)
  }
  if (childDates.actualStart && (!currentProjectActualStart || childDates.actualStart.getTime() < currentProjectActualStart.getTime())) {
    updateBoundaryDate(boundaries.projectStart, childDates.actualStart, columns.actualStart, columns.actualEnd)
  }
  if (childDates.actualEnd && (!currentProjectActualEnd || childDates.actualEnd.getTime() > currentProjectActualEnd.getTime())) {
    updateBoundaryDate(boundaries.projectEnd, childDates.actualEnd, columns.actualStart, columns.actualEnd)
  }

  return Array.from(updates.values())
}

function confineProjectChildDates(
  values: FormValues,
  parentChain: BoardItem[],
  columns: ReturnType<typeof projectDateColumns>
): FormValues {
  const nextValues: FormValues = { ...values }
  const confine = (startColumn: ListColumn | null, endColumn: ListColumn | null): void => {
    const lowerBound = parentChain
      .map((parent) => projectFieldDateValue(parent.values, startColumn))
      .filter((entry): entry is Date => entry !== null)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null
    const upperBound = parentChain
      .map((parent) => projectFieldDateValue(parent.values, endColumn))
      .filter((entry): entry is Date => entry !== null)
      .sort((left, right) => left.getTime() - right.getTime())[0] ?? null
    const currentStart = projectFieldDateValue(nextValues, startColumn)
    const currentEnd = projectFieldDateValue(nextValues, endColumn)
    if (startColumn && currentStart && lowerBound && currentStart.getTime() < lowerBound.getTime()) {
      nextValues[startColumn.id] = formatProjectDateForMutation(lowerBound, startColumn)
    }
    if (endColumn && currentEnd && upperBound && currentEnd.getTime() > upperBound.getTime()) {
      nextValues[endColumn.id] = formatProjectDateForMutation(upperBound, endColumn)
    }
  }
  confine(columns.plannedStart, columns.plannedEnd)
  confine(columns.actualStart, columns.actualEnd)
  return nextValues
}

function confineProjectChildDatesToTimeline(
  list: BoardList,
  values: FormValues,
  columns: ReturnType<typeof projectDateColumns>,
  active: boolean
): FormValues {
  if (!active) return values
  const boundaries = projectTimelineBoundaryItems(list)
  const nextValues: FormValues = { ...values }
  const projectPlannedStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.plannedStart) : null
  const projectPlannedEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.plannedStart) : null
  const projectActualStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.actualStart) : null
  const projectActualEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.actualStart) : null

  const confine = (startColumn: ListColumn | null, endColumn: ListColumn | null, lowerBound: Date | null, upperBound: Date | null): void => {
    const currentStart = projectFieldDateValue(nextValues, startColumn)
    const currentEnd = projectFieldDateValue(nextValues, endColumn)
    if (startColumn && currentStart && lowerBound && currentStart.getTime() < lowerBound.getTime()) {
      nextValues[startColumn.id] = formatProjectDateForMutation(lowerBound, startColumn)
    }
    if (endColumn && currentEnd && upperBound && currentEnd.getTime() > upperBound.getTime()) {
      nextValues[endColumn.id] = formatProjectDateForMutation(upperBound, endColumn)
    }
  }

  confine(columns.plannedStart, columns.plannedEnd, projectPlannedStart, projectPlannedEnd)
  confine(columns.actualStart, columns.actualEnd, projectActualStart, projectActualEnd)
  return nextValues
}

function wishlistMissingInputLabel(input: 'wishmeter' | 'priority' | 'price'): string {
  if (input === 'wishmeter') return 'Wishmeter'
  if (input === 'priority') return 'Priority'
  return 'Price'
}

function wishlistScoreTooltip(item: BoardItem): string {
  const recommendation = item.wishlistRecommendation
  if (!recommendation) return 'Buy Score is calculated from Wishmeter, Priority, and Price.'
  if (recommendation.missingInputs.length === 0) {
    return 'Buy Score is calculated from Wishmeter, Priority, and Price using the selected recommendation profile.'
  }
  const missing = recommendation.missingInputs.map(wishlistMissingInputLabel).join(', ')
  return `${missing} ${recommendation.missingInputs.length === 1 ? 'is' : 'are'} missing and ${recommendation.missingInputs.length === 1 ? 'does' : 'do'} not impact the result.`
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

type BoardDisplayRow = { kind: 'group'; group: ItemGroup } | { kind: 'item'; item: BoardItem; depth: number }

function projectTypeColumn(list: BoardList): ListColumn | null {
  return list.columns.find((column) => normalizeColumnName(column.name) === 'type') ?? null
}

function projectItemType(item: BoardItem, list: BoardList): string {
  const typeColumn = projectTypeColumn(list)
  return normalizeColumnName(String((typeColumn ? item.values[typeColumn.id] : 'task') ?? 'task')) || 'task'
}

function projectTypeFromValues(list: BoardList, values: FormValues): string {
  const typeColumn = projectTypeColumn(list)
  const raw = typeColumn ? values[typeColumn.id] : 'task'
  return normalizeColumnName(String(raw ?? 'task')) || 'task'
}

function isProjectMilestoneLikeType(type: string): boolean {
  return type === 'milestone' || type === 'project start' || type === 'project end'
}

function isProjectBoundaryType(type: string): boolean {
  return type === 'project start' || type === 'project end'
}

function projectParentEligible(item: BoardItem, list: BoardList): boolean {
  return list.templateType === 'project' ? projectItemType(item, list) === 'task' : true
}

function projectItemMap(list: BoardList): Map<string, BoardItem> {
  return new Map(list.items.map((item) => [item.id, item]))
}

function projectOrderingDate(item: BoardItem, list: BoardList): Date | null {
  const columns = projectDateColumns(list)
  return (
    projectFieldDateValue(item.values, columns.actualEnd) ??
    projectFieldDateValue(item.values, columns.plannedEnd) ??
    projectFieldDateValue(item.values, columns.actualStart) ??
    projectFieldDateValue(item.values, columns.plannedStart)
  )
}

function projectPlannedCompletionDate(item: BoardItem, list: BoardList): Date | null {
  const columns = projectDateColumns(list)
  return projectFieldDateValue(item.values, columns.plannedEnd) ?? projectFieldDateValue(item.values, columns.plannedStart)
}

function projectLatestSubtreePlannedDate(list: BoardList, item: BoardItem): Date | null {
  const candidateDates = [projectPlannedCompletionDate(item, list)]
  for (const descendantId of projectDescendantIds(list, item.id)) {
    const descendant = list.items.find((entry) => entry.id === descendantId)
    if (descendant) candidateDates.push(projectPlannedCompletionDate(descendant, list))
  }
  return candidateDates
    .filter((entry): entry is Date => entry !== null)
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null
}

function projectLatestDependencyPlannedDate(list: BoardList, dependencyItemIds: string[]): Date | null {
  return dependencyItemIds
    .map((dependencyId) => list.items.find((item) => item.id === dependencyId))
    .filter((item): item is BoardItem => item !== undefined)
    .map((item) => projectLatestSubtreePlannedDate(list, item))
    .filter((entry): entry is Date => entry !== null)
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null
}

function projectDependencyAnchor(list: BoardList, item: BoardItem, peers: BoardItem[]): BoardItem | null {
  if (!isProjectMilestoneLikeType(projectItemType(item, list)) || item.dependencyItemIds.length === 0) return null
  const itemsById = projectItemMap(list)
  const peerSubtrees = peers
    .filter((peer) => peer.id !== item.id)
    .map((peer) => ({ peer, ids: new Set<string>([peer.id, ...projectDescendantIds(list, peer.id)]) }))

  let anchor: BoardItem | null = null
  let latestDate = Number.NEGATIVE_INFINITY
  let latestIndex = -1

  for (const dependencyId of item.dependencyItemIds) {
    const dependency = itemsById.get(dependencyId)
    if (!dependency) continue
    const peerIndex = peerSubtrees.findIndex((candidate) => candidate.ids.has(dependencyId))
    if (peerIndex < 0) continue
    const dependencyDate = projectOrderingDate(dependency, list)?.getTime() ?? Number.NEGATIVE_INFINITY
    if (dependencyDate > latestDate || (dependencyDate === latestDate && peerIndex > latestIndex)) {
      anchor = peerSubtrees[peerIndex].peer
      latestDate = dependencyDate
      latestIndex = peerIndex
    }
  }

  return anchor
}

function projectOrderedPeerItems(list: BoardList, items: BoardItem[]): BoardItem[] {
  const ordered = [...items].sort((left, right) => left.order - right.order)
  const milestoneItems = ordered.filter((item) => isProjectMilestoneLikeType(projectItemType(item, list)))

  for (const milestone of milestoneItems) {
    const anchor = projectDependencyAnchor(list, milestone, ordered)
    if (!anchor || anchor.id === milestone.id) continue
    const currentIndex = ordered.findIndex((candidate) => candidate.id === milestone.id)
    const anchorIndex = ordered.findIndex((candidate) => candidate.id === anchor.id)
    if (currentIndex < 0 || anchorIndex < 0 || currentIndex === anchorIndex + 1) continue
    const [entry] = ordered.splice(currentIndex, 1)
    const nextAnchorIndex = ordered.findIndex((candidate) => candidate.id === anchor.id)
    ordered.splice(nextAnchorIndex + 1, 0, entry)
  }

  return ordered
}

function projectChildItems(list: BoardList, parentItemId: string, groupId: string | null): BoardItem[] {
  return projectOrderedPeerItems(
    list,
    list.items.filter(
      (item) => item.parentItemId === parentItemId && item.groupId === groupId && !isProjectMilestoneLikeType(projectItemType(item, list))
    )
  )
}

function projectRootItemsForBucket(list: BoardList, groupId: string | null): BoardItem[] {
  const itemsById = projectItemMap(list)
  return projectOrderedPeerItems(
    list,
    list.items
      .filter((item) => item.groupId === groupId)
      .filter((item) => !isProjectBoundaryType(projectItemType(item, list)))
      .filter((item) => {
        if (isProjectMilestoneLikeType(projectItemType(item, list))) return true
        if (!item.parentItemId) return true
        const parent = itemsById.get(item.parentItemId)
        return !parent || parent.groupId !== groupId
      })
  )
}

function appendProjectRows(rows: BoardDisplayRow[], list: BoardList, item: BoardItem, depth: number, groupId: string | null): void {
  rows.push({ kind: 'item', item, depth })
  for (const child of projectChildItems(list, item.id, groupId)) {
    appendProjectRows(rows, list, child, depth + 1, groupId)
  }
}

function buildProjectOrderedRows(items: BoardItem[], list: BoardList): Array<{ kind: 'item'; item: BoardItem; depth: number }> {
  const rows: Array<{ kind: 'item'; item: BoardItem; depth: number }> = []
  const groupId = items[0]?.groupId ?? null
  const byId = new Set(items.map((item) => item.id))
  const roots = items.filter((item) => !item.parentItemId || !byId.has(item.parentItemId)).sort((left, right) => left.order - right.order)
  for (const root of roots) appendProjectRows(rows, list, root, 0, groupId)
  return rows
}

function projectDescendantIds(list: BoardList, itemId: string): Set<string> {
  const descendants = new Set<string>()
  const queue = [itemId]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue
    for (const child of list.items.filter((item) => item.parentItemId === current)) {
      if (descendants.has(child.id)) continue
      descendants.add(child.id)
      queue.push(child.id)
    }
  }
  return descendants
}

function projectParentOptions(list: BoardList, currentItemId: string | null): Array<{ id: string; label: string }> {
  const descendants = currentItemId ? projectDescendantIds(list, currentItemId) : new Set<string>()
  const options: Array<{ id: string; label: string }> = []
  const appendItems = (items: BoardItem[], depth: number): void => {
    for (const item of items) {
      if (item.id === currentItemId || descendants.has(item.id)) continue
      if (projectParentEligible(item, list)) {
        options.push({ id: item.id, label: `${'  '.repeat(depth)}${itemTitle(item, list)}` })
      }
      appendItems(projectChildItems(list, item.id, item.groupId), depth + 1)
    }
  }
  const appendGroupBuckets = (parentGroupId: string | null, depth: number): void => {
    for (const group of list.groups.filter((entry) => entry.parentGroupId === parentGroupId).sort((left, right) => left.order - right.order)) {
      appendItems(projectRootItemsForBucket(list, group.id), depth)
      appendGroupBuckets(group.id, depth + 1)
    }
  }
  appendItems(projectRootItemsForBucket(list, null), 0)
  appendGroupBuckets(null, 1)
  return options
}

function renderProjectDependencyItemRows(
  item: BoardItem,
  list: BoardList,
  depth: number,
  currentItemId: string,
  dependencies: string[],
  setDependencies: Dispatch<SetStateAction<string[]>>
): ReactElement {
  const toggle = (itemId: string, checked: boolean): void => {
    setDependencies((current) => (checked ? [...current, itemId] : current.filter((id) => id !== itemId)))
  }
  return (
    <Fragment key={item.id}>
      <div className="dependency-tree-row">
        <label className="dependency-tree-item" style={{ paddingInlineStart: `${0.65 + depth * 1.05}rem` }}>
          <input checked={dependencies.includes(item.id)} onChange={(event) => toggle(item.id, event.target.checked)} type="checkbox" />
          <span>{itemTitle(item, list)}</span>
          <small>{item.displayCode}</small>
        </label>
      </div>
      {projectChildItems(list, item.id, item.groupId)
        .filter((child) => child.id !== currentItemId)
        .map((child) => renderProjectDependencyItemRows(child, list, depth + 1, currentItemId, dependencies, setDependencies))}
    </Fragment>
  )
}

function boardDisplayRows(list: BoardList): BoardDisplayRow[] {
  if (list.templateType === 'birthday_calendar') {
    return birthdayFilteredItems(list).map((item) => ({ kind: 'item', item, depth: 0 }))
  }
  const rows: Array<{ kind: 'group'; group: ItemGroup } | { kind: 'item'; item: BoardItem }> = []
  projectRootItemsForBucket(list, null).forEach((item) => appendProjectRows(rows as BoardDisplayRow[], list, item, 0, null))

  const appendGroupRows = (parentGroupId: string | null): void => {
    list.groups
      .filter((group) => group.parentGroupId === parentGroupId)
      .forEach((group) => {
        const groupItems = projectRootItemsForBucket(list, group.id)
        const hasChildren = list.groups.some((candidate) => candidate.parentGroupId === group.id)
        if (groupItems.length === 0 && !hasChildren) return
        rows.push({ kind: 'group', group })
        groupItems.forEach((item) => appendProjectRows(rows as BoardDisplayRow[], list, item, 0, group.id))
        appendGroupRows(group.id)
      })
  }
  appendGroupRows(null)
  return rows as BoardDisplayRow[]
}

function boardVisibleItemCount(list: BoardList): number {
  if (list.templateType !== 'project') return list.items.length
  return list.items.filter((item) => !isProjectBoundaryType(projectItemType(item, list))).length
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
  if (templateType === 'todo' || templateType === 'project') return 'tasks'
  if (templateType === 'shopping_list' || templateType === 'wishlist') return 'purchases'
  if (templateType === 'health' || templateType === 'trips_events' || templateType === 'birthday_calendar') return 'calendar'
  return 'other'
}

function listTemplateConfigForSave(
  templateType: ListTemplateType,
  behavior: ListBehavior,
  systemDisplayNames: { itemId: string; dependencies: string; createdAt: string; createdBy: string; status: string },
  birthdayBoardView: BirthdayBoardView,
  wishlistProfile: WishlistRecommendationProfile,
  showWishlistAdvisedBuyOrder: boolean,
  wishlistAdvisedBuyOrderDisplayName: string,
  boardFieldOrder: string[] = []
) {
  return {
    behavior: templateType === 'custom' ? behavior : defaultListBehavior(templateType),
    boardFieldOrder,
    systemDisplayNames: {
      itemId: systemDisplayNames.itemId.trim() || null,
      dependencies: systemDisplayNames.dependencies.trim() || null,
      createdAt: systemDisplayNames.createdAt.trim() || null,
      createdBy: systemDisplayNames.createdBy.trim() || null,
      status: systemDisplayNames.status.trim() || null
    },
    ...(templateType === 'birthday_calendar' ? { birthday: { boardView: birthdayBoardView } } : {}),
    ...(templateType === 'wishlist'
      ? {
          wishlist: {
            profile: wishlistProfile,
            showAdvisedBuyOrder: showWishlistAdvisedBuyOrder,
            advisedBuyOrderDisplayName: wishlistAdvisedBuyOrderDisplayName.trim() || null
          }
        }
      : {})
  }
}

function wizardSteps(listDrafts: WizardListDraft[]): WizardStepId[] {
  const needsSpecifics = listDrafts.some((list) => list.templateType === 'shopping_list' || list.templateType === 'birthday_calendar')
  return needsSpecifics
    ? ['welcome', 'templates', 'lists', 'specifics', 'sorting', 'finalTouches', 'widgets', 'done']
    : ['welcome', 'templates', 'lists', 'sorting', 'finalTouches', 'widgets', 'done']
}

function wizardId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function wizardTemplateLabel(templateType: WizardTemplateType): string {
  return wizardTemplateOptions.find((option) => option.value === templateType)?.label ?? 'List'
}

function wizardDefaultListName(templateType: WizardTemplateType, count = 1): string {
  if (templateType === 'todo') return count > 1 ? `To Do ${count}` : 'My “To Do” List'
  if (templateType === 'shopping_list') return count > 1 ? `Shopping List ${count}` : 'Shopping List'
  if (templateType === 'wishlist') return count > 1 ? `Wishlist ${count}` : 'Wishlist'
  if (templateType === 'health') return count > 1 ? `Health ${count}` : 'Health'
  if (templateType === 'trips_events') return count > 1 ? `Trips & Events ${count}` : 'Trips & Events'
  return count > 1 ? `Birthday Calendar ${count}` : 'My Friend’s Birthdays'
}

function createWizardListDraft(templateType: WizardTemplateType, count = 1): WizardListDraft {
  const defaultSort = wizardDefaultSortField(templateType)
  return {
    id: wizardId('wizard-list'),
    templateType,
    name: wizardDefaultListName(templateType, count),
    sortField: defaultSort,
    sortDirection: wizardDefaultSortDirection(templateType, defaultSort),
    displayEnabled: true,
    dueDateEnabled: wizardDeadlineApplicable(templateType),
    deadlineMandatory: false
  }
}

function createWizardWidgetDraft(name: string, type: WidgetType): WizardWidgetDraft {
  return {
    id: wizardId('wizard-widget'),
    name,
    type,
    displayEnabled: true,
    layout: wizardWidgetLayoutOptions[type][0]
  }
}

function wizardDeadlineApplicable(templateType: WizardTemplateType): boolean {
  return templateType === 'todo' || templateType === 'shopping_list'
}

function wizardDefaultSortField(templateType: WizardTemplateType): string {
  if (templateType === 'todo') return 'Priority'
  if (templateType === 'shopping_list') return 'Needed By'
  if (templateType === 'wishlist') return 'Wishmeter'
  if (templateType === 'health') return 'Appointment Date'
  if (templateType === 'trips_events') return 'Start'
  return 'Birthday'
}

function wizardSortOptions(templateType: WizardTemplateType): Array<{ value: string; label: string }> {
  if (templateType === 'todo') return ['Priority', 'Deadline', 'Effort', 'Task Name', 'manual'].map(wizardSortOption)
  if (templateType === 'shopping_list') return ['Needed By', 'Product', 'Store', 'Cost', 'manual'].map(wizardSortOption)
  if (templateType === 'wishlist') return ['Wishmeter', 'Priority', 'Total Cost', 'Product', 'manual'].map(wizardSortOption)
  if (templateType === 'health') return ['Appointment Date', 'Entry', 'manual'].map(wizardSortOption)
  if (templateType === 'trips_events') return ['Start', 'End', 'Type', 'Title', 'manual'].map(wizardSortOption)
  return [{ value: 'Birthday', label: 'Birthday' }]
}

function wizardSortOption(value: string): { value: string; label: string } {
  return { value, label: value === 'manual' ? 'Manual' : value }
}

function wizardDefaultSortDirection(templateType: WizardTemplateType, field: string): ListSortDirection {
  if (field === 'manual') return 'manual'
  if (templateType === 'todo' && field === 'Priority') return 'asc'
  if (templateType === 'wishlist' && field === 'Wishmeter') return 'asc'
  if (templateType === 'wishlist' && field === 'Priority') return 'asc'
  if (['Deadline', 'Needed By', 'Appointment Date', 'Start', 'End', 'Birthday'].includes(field)) return 'asc'
  if (['Effort', 'Cost', 'Price', 'Total Cost'].includes(field)) return 'desc'
  return 'asc'
}

function wizardSortDirectionOptions(templateType: WizardTemplateType, field: string): Array<{ value: Exclude<ListSortDirection, 'manual'>; label: string }> | Array<{ value: ListSortDirection; label: string }> {
  if (field === 'manual') return [{ value: 'manual', label: 'Manual' }]
  if (templateType === 'todo' && field === 'Priority') {
    return [
      { value: 'asc', label: 'Higher Priority on Top' },
      { value: 'desc', label: 'Lower Priority on Top' }
    ]
  }
  if (templateType === 'wishlist' && field === 'Priority') {
    return [
      { value: 'asc', label: 'Higher Priority on Top' },
      { value: 'desc', label: 'Lower Priority on Top' }
    ]
  }
  if (templateType === 'wishlist' && field === 'Wishmeter') {
    return [
      { value: 'asc', label: 'Most Desired on Top' },
      { value: 'desc', label: 'Least Desired on Top' }
    ]
  }
  if (['Deadline', 'Needed By', 'Appointment Date', 'Start', 'End', 'Birthday'].includes(field)) {
    return [
      { value: 'asc', label: 'Soonest to Farthest' },
      { value: 'desc', label: 'Farthest to Soonest' }
    ]
  }
  if (['Effort', 'Cost', 'Price', 'Total Cost'].includes(field)) {
    return [
      { value: 'desc', label: 'Highest to Lowest' },
      { value: 'asc', label: 'Lowest to Highest' }
    ]
  }
  return [
    { value: 'asc', label: 'A to Z' },
    { value: 'desc', label: 'Z to A' }
  ]
}

function defaultWizardSummarySlots(): NonNullable<Parameters<typeof window.lpl.updateBoard>[0]['summarySlots']> {
  const systemSlots: Array<{ label: string; aggregationMethod: AggregationMethod }> = [
    { label: 'Open Tasks', aggregationMethod: 'open_tasks' },
    { label: 'Board Items', aggregationMethod: 'board_items' },
    { label: 'Total Purchases', aggregationMethod: 'total_purchases' },
    { label: 'Overdue Items', aggregationMethod: 'overdue_items' }
  ]
  return Array.from({ length: 8 }, (_, slotIndex) => {
    const system = systemSlots[slotIndex]
    return {
      slotIndex,
      label: system?.label ?? '',
      sourceListId: null,
      sourceColumnId: null,
      aggregationMethod: system?.aggregationMethod ?? 'count'
    }
  })
}

function configureWizardList(
  list: BoardList,
  draft: WizardListDraft,
  data: WizardData,
  grid: WizardGrid | null
): Parameters<typeof window.lpl.updateList>[0] {
  const sortColumn = draft.sortField === 'manual' ? null : list.columns.find((column) => normalizeColumnName(column.name) === normalizeColumnName(draft.sortField))
  const templateConfig = listTemplateConfigForSave(
    list.templateType,
    defaultListBehavior(list.templateType),
    { itemId: '', dependencies: '', createdAt: '', createdBy: '', status: '' },
    data.birthdayBoardView,
    'default',
    false,
    ''
  )
  const birthdayCalendar = draft.templateType === 'birthday_calendar'
  return {
    ...listInput(list),
    name: draft.name.trim() || wizardDefaultListName(draft.templateType),
    templateConfig,
    grid: grid ?? { x: 0, y: 0, w: 0, h: 0 },
    dueDateEnabled: birthdayCalendar ? false : draft.dueDateEnabled,
    dueDateColumnId: list.dueDateColumnId,
    deadlineMandatory: birthdayCalendar ? false : draft.deadlineMandatory,
    sortColumnId: sortColumn?.id ?? null,
    sortDirection: sortColumn ? draft.sortDirection : 'manual',
    displayEnabled: Boolean(grid && draft.displayEnabled)
  }
}

function planWizardBoardLayout(listDrafts: WizardListDraft[], widgets: WizardWidgetDraft[], baseOccupied: WizardGrid[] = []): WizardLayoutPlan {
  type ListLayoutElement = {
    id: string
    templateType: WizardTemplateType
    sizes: Array<{ w: number; h: number }>
    priority: 'todo' | 'fixed' | 'flex'
  }
  type WidgetLayoutElement = {
    id: string
    size: { w: number; h: number }
  }

  const visibleLists = listDrafts.filter((draft) => draft.displayEnabled)
  const visibleWidgets = widgets.filter((widget) => widget.displayEnabled)
  const widgetStripWidth = visibleWidgets.length > 0 ? 4 : 0
  const leftRegionWidth = Math.max(4, 16 - widgetStripWidth)
  const occupied: WizardGrid[] = [...baseOccupied]
  const listGrids = new Map<string, WizardGrid>()
  const widgetGrids = new Map<string, WizardGrid>()
  const unplacedListIds: string[] = []
  const unplacedWidgetIds: string[] = []

  const listElements: ListLayoutElement[] = visibleLists.map((draft) => ({
    id: draft.id,
    templateType: draft.templateType,
    sizes: wizardHasTargetSize(draft.templateType)
      ? wizardPreferredGrids(draft.templateType)
      : wizardFlexibleListSizes(draft, visibleLists, leftRegionWidth),
    priority: draft.templateType === 'todo' ? 'todo' : wizardHasTargetSize(draft.templateType) ? 'fixed' : 'flex'
  }))

  const widgetElements: WidgetLayoutElement[] = visibleWidgets
    .map((widget) => ({ id: widget.id, size: wizardWidgetGridSize(widget) }))
    .sort((left, right) => right.size.h - left.size.h || right.size.w - left.size.w)

  const todoLists = listElements.filter((entry) => entry.priority === 'todo')
  const fixedLists = listElements.filter((entry) => entry.priority === 'fixed')
  const flexLists = listElements.filter((entry) => entry.priority === 'flex')

  for (const entry of todoLists) {
    const placement = placeWizardElement(entry.sizes, occupied, widgetStripWidth > 0 ? 'left' : 'full', 'left')
    if (!placement) {
      unplacedListIds.push(entry.id)
      continue
    }
    occupied.push(placement)
    listGrids.set(entry.id, placement)
  }

  for (const entry of widgetElements) {
    const placement = placeWizardElement([entry.size], occupied, 'right', 'right')
    if (!placement) {
      unplacedWidgetIds.push(entry.id)
      continue
    }
    occupied.push(placement)
    widgetGrids.set(entry.id, placement)
  }

  for (const entry of fixedLists) {
    const placement = placeWizardElement(entry.sizes, occupied, widgetStripWidth > 0 ? 'left' : 'full', 'left')
    if (!placement) {
      unplacedListIds.push(entry.id)
      continue
    }
    occupied.push(placement)
    listGrids.set(entry.id, placement)
  }

  for (const entry of flexLists) {
    const placement = placeWizardElement(entry.sizes, occupied, widgetStripWidth > 0 ? 'left' : 'full', 'left')
    if (!placement) {
      unplacedListIds.push(entry.id)
      continue
    }
    occupied.push(placement)
    listGrids.set(entry.id, placement)
  }

  return { listGrids, widgetGrids, unplacedListIds, unplacedWidgetIds }
}

function placeWizardElement(
  sizes: Array<{ w: number; h: number }>,
  occupied: WizardGrid[],
  region: 'left' | 'right' | 'full',
  anchor: 'left' | 'right'
): WizardGrid | null {
  for (const size of sizes) {
    const positions = wizardCandidatePositions(size, region, anchor)
    for (const candidate of positions) {
      if (occupied.some((grid) => gridsOverlap(grid, candidate))) continue
      return candidate
    }
  }
  return null
}

function wizardCandidatePositions(
  size: { w: number; h: number },
  region: 'left' | 'right' | 'full',
  anchor: 'left' | 'right'
): WizardGrid[] {
  const positions: WizardGrid[] = []
  const yMax = 9 - size.h

  if (region === 'right') {
    const xStart = Math.max(13, 17 - size.w)
    for (let y = 1; y <= yMax; y += 1) {
      for (let x = xStart; x >= 13; x -= 1) {
        if (x + size.w - 1 > 16) continue
        positions.push({ x, y, ...size })
      }
    }
    return positions
  }

  const xLimit = region === 'left' ? 12 : 16
  const xMin = 1
  if (anchor === 'right') {
    for (let y = 1; y <= yMax; y += 1) {
      for (let x = xLimit - size.w + 1; x >= xMin; x -= 1) {
        positions.push({ x, y, ...size })
      }
    }
    return positions
  }

  for (let y = 1; y <= yMax; y += 1) {
    for (let x = xMin; x <= xLimit - size.w + 1; x += 1) {
      positions.push({ x, y, ...size })
    }
  }
  return positions
}

function wizardHasTargetSize(templateType: WizardTemplateType): boolean {
  return templateType === 'todo' || templateType === 'shopping_list' || templateType === 'wishlist' || templateType === 'health' || templateType === 'birthday_calendar'
}

function wizardFlexibleListSizes(draft: WizardListDraft, allVisibleDrafts: WizardListDraft[], availableWidth: number): Array<{ w: number; h: number }> {
  const flexibleDrafts = allVisibleDrafts.filter((entry) => entry.displayEnabled && !wizardHasTargetSize(entry.templateType))
  const maxVisibleColumns = Math.max(1, ...flexibleDrafts.map((entry) => wizardEstimatedVisibleColumnCount(entry)))
  const ownVisibleColumns = wizardEstimatedVisibleColumnCount(draft)
  const preferredWidth = clamp(Math.round((ownVisibleColumns / maxVisibleColumns) * Math.min(6, availableWidth)), 3, Math.min(6, availableWidth))
  const widths = Array.from(new Set([preferredWidth, preferredWidth + 1, preferredWidth - 1, 6, 5, 4, 3].filter((value) => value >= 3 && value <= availableWidth)))
  const heights = [4, 3, 2]
  const sizes: Array<{ w: number; h: number }> = []
  for (const width of widths) {
    for (const height of heights) {
      sizes.push({ w: width, h: height })
    }
  }
  return sizes
}

function wizardEstimatedVisibleColumnCount(draft: WizardListDraft): number {
  if (draft.templateType === 'todo') return draft.dueDateEnabled ? 6 : 5
  if (draft.templateType === 'shopping_list') return draft.dueDateEnabled ? 6 : 5
  if (draft.templateType === 'wishlist') return 4
  if (draft.templateType === 'health') return 4
  if (draft.templateType === 'trips_events') return 4
  return 3
}

function wizardPreferredGrids(templateType: WizardTemplateType): Array<{ w: number; h: number }> {
  if (templateType === 'todo') return [{ w: 6, h: 4 }, { w: 6, h: 3 }, { w: 6, h: 2 }, { w: 5, h: 4 }, { w: 5, h: 3 }, { w: 5, h: 2 }, { w: 4, h: 3 }, { w: 4, h: 2 }]
  if (templateType === 'shopping_list') return [{ w: 4, h: 4 }, { w: 4, h: 3 }, { w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }]
  if (templateType === 'health') return [{ w: 5, h: 4 }, { w: 5, h: 3 }, { w: 4, h: 4 }, { w: 4, h: 3 }, { w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }]
  return [{ w: 6, h: 4 }, { w: 6, h: 3 }, { w: 5, h: 4 }, { w: 5, h: 3 }, { w: 4, h: 4 }, { w: 4, h: 3 }, { w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }]
}

function wizardWidgetGridSize(widget: WizardWidgetDraft): { w: number; h: number } {
  if (widget.type === 'world_clocks') return { w: 2, h: 2 }
  return { w: 2, h: 2 }
}

function wizardStoreOptions(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      const key = line.toLowerCase()
      if (!line || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function createTutorialBoards(snapshot: BoardSnapshot): BoardSummary[] {
  return [
    {
      id: snapshot.id,
      name: snapshot.name,
      description: 'System tutorial board',
      owner: snapshot.owner,
      active: true
    },
    {
      id: 'tutorial-board-alt',
      name: 'Quarterly Focus',
      description: 'Inactive example board',
      owner: snapshot.owner,
      active: false
    }
  ]
}

function createTutorialSnapshot(mode: TutorialScene): BoardSnapshot {
  const boardId = 'tutorial-board'
  const todoListId = 'tutorial-list-todo'
  const workListId = 'tutorial-list-work'
  const shoppingListId = 'tutorial-list-shopping'
  const wishlistListId = 'tutorial-list-wishlist'
  const travelListId = 'tutorial-list-travel'
  const birthdayListId = 'tutorial-list-birthdays'
  const todoGroupId = 'tutorial-group-week'
  const workGroupId = 'tutorial-group-work'

  function createTodoColumns(listId: string, prefix: string): ListColumn[] {
    return [
      tutorialColumn(listId, `${prefix}-col-title`, 'Task Name', 'text', 1, {
        listSummaryEligible: true,
        boardSummaryEligible: true,
        showOnBoard: true
      }),
      tutorialColumn(listId, `${prefix}-col-deadline`, 'Deadline', 'date', 2, {
        listSummaryEligible: true,
        boardSummaryEligible: true,
        role: 'deadline',
        showOnBoard: true
      }),
      tutorialColumn(listId, `${prefix}-col-priority`, 'Priority', 'choice', 3, {
        showOnBoard: true,
        choiceConfig: {
          selection: 'single',
          ranked: true,
          options: [
            { id: `${prefix}-p1`, label: 'High', rank: 1 },
            { id: `${prefix}-p2`, label: 'Medium', rank: 2 },
            { id: `${prefix}-p3`, label: 'Low', rank: 3 }
          ]
        }
      }),
      tutorialColumn(listId, `${prefix}-col-effort`, 'Effort', 'duration', 4, {
        listSummaryEligible: true,
        boardSummaryEligible: true,
        showOnBoard: true,
        durationDisplayFormat: 'hours'
      }),
      tutorialColumn(listId, `${prefix}-col-progress`, '% Done', 'integer', 5, { showOnBoard: true }),
      tutorialColumn(listId, `${prefix}-col-people`, 'People', 'text', 6, { showOnBoard: false }),
      tutorialColumn(listId, `${prefix}-col-details`, 'Details', 'text', 7, { showOnBoard: false })
    ]
  }

  const todoColumns: ListColumn[] = createTodoColumns(todoListId, 'todo')
  const workColumns: ListColumn[] = createTodoColumns(workListId, 'work')

  const shoppingColumns: ListColumn[] = [
    tutorialColumn(shoppingListId, 'shop-col-product', 'Product', 'text', 1, { showOnBoard: true }),
    tutorialColumn(shoppingListId, 'shop-col-pieces', 'Pieces', 'integer', 2, { showOnBoard: true }),
    tutorialColumn(shoppingListId, 'shop-col-price', 'Price / pc', 'currency', 3, {
      showOnBoard: true,
      currencyCode: 'EUR'
    }),
    tutorialColumn(shoppingListId, 'shop-col-cost', 'Cost', 'currency', 4, {
      showOnBoard: true,
      currencyCode: 'EUR',
      listSummaryEligible: true,
      boardSummaryEligible: true
    }),
    tutorialColumn(shoppingListId, 'shop-col-store', 'Store', 'choice', 5, {
      showOnBoard: true,
      choiceConfig: {
        selection: 'single',
        ranked: false,
        options: [
          { id: 'store-1', label: 'Mega Market', rank: 1 },
          { id: 'store-2', label: 'Farmer Market', rank: 2 },
          { id: 'store-3', label: 'Corner Shop', rank: 3 }
        ]
      }
    }),
    tutorialColumn(shoppingListId, 'shop-col-needed', 'Needed By', 'date', 6, {
      showOnBoard: true,
      role: 'deadline'
    })
  ]

  const wishlistColumns: ListColumn[] = [
    tutorialColumn(wishlistListId, 'wish-col-product', 'Product', 'text', 1, {
      showOnBoard: true,
      listSummaryEligible: true,
      boardSummaryEligible: true
    }),
    tutorialColumn(wishlistListId, 'wish-col-pieces', 'Pieces', 'integer', 2, {
      showOnBoard: false
    }),
    tutorialColumn(wishlistListId, 'wish-col-price', 'Price', 'currency', 3, {
      showOnBoard: true,
      currencyCode: 'EUR'
    }),
    tutorialColumn(wishlistListId, 'wish-col-total', 'Total Cost', 'currency', 4, {
      showOnBoard: true,
      currencyCode: 'EUR',
      listSummaryEligible: true,
      boardSummaryEligible: true
    }),
    tutorialColumn(wishlistListId, 'wish-col-wishmeter', 'Wishmeter', 'choice', 5, {
      showOnBoard: true,
      choiceConfig: {
        selection: 'single',
        ranked: true,
        options: [
          { id: 'wish-1', label: "It's so fluffy I'm gonna die!", rank: 1 },
          { id: 'wish-2', label: 'My precious!', rank: 2 },
          { id: 'wish-3', label: 'Shut up and take my money!', rank: 3 },
          { id: 'wish-4', label: 'Gotta get me one of those!', rank: 4 },
          { id: 'wish-5', label: 'Asking for a friend...', rank: 5 }
        ]
      }
    }),
    tutorialColumn(wishlistListId, 'wish-col-priority', 'Priority', 'choice', 6, {
      showOnBoard: true,
      choiceConfig: {
        selection: 'single',
        ranked: true,
        options: [
          { id: 'wish-prio-1', label: 'Highest', rank: 1 },
          { id: 'wish-prio-2', label: 'High', rank: 2 },
          { id: 'wish-prio-3', label: 'Medium', rank: 3 },
          { id: 'wish-prio-4', label: 'Low', rank: 4 },
          { id: 'wish-prio-5', label: 'Lowest', rank: 5 }
        ]
      }
    })
  ]

  const travelColumns: ListColumn[] = [
    tutorialColumn(travelListId, 'trip-col-topic', 'Topic / Theme', 'text', 1, {
      listSummaryEligible: true,
      boardSummaryEligible: true,
      showOnBoard: true
    }),
    tutorialColumn(travelListId, 'trip-col-type', 'Type', 'choice', 2, {
      showOnBoard: true,
      choiceConfig: {
        selection: 'single',
        ranked: false,
        options: [
          { id: 'trip-type-personal', label: 'Personal Time', rank: 1 },
          { id: 'trip-type-event', label: 'Event', rank: 2 },
          { id: 'trip-type-work-trip', label: 'Work Trip', rank: 3 },
          { id: 'trip-type-work-event', label: 'Work Event', rank: 4 },
          { id: 'trip-type-other', label: 'Other', rank: 5 }
        ]
      }
    }),
    tutorialColumn(travelListId, 'trip-col-start', 'Start', 'date', 3, {
      showOnBoard: true,
      role: 'deadline'
    }),
    tutorialColumn(travelListId, 'trip-col-end', 'End', 'date', 4, {
      showOnBoard: true,
      dateDisplayFormat: 'date'
    }),
    tutorialColumn(travelListId, 'trip-col-location', 'Location', 'text', 5, {
      showOnBoard: true
    })
  ]

  const birthdayColumns: ListColumn[] = [
    tutorialColumn(birthdayListId, 'birthday-col-name', 'Name', 'text', 1, {
      listSummaryEligible: true,
      boardSummaryEligible: true,
      showOnBoard: true
    }),
    tutorialColumn(birthdayListId, 'birthday-col-birthday', 'Birthday', 'date', 2, {
      showOnBoard: true,
      role: 'deadline'
    }),
    tutorialColumn(birthdayListId, 'birthday-col-birth-year', 'Birth Year', 'integer', 3, {
      showOnBoard: false
    }),
    tutorialColumn(birthdayListId, 'birthday-col-location', 'Location', 'text', 4, {
      showOnBoard: false
    })
  ]

  return {
    id: boardId,
    name: 'Life Plan Lite Tutorial',
    description: 'Synthetic tutorial walkthrough board',
    owner: 'LPL',
    active: true,
    lists: [
      {
        id: todoListId,
        boardId,
        name: 'My To Do List',
        code: 'L01',
        templateType: 'todo',
        templateConfig: { behavior: 'tasks' },
        order: 1,
        grid: { x: 1, y: 1, w: 6, h: 4 },
        dueDateEnabled: true,
        dueDateColumnId: 'todo-col-deadline',
        deadlineMandatory: false,
        columnSortOrder: 'default',
        sortColumnId: 'todo-col-priority',
        sortDirection: 'asc',
        displayEnabled: true,
        showItemIdOnBoard: false,
        showDependenciesOnBoard: false,
        showCreatedAtOnBoard: false,
        showCreatedByOnBoard: false,
        showStatusOnBoard: true,
        columns: todoColumns,
        groups: [
          {
            id: todoGroupId,
            listId: todoListId,
            parentGroupId: null,
            name: 'This Week',
            code: 'G01',
            order: 1,
            showIdOnBoard: false,
            summaries: []
          }
        ],
        items: [
          tutorialItem(todoListId, 'todo-item-1', 'T01', todoColumns, {
            taskname: 'Prepare release notes',
            deadline: '2026-05-02',
            priority: 'High',
            effort: 90,
            done: 60,
            people: 'Andre',
            details: 'Wrap up the stable notes for the next release.'
          }, {
            deadlineStatus: 'Tomorrow',
            deadlineTone: 'soon',
            groupId: todoGroupId
          }),
          tutorialItem(todoListId, 'todo-item-2', 'T02', todoColumns, {
            taskname: 'Schedule dentist visit',
            deadline: '2026-05-04',
            priority: 'Medium',
            effort: 15,
            done: 10,
            people: 'Andre',
            details: 'Find an afternoon slot.'
          }, {
            deadlineStatus: 'In 3 days',
            deadlineTone: 'ok'
          }),
          tutorialItem(todoListId, 'todo-item-3', 'T03', todoColumns, {
            taskname: 'Renew passport',
            deadline: '2026-05-08',
            priority: 'Low',
            effort: 45,
            done: 0,
            people: 'Andre',
            details: 'Fill in the online request and prepare the documents.'
          }, {
            deadlineStatus: 'Next week',
            deadlineTone: 'ok'
          })
        ]
      },
      {
        id: workListId,
        boardId,
        name: 'Work Priorities',
        code: 'L02',
        templateType: 'todo',
        templateConfig: { behavior: 'tasks' },
        order: 2,
        grid: { x: 1, y: 5, w: 6, h: 4 },
        dueDateEnabled: true,
        dueDateColumnId: 'work-col-deadline',
        deadlineMandatory: false,
        columnSortOrder: 'default',
        sortColumnId: 'work-col-priority',
        sortDirection: 'asc',
        displayEnabled: true,
        showItemIdOnBoard: false,
        showDependenciesOnBoard: false,
        showCreatedAtOnBoard: false,
        showCreatedByOnBoard: false,
        showStatusOnBoard: true,
        columns: workColumns,
        groups: [
          {
            id: workGroupId,
            listId: workListId,
            parentGroupId: null,
            name: 'This Sprint',
            code: 'G01',
            order: 1,
            showIdOnBoard: false,
            summaries: []
          }
        ],
        items: [
          tutorialItem(workListId, 'work-item-1', 'W01', workColumns, {
            taskname: 'Finalize Q2 budget pack',
            deadline: '2026-04-30',
            priority: 'High',
            effort: 120,
            done: 70,
            people: 'Finance',
            details: 'Align the slides and validate the final figures before review.'
          }, {
            deadlineStatus: 'Today',
            deadlineTone: 'urgent',
            groupId: workGroupId
          }),
          tutorialItem(workListId, 'work-item-2', 'W02', workColumns, {
            taskname: 'Prepare summit keynote',
            deadline: '2026-05-03',
            priority: 'High',
            effort: 180,
            done: 35,
            people: 'Marketing',
            details: 'Tighten the story arc and rehearse the opening sequence.'
          }, {
            deadlineStatus: 'In 2 days',
            deadlineTone: 'soon'
          }),
          tutorialItem(workListId, 'work-item-3', 'W03', workColumns, {
            taskname: 'Review vendor proposal',
            deadline: '2026-05-06',
            priority: 'Medium',
            effort: 60,
            done: 15,
            people: 'Operations',
            details: 'Compare the commercial terms and capture follow-up questions.'
          }, {
            deadlineStatus: 'In 5 days',
            deadlineTone: 'ok'
          })
        ]
      },
      {
        id: shoppingListId,
        boardId,
        name: 'Shopping List',
        code: 'L03',
        templateType: 'shopping_list',
        templateConfig: { behavior: 'purchases' },
        order: 3,
        grid: { x: 7, y: 1, w: 6, h: 4 },
        dueDateEnabled: true,
        dueDateColumnId: 'shop-col-needed',
        deadlineMandatory: false,
        columnSortOrder: 'default',
        sortColumnId: 'shop-col-needed',
        sortDirection: 'asc',
        displayEnabled: true,
        showItemIdOnBoard: false,
        showDependenciesOnBoard: false,
        showCreatedAtOnBoard: false,
        showCreatedByOnBoard: false,
        showStatusOnBoard: true,
        columns: shoppingColumns,
        groups: [],
        items: [
          tutorialItem(shoppingListId, 'shop-item-1', 'S01', shoppingColumns, {
            product: 'Milk',
            pieces: 2,
            pricepc: 2.5,
            cost: 5,
            store: 'Mega Market',
            neededby: '2026-05-01'
          }, {
            deadlineStatus: 'Today',
            deadlineTone: 'urgent'
          }),
          tutorialItem(shoppingListId, 'shop-item-2', 'S02', shoppingColumns, {
            product: 'Eggs',
            pieces: 1,
            pricepc: 4.2,
            cost: 4.2,
            store: 'Farmer Market',
            neededby: '2026-05-01'
          }, {
            deadlineStatus: 'Today',
            deadlineTone: 'urgent'
          }),
          tutorialItem(shoppingListId, 'shop-item-3', 'S03', shoppingColumns, {
            product: 'Tomatoes',
            pieces: 1,
            pricepc: 3.8,
            cost: 3.8,
            store: 'Farmer Market',
            neededby: '2026-05-02'
          }, {
            deadlineStatus: 'Tomorrow',
            deadlineTone: 'soon'
          }),
          tutorialItem(shoppingListId, 'shop-item-4', 'S04', shoppingColumns, {
            product: 'Pasta',
            pieces: 3,
            pricepc: 1.6,
            cost: 4.8,
            store: 'Corner Shop',
            neededby: '2026-05-04'
          }, {
            deadlineStatus: 'In 3 days',
            deadlineTone: 'ok'
          })
        ]
      },
      {
        id: wishlistListId,
        boardId,
        name: 'Wishlist',
        code: 'L03B',
        templateType: 'wishlist',
        templateConfig: { behavior: 'purchases', wishlist: { profile: 'default', showAdvisedBuyOrder: true } },
        order: 3.5,
        grid: { x: 0, y: 0, w: 0, h: 0 },
        dueDateEnabled: false,
        dueDateColumnId: null,
        deadlineMandatory: false,
        columnSortOrder: 'default',
        sortColumnId: 'wish-col-wishmeter',
        sortDirection: 'asc',
        displayEnabled: false,
        showItemIdOnBoard: false,
        showDependenciesOnBoard: false,
        showCreatedAtOnBoard: false,
        showCreatedByOnBoard: false,
        showStatusOnBoard: false,
        columns: wishlistColumns,
        groups: [],
        items: [
          {
            ...tutorialItem(wishlistListId, 'wish-item-1', 'WL01', wishlistColumns, {
              product: 'Home espresso machine',
              pieces: 1,
              price: 450,
              totalcost: 450,
              wishmeter: 'Gotta get me one of those!',
              priority: 'Highest'
            }, {
              deadlineStatus: '',
              deadlineTone: 'none'
            }),
            wishlistRecommendation: { buyScore: 0.91, advisedBuyOrder: 1, missingInputs: [] }
          },
          {
            ...tutorialItem(wishlistListId, 'wish-item-2', 'WL02', wishlistColumns, {
              product: 'QD-OLED monitor pair',
              pieces: 2,
              price: 1000,
              totalcost: 2000,
              wishmeter: "It's so fluffy I'm gonna die!",
              priority: 'High'
            }, {
              deadlineStatus: '',
              deadlineTone: 'none'
            }),
            wishlistRecommendation: { buyScore: 0.68, advisedBuyOrder: 2, missingInputs: [] }
          },
          {
            ...tutorialItem(wishlistListId, 'wish-item-3', 'WL03', wishlistColumns, {
              product: 'Sensor light sets',
              pieces: 10,
              price: 25,
              totalcost: 250,
              wishmeter: 'My precious!',
              priority: 'Medium'
            }, {
              deadlineStatus: '',
              deadlineTone: 'none'
            }),
            wishlistRecommendation: { buyScore: 0.73, advisedBuyOrder: 3, missingInputs: [] }
          }
        ]
      },
      {
        id: travelListId,
        boardId,
        name: 'Vacation & Events',
        code: 'L04',
        templateType: 'trips_events',
        templateConfig: { behavior: 'calendar' },
        order: 4,
        grid: { x: 7, y: 5, w: 6, h: 2 },
        dueDateEnabled: false,
        dueDateColumnId: null,
        deadlineMandatory: false,
        columnSortOrder: 'default',
        sortColumnId: 'trip-col-start',
        sortDirection: 'asc',
        displayEnabled: true,
        showItemIdOnBoard: false,
        showDependenciesOnBoard: false,
        showCreatedAtOnBoard: false,
        showCreatedByOnBoard: false,
        showStatusOnBoard: true,
        columns: travelColumns,
        groups: [],
        items: [
          tutorialItem(travelListId, 'trip-item-1', 'E01', travelColumns, {
            topictheme: 'Summer getaway in Crete',
            type: 'Personal Time',
            start: '2026-08-15',
            end: '2026-08-22',
            location: 'Heraklion'
          }, {
            deadlineStatus: 'Aug 15',
            deadlineTone: 'ok'
          }),
          tutorialItem(travelListId, 'trip-item-2', 'E02', travelColumns, {
            topictheme: 'Bucharest Growth Summit',
            type: 'Work Event',
            start: '2026-06-18',
            end: '2026-06-19',
            location: 'Bucharest'
          }, {
            deadlineStatus: 'Jun 18',
            deadlineTone: 'ok'
          })
        ]
      },
      {
        id: birthdayListId,
        boardId,
        name: 'Upcoming Birthdays',
        code: 'L05',
        templateType: 'birthday_calendar',
        templateConfig: { behavior: 'calendar', birthday: { boardView: 'next_30_days' } },
        order: 5,
        grid: { x: 7, y: 7, w: 6, h: 2 },
        dueDateEnabled: false,
        dueDateColumnId: null,
        deadlineMandatory: false,
        columnSortOrder: 'default',
        sortColumnId: 'birthday-col-birthday',
        sortDirection: 'asc',
        displayEnabled: true,
        showItemIdOnBoard: false,
        showDependenciesOnBoard: false,
        showCreatedAtOnBoard: false,
        showCreatedByOnBoard: false,
        showStatusOnBoard: true,
        columns: birthdayColumns,
        groups: [],
        items: [
          tutorialItem(birthdayListId, 'birthday-item-1', 'B01', birthdayColumns, {
            name: 'Mara',
            birthday: '1994-05-02',
            birthyear: 1994,
            location: 'Cluj'
          }, {
            deadlineStatus: 'May 2',
            deadlineTone: 'soon'
          }),
          tutorialItem(birthdayListId, 'birthday-item-2', 'B02', birthdayColumns, {
            name: 'Victor',
            birthday: '1989-05-11',
            birthyear: 1989,
            location: 'Brasov'
          }, {
            deadlineStatus: 'May 11',
            deadlineTone: 'ok'
          }),
          tutorialItem(birthdayListId, 'birthday-item-3', 'B03', birthdayColumns, {
            name: 'Elena',
            birthday: '1992-05-24',
            birthyear: 1992,
            location: 'Bucharest'
          }, {
            deadlineStatus: 'May 24',
            deadlineTone: 'ok'
          })
        ]
      }
    ],
    widgets: [
      {
        id: 'tutorial-widget-clock',
        boardId,
        type: 'clock',
        name: 'Local Time',
        order: 1,
        displayEnabled: true,
        grid: { x: 13, y: 1, w: 2, h: 2 },
        config: { clock: { showSeconds: false, style: 'segmented' } }
      },
      {
        id: 'tutorial-widget-weather',
        boardId,
        type: 'weather',
        name: 'Weather',
        order: 2,
        displayEnabled: true,
        grid: { x: 15, y: 1, w: 2, h: 2 },
        config: { weather: defaultWeatherConfig() }
      },
      {
        id: 'tutorial-widget-world',
        boardId,
        type: 'world_clocks',
        name: 'World Clock',
        order: 3,
        displayEnabled: true,
        grid: { x: 13, y: 3, w: 4, h: 2 },
        config: {
          worldClocks: {
            locations: [
              { id: 'bucharest', label: 'Bucharest', timeZone: 'Europe/Bucharest' },
              { id: 'new-york', label: 'New York', timeZone: 'America/New_York' }
            ],
            showSeconds: false,
            style: 'panel'
          }
        }
      },
      {
        id: 'tutorial-widget-word',
        boardId,
        type: 'word_of_day',
        name: 'Word of the Day',
        order: 4,
        displayEnabled: true,
        grid: { x: 13, y: 5, w: 4, h: 2 },
        config: { wordOfDay: { accent: '#34d51d' } }
      },
      {
        id: 'tutorial-widget-countdown',
        boardId,
        type: 'countdown',
        name: 'Countdown to Vacation',
        order: 5,
        displayEnabled: true,
        grid: { x: 13, y: 7, w: 4, h: 2 },
        config: {
          countdown: {
            label: 'Vacation',
            targetAt: '2026-08-15T09:00',
            style: 'segmented'
          }
        }
      }
    ],
    summarySlots: [
      tutorialSummarySlot(0, 'Open Tasks', 'open_tasks', '6'),
      tutorialSummarySlot(1, 'Board Items', 'board_items', '15'),
      tutorialSummarySlot(2, 'Total Purchases', 'total_purchases', '17.80 EUR'),
      tutorialSummarySlot(3, 'Upcoming Birthdays', 'count', '3')
    ],
    mode,
    generatedAt: '2026-04-28T08:00:00.000Z'
  }
}

function tutorialSummarySlot(slotIndex: number, label: string, aggregationMethod: AggregationMethod, value: string): SummarySlot {
  return {
    slotIndex,
    label,
    sourceListId: null,
    sourceColumnId: null,
    aggregationMethod,
    value
  }
}

function tutorialColumn(
  listId: string,
  id: string,
  name: string,
  type: ColumnType,
  order: number,
  options: {
    listSummaryEligible?: boolean
    boardSummaryEligible?: boolean
    role?: 'deadline'
    choiceConfig?: ChoiceConfig
    dateDisplayFormat?: DateDisplayFormat
    durationDisplayFormat?: DurationDisplayFormat
    currencyCode?: CurrencyCode
    showOnBoard?: boolean
    required?: boolean
  } = {}
): ListColumn {
  return {
    id,
    listId,
    name,
    displayName: null,
    type,
    order,
    required: options.required ?? false,
    maxLength: null,
    listSummaryEligible: options.listSummaryEligible ?? false,
    boardSummaryEligible: options.boardSummaryEligible ?? false,
    system: false,
    role: options.role ?? null,
    choiceConfig: options.choiceConfig ?? null,
    dateDisplayFormat: options.dateDisplayFormat ?? 'date',
    durationDisplayFormat: options.durationDisplayFormat ?? 'hours',
    recurrence: 'none',
    recurrenceDays: [],
    currencyCode: options.currencyCode ?? 'EUR',
    showOnBoard: options.showOnBoard ?? true
  }
}

function tutorialItem(
  listId: string,
  id: string,
  code: string,
  columns: ListColumn[],
  values: Record<string, string | number>,
  options: {
    deadlineStatus: string
    deadlineTone: BoardItem['deadlineTone']
    groupId?: string | null
  }
): BoardItem {
  const mappedValues = columns.reduce<Record<string, FieldValue>>((acc, column) => {
    const raw = values[tutorialColumnKey(column.name)]
    if (column.type === 'date' || column.role === 'deadline') {
      acc[column.id] = tutorialDateField(String(raw ?? ''))
      return acc
    }
    acc[column.id] = raw ?? ''
    return acc
  }, {})

  return {
    id,
    listId,
    groupId: options.groupId ?? null,
    parentItemId: null,
    code,
    displayCode: code,
    order: Number(code.replace(/\D+/g, '')) || 1,
    publicationStatus: 'published',
    operationalState: 'active',
    values: mappedValues,
    dependencyCodes: [],
    dependencyItemIds: [],
    createdAt: '2026-04-28T08:00:00.000Z',
    createdBy: 'LPL',
    isOverdue: options.deadlineTone === 'overdue',
    deadlineStatus: options.deadlineStatus,
    deadlineTone: options.deadlineTone,
    wishlistRecommendation: null,
    updatedAt: '2026-04-28T08:00:00.000Z'
  }
}

function tutorialDateField(value: string): DateFieldValue {
  return {
    value,
    recurrence: 'none',
    recurrenceDays: [],
    recurrenceInterval: 1
  }
}

function tutorialColumnKey(name: string): string {
  return name
    .replace(/[%/]/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function wizardWidgetConfig(draft: WizardWidgetDraft, existing: BoardWidgetConfig): BoardWidgetConfig {
  if (draft.type === 'world_clocks') {
    return {
      ...existing,
      worldClocks: {
        locations: [
          { id: 'bucharest', label: 'Bucharest', timeZone: 'Europe/Bucharest' },
          { id: 'new-york', label: 'New York', timeZone: 'America/New_York' }
        ],
        showSeconds: existing.worldClocks?.showSeconds ?? false,
        style: 'panel'
      }
    }
  }
  if (draft.type === 'clock') {
    return {
      ...existing,
      clock: {
        showSeconds: existing.clock?.showSeconds ?? true,
        style: draft.layout === 'Split Date' ? 'split_date' : 'segmented'
      }
    }
  }
  if (draft.type === 'countdown') {
    return {
      ...existing,
      countdown: {
        label: existing.countdown?.label ?? 'Next milestone',
        targetAt: existing.countdown?.targetAt ?? '',
        style: 'segmented'
      }
    }
  }
  return existing
}

type BoardListSortDirection = 'asc' | 'desc'

type BoardListSortState = {
  key: string
  direction: BoardListSortDirection
}

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

function buildBoardDisplayColumns(list: BoardList): BoardDisplayColumn[] {
  const templateModule = getListTemplateModule(list.templateType)
  if (templateModule.buildBoardColumns) {
    return templateModule.buildBoardColumns(list, {
      boardVisibleColumns,
      visibleColumns,
      boardColumnLabel,
      normalizeColumnName
    })
  }
  return boardVisibleColumns(list).map((column) => ({
    kind: 'real',
    key: column.id,
    label: boardColumnLabel(column),
    column
  }))
}

function orderedBoardRenderFields(list: BoardList): BoardRenderFieldEntry[] {
  const displayColumns = buildBoardDisplayColumns(list)
  const visibleMap = new Map<string, BoardRenderFieldEntry>()

  if (list.showItemIdOnBoard) visibleMap.set('system:itemId', { kind: 'system', key: 'system:itemId', field: 'itemId', label: systemBoardLabel(list, 'itemId', 'Item ID') })
  if (list.showDependenciesOnBoard)
    visibleMap.set('system:dependencies', {
      kind: 'system',
      key: 'system:dependencies',
      field: 'dependencies',
      label: systemBoardLabel(list, 'dependencies', 'Dependencies')
    })
  if (list.showCreatedAtOnBoard)
    visibleMap.set('system:createdAt', { kind: 'system', key: 'system:createdAt', field: 'createdAt', label: systemBoardLabel(list, 'createdAt', 'Created At') })
  if (list.showCreatedByOnBoard)
    visibleMap.set('system:createdBy', { kind: 'system', key: 'system:createdBy', field: 'createdBy', label: systemBoardLabel(list, 'createdBy', 'Created By') })
  if (list.dueDateEnabled && list.showStatusOnBoard)
    visibleMap.set('system:status', { kind: 'system', key: 'system:status', field: 'status', label: systemBoardLabel(list, 'status', 'Status') })

  for (const column of displayColumns) {
    const key = column.kind === 'wishlist_advised_buy_order' ? 'special:wishlistAdvisedBuyOrder' : column.key
    visibleMap.set(key, { kind: 'display', key, column, label: column.label })
  }

  const orderedKeys = normalizedBoardFieldOrderKeys(list)
  return orderedKeys
    .map((key) => visibleMap.get(key))
    .filter((entry): entry is BoardRenderFieldEntry => Boolean(entry))
}

function boardSortMetaForDisplayColumn(
  list: BoardList,
  column: BoardDisplayColumn
): { key: string; defaultDirection: BoardListSortDirection } | null {
  if (column.kind === 'birthday_turning') return { key: column.key, defaultDirection: 'asc' }
  if (column.kind === 'wishlist_advised_buy_order') return { key: column.key, defaultDirection: 'asc' }
  if (column.kind === 'project_gantt') return null
  const candidate = column.column
  if (candidate.role === 'deadline') return { key: column.key, defaultDirection: 'asc' }
  if (list.templateType === 'birthday_calendar' && isBirthdayDateColumn(candidate)) return { key: column.key, defaultDirection: 'asc' }
  if (candidate.type === 'date') return { key: column.key, defaultDirection: candidate.dateDisplayFormat === 'time' ? 'asc' : 'asc' }
  if (candidate.type === 'choice' && candidate.choiceConfig?.ranked) return { key: column.key, defaultDirection: 'asc' }
  if (candidate.type === 'integer' || candidate.type === 'decimal' || candidate.type === 'currency' || candidate.type === 'duration') {
    return { key: column.key, defaultDirection: 'asc' }
  }
  if (candidate.type === 'boolean') return { key: column.key, defaultDirection: 'desc' }
  return { key: column.key, defaultDirection: 'asc' }
}

function sortBoardDisplayRows(
  list: BoardList,
  rows: BoardDisplayRow[],
  displayColumns: BoardDisplayColumn[],
  sortState: BoardListSortState | null
): BoardDisplayRow[] {
  if (!sortState) return rows
  if (list.templateType === 'birthday_calendar') {
    return rows
      .filter((row): row is { kind: 'item'; item: BoardItem; depth: number } => row.kind === 'item')
      .sort((left, right) => compareBoardItems(left.item, right.item, list, displayColumns, sortState))
  }

  const nextRows: BoardDisplayRow[] = []
  const pushItems = (items: BoardItem[]): void => {
    if (list.templateType === 'project') {
      const byId = new Set(items.map((item) => item.id))
      const groupId = items[0]?.groupId ?? null
      const roots = items
        .filter((item) => !item.parentItemId || !byId.has(item.parentItemId))
        .sort((left, right) => compareBoardItems(left, right, list, displayColumns, sortState))
      for (const root of roots) appendProjectRows(nextRows, list, root, 0, groupId)
      return
    }
    ;[...items].sort((left, right) => compareBoardItems(left, right, list, displayColumns, sortState)).forEach((item) => nextRows.push({ kind: 'item', item, depth: 0 }))
  }

  pushItems(projectRootItemsForBucket(list, null))

  const appendGroupRows = (parentGroupId: string | null): void => {
    list.groups
      .filter((group) => group.parentGroupId === parentGroupId)
      .forEach((group) => {
        const groupItems = projectRootItemsForBucket(list, group.id)
        const hasChildren = list.groups.some((candidate) => candidate.parentGroupId === group.id)
        if (groupItems.length === 0 && !hasChildren) return
        nextRows.push({ kind: 'group', group })
        pushItems(groupItems)
        appendGroupRows(group.id)
      })
  }

  appendGroupRows(null)
  return nextRows
}

function compareBoardItems(
  left: BoardItem,
  right: BoardItem,
  list: BoardList,
  displayColumns: BoardDisplayColumn[],
  sortState: BoardListSortState
): number {
  const result = compareBoardSortValues(left, right, list, displayColumns, sortState.key)
  if (result !== 0) return sortState.direction === 'asc' ? result : -result
  return left.order - right.order || left.displayCode.localeCompare(right.displayCode, undefined, { numeric: true, sensitivity: 'base' })
}

function compareBoardSortValues(left: BoardItem, right: BoardItem, list: BoardList, displayColumns: BoardDisplayColumn[], key: string): number {
  if (key === '__itemId') return compareTextValues(left.displayCode, right.displayCode)
  if (key === '__createdAt') return compareNumberValues(Date.parse(left.createdAt), Date.parse(right.createdAt))
  if (key === '__createdBy') return compareTextValues(left.createdBy, right.createdBy)

  const column = displayColumns.find((candidate) => candidate.key === key)
  if (!column) return 0
  if (column.kind === 'birthday_turning') return compareNumberValues(birthdayTurningNumber(left, list), birthdayTurningNumber(right, list))
  if (column.kind === 'wishlist_advised_buy_order') {
    return compareNumberValues(left.wishlistRecommendation?.advisedBuyOrder ?? null, right.wishlistRecommendation?.advisedBuyOrder ?? null, Number.MAX_SAFE_INTEGER)
  }
  if (column.kind === 'project_gantt') return 0

  return compareItemColumnValue(left.values[column.column.id], right.values[column.column.id], column.column, list)
}

function compareItemColumnValue(left: FieldValue | undefined, right: FieldValue | undefined, column: ListColumn, list: BoardList): number {
  if (list.templateType === 'birthday_calendar' && isBirthdayDateColumn(column)) {
    const leftDate = birthdayOccurrenceDate(left)
    const rightDate = birthdayOccurrenceDate(right)
    return compareOptionalDates(leftDate, rightDate, Number.MIN_SAFE_INTEGER)
  }
  if (column.role === 'deadline' || column.type === 'date') {
    const leftDate = sortableDateValue(left, column)
    const rightDate = sortableDateValue(right, column)
    return compareOptionalDates(leftDate, rightDate, Number.MIN_SAFE_INTEGER)
  }
  if (column.type === 'choice') {
    if (column.choiceConfig?.ranked) return compareNumberValues(choiceRankValue(left, column), choiceRankValue(right, column, 'below_lowest'))
    return compareTextValues(sortableTextForColumn(left, column), sortableTextForColumn(right, column))
  }
  if (column.type === 'integer' || column.type === 'decimal' || column.type === 'currency' || column.type === 'duration') {
    return compareNumberValues(typeof left === 'number' ? left : null, typeof right === 'number' ? right : null, 0)
  }
  if (column.type === 'boolean') return compareNumberValues(left ? 1 : 0, right ? 1 : 0, 0)
  return compareTextValues(sortableTextForColumn(left, column), sortableTextForColumn(right, column))
}

function sortableDateValue(value: FieldValue | undefined, column: ListColumn): Date | null {
  if (column.type === 'date' && column.dateDisplayFormat === 'time') {
    const raw = dateStringFromField(value)
    if (!raw) return null
    const candidate = raw.includes('T') ? raw.slice(11, 16) : raw.slice(0, 5)
    const [hour, minute] = candidate.split(':').map(Number)
    return Number.isFinite(hour) && Number.isFinite(minute) ? new Date(1970, 0, 1, hour, minute, 0, 0) : null
  }
  const raw = dateStringFromField(value)
  return raw ? parseColumnDateValue(raw, column) : null
}

function birthdayTurningNumber(item: BoardItem, list: BoardList): number | null {
  const birthYearColumn = birthdayCoreColumns(list).find((column) => isBirthdayBirthYearColumn(column))
  const birthdayColumn = birthdayCoreColumns(list).find((column) => isBirthdayDateColumn(column))
  const year = birthYearColumn ? Number(item.values[birthYearColumn.id]) : NaN
  const occurrence = birthdayColumn ? birthdayOccurrenceDate(item.values[birthdayColumn.id]) : null
  if (!Number.isFinite(year) || !occurrence) return null
  return occurrence.getFullYear() - year
}

function choiceRankValue(
  value: FieldValue | undefined,
  column: ListColumn,
  missing: 'lowest' | 'below_lowest' = 'lowest'
): number | null {
  const maxRank = Math.max(0, ...(column.choiceConfig?.options.map((candidate) => candidate.rank) ?? [0]))
  if (value === null || value === undefined || value === '') return missing === 'below_lowest' ? maxRank + 1 : maxRank
  const first = Array.isArray(value) ? value[0] : value
  const option = column.choiceConfig?.options.find((candidate) => candidate.id === first || candidate.label === first)
  return option?.rank ?? (missing === 'below_lowest' ? maxRank + 1 : maxRank)
}

function sortableTextForColumn(value: FieldValue | undefined, column: ListColumn): string {
  if (Array.isArray(value)) return value.map((entry) => choiceLabel(entry, column)).join(', ')
  if (value === null || value === undefined) return ''
  if (isDateFieldValue(value)) return value.value ?? ''
  if (column.type === 'choice') return choiceLabel(String(value), column)
  return String(value)
}

function compareOptionalDates(left: Date | null, right: Date | null, missingValue: number): number {
  return compareNumberValues(left?.getTime() ?? null, right?.getTime() ?? null, missingValue)
}

function compareNumberValues(left: number | null, right: number | null, missingValue = 0): number {
  const safeLeft = left === null || !Number.isFinite(left) ? missingValue : left
  const safeRight = right === null || !Number.isFinite(right) ? missingValue : right
  return safeLeft - safeRight
}

function compareTextValues(left: string, right: string): number {
  const normalizedLeft = left.trim()
  const normalizedRight = right.trim()
  return normalizedLeft.localeCompare(normalizedRight, undefined, { numeric: true, sensitivity: 'base' })
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

function formatBoardDisplayValue(
  item: BoardItem,
  column: BoardDisplayColumn,
  list: BoardList,
  depth = 0,
  firstVisibleColumn = false
): string | ReactElement {
  const raw =
    column.kind === 'real'
      ? formatBirthdayAwareCellValue(item, column.column, list)
      : column.kind === 'birthday_turning'
        ? birthdayTurningLabel(item, list)
        : column.kind === 'wishlist_advised_buy_order'
          ? item.wishlistRecommendation?.advisedBuyOrder
            ? String(item.wishlistRecommendation.advisedBuyOrder)
            : '-'
          : renderProjectGanttCell(item, list)
  if (list.templateType !== 'project' || !firstVisibleColumn) return raw
  const type = projectItemType(item, list)
  const dependencyItems =
    isProjectMilestoneLikeType(type) && item.dependencyItemIds.length > 0
      ? item.dependencyItemIds
          .map((dependencyId) => list.items.find((candidate) => candidate.id === dependencyId))
          .filter((dependency): dependency is BoardItem => dependency !== undefined)
      : []
  return (
    <span className="project-board-cell" style={{ paddingInlineStart: `${depth * 1.1}rem` }}>
      <span className="project-board-branch" aria-hidden="true">
        {depth > 0 ? '↳' : ''}
      </span>
      <span>{raw}</span>
      {dependencyItems.length > 0 ? (
        <span className="project-milestone-dependencies" title={`Depends on: ${dependencyItems.map((dependency) => itemTitle(dependency, list)).join(', ')}`}>
          {dependencyItems.map((dependency) => (
            <span className="project-milestone-link" key={dependency.id}>
              {itemTitle(dependency, list)}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  )
}

function renderProjectGanttCell(item: BoardItem, list: BoardList): ReactElement {
  const columns = projectDateColumns(list)
  const range = projectTimelineRange(list)
  const plannedStart = projectFieldDateValue(item.values, columns.plannedStart)
  const plannedEnd = projectFieldDateValue(item.values, columns.plannedEnd) ?? plannedStart
  const actualStart = projectFieldDateValue(item.values, columns.actualStart)
  const actualEnd = projectFieldDateValue(item.values, columns.actualEnd) ?? actualStart
  const type = projectItemType(item, list)
  const milestoneLike = isProjectMilestoneLikeType(type)
  const dependencyLinked = milestoneLike && item.dependencyItemIds.length > 0

  return (
    <div className="project-gantt-cell">
      <div className="project-gantt-track">
        {plannedStart && plannedEnd &&
          (milestoneLike ? (
            <span className={`project-gantt-marker planned${dependencyLinked ? ' dependent' : ''}`} style={{ left: `${projectTimelinePosition(plannedStart, range)}%` }} />
          ) : (
            <span
              className="project-gantt-bar planned"
              style={{
                left: `${projectTimelinePosition(plannedStart, range)}%`,
                width: `${Math.max(1.5, projectTimelineSpan(plannedStart, plannedEnd, range))}%`
              }}
            />
          ))}
        {actualStart && actualEnd &&
          (milestoneLike ? (
            <span className={`project-gantt-marker actual${dependencyLinked ? ' dependent' : ''}`} style={{ left: `${projectTimelinePosition(actualStart, range)}%` }} />
          ) : (
            <span
              className="project-gantt-bar actual"
              style={{
                left: `${projectTimelinePosition(actualStart, range)}%`,
                width: `${Math.max(1.5, projectTimelineSpan(actualStart, actualEnd, range))}%`
              }}
            />
          ))}
      </div>
      <div className="project-gantt-meta">
        <span>{projectTimelineLabel(range.start)}</span>
        <span>{projectTimelineLabel(range.end)}</span>
      </div>
    </div>
  )
}

function projectTimelineRange(list: BoardList): { start: Date; end: Date } {
  const columns = projectDateColumns(list)
  const boundaries = projectTimelineBoundaryItems(list)
  const dates = list.items
    .flatMap((item) => [
      projectFieldDateValue(item.values, columns.plannedStart),
      projectFieldDateValue(item.values, columns.plannedEnd),
      projectFieldDateValue(item.values, columns.actualStart),
      projectFieldDateValue(item.values, columns.actualEnd)
    ])
    .filter((entry): entry is Date => entry !== null)
    .sort((left, right) => left.getTime() - right.getTime())
  const boundaryStartCandidates = [
    boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.plannedStart) : null,
    boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.actualStart) : null
  ].filter((entry): entry is Date => entry !== null)
  const boundaryEndCandidates = [
    boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.plannedStart) : null,
    boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.actualStart) : null
  ].filter((entry): entry is Date => entry !== null)
  const boundaryStart = boundaryStartCandidates.sort((left, right) => left.getTime() - right.getTime())[0] ?? null
  const boundaryEnd = boundaryEndCandidates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null
  if (dates.length === 0) {
    const start = boundaryStart ? startOfToday(boundaryStart) : startOfToday(new Date())
    const end = new Date(start)
    if (boundaryEnd) {
      end.setTime(boundaryEnd.getTime())
    } else {
      end.setDate(end.getDate() + 14)
    }
    return { start, end }
  }
  const earliestDate = boundaryStart && boundaryStart.getTime() < dates[0].getTime() ? boundaryStart : dates[0]
  const latestDate = boundaryEnd && boundaryEnd.getTime() > dates[dates.length - 1].getTime() ? boundaryEnd : dates[dates.length - 1]
  const start = new Date(earliestDate)
  start.setDate(start.getDate() - 1)
  const end = new Date(latestDate)
  end.setDate(end.getDate() + 1)
  if (end.getTime() <= start.getTime()) end.setDate(start.getDate() + 1)
  return { start, end }
}

function projectTimelinePosition(date: Date, range: { start: Date; end: Date }): number {
  const span = Math.max(1, range.end.getTime() - range.start.getTime())
  return ((date.getTime() - range.start.getTime()) / span) * 100
}

function projectTimelineSpan(start: Date, end: Date, range: { start: Date; end: Date }): number {
  const span = Math.max(1, range.end.getTime() - range.start.getTime())
  return ((Math.max(end.getTime(), start.getTime()) - start.getTime()) / span) * 100
}

function projectTimelineLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
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

function summaryToneForSlot(slot: SummarySlot): 'positive' | 'alert' {
  if (slot.aggregationMethod === 'total_purchases' || slot.aggregationMethod === 'overdue_items' || slot.aggregationMethod === 'overdue_tasks') {
    return 'alert'
  }
  return 'positive'
}

function statusLabel(item: BoardItem): string {
  if (item.publicationStatus === 'dirty') return 'Unpublished edits'
  if (item.publicationStatus === 'draft') return 'Draft'
  return item.operationalState === 'completed' ? 'Completed' : 'Published'
}

function deadlineRowClass(item: BoardItem): string | undefined {
  return item.deadlineTone === 'none' ? undefined : deadlineClass(item.deadlineTone)
}
