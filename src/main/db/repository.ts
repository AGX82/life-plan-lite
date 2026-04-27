import { randomUUID } from 'node:crypto'
import type {
  AggregationMethod,
  ArchiveValueScope,
  AppTheme,
  AppSettings,
  ArchiveRecord,
  BoardItem,
  BoardList,
  BoardSnapshot,
  BoardSummary,
  BoardWidget,
  BoardWidgetConfig,
  ChoiceConfig,
  ChoiceOption,
  CloseConfirmationMode,
  CloseItemInput,
  ColumnRole,
  ColumnSortOrder,
  ColumnType,
  CreateBoardInput,
  CreateColumnInput,
  DeleteBoardInput,
  DuplicateBoardInput,
  CurrencyCode,
  CreateGroupInput,
  CreateItemInput,
  CreateListInput,
  CreateWidgetInput,
  DateFieldValue,
  DateDisplayFormat,
  DurationDisplayFormat,
  FieldValue,
  GroupSummaryConfig,
  GroupSummaryMethod,
  ItemGroup,
  ListBehavior,
  ListTemplateConfig,
  ListTemplateType,
  ListColumn,
  ListSortDirection,
  OperationalState,
  PublicationStatus,
  RecurrenceMode,
  SummarySlot,
  MoveListInput,
  UpdateSummarySlotsInput,
  UpdateBoardInput,
  UpdateColumnInput,
  UpdateGroupInput,
  UpdateListInput,
  UpdateItemInput,
  UpdateWidgetInput,
  WidgetType,
  WorldClockLocation
} from '../../shared/domain'
import type { DbClient } from './client'

const MIN_LIST_GRID_WIDTH = 2
const MIN_LIST_GRID_HEIGHT = 2
const MIN_WIDGET_GRID_WIDTH = 2
const MIN_WIDGET_GRID_HEIGHT = 2
const MAX_LIST_SUMMARY_COLUMNS = 3
const MAX_BOARD_SUMMARY_COLUMNS = 5
const BOARD_SUMMARY_SLOT_COUNT = 8
const RESERVED_COLUMN_NAMES = new Set(
  ['item id', 'item name', 'created at', 'created by', 'dependency', 'dependencies', 'close_comm'].map((name) =>
    normalizeReservedColumnName(name)
  )
)
const BIRTHDAY_PROTECTED_COLUMN_NAMES = new Set(['name', 'person name', 'birthday', 'year of birth', 'birth year'].map((name) => normalizeReservedColumnName(name)))
const DEFAULT_APP_SETTINGS: AppSettings = {
  closeConfirmationMode: 'with_comments',
  theme: 'midnight_clear',
  addColumnOnTopByBoard: {}
}

const DEFAULT_PRIORITY_OPTIONS = ['Highest', 'High', 'Medium', 'Low', 'Lowest']
const WISHMETER_OPTIONS = ["It's so fluffy I'm gonna die!", 'My precious!', 'Shut up and take my money!', 'Gotta get me one of those!', 'Asking for a friend...']
const SUMMARY_COUNT_TEXT_COLUMNS = new Set(['item name', 'task', 'task name', 'product', 'entry', 'title', 'name'].map((name) => normalizeReservedColumnName(name)))
const SUMMARY_DATE_COLUMNS = new Set(['deadline', 'needed by', 'appointment date', 'birthday', 'start'].map((name) => normalizeReservedColumnName(name)))
const NON_SUMMARY_NUMERIC_COLUMNS = new Set(['year of birth', 'birth year', '% done'].map((name) => normalizeReservedColumnName(name)))
const RESERVED_BOARD_SUMMARY_LABELS = new Map<string, AggregationMethod>([
  ['open tasks', 'open_tasks'],
  ['board items', 'board_items'],
  ['total board entries', 'total_board_entries'],
  ['total purchases', 'total_purchases'],
  ['total effort on tasks', 'total_effort_tasks'],
  ['overdue items', 'overdue_items'],
  ['overdue tasks', 'overdue_tasks'],
  ['archived items', 'archived_items']
])

type ListRow = {
  id: string
  board_id: string
  name: string
  code: string
  list_type: ListTemplateType
  list_config: string | null
  sort_order: number
  grid_x: number
  grid_y: number
  grid_w: number
  grid_h: number
  due_date_enabled: number
  due_date_column_id: string | null
  deadline_mandatory: number
  column_sort_order: ColumnSortOrder
  sort_column_id: string | null
  sort_direction: ListSortDirection
  display_enabled: number
  show_item_id_on_board: number
  show_dependencies_on_board: number
  show_created_at_on_board: number
  show_created_by_on_board: number
  show_status_on_board: number
}

type ColumnRow = {
  id: string
  list_id: string
  name: string
  column_type: ColumnType
  sort_order: number
  is_required: number
  max_length: number | null
  is_summary_eligible: number
  is_list_summary_eligible: number
  is_board_summary_eligible: number
  is_system: number
  display_format: string | null
}

type GroupRow = {
  id: string
  list_id: string
  parent_group_id: string | null
  name: string
  code: string
  sort_order: number
  display_config: string | null
}

type ItemRow = {
  id: string
  list_id: string
  group_id: string | null
  item_number: number
  item_order: number
  publication_status: PublicationStatus
  operational_state: OperationalState
  created_at: string
  created_by: string
  updated_at: string
}

type ValueRow = {
  item_id: string
  column_id: string
  column_type: ColumnType
  value_text: string | null
  value_number: number | null
  value_date: string | null
  value_boolean: number | null
  value_json: string | null
}

type DependencyCodeRow = {
  source_item_id: string
  target_list_code: string
  target_item_number: number
}

type BottomSlotRow = {
  slot_index: number
  label: string
  source_list_id: string | null
  source_column_id: string | null
  aggregation_method: AggregationMethod
}

type SettingRow = {
  value_json: string | null
}

type WidgetRow = {
  id: string
  board_id: string
  widget_type: WidgetType
  name: string
  sort_order: number
  grid_x: number
  grid_y: number
  grid_w: number
  grid_h: number
  display_enabled: number
  config_json: string | null
}

function defaultChoiceConfig(name: string, type: ColumnType): ChoiceConfig | null {
  if (type !== 'choice') return null
  const priorityLabels = name.toLowerCase().includes('priority')
    ? ['Highest', 'High', 'Medium', 'Low', 'Lowest']
    : ['Option 1', 'Option 2', 'Option 3']
  return {
    selection: 'single',
    ranked: name.toLowerCase().includes('priority'),
    options: priorityLabels.map((label, index) => ({ id: randomUUID(), label, rank: index + 1 }))
  }
}

function normalizeChoiceConfig(config: ChoiceConfig): ChoiceConfig {
  return {
    selection: config.selection === 'multi' ? 'multi' : 'single',
    ranked: Boolean(config.ranked),
    options: config.options
      .filter((option) => option.label.trim().length > 0)
      .map((option, index) => ({
        id: option.id || randomUUID(),
        label: option.label.trim(),
        rank: Number.isFinite(option.rank) ? option.rank : index + 1
      }))
  }
}

function normalizeDateDisplayFormat(format: DateDisplayFormat | undefined): DateDisplayFormat {
  if (format === 'datetime' || format === 'time') return format
  return 'date'
}

function normalizeDurationDisplayFormat(format: DurationDisplayFormat | undefined): DurationDisplayFormat {
  return format === 'hours' ? 'hours' : 'days_hours'
}

function normalizeColumnSortOrder(order: ColumnSortOrder | undefined): ColumnSortOrder {
  if (order === 'manual' || order === 'name' || order === 'field_type' || order === 'required' || order === 'visibility') return order
  return 'default'
}

function normalizeDeadlineDisplayFormat(format: DateDisplayFormat | undefined): DateDisplayFormat {
  const normalized = normalizeDateDisplayFormat(format)
  return normalized === 'time' ? 'date' : normalized
}

function normalizeCurrencyCode(code: CurrencyCode | undefined): CurrencyCode {
  const normalized = String(code ?? 'USD').toUpperCase()
  if (
    normalized === 'RON' ||
    normalized === 'EUR' ||
    normalized === 'USD' ||
    normalized === 'GBP' ||
    normalized === 'CNY' ||
    normalized === 'JPY' ||
    normalized === 'CAD' ||
    normalized === 'AUD' ||
    normalized === 'CHF' ||
    normalized === 'PLN'
  ) {
    return normalized
  }
  return 'USD'
}

function normalizeRecurrenceMode(mode: RecurrenceMode | undefined): RecurrenceMode {
  if (mode === 'daily' || mode === 'weekly' || mode === 'interval_weeks' || mode === 'monthly' || mode === 'interval_months' || mode === 'custom_weekdays') return mode
  return 'none'
}

function recurrenceNeedsDays(mode: RecurrenceMode): boolean {
  return mode === 'weekly' || mode === 'interval_weeks' || mode === 'custom_weekdays'
}

function normalizeRecurrenceDays(days: number[] | undefined): number[] {
  return [...new Set((days ?? []).map((day) => Math.trunc(day)).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b)
}

function normalizeRecurrenceInterval(interval: number | undefined): number {
  return Number.isFinite(interval) ? Math.max(1, Math.min(24, Math.trunc(interval ?? 1))) : 1
}

function normalizeWidgetType(type: WidgetType | undefined): WidgetType {
  if (type === 'weather' || type === 'word_of_day' || type === 'world_clocks' || type === 'countdown') return type
  return 'clock'
}

function normalizeListTemplateType(type: string | undefined): ListTemplateType {
  if (
    type === 'todo' ||
    type === 'shopping_list' ||
    type === 'wishlist' ||
    type === 'health' ||
    type === 'trips_events' ||
    type === 'birthday_calendar' ||
    type === 'custom'
  ) {
    return type
  }
  return 'custom'
}

function defaultWorldClockLocations(): WorldClockLocation[] {
  return [
    { id: randomUUID(), label: 'New York', timeZone: 'America/New_York' },
    { id: randomUUID(), label: 'London', timeZone: 'Europe/London' },
    { id: randomUUID(), label: 'Bucharest', timeZone: 'Europe/Bucharest' },
    { id: randomUUID(), label: 'Tokyo', timeZone: 'Asia/Tokyo' }
  ]
}

function defaultWidgetConfig(type: WidgetType): BoardWidgetConfig {
  if (type === 'weather') return { weather: { temperatureUnit: 'celsius' } }
  if (type === 'word_of_day') return { wordOfDay: { accent: 'calm' } }
  if (type === 'world_clocks') return { worldClocks: { locations: defaultWorldClockLocations(), showSeconds: false, style: 'digital' } }
  if (type === 'countdown') return { countdown: { targetAt: '', label: 'Next milestone' } }
  return { clock: { showSeconds: true } }
}

function defaultListTemplateConfig(type: ListTemplateType): ListTemplateConfig {
  if (type === 'custom') return { behavior: 'other' }
  if (type === 'birthday_calendar') return { behavior: 'calendar', birthday: { boardView: 'this_month' } }
  if (type === 'todo') return { behavior: 'tasks' }
  if (type === 'shopping_list' || type === 'wishlist') return { behavior: 'purchases' }
  if (type === 'health' || type === 'trips_events') return { behavior: 'calendar' }
  return {}
}

function choiceConfigFromLabels(labels: string[]): ChoiceConfig {
  return {
    selection: 'single',
    ranked: true,
    options: labels.map((label, index) => ({
      id: normalizeReservedColumnName(label).replace(/\s+/g, '-'),
      label,
      rank: index + 1
    }))
  }
}

function normalizeReservedColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function defaultColumnOrderIndex(listType: ListTemplateType, name: string): number {
  const templateOrder: Record<ListTemplateType, string[]> = {
    custom: ['item name'],
    todo: ['task name', 'task', 'details', 'deadline', 'priority', 'people', 'location', 'effort', '% done', 'comments'],
    shopping_list: ['product', 'pieces', 'store', 'needed by', 'price / pc', 'cost', 'link'],
    wishlist: ['product', 'description', 'link', 'price', 'wishmeter'],
    health: ['entry', 'appointment date', 'recurrence', 'mentions', 'frequency', 'details'],
    trips_events: ['title', 'type', 'start', 'end', 'topic / theme', 'location'],
    birthday_calendar: ['name', 'birthday', 'year of birth', 'birth year', 'location']
  }
  const index = templateOrder[normalizeListTemplateType(listType)].indexOf(normalizeReservedColumnName(name))
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER
}

function formatDurationMinutes(minutes: number, displayFormat: DurationDisplayFormat = 'days_hours'): string {
  const totalMinutes = Math.max(0, Math.round(minutes))
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (displayFormat === 'hours') {
    return `${hours}:${String(mins).padStart(2, '0')}`
  }
  const days = Math.floor(hours / 24)
  const remainderHours = hours % 24
  return days > 0
    ? `${days}:${String(remainderHours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
    : `${remainderHours}:${String(mins).padStart(2, '0')}`
}

function isDateFieldValue(value: FieldValue | undefined): value is DateFieldValue {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'value' in value)
}

function dateFieldString(value: FieldValue | undefined): string | null {
  if (isDateFieldValue(value)) return value.value || null
  return typeof value === 'string' && value.length > 0 ? value : null
}

export class LifePlanRepository {
  constructor(private readonly client: DbClient) {}

  seedIfEmpty(): void {
    const existing = this.client.database.prepare('SELECT COUNT(*) AS count FROM boards').get<{ count: number }>()
    if (existing && existing.count > 0) return

    const now = new Date().toISOString()
    const userId = randomUUID()
    const boardId = randomUUID()

    this.transaction(() => {
      this.run(
        'INSERT INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        userId,
        'Local User',
        now,
        now
      )
      this.run(
        'INSERT INTO boards (id, user_id, name, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
        boardId,
        userId,
        'Life Plan Lite',
        now,
        now
      )
      this.run(
        'INSERT INTO display_configs (id, active_board_id, display_mode, updated_at) VALUES (?, ?, ?, ?)',
        randomUUID(),
        boardId,
        'single-screen',
        now
      )

      const todo = this.createSeedList(boardId, 'To Do', 'L01', 0, { x: 1, y: 1, w: 8, h: 4 }, true)
      const shopping = this.createSeedList(boardId, 'Shopping List', 'L02', 1, { x: 9, y: 1, w: 8, h: 4 }, false)
      const house = this.createSeedList(boardId, 'House Setup', 'L03', 2, { x: 1, y: 5, w: 16, h: 3 }, true)

      const todoName = this.createSeedColumn(todo, 'Item Name', 'text', 0, true, 120, false, false, true)
      const todoDue = this.createSeedColumn(
        todo,
        'Deadline',
        'date',
        1,
        false,
        null,
        true,
        false,
        true,
        JSON.stringify({ role: 'deadline', dateDisplayFormat: 'datetime' })
      )
      const todoEffort = this.createSeedColumn(todo, 'Effort', 'duration', 2, false, null, true, true, true, this.writeColumnDisplayFormat(null, null, 'date', 'none', [], undefined, true, 'days_hours'))
      this.setDueDateColumn(todo, todoDue)

      const shoppingName = this.createSeedColumn(shopping, 'Item Name', 'text', 0, true, 120, false, false, true)
      const shoppingPrice = this.createSeedColumn(shopping, 'Price', 'currency', 1, false, null, false, false, false)
      const shoppingBought = this.createSeedColumn(shopping, 'Bought', 'boolean', 2, false, null, false, false, false)

      const houseName = this.createSeedColumn(house, 'Item Name', 'text', 0, true, 120, false, false, true)
      const houseDue = this.createSeedColumn(
        house,
        'Deadline',
        'date',
        1,
        false,
        null,
        true,
        false,
        true,
        JSON.stringify({ role: 'deadline', dateDisplayFormat: 'datetime' })
      )
      const houseBudget = this.createSeedColumn(house, 'Budget', 'currency', 2, false, null, false, false, false)
      this.setDueDateColumn(house, houseDue)

      const moveIn = this.createSeedItem(house, 1, 'published', {
        [houseName]: 'Move into new house',
        [houseDue]: this.offsetDate(5),
        [houseBudget]: 0
      })
      const furniture = this.createSeedItem(house, 2, 'draft', {
        [houseName]: 'Buy furniture',
        [houseDue]: this.offsetDate(14),
        [houseBudget]: 2200
      })
      const reviewBudget = this.createSeedItem(todo, 1, 'published', {
        [todoName]: 'Review monthly plan',
        [todoDue]: this.offsetDate(-1),
        [todoEffort]: 60
      })
      this.createSeedItem(todo, 2, 'draft', {
        [todoName]: 'Book utility setup',
        [todoDue]: this.offsetDate(3),
        [todoEffort]: 120
      })
      this.createSeedItem(shopping, 1, 'published', {
        [shoppingName]: 'Kitchen starter kit',
        [shoppingPrice]: 180,
        [shoppingBought]: false
      })
      this.createSeedItem(shopping, 2, 'published', {
        [shoppingName]: 'Cleaning supplies',
        [shoppingPrice]: 65,
        [shoppingBought]: false
      })

      this.run(
        'INSERT INTO dependencies (id, source_item_id, target_item_id, dependency_type, created_at) VALUES (?, ?, ?, ?, ?)',
        randomUUID(),
        furniture,
        moveIn,
        'prerequisite',
        now
      )
      this.run(
        'INSERT INTO dependencies (id, source_item_id, target_item_id, dependency_type, created_at) VALUES (?, ?, ?, ?, ?)',
        randomUUID(),
        reviewBudget,
        moveIn,
        'prerequisite',
        now
      )

      this.createSeedSummary(boardId, 0, 'Open Tasks', null, null, 'open_tasks')
      this.createSeedSummary(boardId, 1, 'Board Items', null, null, 'board_items')
      this.createSeedSummary(boardId, 2, 'Total Purchases', null, null, 'total_purchases')
      this.createSeedSummary(boardId, 3, 'Archived Items', null, null, 'archived_items')
      for (let slot = 4; slot < BOARD_SUMMARY_SLOT_COUNT; slot += 1) {
        this.createSeedSummary(boardId, slot, '', null, null, 'count')
      }
    })
  }

  listBoards(): BoardSummary[] {
    return this.client.database
      .prepare('SELECT id, name, description, owner, is_active FROM boards ORDER BY is_active DESC, name')
      .all<{ id: string; name: string; description: string; owner: string; is_active: number }>()
      .map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        owner: row.owner,
        active: row.is_active === 1
      }))
  }

  getDisplayTargetId(): string | null {
    return (
      this.client.database.prepare('SELECT target_display_id FROM display_configs LIMIT 1').get<{ target_display_id: string | null }>()
        ?.target_display_id ?? null
    )
  }

  setDisplayTargetId(displayId: string): void {
    this.run('UPDATE display_configs SET target_display_id = ?, updated_at = ?', displayId, new Date().toISOString())
  }

  getAppSettings(): AppSettings {
    const row = this.client.database
      .prepare("SELECT value_json FROM app_settings WHERE key = 'app_config'")
      .get<SettingRow>()

    if (!row?.value_json) return DEFAULT_APP_SETTINGS

    try {
      const parsed = JSON.parse(row.value_json) as { closeConfirmationMode?: CloseConfirmationMode; theme?: AppTheme; addColumnOnTopByBoard?: Record<string, unknown> }
      return {
        closeConfirmationMode: this.normalizeCloseConfirmationMode(parsed.closeConfirmationMode),
        theme: this.normalizeTheme(parsed.theme),
        addColumnOnTopByBoard: this.normalizeBooleanMap(parsed.addColumnOnTopByBoard)
      }
    } catch {
      return DEFAULT_APP_SETTINGS
    }
  }

  updateAppSettings(settings: AppSettings): AppSettings {
    const normalized: AppSettings = {
      closeConfirmationMode: this.normalizeCloseConfirmationMode(settings.closeConfirmationMode),
      theme: this.normalizeTheme(settings.theme),
      addColumnOnTopByBoard: this.normalizeBooleanMap(settings.addColumnOnTopByBoard)
    }
    this.run(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES ('app_config', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      JSON.stringify(normalized),
      new Date().toISOString()
    )
    return normalized
  }

  setActiveBoard(boardId: string): BoardSnapshot {
    const now = new Date().toISOString()
    this.transaction(() => {
      this.run('UPDATE boards SET is_active = 0, updated_at = ?', now)
      this.run('UPDATE boards SET is_active = 1, updated_at = ? WHERE id = ?', now, boardId)
      this.run('UPDATE display_configs SET active_board_id = ?, updated_at = ?', boardId, now)
    })

    return this.getActiveBoardSnapshot('admin')
  }

  getActiveBoardSnapshot(mode: 'admin' | 'display'): BoardSnapshot {
    const board = this.client.database
      .prepare(
        `SELECT b.id, b.name, b.description, b.owner, b.is_active
         FROM boards b
         LEFT JOIN display_configs dc ON dc.active_board_id = b.id
         WHERE b.is_active = 1 OR dc.active_board_id = b.id
         ORDER BY b.is_active DESC
         LIMIT 1`
      )
      .get<{ id: string; name: string; description: string; owner: string; is_active: number }>()

    if (!board) {
      throw new Error('No active board exists.')
    }

    return this.getBoardSnapshot(board.id, mode)
  }

  getBoardSnapshot(boardId: string, mode: 'admin' | 'display'): BoardSnapshot {
    const board = this.client.database
      .prepare('SELECT id, name, description, owner, is_active FROM boards WHERE id = ?')
      .get<{ id: string; name: string; description: string; owner: string; is_active: number }>(boardId)

    if (!board) {
      throw new Error('Board not found.')
    }

    const lists = this.getBoardLists(board.id, mode)
    const widgets = this.getBoardWidgets(board.id, mode, lists)

    return {
      id: board.id,
      name: board.name,
      description: board.description,
      owner: board.owner,
      active: board.is_active === 1,
      lists,
      widgets,
      summarySlots: this.getSummarySlots(board.id, lists),
      mode,
      generatedAt: new Date().toISOString()
    }
  }

  publishItem(itemId: string): BoardSnapshot {
    const boardId = this.client.database
      .prepare('SELECT l.board_id FROM items i JOIN lists l ON l.id = i.list_id WHERE i.id = ?')
      .get<{ board_id: string }>(itemId)?.board_id
    this.transaction(() => this.publishItems([itemId]))
    return boardId ? this.getBoardSnapshot(boardId, 'admin') : this.getActiveBoardSnapshot('admin')
  }

  publishList(listId: string): BoardSnapshot {
    const boardId = this.client.database.prepare('SELECT board_id FROM lists WHERE id = ?').get<{ board_id: string }>(listId)?.board_id
    const ids = this.client.database
      .prepare(
        `SELECT id FROM items
         WHERE list_id = ?
         AND operational_state = 'active'
         AND publication_status IN ('draft', 'dirty')`
      )
      .all<{ id: string }>(listId)
      .map((row) => row.id)

    this.transaction(() => this.publishItems(ids))
    return boardId ? this.getBoardSnapshot(boardId, 'admin') : this.getActiveBoardSnapshot('admin')
  }

  publishBoard(boardId: string): BoardSnapshot {
    const ids = this.client.database
      .prepare(
        `SELECT i.id
         FROM items i
         JOIN lists l ON l.id = i.list_id
         WHERE l.board_id = ?
         AND i.operational_state = 'active'
         AND i.publication_status IN ('draft', 'dirty')`
      )
      .all<{ id: string }>(boardId)
      .map((row) => row.id)

    this.transaction(() => this.publishItems(ids))
    return this.getBoardSnapshot(boardId, 'admin')
  }

  completeItem(itemId: string): BoardSnapshot {
    return this.closeItem({ itemId, action: 'completed', comment: null })
  }

  closeItem(input: CloseItemInput): BoardSnapshot {
    const item = this.client.database
      .prepare(
        `SELECT i.id, i.item_number, i.publication_status, l.id AS list_id, l.name AS list_name, l.code AS list_code, b.id AS board_id
         FROM items i
         JOIN lists l ON l.id = i.list_id
         JOIN boards b ON b.id = l.board_id
         WHERE i.id = ?`
      )
      .get<{ id: string; item_number: number; publication_status: PublicationStatus; list_id: string; list_name: string; list_code: string; board_id: string }>(
        input.itemId
      )

    if (!item) throw new Error('Item not found.')

    const action = input.action === 'cancelled' ? 'cancelled' : 'completed'
    const values = this.archiveValuesForItem(input.itemId, item.publication_status, input.archiveScope)
    const now = new Date().toISOString()
    const comment = String(input.comment ?? '').trim()

    this.transaction(() => {
      this.run(
        `INSERT INTO item_archives (id, item_id, board_id, list_id, list_name, item_code, values_json, close_action, close_comment, closed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(),
        item.id,
        item.board_id,
        item.list_id,
        item.list_name,
        `${item.list_code}-T${String(item.item_number).padStart(2, '0')}`,
        JSON.stringify(values),
        action,
        comment,
        now
      )
      this.run(
        `UPDATE items
         SET operational_state = ?, updated_at = ?
         WHERE id = ?`,
        action,
        now,
        input.itemId
      )
    })

    return this.getBoardSnapshot(item.board_id, 'admin')
  }

  createItem(input: CreateItemInput): BoardSnapshot {
    const nextNumber = this.client.database
      .prepare('SELECT COALESCE(MAX(item_number), 0) + 1 AS next_number FROM items WHERE list_id = ?')
      .get<{ next_number: number }>(input.listId)?.next_number ?? 1
    const nextOrder = this.client.database
      .prepare('SELECT COALESCE(MAX(item_order), 0) + 1 AS next_order FROM items WHERE list_id = ?')
      .get<{ next_order: number }>(input.listId)?.next_order ?? 1
    const itemId = randomUUID()
    const now = new Date().toISOString()
    const groupId = this.validGroupId(input.listId, input.groupId ?? null)
    const values = this.validateItemValues(input.listId, input.values)

    this.transaction(() => {
      this.run(
        `INSERT INTO items (id, list_id, group_id, item_number, item_order, publication_status, operational_state, created_by, created_at, updated_at, published_at)
         VALUES (?, ?, ?, ?, ?, 'published', 'active', ?, ?, ?, ?)`,
        itemId,
        input.listId,
        groupId,
        nextNumber,
        nextOrder,
        'admin',
        now,
        now,
        now
      )
      this.upsertValues(itemId, values, 'draft')
      this.upsertValues(itemId, values, 'published')
      this.replaceDependencies(itemId, input.dependencyItemIds)
    })

    const boardId = this.client.database.prepare('SELECT board_id FROM lists WHERE id = ?').get<{ board_id: string }>(input.listId)?.board_id
    return boardId ? this.getBoardSnapshot(boardId, 'admin') : this.getActiveBoardSnapshot('admin')
  }

  updateItem(input: UpdateItemInput): BoardSnapshot {
    const item = this.client.database
      .prepare('SELECT list_id, group_id, publication_status FROM items WHERE id = ?')
      .get<{ list_id: string; group_id: string | null; publication_status: PublicationStatus }>(input.itemId)
    if (!item) throw new Error('Item not found.')

    const now = new Date().toISOString()
    const groupId = this.validGroupId(item.list_id, input.groupId === undefined ? item.group_id : input.groupId)
    const values = this.validateItemValues(item.list_id, input.values, input.itemId)

    this.transaction(() => {
      this.run(
        `UPDATE items
         SET group_id = ?,
             publication_status = 'published',
              updated_at = ?
         WHERE id = ?`,
        groupId,
        now,
        input.itemId
      )
      this.upsertValues(input.itemId, values, 'draft')
      this.upsertValues(input.itemId, values, 'published')
      this.replaceDependencies(input.itemId, input.dependencyItemIds)
    })

    const boardId = this.client.database
      .prepare('SELECT l.board_id FROM items i JOIN lists l ON l.id = i.list_id WHERE i.id = ?')
      .get<{ board_id: string }>(input.itemId)?.board_id
    return boardId ? this.getBoardSnapshot(boardId, 'admin') : this.getActiveBoardSnapshot('admin')
  }

  deleteItem(itemId: string): BoardSnapshot {
    const boardId = this.client.database
      .prepare('SELECT l.board_id FROM items i JOIN lists l ON l.id = i.list_id WHERE i.id = ?')
      .get<{ board_id: string }>(itemId)?.board_id
    this.transaction(() => {
      this.run('DELETE FROM dependencies WHERE source_item_id = ? OR target_item_id = ?', itemId, itemId)
      this.run('DELETE FROM items WHERE id = ?', itemId)
    })
    return boardId ? this.getBoardSnapshot(boardId, 'admin') : this.getActiveBoardSnapshot('admin')
  }

  createBoard(input: CreateBoardInput): BoardSnapshot {
    const userId = this.getDefaultUserId()
    const boardId = randomUUID()
    const now = new Date().toISOString()

    this.transaction(() => {
      this.run(
        `INSERT INTO boards (id, user_id, name, description, owner, is_active, created_at, updated_at)
         VALUES (?, ?, ?, '', '', 0, ?, ?)`,
        boardId,
        userId,
        input.name.trim() || 'New Board',
        now,
        now
      )
        for (let slot = 0; slot < BOARD_SUMMARY_SLOT_COUNT; slot += 1) {
          this.createSeedSummary(boardId, slot, '', null, null, 'count')
        }
    })

    return this.getBoardSnapshot(boardId, 'admin')
  }

  updateBoard(input: UpdateBoardInput): BoardSnapshot {
    const summarySlots = input.summarySlots ? this.resolveSummarySlots(input.boardId, input.summarySlots) : null
    this.transaction(() => {
      this.run(
        'UPDATE boards SET name = ?, description = ?, owner = ?, updated_at = ? WHERE id = ?',
        input.name.trim() || 'Untitled Board',
        input.description,
        input.owner,
        new Date().toISOString(),
        input.boardId
      )
      if (summarySlots) {
        this.run('DELETE FROM bottom_bar_widget_configs WHERE board_id = ?', input.boardId)
        for (const slot of summarySlots) {
          this.createSeedSummary(input.boardId, slot.slotIndex, slot.label, slot.sourceListId, slot.sourceColumnId, slot.aggregationMethod)
        }
      }
    })
    return this.getBoardSnapshot(input.boardId, 'admin')
  }

  duplicateBoard(input: DuplicateBoardInput): BoardSnapshot {
    const sourceBoard = this.client.database
      .prepare('SELECT id, user_id, name, description, owner FROM boards WHERE id = ?')
      .get<{ id: string; user_id: string; name: string; description: string; owner: string }>(input.boardId)
    if (!sourceBoard) throw new Error('Board not found.')

    const now = new Date().toISOString()
    const newBoardId = randomUUID()
    const listMap = new Map<string, string>()
    const columnMap = new Map<string, string>()
    const groupMap = new Map<string, string>()
    const itemMap = new Map<string, string>()

    this.transaction(() => {
      this.run(
        `INSERT INTO boards (id, user_id, name, description, owner, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        newBoardId,
        sourceBoard.user_id,
        `Copy of ${sourceBoard.name}`,
        sourceBoard.description,
        sourceBoard.owner,
        now,
        now
      )

      const lists = this.client.database
        .prepare(
          `SELECT id, name, code, list_type, list_config, sort_order, grid_x, grid_y, grid_w, grid_h,
                  due_date_enabled, due_date_column_id, deadline_mandatory, column_sort_order, sort_column_id, sort_direction,
                  display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board, show_status_on_board
           FROM lists
           WHERE board_id = ?
           ORDER BY sort_order`
        )
        .all<
          ListRow & {
            sort_column_id: string | null
          }
        >(input.boardId)

      for (const list of lists) {
        const newListId = randomUUID()
        listMap.set(list.id, newListId)
        this.run(
          `INSERT INTO lists
             (id, board_id, name, code, list_type, list_config, sort_order, grid_x, grid_y, grid_w, grid_h, due_date_enabled, due_date_column_id, deadline_mandatory, column_sort_order, sort_column_id, sort_direction, display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board, show_status_on_board, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newListId,
          newBoardId,
          list.name,
          list.code,
          normalizeListTemplateType(list.list_type),
          list.list_config,
          list.sort_order,
          list.grid_x,
          list.grid_y,
          list.grid_w,
          list.grid_h,
          list.due_date_enabled,
          list.deadline_mandatory,
          normalizeColumnSortOrder(list.column_sort_order),
          list.sort_direction,
          list.display_enabled,
          list.show_item_id_on_board,
          list.show_dependencies_on_board,
          list.show_created_at_on_board,
          list.show_created_by_on_board,
          list.show_status_on_board,
          now,
          now
        )
      }

      const listIds = lists.map((list) => list.id)
      if (listIds.length > 0) {
        const columns = this.client.database
          .prepare(
            `SELECT id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_list_summary_eligible, is_board_summary_eligible, display_format, is_system
             FROM list_columns
             WHERE list_id IN (${this.placeholders(listIds)})
             ORDER BY list_id, sort_order`
          )
          .all<ColumnRow>(...listIds)

        for (const column of columns) {
          const newColumnId = randomUUID()
          columnMap.set(column.id, newColumnId)
          const newListId = listMap.get(column.list_id)
          if (!newListId) continue
          this.run(
            `INSERT INTO list_columns
               (id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_list_summary_eligible, is_board_summary_eligible, display_format, is_system, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            newColumnId,
            newListId,
            column.name,
            column.column_type,
            column.sort_order,
            column.is_required,
            column.max_length,
            column.is_summary_eligible,
            column.is_list_summary_eligible,
            column.is_board_summary_eligible,
            column.display_format,
            column.is_system,
            now,
            now
          )
        }

        for (const list of lists) {
          const newListId = listMap.get(list.id)
          if (!newListId) continue
          const newDueDateColumnId = list.due_date_column_id ? columnMap.get(list.due_date_column_id) ?? null : null
          const newSortColumnId = list.sort_column_id ? columnMap.get(list.sort_column_id) ?? null : null
          this.run(
            `UPDATE lists
             SET due_date_column_id = ?,
                 sort_column_id = ?
             WHERE id = ?`,
            newDueDateColumnId,
            newSortColumnId,
            newListId
          )
        }

        const groups = this.client.database
          .prepare(
            `SELECT id, list_id, parent_group_id, name, code, sort_order, display_config
             FROM item_groups
             WHERE list_id IN (${this.placeholders(listIds)})
             ORDER BY list_id, sort_order`
          )
          .all<GroupRow>(...listIds)

        for (const group of groups) {
          groupMap.set(group.id, randomUUID())
        }

        for (const group of groups) {
          const newGroupId = groupMap.get(group.id)
          const newListId = listMap.get(group.list_id)
          if (!newGroupId || !newListId) continue
          const groupDisplay = this.readGroupDisplayConfig(group.display_config)
          const remappedSummaries = groupDisplay.summaries
            .map((summary) => ({
              columnId: columnMap.get(summary.columnId) ?? '',
              method: summary.method
            }))
            .filter((summary) => summary.columnId.length > 0)

          this.run(
            `INSERT INTO item_groups (id, list_id, parent_group_id, name, code, sort_order, display_config, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            newGroupId,
            newListId,
            group.parent_group_id ? (groupMap.get(group.parent_group_id) ?? null) : null,
            group.name,
            group.code,
            group.sort_order,
            this.writeGroupDisplayConfig(groupDisplay.showIdOnBoard, remappedSummaries),
            now,
            now
          )
        }

        const items = this.client.database
          .prepare(
            `SELECT id, list_id, group_id, item_number, item_order, publication_status, operational_state, created_by, created_at, published_at
             FROM items
             WHERE list_id IN (${this.placeholders(listIds)})
             ORDER BY list_id, item_order`
          )
          .all<
            ItemRow & {
              published_at: string | null
            }
          >(...listIds)

        for (const item of items) {
          const newItemId = randomUUID()
          itemMap.set(item.id, newItemId)
          const newListId = listMap.get(item.list_id)
          if (!newListId) continue
          this.run(
            `INSERT INTO items
               (id, list_id, group_id, item_number, item_order, publication_status, operational_state, created_by, created_at, updated_at, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            newItemId,
            newListId,
            item.group_id ? (groupMap.get(item.group_id) ?? null) : null,
            item.item_number,
            item.item_order,
            item.publication_status,
            item.operational_state,
            item.created_by,
            item.created_at,
            now,
            item.published_at
          )
        }

        const itemIds = items.map((item) => item.id)
        if (itemIds.length > 0) {
          const values = this.client.database
            .prepare(
              `SELECT item_id, column_id, version_scope, value_text, value_number, value_date, value_boolean, value_json
               FROM item_field_values
               WHERE item_id IN (${this.placeholders(itemIds)})`
            )
            .all<
              ValueRow & {
                version_scope: 'draft' | 'published'
              }
            >(...itemIds)

          for (const value of values) {
            const newItemId = itemMap.get(value.item_id)
            const newColumnId = columnMap.get(value.column_id)
            if (!newItemId || !newColumnId) continue
            this.run(
              `INSERT INTO item_field_values
                 (id, item_id, column_id, version_scope, value_text, value_number, value_date, value_boolean, value_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              randomUUID(),
              newItemId,
              newColumnId,
              value.version_scope,
              value.value_text,
              value.value_number,
              value.value_date,
              value.value_boolean,
              value.value_json,
              now
            )
          }

          const dependencies = this.client.database
            .prepare(
              `SELECT source_item_id, target_item_id, dependency_type
               FROM dependencies
               WHERE source_item_id IN (${this.placeholders(itemIds)})
                 AND target_item_id IN (${this.placeholders(itemIds)})`
            )
            .all<{ source_item_id: string; target_item_id: string; dependency_type: string }>(
              ...itemIds,
              ...itemIds
            )

          for (const dependency of dependencies) {
            const newSourceId = itemMap.get(dependency.source_item_id)
            const newTargetId = itemMap.get(dependency.target_item_id)
            if (!newSourceId || !newTargetId) continue
            this.run(
              `INSERT INTO dependencies (id, source_item_id, target_item_id, dependency_type, created_at)
               VALUES (?, ?, ?, ?, ?)`,
              randomUUID(),
              newSourceId,
              newTargetId,
              dependency.dependency_type,
              now
            )
          }
        }
      }

      const widgets = this.client.database
        .prepare(
          `SELECT widget_type, name, sort_order, grid_x, grid_y, grid_w, grid_h, display_enabled, config_json
           FROM board_widgets
           WHERE board_id = ?
           ORDER BY sort_order`
        )
        .all<WidgetRow>(input.boardId)

      for (const widget of widgets) {
        this.run(
          `INSERT INTO board_widgets
             (id, board_id, widget_type, name, sort_order, grid_x, grid_y, grid_w, grid_h, display_enabled, config_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          randomUUID(),
          newBoardId,
          widget.widget_type,
          widget.name,
          widget.sort_order,
          widget.grid_x,
          widget.grid_y,
          widget.grid_w,
          widget.grid_h,
          widget.display_enabled,
          widget.config_json,
          now,
          now
        )
      }

      const summarySlots = this.client.database
        .prepare(
          `SELECT slot_index, label, source_list_id, source_column_id, aggregation_method
           FROM bottom_bar_widget_configs
           WHERE board_id = ?
           ORDER BY slot_index`
        )
        .all<BottomSlotRow>(input.boardId)

      if (summarySlots.length === 0) {
        this.createSeedSummary(newBoardId, 0, 'Slot 1', null, null, 'count')
        this.createSeedSummary(newBoardId, 1, 'Slot 2', null, null, 'count')
        this.createSeedSummary(newBoardId, 2, 'Slot 3', null, null, 'count')
        this.createSeedSummary(newBoardId, 3, 'Slot 4', null, null, 'count')
        this.createSeedSummary(newBoardId, 4, 'Slot 5', null, null, 'count')
      } else {
        for (const slot of summarySlots) {
          this.run(
            `INSERT INTO bottom_bar_widget_configs
               (id, board_id, slot_index, label, source_list_id, source_column_id, aggregation_method, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            randomUUID(),
            newBoardId,
            slot.slot_index,
            slot.label,
            slot.source_list_id ? (listMap.get(slot.source_list_id) ?? null) : null,
            slot.source_column_id ? (columnMap.get(slot.source_column_id) ?? null) : null,
            slot.aggregation_method,
            now,
            now
          )
        }
      }
    })

    return this.getBoardSnapshot(newBoardId, 'admin')
  }

  deleteBoard(input: DeleteBoardInput): BoardSnapshot {
    const board = this.client.database
      .prepare('SELECT id, user_id, name, is_active FROM boards WHERE id = ?')
      .get<{ id: string; user_id: string; name: string; is_active: number }>(input.boardId)
    if (!board) throw new Error('Board not found.')

    const now = new Date().toISOString()
    const keepBoardId = input.keepBoardId && input.keepBoardId !== input.boardId ? input.keepBoardId : null
    const activeItems = this.client.database
      .prepare(
        `SELECT i.id, i.item_number, i.publication_status, l.id AS list_id, l.name AS list_name, l.code AS list_code
         FROM items i
         JOIN lists l ON l.id = i.list_id
         WHERE l.board_id = ?
           AND i.operational_state = 'active'`
      )
      .all<{
        id: string
        item_number: number
        publication_status: PublicationStatus
        list_id: string
        list_name: string
        list_code: string
      }>(input.boardId)

    let returnBoardId = keepBoardId

    this.transaction(() => {
      for (const item of activeItems) {
        const values = this.archiveValuesForItem(item.id, item.publication_status, 'draft')
        this.run(
          `INSERT INTO item_archives (id, item_id, board_id, list_id, list_name, item_code, values_json, close_action, close_comment, closed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          randomUUID(),
          item.id,
          input.boardId,
          item.list_id,
          item.list_name,
          `${item.list_code}-T${String(item.item_number).padStart(2, '0')}`,
          JSON.stringify(values),
          'cancelled',
          `cancelled as board deleted - boardID: ${input.boardId}`,
          now
        )
        this.run(`UPDATE items SET operational_state = 'cancelled', updated_at = ? WHERE id = ?`, now, item.id)
      }

      this.run('DELETE FROM boards WHERE id = ?', input.boardId)

      const remainingBoards = this.client.database
        .prepare('SELECT id, is_active FROM boards ORDER BY is_active DESC, name')
        .all<{ id: string; is_active: number }>()

      if (remainingBoards.length === 0) {
        const replacementId = randomUUID()
        this.run(
          `INSERT INTO boards (id, user_id, name, description, owner, is_active, created_at, updated_at)
           VALUES (?, ?, ?, '', '', 1, ?, ?)`,
          replacementId,
          board.user_id,
          'New Board',
          now,
          now
        )
        for (let slot = 0; slot < BOARD_SUMMARY_SLOT_COUNT; slot += 1) {
          this.createSeedSummary(replacementId, slot, '', null, null, 'count')
        }
        this.run('UPDATE display_configs SET active_board_id = ?, updated_at = ?', replacementId, now)
        returnBoardId = replacementId
        return
      }

      if (board.is_active === 1) {
        const nextActiveBoardId =
          (keepBoardId && remainingBoards.some((candidate) => candidate.id === keepBoardId) ? keepBoardId : remainingBoards[0]?.id) ??
          remainingBoards[0].id
        this.run('UPDATE boards SET is_active = 0, updated_at = ?', now)
        this.run('UPDATE boards SET is_active = 1, updated_at = ? WHERE id = ?', now, nextActiveBoardId)
        this.run('UPDATE display_configs SET active_board_id = ?, updated_at = ?', nextActiveBoardId, now)
        returnBoardId = nextActiveBoardId
        return
      }

      if (!returnBoardId || !remainingBoards.some((candidate) => candidate.id === returnBoardId)) {
        const activeBoardId = remainingBoards.find((candidate) => candidate.is_active === 1)?.id ?? remainingBoards[0].id
        returnBoardId = activeBoardId
      }
    })

    return this.getBoardSnapshot(returnBoardId ?? this.getActiveBoardSnapshot('admin').id, 'admin')
  }

  createList(input: CreateListInput): BoardSnapshot {
    const next = this.client.database
      .prepare(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order,
                COALESCE(MAX(CAST(SUBSTR(code, 2) AS INTEGER)), 0) + 1 AS next_code
         FROM lists
         WHERE board_id = ?`
      )
      .get<{ next_order: number; next_code: number }>(input.boardId)

    const listId = randomUUID()
    const now = new Date().toISOString()
    const code = `L${String(next?.next_code ?? 1).padStart(2, '0')}`
    const templateType = normalizeListTemplateType(input.templateType)

    this.transaction(() => {
      this.run(
        `INSERT INTO lists
           (id, board_id, name, code, list_type, list_config, sort_order, grid_x, grid_y, grid_w, grid_h, due_date_enabled, display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board, show_status_on_board, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, 1, 0, 0, 1, ?, ?)`,
        listId,
        input.boardId,
        input.name.trim() || 'New List',
        code,
        templateType,
        JSON.stringify(defaultListTemplateConfig(templateType)),
        next?.next_order ?? 0,
        0,
        0,
        0,
        0,
        0,
        now,
        now
      )
      this.createTemplateList(listId, templateType)
    })

    return this.getBoardSnapshot(input.boardId, 'admin')
  }

  updateList(input: UpdateListInput): BoardSnapshot {
    const list = this.client.database
      .prepare('SELECT board_id, list_type, list_config, column_sort_order FROM lists WHERE id = ?')
      .get<{ board_id: string; list_type: ListTemplateType; list_config: string | null; column_sort_order: ColumnSortOrder }>(input.listId)
    if (!list) throw new Error('List not found.')
    const currentTemplateType = normalizeListTemplateType(list.list_type)
    const nextTemplateType = normalizeListTemplateType(input.templateType ?? list.list_type)
    const templateChanged = nextTemplateType !== currentTemplateType
    if (templateChanged && !this.canRetemplateList(input.listId, currentTemplateType)) {
      throw new Error('List type can only be changed while the list is still new and empty.')
    }

    const now = new Date().toISOString()
    const grid = input.displayEnabled
      ? {
          x: this.clamp(input.grid.x, 1, 16),
          y: this.clamp(input.grid.y, 1, 8),
          w: this.clamp(input.grid.w, MIN_LIST_GRID_WIDTH, 16),
          h: this.clamp(input.grid.h, MIN_LIST_GRID_HEIGHT, 8)
        }
      : { x: 0, y: 0, w: 0, h: 0 }

    if (input.displayEnabled) this.assertListGridPlacement(list.board_id, input.listId, grid)

    this.transaction(() => {
      if (templateChanged) {
        this.retemplateList(input.listId, nextTemplateType)
      }
    const dueDateColumnId = nextTemplateType !== 'birthday_calendar' && input.dueDateEnabled ? this.ensureDeadlineColumn(input.listId, input.deadlineMandatory) : null
    const columnSortOrder = normalizeColumnSortOrder(input.columnSortOrder ?? list.column_sort_order)
    const birthdaySortColumnId =
      nextTemplateType === 'birthday_calendar'
        ? this.client.database
            .prepare("SELECT id FROM list_columns WHERE list_id = ? AND lower(name) = 'birthday' ORDER BY sort_order LIMIT 1")
            .get<{ id: string }>(input.listId)?.id ?? null
        : null
    const nextSortColumnId = nextTemplateType === 'birthday_calendar' ? birthdaySortColumnId : input.sortDirection === 'manual' ? null : input.sortColumnId
    const nextSortDirection = nextTemplateType === 'birthday_calendar' ? (birthdaySortColumnId ? 'asc' : 'manual') : input.sortColumnId ? input.sortDirection : 'manual'
    this.run(
      `UPDATE lists
         SET name = ?,
              list_type = ?,
              list_config = ?,
              grid_x = ?,
              grid_y = ?,
              grid_w = ?,
              grid_h = ?,
               due_date_enabled = ?,
               due_date_column_id = ?,
               deadline_mandatory = ?,
               column_sort_order = ?,
               sort_column_id = ?,
              sort_direction = ?,
              display_enabled = ?,
              show_item_id_on_board = ?,
              show_dependencies_on_board = ?,
              show_created_at_on_board = ?,
              show_created_by_on_board = ?,
              show_status_on_board = ?,
              updated_at = ?
         WHERE id = ?`,
        input.name.trim() || 'Untitled List',
        nextTemplateType,
        JSON.stringify(input.templateConfig ?? this.readListTemplateConfig(nextTemplateType, templateChanged ? JSON.stringify(defaultListTemplateConfig(nextTemplateType)) : list.list_config)),
        grid.x,
        grid.y,
        grid.w,
        grid.h,
        nextTemplateType === 'birthday_calendar' ? 0 : input.dueDateEnabled ? 1 : 0,
        nextTemplateType === 'birthday_calendar' ? null : dueDateColumnId,
        nextTemplateType === 'birthday_calendar' ? 0 : input.dueDateEnabled && input.deadlineMandatory ? 1 : 0,
        columnSortOrder,
        nextSortColumnId,
        nextSortDirection,
        input.displayEnabled ? 1 : 0,
        input.showItemIdOnBoard ? 1 : 0,
        input.showDependenciesOnBoard ? 1 : 0,
        input.showCreatedAtOnBoard ? 1 : 0,
        input.showCreatedByOnBoard ? 1 : 0,
        input.showStatusOnBoard ? 1 : 0,
        now,
        input.listId
      )
      if (columnSortOrder !== 'manual') {
        this.applyColumnSortOrder(input.listId, columnSortOrder, nextTemplateType)
      }
    })

    return this.getBoardSnapshot(list.board_id, 'admin')
  }

  updateSummarySlots(input: UpdateSummarySlotsInput): BoardSnapshot {
    const slots = this.resolveSummarySlots(input.boardId, input.slots)

    this.transaction(() => {
      this.run('DELETE FROM bottom_bar_widget_configs WHERE board_id = ?', input.boardId)
      for (const slot of slots) {
        this.createSeedSummary(input.boardId, slot.slotIndex, slot.label, slot.sourceListId, slot.sourceColumnId, slot.aggregationMethod)
      }
    })

    return this.getBoardSnapshot(input.boardId, 'admin')
  }

  updateListLayouts(input: { listId: string; grid: BoardList['grid'] }[]): BoardSnapshot {
    if (input.length === 0) throw new Error('No list layout updates were provided.')

    const uniqueIds = new Set(input.map((entry) => entry.listId))
    if (uniqueIds.size !== input.length) throw new Error('Duplicate list layout updates are not allowed.')

    const listRows = input.map((entry) => {
      const row = this.client.database
        .prepare('SELECT id, board_id FROM lists WHERE id = ?')
        .get<{ id: string; board_id: string }>(entry.listId)
      if (!row) throw new Error('List not found.')
      return row
    })

    const boardId = listRows[0].board_id
    if (listRows.some((row) => row.board_id !== boardId)) {
      throw new Error('All updated lists must belong to the same board.')
    }

    const normalized = input.map((entry) => ({
      listId: entry.listId,
      grid: {
        x: this.clamp(entry.grid.x, 1, 16),
        y: this.clamp(entry.grid.y, 1, 8),
        w: this.clamp(entry.grid.w, MIN_LIST_GRID_WIDTH, 16),
        h: this.clamp(entry.grid.h, MIN_LIST_GRID_HEIGHT, 8)
      }
    }))

    this.assertListGridPlacementBatch(boardId, normalized)

    this.transaction(() => {
      const now = new Date().toISOString()
      for (const entry of normalized) {
        this.run(
          `UPDATE lists
           SET grid_x = ?, grid_y = ?, grid_w = ?, grid_h = ?, display_enabled = 1, updated_at = ?
           WHERE id = ?`,
          entry.grid.x,
          entry.grid.y,
          entry.grid.w,
          entry.grid.h,
          now,
          entry.listId
        )
      }
    })

    return this.getBoardSnapshot(boardId, 'admin')
  }

  updateBoardLayouts(input: { lists: { listId: string; grid: BoardList['grid'] }[]; widgets: { widgetId: string; grid: BoardWidget['grid'] }[] }): BoardSnapshot {
    if (input.lists.length === 0 && input.widgets.length === 0) throw new Error('No board layout updates were provided.')

    const listIds = new Set(input.lists.map((entry) => entry.listId))
    if (listIds.size !== input.lists.length) throw new Error('Duplicate list layout updates are not allowed.')
    const widgetIds = new Set(input.widgets.map((entry) => entry.widgetId))
    if (widgetIds.size !== input.widgets.length) throw new Error('Duplicate widget layout updates are not allowed.')

    const listRows = input.lists.map((entry) => {
      const row = this.client.database
        .prepare('SELECT id, board_id FROM lists WHERE id = ?')
        .get<{ id: string; board_id: string }>(entry.listId)
      if (!row) throw new Error('List not found.')
      return row
    })

    const widgetRows = input.widgets.map((entry) => {
      const row = this.client.database
        .prepare('SELECT id, board_id, widget_type, config_json FROM board_widgets WHERE id = ?')
        .get<{ id: string; board_id: string; widget_type: WidgetType; config_json: string | null }>(entry.widgetId)
      if (!row) throw new Error('Widget not found.')
      return row
    })

    const boardId = listRows[0]?.board_id ?? widgetRows[0]?.board_id
    if (!boardId) throw new Error('No board found for layout updates.')
    if (listRows.some((row) => row.board_id !== boardId) || widgetRows.some((row) => row.board_id !== boardId)) {
      throw new Error('All updated elements must belong to the same board.')
    }

    const normalizedLists = input.lists.map((entry) => ({
      listId: entry.listId,
      grid: {
        x: this.clamp(entry.grid.x, 1, 16),
        y: this.clamp(entry.grid.y, 1, 8),
        w: this.clamp(entry.grid.w, MIN_LIST_GRID_WIDTH, 16),
        h: this.clamp(entry.grid.h, MIN_LIST_GRID_HEIGHT, 8)
      }
    }))

    const normalizedWidgets = input.widgets.map((entry) => {
      const row = widgetRows.find((candidate) => candidate.id === entry.widgetId)
      const type = normalizeWidgetType(row?.widget_type)
      const config = this.normalizeWidgetConfig(type, row ? this.readWidgetConfig(type, row.config_json) : undefined)
      return {
        widgetId: entry.widgetId,
        grid: this.normalizeWidgetGrid(entry.grid, type, config)
      }
    })

    this.assertBoardLayoutPlacementBatch(boardId, normalizedLists, normalizedWidgets)

    this.transaction(() => {
      const now = new Date().toISOString()
      for (const entry of normalizedLists) {
        this.run(
          `UPDATE lists
           SET grid_x = ?, grid_y = ?, grid_w = ?, grid_h = ?, display_enabled = 1, updated_at = ?
           WHERE id = ?`,
          entry.grid.x,
          entry.grid.y,
          entry.grid.w,
          entry.grid.h,
          now,
          entry.listId
        )
      }
      for (const entry of normalizedWidgets) {
        this.run(
          `UPDATE board_widgets
           SET grid_x = ?, grid_y = ?, grid_w = ?, grid_h = ?, display_enabled = 1, updated_at = ?
           WHERE id = ?`,
          entry.grid.x,
          entry.grid.y,
          entry.grid.w,
          entry.grid.h,
          now,
          entry.widgetId
        )
      }
    })

    return this.getBoardSnapshot(boardId, 'admin')
  }

  deleteList(listId: string): BoardSnapshot {
    const boardId = this.client.database.prepare('SELECT board_id FROM lists WHERE id = ?').get<{ board_id: string }>(listId)?.board_id
    this.run('DELETE FROM lists WHERE id = ?', listId)
    return boardId ? this.getBoardSnapshot(boardId, 'admin') : this.getActiveBoardSnapshot('admin')
  }

  createGroup(input: CreateGroupInput): BoardSnapshot {
    const list = this.client.database
      .prepare('SELECT board_id FROM lists WHERE id = ?')
      .get<{ board_id: string }>(input.listId)
    if (!list) throw new Error('List not found.')

    const next = this.getNextGroupPosition(input.listId)
    const groupId = randomUUID()
    const now = new Date().toISOString()
    const parentGroupId = this.validParentGroupId(input.listId, input.parentGroupId ?? null, groupId)

    this.run(
      `INSERT INTO item_groups (id, list_id, parent_group_id, name, code, sort_order, display_config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      groupId,
      input.listId,
      parentGroupId,
      input.name.trim() || 'New Group',
      next.code,
      next.order,
      this.writeGroupDisplayConfig(true, []),
      now,
      now
    )

    return this.getBoardSnapshot(list.board_id, 'admin')
  }

  updateGroup(input: UpdateGroupInput): BoardSnapshot {
    const group = this.client.database
      .prepare('SELECT list_id, display_config FROM item_groups WHERE id = ?')
      .get<{ list_id: string; display_config: string | null }>(input.groupId)
    if (!group) throw new Error('Group not found.')

    const existingDisplay = this.readGroupDisplayConfig(group.display_config)
    const parentGroupId = this.validParentGroupId(group.list_id, input.parentGroupId ?? null, input.groupId)
    this.run(
      `UPDATE item_groups
       SET name = ?,
           parent_group_id = ?,
           display_config = ?,
           updated_at = ?
       WHERE id = ?`,
      input.name.trim() || 'Untitled Group',
      parentGroupId,
      this.writeGroupDisplayConfig(input.showIdOnBoard ?? existingDisplay.showIdOnBoard, input.summaries ?? existingDisplay.summaries),
      new Date().toISOString(),
      input.groupId
    )

    const boardId = this.client.database.prepare('SELECT board_id FROM lists WHERE id = ?').get<{ board_id: string }>(group.list_id)?.board_id
    return boardId ? this.getBoardSnapshot(boardId, 'admin') : this.getActiveBoardSnapshot('admin')
  }

  deleteGroup(groupId: string): BoardSnapshot {
    const group = this.client.database
      .prepare('SELECT list_id FROM item_groups WHERE id = ?')
      .get<{ list_id: string }>(groupId)
    if (!group) throw new Error('Group not found.')

    this.transaction(() => {
      this.run('UPDATE items SET group_id = NULL, updated_at = ? WHERE group_id = ?', new Date().toISOString(), groupId)
      this.run('UPDATE item_groups SET parent_group_id = NULL, updated_at = ? WHERE parent_group_id = ?', new Date().toISOString(), groupId)
      this.run('DELETE FROM item_groups WHERE id = ?', groupId)
    })

    const boardId = this.client.database.prepare('SELECT board_id FROM lists WHERE id = ?').get<{ board_id: string }>(group.list_id)?.board_id
    return boardId ? this.getBoardSnapshot(boardId, 'admin') : this.getActiveBoardSnapshot('admin')
  }

  moveListToBoard(input: MoveListInput): BoardSnapshot {
    const list = this.client.database.prepare('SELECT name FROM lists WHERE id = ?').get<{ name: string }>(input.listId)
    if (!list) throw new Error('List not found.')

    const next = this.getNextListPosition(input.targetBoardId)
    this.run(
      `UPDATE lists
       SET board_id = ?, code = ?, sort_order = ?, grid_x = ?, grid_y = ?, grid_w = ?, grid_h = ?, display_enabled = ?, updated_at = ?
       WHERE id = ?`,
      input.targetBoardId,
      next.code,
      next.order,
      0,
      0,
      0,
      0,
      0,
      new Date().toISOString(),
      input.listId
    )
    return this.getBoardSnapshot(input.targetBoardId, 'admin')
  }

  copyListToBoard(input: MoveListInput): BoardSnapshot {
    const sourceList = this.client.database
      .prepare(
        `SELECT id, name, list_type, list_config, due_date_enabled, due_date_column_id, deadline_mandatory, column_sort_order, sort_column_id, sort_direction, display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board, show_status_on_board, grid_w, grid_h
         FROM lists
         WHERE id = ?`
      )
      .get<{
        id: string
        name: string
        list_type: ListTemplateType
        list_config: string | null
        due_date_enabled: number
        due_date_column_id: string | null
        deadline_mandatory: number
        column_sort_order: ColumnSortOrder
        sort_column_id: string | null
        sort_direction: ListSortDirection
        display_enabled: number
        show_item_id_on_board: number
        show_dependencies_on_board: number
        show_created_at_on_board: number
        show_created_by_on_board: number
        show_status_on_board: number
        grid_w: number
        grid_h: number
      }>(input.listId)
    if (!sourceList) throw new Error('List not found.')

    const next = this.getNextListPosition(input.targetBoardId)
    const now = new Date().toISOString()
    const newListId = randomUUID()
    const columnMap = new Map<string, string>()
    const groupMap = new Map<string, string>()
    const itemMap = new Map<string, string>()

    this.transaction(() => {
      this.run(
        `INSERT INTO lists
           (id, board_id, name, code, list_type, list_config, sort_order, grid_x, grid_y, grid_w, grid_h, due_date_enabled, deadline_mandatory, column_sort_order, display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board, show_status_on_board, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newListId,
        input.targetBoardId,
        `${sourceList.name} Copy`,
        next.code,
        normalizeListTemplateType(sourceList.list_type),
        sourceList.list_config,
        next.order,
        0,
        0,
        0,
        0,
        sourceList.due_date_enabled,
        sourceList.deadline_mandatory,
        normalizeColumnSortOrder(sourceList.column_sort_order),
        0,
        sourceList.show_item_id_on_board,
        sourceList.show_dependencies_on_board,
        sourceList.show_created_at_on_board,
        sourceList.show_created_by_on_board,
        sourceList.show_status_on_board,
        now,
        now
      )

      const columns = this.client.database
        .prepare(
          `SELECT id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_list_summary_eligible, is_board_summary_eligible, is_system, display_format
           FROM list_columns
           WHERE list_id = ?
           ORDER BY sort_order`
        )
        .all<ColumnRow>(input.listId)
      for (const column of columns) {
        const newColumnId = randomUUID()
        columnMap.set(column.id, newColumnId)
        this.run(
          `INSERT INTO list_columns
             (id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_list_summary_eligible, is_board_summary_eligible, display_format, is_system, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newColumnId,
          newListId,
          column.name,
          column.column_type,
          column.sort_order,
          column.is_required,
          column.max_length,
          column.is_summary_eligible,
          column.is_list_summary_eligible,
          column.is_board_summary_eligible,
          column.display_format,
          column.is_system,
          now,
          now
        )
      }

      const newDueDateColumnId = sourceList.due_date_column_id ? columnMap.get(sourceList.due_date_column_id) : null
      if (newDueDateColumnId) this.run('UPDATE lists SET due_date_column_id = ? WHERE id = ?', newDueDateColumnId, newListId)
      const newSortColumnId = sourceList.sort_column_id ? columnMap.get(sourceList.sort_column_id) : null
      if (newSortColumnId) {
        this.run(
          'UPDATE lists SET sort_column_id = ?, sort_direction = ? WHERE id = ?',
          newSortColumnId,
          sourceList.sort_direction,
          newListId
        )
      }

      const groups = this.client.database
        .prepare(
          `SELECT id, parent_group_id, name, code, sort_order, display_config
           FROM item_groups
           WHERE list_id = ?
           ORDER BY sort_order`
        )
        .all<Pick<GroupRow, 'id' | 'parent_group_id' | 'name' | 'code' | 'sort_order' | 'display_config'>>(input.listId)
      for (const group of groups) {
        groupMap.set(group.id, randomUUID())
      }
      for (const group of groups) {
        const newGroupId = groupMap.get(group.id)
        if (!newGroupId) continue
        this.run(
          `INSERT INTO item_groups (id, list_id, parent_group_id, name, code, sort_order, display_config, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newGroupId,
          newListId,
          group.parent_group_id ? (groupMap.get(group.parent_group_id) ?? null) : null,
          group.name,
          group.code,
          group.sort_order,
          group.display_config,
          now,
          now
        )
      }

      const items = this.client.database
        .prepare(
          `SELECT id, group_id, item_number, item_order, publication_status, operational_state, created_by, created_at, published_at
           FROM items
           WHERE list_id = ?
           ORDER BY item_order`
        )
        .all<{
          id: string
          group_id: string | null
          item_number: number
          item_order: number
          publication_status: PublicationStatus
          operational_state: OperationalState
          created_by: string
          created_at: string
          published_at: string | null
        }>(input.listId)
      for (const item of items) {
        const newItemId = randomUUID()
        itemMap.set(item.id, newItemId)
        this.run(
          `INSERT INTO items
             (id, list_id, group_id, item_number, item_order, publication_status, operational_state, created_by, created_at, updated_at, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newItemId,
          newListId,
          item.group_id ? (groupMap.get(item.group_id) ?? null) : null,
          item.item_number,
          item.item_order,
          item.publication_status,
          item.operational_state,
          item.created_by,
          item.created_at,
          now,
          item.published_at
        )
      }

      if (items.length > 0) {
        const values = this.client.database
          .prepare(
            `SELECT item_id, column_id, version_scope, value_text, value_number, value_date, value_boolean, value_json
             FROM item_field_values
             WHERE item_id IN (${this.placeholders(items.map((item) => item.id))})`
          )
          .all<{
            item_id: string
            column_id: string
            version_scope: 'draft' | 'published'
            value_text: string | null
            value_number: number | null
            value_date: string | null
            value_boolean: number | null
            value_json: string | null
          }>(...items.map((item) => item.id))
        for (const value of values) {
          const newItemId = itemMap.get(value.item_id)
          const newColumnId = columnMap.get(value.column_id)
          if (!newItemId || !newColumnId) continue
          this.run(
            `INSERT INTO item_field_values
               (id, item_id, column_id, version_scope, value_text, value_number, value_date, value_boolean, value_json, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            randomUUID(),
            newItemId,
            newColumnId,
            value.version_scope,
            value.value_text,
            value.value_number,
            value.value_date,
            value.value_boolean,
            value.value_json,
            now
          )
        }
      }
    })

    return this.getBoardSnapshot(input.targetBoardId, 'admin')
  }

  createColumn(input: CreateColumnInput): BoardSnapshot {
    const resolvedName = input.name.trim() || 'New Column'
    this.assertColumnNameAllowed(input.listId, resolvedName)
    const list = this.client.database
      .prepare('SELECT board_id, list_type, column_sort_order FROM lists WHERE id = ?')
      .get<{ board_id: string; list_type: ListTemplateType; column_sort_order: ColumnSortOrder }>(input.listId)
    if (!list) throw new Error('List not found.')
    const summarySelection = this.resolveColumnSummaryEligibility(
      input.listId,
      resolvedName,
      input.type,
      null,
      false,
      false
    )
    const maxOrder = this.client.database
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM list_columns WHERE list_id = ?')
      .get<{ next_order: number }>(input.listId)?.next_order ?? 0
    const columnSortOrder = normalizeColumnSortOrder(input.columnSortOrder ?? list.column_sort_order)
    const nextOrder = input.addOnTop ? 0 : maxOrder

    this.transaction(() => {
      if (input.addOnTop) {
        this.run('UPDATE list_columns SET sort_order = sort_order + 1 WHERE list_id = ?', input.listId)
      }
      this.createSeedColumn(
        input.listId,
        resolvedName,
        input.type,
        nextOrder,
        false,
        null,
        summarySelection.list,
        summarySelection.board,
        false,
        this.writeColumnDisplayFormat(
          null,
          input.type === 'choice' ? (input.choiceConfig ?? defaultChoiceConfig(resolvedName, input.type)) : null,
          input.type === 'date' ? (input.dateDisplayFormat ?? 'date') : 'date',
          input.type === 'date' ? (input.recurrence ?? 'none') : 'none',
          input.type === 'date' ? (input.recurrenceDays ?? []) : [],
          input.type === 'currency' ? input.currencyCode : undefined,
          input.showOnBoard ?? true,
          input.type === 'duration' ? input.durationDisplayFormat : undefined
        )
      )
      if (!input.addOnTop && columnSortOrder !== 'manual') {
        this.applyColumnSortOrder(input.listId, columnSortOrder, list.list_type)
      }
    })
    return this.getBoardSnapshot(list.board_id, 'admin')
  }

  updateColumn(input: UpdateColumnInput): BoardSnapshot {
    const existing = this.client.database
      .prepare(
          `SELECT c.name, c.column_type, c.is_required, c.max_length, c.display_format, c.list_id, l.board_id, l.list_type
          FROM list_columns c
          JOIN lists l ON l.id = c.list_id
          WHERE c.id = ?`
      )
      .get<{
        name: string
        column_type: ColumnType
        is_required: number
        max_length: number | null
        display_format: string | null
        list_id: string
        board_id: string
        list_type: ListTemplateType
      }>(input.columnId)
    if (!existing) throw new Error('Column not found.')
    const existingFormat = this.readColumnDisplayFormat(existing?.display_format ?? null)
    const role = existingFormat.role
    const resolvedName = role === 'deadline' ? input.name.trim() || existing.name : input.name.trim() || 'Untitled Column'
    if (role !== 'deadline') this.assertColumnNameAllowed(existing.list_id, resolvedName, input.columnId)
    const type = role === 'deadline' ? 'date' : input.type
    const dateDisplayFormat =
      role === 'deadline'
        ? normalizeDeadlineDisplayFormat(input.dateDisplayFormat ?? existingFormat.dateDisplayFormat)
        : type === 'date' ? (input.dateDisplayFormat ?? existingFormat.dateDisplayFormat) : 'date'
    const recurrence = type === 'date' && dateDisplayFormat === 'time' ? (input.recurrence ?? existingFormat.recurrence) : 'none'
    const recurrenceDays = type === 'date' && dateDisplayFormat === 'time' ? (input.recurrenceDays ?? existingFormat.recurrenceDays) : []
    const requestedCurrencyCode = type === 'currency' ? normalizeCurrencyCode(input.currencyCode ?? existingFormat.currencyCode) : 'USD'
    const currencyCode =
      this.isShoppingCostColumn(existing.list_type, existing.name) ? this.shoppingPriceCurrencyCode(existing.list_id) : requestedCurrencyCode
    const durationDisplayFormat = type === 'duration' ? normalizeDurationDisplayFormat(input.durationDisplayFormat ?? existingFormat.durationDisplayFormat) : 'days_hours'
    const showOnBoard = input.showOnBoard ?? existingFormat.showOnBoard
    if (this.isProtectedBirthdayColumn(existing.list_type, existing.name)) {
      this.assertProtectedBirthdayColumnUpdateAllowed(existing, resolvedName, type, input)
    }
    const summarySelection = this.resolveColumnSummaryEligibility(
      existing.list_id,
      resolvedName,
      type,
      role,
      input.listSummaryEligible,
      input.boardSummaryEligible,
      input.columnId
    )

    this.transaction(() => {
      this.run(
        `UPDATE list_columns
         SET name = ?,
             column_type = ?,
             is_required = ?,
             max_length = ?,
             is_summary_eligible = ?,
             is_list_summary_eligible = ?,
             is_board_summary_eligible = ?,
             display_format = ?,
             updated_at = ?
          WHERE id = ?`,
        resolvedName,
        type,
        input.required ? 1 : 0,
        input.maxLength,
        summarySelection.list || summarySelection.board ? 1 : 0,
        summarySelection.list ? 1 : 0,
        summarySelection.board ? 1 : 0,
        this.writeColumnDisplayFormat(
          role,
          type === 'choice' ? (input.choiceConfig ?? defaultChoiceConfig(resolvedName, type)) : null,
          dateDisplayFormat,
          recurrence,
          recurrenceDays,
          currencyCode,
          showOnBoard,
          durationDisplayFormat
        ),
        new Date().toISOString(),
        input.columnId
      )
      if (typeof input.order === 'number' && Number.isFinite(input.order)) {
        this.moveColumnToOrder(existing.list_id, input.columnId, Math.trunc(input.order))
      }
      if (this.isShoppingPriceColumn(existing.list_type, existing.name)) {
        this.syncShoppingCostCurrency(existing.list_id, currencyCode)
      }
    })
    return this.getBoardSnapshot(existing.board_id, 'admin')
  }

  deleteColumn(columnId: string): BoardSnapshot {
    const existing = this.client.database
      .prepare(
        `SELECT c.list_id, c.name, l.board_id, l.list_type
         FROM list_columns c
         JOIN lists l ON l.id = c.list_id
         WHERE c.id = ?`
      )
      .get<{ list_id: string; name: string; board_id: string; list_type: ListTemplateType }>(columnId)
    if (existing && this.isProtectedBirthdayColumn(existing.list_type, existing.name)) {
      throw new Error(`"${existing.name}" is a protected Birthday Calendar field and cannot be deleted.`)
    }
    this.transaction(() => {
      this.run('UPDATE lists SET due_date_column_id = NULL, due_date_enabled = 0 WHERE due_date_column_id = ?', columnId)
      this.run("UPDATE lists SET sort_column_id = NULL, sort_direction = 'manual' WHERE sort_column_id = ?", columnId)
      this.run('DELETE FROM list_columns WHERE id = ?', columnId)
    })
    return existing?.board_id ? this.getBoardSnapshot(existing.board_id, 'admin') : this.getActiveBoardSnapshot('admin')
  }

  createWidget(input: CreateWidgetInput): BoardSnapshot {
    const type = normalizeWidgetType(input.type)
    const config = this.normalizeWidgetConfig(type, undefined)
    const now = new Date().toISOString()
    const next = this.client.database
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM board_widgets WHERE board_id = ?')
      .get<{ next_order: number }>(input.boardId)
    const grid = this.findOpenWidgetSlot(input.boardId, type, config)
    const displayEnabled = Boolean(grid)
    this.run(
      `INSERT INTO board_widgets
         (id, board_id, widget_type, name, sort_order, grid_x, grid_y, grid_w, grid_h, display_enabled, config_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      input.boardId,
      type,
      (input.name ?? '').trim() || this.defaultWidgetName(type),
      next?.next_order ?? 0,
      displayEnabled ? grid?.x ?? 0 : 0,
      displayEnabled ? grid?.y ?? 0 : 0,
      displayEnabled ? grid?.w ?? 0 : 0,
      displayEnabled ? grid?.h ?? 0 : 0,
      displayEnabled ? 1 : 0,
      JSON.stringify(config),
      now,
      now
    )
    return this.getBoardSnapshot(input.boardId, 'admin')
  }

  updateWidget(input: UpdateWidgetInput): BoardSnapshot {
    const existing = this.client.database
      .prepare('SELECT board_id, widget_type FROM board_widgets WHERE id = ?')
      .get<{ board_id: string; widget_type: WidgetType }>(input.widgetId)
    if (!existing) throw new Error('Widget not found.')

    const type = normalizeWidgetType(input.type)
    const config = this.normalizeWidgetConfig(type, input.config)
    const requestedGrid = input.grid
    const needsAutoPlacement =
      input.displayEnabled &&
      (requestedGrid.x < 1 || requestedGrid.y < 1 || requestedGrid.w < 1 || requestedGrid.h < 1)
    const grid = needsAutoPlacement
      ? this.findOpenWidgetSlot(existing.board_id, type, config) ?? this.normalizeWidgetGrid(input.grid, type, config)
      : this.normalizeWidgetGrid(input.grid, type, config)
    if (input.displayEnabled) this.assertWidgetGridPlacement(existing.board_id, input.widgetId, grid)
    this.run(
      `UPDATE board_widgets
       SET widget_type = ?,
           name = ?,
           display_enabled = ?,
           grid_x = ?,
           grid_y = ?,
           grid_w = ?,
           grid_h = ?,
           config_json = ?,
           updated_at = ?
       WHERE id = ?`,
      type,
      input.name.trim() || this.defaultWidgetName(type),
      input.displayEnabled ? 1 : 0,
      input.displayEnabled ? grid.x : 0,
      input.displayEnabled ? grid.y : 0,
      input.displayEnabled ? grid.w : 0,
      input.displayEnabled ? grid.h : 0,
      JSON.stringify(config),
      new Date().toISOString(),
      input.widgetId
    )
    return this.getBoardSnapshot(existing.board_id, 'admin')
  }

  updateWidgetLayouts(input: { widgetId: string; grid: BoardWidget['grid'] }[]): BoardSnapshot {
    if (input.length === 0) throw new Error('No widget layout updates were provided.')

    const uniqueIds = new Set(input.map((entry) => entry.widgetId))
    if (uniqueIds.size !== input.length) throw new Error('Duplicate widget layout updates are not allowed.')

    const widgetRows = input.map((entry) => {
      const row = this.client.database
        .prepare('SELECT id, board_id, widget_type, config_json FROM board_widgets WHERE id = ?')
        .get<{ id: string; board_id: string; widget_type: WidgetType; config_json: string | null }>(entry.widgetId)
      if (!row) throw new Error('Widget not found.')
      return row
    })

    const boardId = widgetRows[0].board_id
    if (widgetRows.some((row) => row.board_id !== boardId)) {
      throw new Error('All updated widgets must belong to the same board.')
    }

    const normalized = input.map((entry) => {
      const row = widgetRows.find((candidate) => candidate.id === entry.widgetId)
      const type = normalizeWidgetType(row?.widget_type)
      const config = this.normalizeWidgetConfig(type, row ? this.readWidgetConfig(type, row.config_json) : undefined)
      return {
        widgetId: entry.widgetId,
        grid: this.normalizeWidgetGrid(entry.grid, type, config)
      }
    })

    this.assertWidgetGridPlacementBatch(boardId, normalized)

    this.transaction(() => {
      const now = new Date().toISOString()
      for (const entry of normalized) {
        this.run(
          `UPDATE board_widgets
           SET grid_x = ?, grid_y = ?, grid_w = ?, grid_h = ?, display_enabled = 1, updated_at = ?
           WHERE id = ?`,
          entry.grid.x,
          entry.grid.y,
          entry.grid.w,
          entry.grid.h,
          now,
          entry.widgetId
        )
      }
    })

    return this.getBoardSnapshot(boardId, 'admin')
  }

  deleteWidget(widgetId: string): BoardSnapshot {
    const existing = this.client.database.prepare('SELECT board_id FROM board_widgets WHERE id = ?').get<{ board_id: string }>(widgetId)
    this.run('DELETE FROM board_widgets WHERE id = ?', widgetId)
    return existing ? this.getBoardSnapshot(existing.board_id, 'admin') : this.getActiveBoardSnapshot('admin')
  }

  listArchive(filters: { listId?: string; closedAfter?: string; closedBefore?: string } = {}): ArchiveRecord[] {
    const clauses: string[] = []
    const params: unknown[] = []

    if (filters.listId) {
      clauses.push('list_id = ?')
      params.push(filters.listId)
    }
    if (filters.closedAfter) {
      clauses.push('closed_at >= ?')
      params.push(filters.closedAfter)
    }
    if (filters.closedBefore) {
      clauses.push('closed_at <= ?')
      params.push(filters.closedBefore)
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    return this.client.database
      .prepare(
        `SELECT id, item_id, board_id, list_id, list_name, item_code, values_json, close_action, close_comment, closed_at
         FROM item_archives
         ${where}
         ORDER BY closed_at DESC`
      )
      .all<{
        id: string
        item_id: string
        board_id: string
        list_id: string
        list_name: string
        item_code: string
        values_json: string
        close_action: Exclude<OperationalState, 'active'>
        close_comment: string | null
        closed_at: string
      }>(...params)
      .map((row) => ({
        id: row.id,
        itemId: row.item_id,
        boardId: row.board_id,
        listId: row.list_id,
        listName: row.list_name,
        itemCode: row.item_code,
        values: JSON.parse(row.values_json),
        closedAt: row.closed_at,
        closeAction: row.close_action === 'cancelled' ? 'cancelled' : 'completed',
        closeComment: row.close_comment ?? ''
      }))
  }

  private getBoardLists(boardId: string, mode: 'admin' | 'display'): BoardList[] {
    const listRows = this.client.database
      .prepare(
        `SELECT id, board_id, name, code, list_type, list_config, sort_order, grid_x, grid_y, grid_w, grid_h, due_date_enabled, due_date_column_id,
                deadline_mandatory, column_sort_order,
                sort_column_id, sort_direction, display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board, show_status_on_board
         FROM lists
         WHERE board_id = ?
         ORDER BY sort_order`
      )
      .all<ListRow>(boardId)

    const allListIds = listRows.map((list) => list.id)
    const columnsByList = this.getColumnsByList(allListIds)
    const groupsByList = this.getGroupsByList(allListIds)
    const itemsByList = this.getItemsByList(allListIds, mode, columnsByList)

    const lists = listRows.map((row) => ({
      id: row.id,
      boardId: row.board_id,
      name: row.name,
      code: row.code,
      templateType: normalizeListTemplateType(row.list_type),
      templateConfig: this.readListTemplateConfig(row.list_type, row.list_config),
      order: row.sort_order,
      grid: {
        x: row.grid_x,
        y: row.grid_y,
        w: row.grid_w,
        h: row.grid_h
      },
      dueDateEnabled: row.due_date_enabled === 1,
      dueDateColumnId: row.due_date_column_id,
      deadlineMandatory: row.deadline_mandatory === 1,
      columnSortOrder: normalizeColumnSortOrder(row.column_sort_order),
      sortColumnId: row.sort_column_id,
      sortDirection: row.sort_column_id ? row.sort_direction : 'manual',
      displayEnabled: row.display_enabled === 1,
      showItemIdOnBoard: row.show_item_id_on_board === 1,
      showDependenciesOnBoard: row.show_dependencies_on_board === 1,
      showCreatedAtOnBoard: row.show_created_at_on_board === 1,
      showCreatedByOnBoard: row.show_created_by_on_board === 1,
      showStatusOnBoard: row.show_status_on_board === 1,
      columns: columnsByList[row.id] ?? [],
      groups: groupsByList[row.id] ?? [],
      items: itemsByList[row.id] ?? []
    }))
    return mode === 'display' ? this.displayableLists(lists) : lists
  }

  private getBoardWidgets(boardId: string, mode: 'admin' | 'display', placedLists: BoardList[]): BoardWidget[] {
    const rows = this.client.database
      .prepare(
        `SELECT id, board_id, widget_type, name, sort_order, grid_x, grid_y, grid_w, grid_h, display_enabled, config_json
         FROM board_widgets
         WHERE board_id = ?
         ORDER BY sort_order`
      )
      .all<WidgetRow>(boardId)

    const widgets = rows.map((row) => ({
      id: row.id,
      boardId: row.board_id,
      type: normalizeWidgetType(row.widget_type),
      name: row.name,
      order: row.sort_order,
      displayEnabled: row.display_enabled === 1,
      grid: {
        x: row.grid_x,
        y: row.grid_y,
        w: row.grid_w,
        h: row.grid_h
      },
      config: this.readWidgetConfig(row.widget_type, row.config_json)
    }))

    return mode === 'display' ? this.displayableWidgets(widgets, placedLists) : widgets
  }

  private displayableLists(lists: BoardList[]): BoardList[] {
    const placed: BoardList[] = []
    for (const list of lists.filter((candidate) => candidate.displayEnabled)) {
      if (list.grid.w < MIN_LIST_GRID_WIDTH || list.grid.h < MIN_LIST_GRID_HEIGHT) continue
      if (list.grid.x < 1 || list.grid.y < 1 || list.grid.x + list.grid.w > 17 || list.grid.y + list.grid.h > 9) continue
      if (placed.some((candidate) => this.gridsOverlap(candidate.grid, list.grid))) continue
      placed.push(list)
    }
    return placed
  }

  private displayableWidgets(widgets: BoardWidget[], lists: BoardList[]): BoardWidget[] {
    const occupied = lists.map((list) => list.grid)
    const placed: BoardWidget[] = []
    for (const widget of widgets.filter((candidate) => candidate.displayEnabled)) {
      if (widget.grid.w < MIN_WIDGET_GRID_WIDTH || widget.grid.h < MIN_WIDGET_GRID_HEIGHT) continue
      if (widget.grid.x < 1 || widget.grid.y < 1 || widget.grid.x + widget.grid.w > 17 || widget.grid.y + widget.grid.h > 9) continue
      if (occupied.some((candidate) => this.gridsOverlap(candidate, widget.grid))) continue
      if (placed.some((candidate) => this.gridsOverlap(candidate.grid, widget.grid))) continue
      placed.push(widget)
    }
    return placed
  }

  private getGroupsByList(listIds: string[]): Record<string, ItemGroup[]> {
    if (listIds.length === 0) return {}

    const rows = this.client.database
      .prepare(
        `SELECT id, list_id, parent_group_id, name, code, sort_order, display_config
         FROM item_groups
         WHERE list_id IN (${this.placeholders(listIds)})
         ORDER BY sort_order`
      )
      .all<GroupRow>(...listIds)

    return rows.reduce<Record<string, ItemGroup[]>>((acc, row) => {
      const display = this.readGroupDisplayConfig(row.display_config)
      acc[row.list_id] ??= []
      acc[row.list_id].push({
        id: row.id,
        listId: row.list_id,
        parentGroupId: row.parent_group_id,
        name: row.name,
        code: row.code,
        order: row.sort_order,
        showIdOnBoard: display.showIdOnBoard,
        summaries: display.summaries
      })
      return acc
    }, {})
  }

  private getColumnsByList(listIds: string[]): Record<string, ListColumn[]> {
    if (listIds.length === 0) return {}

    const rows = this.client.database
      .prepare(
        `SELECT id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_list_summary_eligible, is_board_summary_eligible, is_system, display_format
         FROM list_columns
         WHERE list_id IN (${this.placeholders(listIds)})
         ORDER BY sort_order`
      )
      .all<ColumnRow>(...listIds)

    return rows.reduce<Record<string, ListColumn[]>>((acc, row) => {
      const displayFormat = this.readColumnDisplayFormat(row.display_format)
      acc[row.list_id] ??= []
      acc[row.list_id].push({
        id: row.id,
        listId: row.list_id,
        name: row.name,
        type: row.column_type,
        order: row.sort_order,
        required: row.is_required === 1,
        maxLength: row.max_length,
        listSummaryEligible: row.is_list_summary_eligible === 1,
        boardSummaryEligible: row.is_board_summary_eligible === 1,
        system: row.is_system === 1,
        role: displayFormat.role,
        choiceConfig: displayFormat.choiceConfig,
        dateDisplayFormat: displayFormat.dateDisplayFormat,
        durationDisplayFormat: displayFormat.durationDisplayFormat,
        recurrence: displayFormat.recurrence,
        recurrenceDays: displayFormat.recurrenceDays,
        currencyCode: displayFormat.currencyCode,
        showOnBoard: displayFormat.showOnBoard
      })
      return acc
    }, {})
  }

  private getItemsByList(
    listIds: string[],
    mode: 'admin' | 'display',
    columnsByList: Record<string, ListColumn[]>
  ): Record<string, BoardItem[]> {
    if (listIds.length === 0) return {}

    const publicationFilter =
      mode === 'display'
        ? "AND i.publication_status IN ('published', 'dirty')"
        : "AND i.publication_status IN ('draft', 'published', 'dirty')"
    const rows = this.client.database
      .prepare(
        `SELECT i.id, i.list_id, i.group_id, i.item_number, i.item_order, i.publication_status, i.operational_state, i.created_at, i.created_by, i.updated_at
         FROM items i
         WHERE i.list_id IN (${this.placeholders(listIds)})
         AND i.operational_state = 'active'
         ${publicationFilter}
         ORDER BY i.item_order`
      )
      .all<ItemRow>(...listIds)

    const itemIds = rows.map((item) => item.id)
    const values = this.getItemValues(itemIds, mode === 'display' ? 'published' : 'draft')
    const publishedFallback = mode === 'admin' ? this.getItemValues(itemIds, 'published') : {}
    const dependencyCodes = this.getDependencyCodes(itemIds)
    const listConfig = this.getListConfig(listIds)

    const byList = rows.reduce<Record<string, BoardItem[]>>((acc, row) => {
      const activeValues = this.applyTemplateComputedValues(
        listConfig[row.list_id]?.templateType,
        columnsByList[row.list_id] ?? [],
        values[row.id] ?? publishedFallback[row.id] ?? {}
      )
      const displayCode = `${listConfig[row.list_id]?.code ?? 'L??'}-T${String(row.item_number).padStart(2, '0')}`
      const deadline = this.deadlineInfo(activeValues, listConfig[row.list_id])

      acc[row.list_id] ??= []
      acc[row.list_id].push({
        id: row.id,
        listId: row.list_id,
        groupId: row.group_id,
        code: `T${String(row.item_number).padStart(2, '0')}`,
        displayCode,
        order: row.item_order,
        publicationStatus: row.publication_status,
        operationalState: row.operational_state,
        values: activeValues,
        dependencyCodes: dependencyCodes[row.id] ?? [],
        dependencyItemIds: this.getDependencyItemIds(row.id),
        createdAt: row.created_at,
        createdBy: row.created_by,
        isOverdue: this.isOverdue(row, activeValues, listConfig[row.list_id]),
        deadlineStatus: deadline.status,
        deadlineTone: deadline.tone,
        updatedAt: row.updated_at
      })
      return acc
    }, {})

    for (const [listId, items] of Object.entries(byList)) {
      const config = listConfig[listId]
      const sortColumn = config?.sortColumnId ? columnsByList[listId]?.find((column) => column.id === config.sortColumnId) : null
      const sortDirection = config?.sortDirection
      if (sortColumn && (sortDirection === 'asc' || sortDirection === 'desc')) {
        items.sort((a, b) => this.compareItemsByColumn(a, b, sortColumn, sortDirection))
      }
    }

    return byList
  }

  private getItemValues(itemIds: string[], scope: 'draft' | 'published'): Record<string, BoardItem['values']> {
    if (itemIds.length === 0) return {}

    const rows = this.client.database
      .prepare(
        `SELECT ifv.item_id, ifv.column_id, lc.column_type, ifv.value_text, ifv.value_number, ifv.value_date, ifv.value_boolean, ifv.value_json
         FROM item_field_values ifv
         JOIN list_columns lc ON lc.id = ifv.column_id
         WHERE ifv.item_id IN (${this.placeholders(itemIds)})
         AND ifv.version_scope = ?`
      )
      .all<ValueRow>(...itemIds, scope)

    return rows.reduce<Record<string, BoardItem['values']>>((acc, row) => {
      acc[row.item_id] ??= {}
      acc[row.item_id][row.column_id] = this.readValue(row)
      return acc
    }, {})
  }

  private getDependencyCodes(itemIds: string[]): Record<string, string[]> {
    if (itemIds.length === 0) return {}

    const rows = this.client.database
      .prepare(
        `SELECT d.source_item_id, target_list.code AS target_list_code, target_item.item_number AS target_item_number
         FROM dependencies d
         JOIN items target_item ON target_item.id = d.target_item_id
         JOIN lists target_list ON target_list.id = target_item.list_id
         WHERE d.source_item_id IN (${this.placeholders(itemIds)})
         ORDER BY target_list.code, target_item.item_number`
      )
      .all<DependencyCodeRow>(...itemIds)

    return rows.reduce<Record<string, string[]>>((acc, row) => {
      acc[row.source_item_id] ??= []
      acc[row.source_item_id].push(`${row.target_list_code}-T${String(row.target_item_number).padStart(2, '0')}`)
      return acc
    }, {})
  }

  private getDependencyItemIds(itemId: string): string[] {
    return this.client.database
      .prepare('SELECT target_item_id FROM dependencies WHERE source_item_id = ? ORDER BY created_at')
      .all<{ target_item_id: string }>(itemId)
      .map((row) => row.target_item_id)
  }

  private getListConfig(
    listIds: string[]
  ): Record<
    string,
    {
      code: string
      templateType: ListTemplateType
      dueDateEnabled: boolean
      dueDateColumnId: string | null
      deadlineMandatory: boolean
      sortColumnId: string | null
      sortDirection: ListSortDirection
    }
  > {
    if (listIds.length === 0) return {}

    return this.client.database
      .prepare(
        `SELECT id, code, list_type, due_date_enabled, due_date_column_id, deadline_mandatory, sort_column_id, sort_direction
         FROM lists
         WHERE id IN (${this.placeholders(listIds)})`
      )
      .all<{
        id: string
        code: string
        list_type: ListTemplateType
        due_date_enabled: number
        due_date_column_id: string | null
        deadline_mandatory: number
        sort_column_id: string | null
        sort_direction: ListSortDirection
      }>(...listIds)
      .reduce<
        Record<
          string,
            {
              code: string
              templateType: ListTemplateType
              dueDateEnabled: boolean
              dueDateColumnId: string | null
              deadlineMandatory: boolean
            sortColumnId: string | null
            sortDirection: ListSortDirection
          }
        >
      >((acc, row) => {
        acc[row.id] = {
          code: row.code,
          templateType: normalizeListTemplateType(row.list_type),
          dueDateEnabled: row.due_date_enabled === 1,
          dueDateColumnId: row.due_date_column_id,
          deadlineMandatory: row.deadline_mandatory === 1,
          sortColumnId: row.sort_column_id,
          sortDirection: row.sort_column_id ? row.sort_direction : 'manual'
        }
        return acc
      }, {})
  }

  private getSummarySlots(boardId: string, lists: BoardList[]): SummarySlot[] {
    const rows = this.client.database
      .prepare(
        `SELECT slot_index, label, source_list_id, source_column_id, aggregation_method
         FROM bottom_bar_widget_configs
         WHERE board_id = ?
         ORDER BY slot_index`
      )
      .all<BottomSlotRow>(boardId)

    const bySlot = new Map(rows.map((row) => [row.slot_index, row]))
    return Array.from({ length: BOARD_SUMMARY_SLOT_COUNT }, (_, slotIndex) => {
      const row = bySlot.get(slotIndex)
      if (!row) {
        return {
          slotIndex,
          label: '',
          sourceListId: null,
          sourceColumnId: null,
          aggregationMethod: 'count',
          value: '0'
        }
      }

      return {
        slotIndex,
        label: row.label,
        sourceListId: row.source_list_id,
        sourceColumnId: row.source_column_id,
        aggregationMethod: this.normalizeSummaryAggregationMethod(row.aggregation_method),
        value: this.calculateSummary(row, lists, boardId)
      }
    })
  }

  private calculateSummary(slot: BottomSlotRow, lists: BoardList[], boardId: string): string {
    const aggregationMethod = this.normalizeSummaryAggregationMethod(slot.aggregation_method)
    if (aggregationMethod === 'archived_items' || aggregationMethod === 'completed_count') {
      const count = this.client.database
        .prepare('SELECT COUNT(*) AS count FROM item_archives WHERE board_id = ?')
        .get<{ count: number }>(boardId)?.count ?? 0
      return String(count)
    }

    if (this.isSystemSummaryAggregation(aggregationMethod)) {
      return this.calculateSystemSummary(aggregationMethod, boardId, lists)
    }

    const list = lists.find((candidate) => candidate.id === slot.source_list_id)

    if (aggregationMethod === 'count' || aggregationMethod === 'active_count') {
      const shouldCountBoard = !list
      return String(shouldCountBoard ? lists.reduce((count, candidate) => count + candidate.items.length, 0) : list.items.length)
    }

    if (!list) return '0'

    if (aggregationMethod === 'next_due') {
      if (!slot.source_column_id) return 'No due date'
      const datedItems = list.items
        .map((item) => {
          const raw = dateFieldString(item.values[slot.source_column_id ?? ''])
          const date = raw ? this.deadlineDate(raw) : null
          return date ? { item, date } : null
        })
        .filter((entry): entry is { item: BoardItem; date: Date } => entry !== null)
        .sort((left, right) => left.date.getTime() - right.date.getTime())
      if (datedItems.length === 0) return 'No due date'
      const overdueCount = datedItems.filter((entry) => entry.item.isOverdue).length
      if (overdueCount > 0) return `${overdueCount} overdue`
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(datedItems[0].date)
    }

    const total = list.items.reduce((sum, item) => {
      if (!slot.source_column_id) return sum
      const value = item.values[slot.source_column_id]
      return typeof value === 'number' ? sum + value : sum
    }, 0)

    const column = list.columns.find((candidate) => candidate.id === slot.source_column_id)
    if (column?.type === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: column.currencyCode }).format(total)
    if (column?.type === 'duration') return formatDurationMinutes(total, column.durationDisplayFormat)
    return String(total)
  }

  private resolveSummarySlots(boardId: string, providedSlots: UpdateSummarySlotsInput['slots']): Array<{
    slotIndex: number
    label: string
    sourceListId: string | null
    sourceColumnId: string | null
    aggregationMethod: AggregationMethod
  }> {
    const board = this.client.database.prepare('SELECT id FROM boards WHERE id = ?').get<{ id: string }>(boardId)
    if (!board) throw new Error('Board not found.')

    const lists = this.getBoardSnapshot(boardId, 'admin').lists
    const listsById = new Map(lists.map((list) => [list.id, list]))
    return Array.from({ length: BOARD_SUMMARY_SLOT_COUNT }, (_, slotIndex) => {
      const provided = providedSlots.find((slot) => slot.slotIndex === slotIndex)
      const aggregationMethod = this.normalizeSummaryAggregationMethod(provided?.aggregationMethod ?? 'count')
      const label = provided?.label?.trim() || this.defaultSummaryLabel(aggregationMethod)
      const sourceListId = provided?.sourceListId ?? null
      let sourceColumnId = provided?.sourceColumnId ?? null
      let resolvedAggregationMethod = aggregationMethod
      this.assertBoardSummaryLabelAllowed(label, sourceListId, aggregationMethod)

      if (!sourceListId) {
        sourceColumnId = null
        if (!this.isSystemSummaryAggregation(aggregationMethod) && !['active_count', 'completed_count', 'count'].includes(aggregationMethod)) resolvedAggregationMethod = 'count'
        return { slotIndex, label, sourceListId: null, sourceColumnId: null, aggregationMethod: resolvedAggregationMethod }
      }

      const list = listsById.get(sourceListId)
      if (!list) throw new Error('Summary slot references an invalid list.')
      if (!sourceColumnId) throw new Error('Summary slot needs a field selection.')
      const column = list.columns.find((candidate) => candidate.id === sourceColumnId)
      if (!column || !column.boardSummaryEligible) {
        throw new Error('Summary slot references an invalid or unsupported field.')
      }
      resolvedAggregationMethod = this.inferBoardSummaryAggregation(column)
      this.assertBoardSummaryLabelAllowed(label, sourceListId, resolvedAggregationMethod)
      return { slotIndex, label, sourceListId, sourceColumnId, aggregationMethod: resolvedAggregationMethod }
    })
  }

  private assertBoardSummaryLabelAllowed(label: string, sourceListId: string | null, aggregationMethod: AggregationMethod): void {
    const reservedMethod = RESERVED_BOARD_SUMMARY_LABELS.get(normalizeReservedColumnName(label))
    if (!reservedMethod) return
    if (!sourceListId && aggregationMethod === reservedMethod) return
    throw new Error(`"${label}" is reserved for a system board summary. Choose a different label, or select the matching Board source.`)
  }

  private normalizeSummaryAggregationMethod(method: AggregationMethod): AggregationMethod {
    if (method === 'active_count') return 'open_tasks'
    if (method === 'completed_count') return 'archived_items'
    return method
  }

  private isSystemSummaryAggregation(method: AggregationMethod): boolean {
    return (
      method === 'open_tasks' ||
      method === 'board_items' ||
      method === 'total_board_entries' ||
      method === 'total_purchases' ||
      method === 'total_effort_tasks' ||
      method === 'overdue_items' ||
      method === 'overdue_tasks' ||
      method === 'archived_items'
    )
  }

  private defaultSummaryLabel(method: AggregationMethod): string {
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

  private calculateSystemSummary(method: AggregationMethod, boardId: string, displayLists: BoardList[]): string {
    const allLists = this.getBoardLists(boardId, 'admin')
    if (method === 'open_tasks') {
      return String(allLists.filter((list) => this.listBehavior(list) === 'tasks').reduce((count, list) => count + list.items.length, 0))
    }
    if (method === 'board_items') {
      return String(displayLists.reduce((count, list) => count + this.displayedItemCount(list), 0))
    }
    if (method === 'total_board_entries') {
      return String(allLists.reduce((count, list) => count + list.items.length, 0))
    }
    if (method === 'total_purchases') return this.totalPurchasesSummary(allLists)
    if (method === 'total_effort_tasks') return this.totalEffortTasksSummary(allLists)
    if (method === 'overdue_items') {
      return String(allLists.filter((list) => ['tasks', 'purchases', 'calendar'].includes(this.listBehavior(list))).reduce((count, list) => count + list.items.filter((item) => item.isOverdue).length, 0))
    }
    if (method === 'overdue_tasks') {
      return String(allLists.filter((list) => this.listBehavior(list) === 'tasks').reduce((count, list) => count + list.items.filter((item) => item.isOverdue).length, 0))
    }
    return '0'
  }

  private totalPurchasesSummary(lists: BoardList[]): string {
    const totals = new Map<CurrencyCode, number>()
    for (const list of lists.filter((candidate) => this.listBehavior(candidate) === 'purchases')) {
      const columns =
        list.templateType === 'shopping_list'
          ? list.columns.filter((column) => normalizeReservedColumnName(column.name) === 'cost' && column.type === 'currency')
          : list.templateType === 'wishlist'
            ? list.columns.filter((column) => normalizeReservedColumnName(column.name) === 'price' && column.type === 'currency')
            : list.columns.filter((column) => column.type === 'currency')
      for (const column of columns) {
        const total = list.items.reduce((sum, item) => {
          const value = item.values[column.id]
          return typeof value === 'number' && Number.isFinite(value) ? sum + value : sum
        }, 0)
        totals.set(column.currencyCode, (totals.get(column.currencyCode) ?? 0) + total)
      }
    }
    if (totals.size === 0) return '0'
    return [...totals.entries()]
      .filter(([, total]) => total !== 0)
      .map(([currency, total]) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(total))
      .join(' | ') || '0'
  }

  private totalEffortTasksSummary(lists: BoardList[]): string {
    const totalMinutes = lists
      .filter((list) => this.listBehavior(list) === 'tasks')
      .flatMap((list) => list.columns.filter((column) => column.type === 'duration' && normalizeReservedColumnName(column.name) === 'effort').map((column) => ({ list, column })))
      .reduce((sum, { list, column }) => {
        return sum + list.items.reduce((itemSum, item) => {
          const value = item.values[column.id]
          return typeof value === 'number' && Number.isFinite(value) ? itemSum + value : itemSum
        }, 0)
      }, 0)
    return this.formatEffortSummary(totalMinutes)
  }

  private formatEffortSummary(minutes: number): string {
    const totalMinutes = Math.max(0, Math.round(minutes))
    const hours = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    if (hours < 24) return `${hours}h ${String(mins).padStart(2, '0')}m`
    const days = Math.floor(hours / 24)
    const remainderHours = hours % 24
    return `${days}d ${remainderHours}h ${String(mins).padStart(2, '0')}m`
  }

  private displayedItemCount(list: BoardList): number {
    if (list.templateType !== 'birthday_calendar') return list.items.length
    const birthdayColumn = list.columns.find((column) => normalizeReservedColumnName(column.name) === 'birthday')
    if (!birthdayColumn) return list.items.length
    const mode = list.templateConfig.birthday?.boardView ?? 'this_month'
    const end = this.birthdayRangeEnd(new Date(), mode)
    return list.items.filter((item) => {
      const occurrence = this.nextBirthdayOccurrence(dateFieldString(item.values[birthdayColumn.id]), new Date())
      return mode === 'all' ? true : Boolean(occurrence && occurrence.getTime() <= end.getTime())
    }).length
  }

  private birthdayRangeEnd(now: Date, mode: NonNullable<ListTemplateConfig['birthday']>['boardView']): Date {
    if (mode === 'this_week') {
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      end.setDate(now.getDate() + (6 - now.getDay()))
      return end
    }
    if (mode === 'this_month') return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    if (mode === 'next_10_days') return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10, 23, 59, 59, 999)
    if (mode === 'next_30_days') return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59, 999)
    if (mode === 'next_2_months') return new Date(now.getFullYear(), now.getMonth() + 2, now.getDate(), 23, 59, 59, 999)
    return new Date(8640000000000000)
  }

  private listBehavior(list: BoardList): ListBehavior {
    if (list.templateType === 'todo') return 'tasks'
    if (list.templateType === 'shopping_list' || list.templateType === 'wishlist') return 'purchases'
    if (list.templateType === 'health' || list.templateType === 'trips_events' || list.templateType === 'birthday_calendar') return 'calendar'
    return this.normalizeListBehavior(list.templateConfig.behavior)
  }

  private publishItems(itemIds: string[]): void {
    if (itemIds.length === 0) return

    const now = new Date().toISOString()
    for (const itemId of itemIds) {
      const draftValues = this.client.database
        .prepare(
          `SELECT column_id, value_text, value_number, value_date, value_boolean, value_json
           FROM item_field_values
           WHERE item_id = ? AND version_scope = 'draft'`
        )
        .all<{
          column_id: string
          value_text: string | null
          value_number: number | null
          value_date: string | null
          value_boolean: number | null
          value_json: string | null
        }>(itemId)

      this.run('DELETE FROM item_field_values WHERE item_id = ? AND version_scope = ?', itemId, 'published')
      for (const value of draftValues) {
        this.run(
          `INSERT INTO item_field_values
             (id, item_id, column_id, version_scope, value_text, value_number, value_date, value_boolean, value_json, updated_at)
           VALUES (?, ?, ?, 'published', ?, ?, ?, ?, ?, ?)`,
          randomUUID(),
          itemId,
          value.column_id,
          value.value_text,
          value.value_number,
          value.value_date,
          value.value_boolean,
          value.value_json,
          now
        )
      }
      this.run(
        `UPDATE items
         SET publication_status = 'published', published_at = ?, updated_at = ?
         WHERE id = ?`,
        now,
        now,
        itemId
      )
    }
  }

  private upsertValues(
    itemId: string,
    values: Record<string, FieldValue>,
    scope: 'draft' | 'published'
  ): void {
    const now = new Date().toISOString()
    for (const [columnId, rawValue] of Object.entries(values)) {
      const column = this.client.database
        .prepare('SELECT column_type FROM list_columns WHERE id = ?')
        .get<{ column_type: ColumnType }>(columnId)
      if (!column) continue

      const normalized = this.writeValue(rawValue, column.column_type)
      this.run(
        `INSERT INTO item_field_values
           (id, item_id, column_id, version_scope, value_text, value_number, value_date, value_boolean, value_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(item_id, column_id, version_scope) DO UPDATE SET
           value_text = excluded.value_text,
           value_number = excluded.value_number,
           value_date = excluded.value_date,
           value_boolean = excluded.value_boolean,
           value_json = excluded.value_json,
           updated_at = excluded.updated_at`,
        randomUUID(),
        itemId,
        columnId,
        scope,
        normalized.value_text,
        normalized.value_number,
        normalized.value_date,
        normalized.value_boolean,
        normalized.value_json,
        now
      )
    }
  }

  private replaceDependencies(itemId: string, dependencyItemIds: string[]): void {
    const now = new Date().toISOString()
    this.run('DELETE FROM dependencies WHERE source_item_id = ?', itemId)
    for (const targetItemId of dependencyItemIds.filter((id) => id !== itemId)) {
      this.run(
        'INSERT OR IGNORE INTO dependencies (id, source_item_id, target_item_id, dependency_type, created_at) VALUES (?, ?, ?, ?, ?)',
        randomUUID(),
        itemId,
        targetItemId,
        'prerequisite',
        now
      )
    }
  }

  private isOverdue(
    item: ItemRow,
    values: BoardItem['values'],
    listConfig: { dueDateEnabled: boolean; dueDateColumnId: string | null } | undefined
  ): boolean {
    if (!listConfig?.dueDateEnabled || !listConfig.dueDateColumnId) return false
    if (item.publication_status === 'draft' || item.operational_state !== 'active') return false

    const dueValue = dateFieldString(values[listConfig.dueDateColumnId])
    if (!dueValue) return false

    const deadline = this.deadlineDate(dueValue)
    return deadline ? deadline.getTime() < Date.now() : false
  }

  private deadlineInfo(
    values: BoardItem['values'],
    listConfig: { dueDateEnabled: boolean; dueDateColumnId: string | null } | undefined
  ): { status: string; tone: BoardItem['deadlineTone'] } {
    if (!listConfig?.dueDateEnabled || !listConfig.dueDateColumnId) return { status: '', tone: 'none' }

    const raw = dateFieldString(values[listConfig.dueDateColumnId])
    if (!raw) return { status: 'No deadline set', tone: 'none' }

    const deadline = this.deadlineDate(raw)
    if (!deadline) return { status: 'No deadline set', tone: 'none' }

    const remainingMs = deadline.getTime() - Date.now()
    const absoluteMs = Math.abs(remainingMs)
    if (remainingMs < 0) return { status: `Overdue by ${this.humanDuration(absoluteMs)}`, tone: 'overdue' }
    if (remainingMs <= 12 * 60 * 60 * 1000) return { status: `Imminent - ${this.humanDuration(remainingMs)} left`, tone: 'critical' }
    if (remainingMs <= 24 * 60 * 60 * 1000) return { status: `${this.humanDuration(remainingMs)} left`, tone: 'urgent' }
    if (remainingMs <= 2 * 24 * 60 * 60 * 1000) return { status: `${this.humanDuration(remainingMs)} left`, tone: 'soon' }
    if (remainingMs <= 5 * 24 * 60 * 60 * 1000) return { status: `${this.humanDuration(remainingMs)} left`, tone: 'ok' }
    return { status: `${this.humanDuration(remainingMs)} to deadline`, tone: 'none' }
  }

  private deadlineDate(value: string): Date | null {
    const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
    return Number.isNaN(date.getTime()) ? null : date
  }

  private humanDuration(milliseconds: number): string {
    const hours = Math.max(1, Math.ceil(milliseconds / (60 * 60 * 1000)))
    if (hours < 24) return `${hours}h`
    const days = Math.ceil(hours / 24)
    if (days === 1) return '1 day'
    if (days === 7) return 'one week'
    return `${days} days`
  }

  private normalizeCloseConfirmationMode(mode: CloseConfirmationMode | undefined): CloseConfirmationMode {
    if (mode === 'without_comments' || mode === 'none') return mode
    return 'with_comments'
  }

  private normalizeTheme(theme: AppTheme | undefined): AppTheme {
    if (theme === 'black_glass_blue' || theme === 'liquid_gunmetal' || theme === 'midnight_clear') return theme
    return 'midnight_clear'
  }

  private normalizeBooleanMap(value: Record<string, unknown> | undefined): Record<string, boolean> {
    if (!value || typeof value !== 'object') return {}
    return Object.fromEntries(Object.entries(value).filter(([key]) => key.trim().length > 0).map(([key, flag]) => [key, flag === true]))
  }

  private compareItemsByColumn(
    first: BoardItem,
    second: BoardItem,
    column: ListColumn,
    direction: Exclude<ListSortDirection, 'manual'>
  ): number {
    const firstValue = first.values[column.id]
    const secondValue = second.values[column.id]
    const firstEmpty = firstValue === null || firstValue === undefined || firstValue === ''
    const secondEmpty = secondValue === null || secondValue === undefined || secondValue === ''

    if (firstEmpty || secondEmpty) {
      if (firstEmpty && secondEmpty) return first.order - second.order
      return firstEmpty ? 1 : -1
    }

    const base = this.compareValues(firstValue, secondValue, column)
    if (base === 0) return first.order - second.order
    return direction === 'asc' ? base : -base
  }

  private compareValues(first: Exclude<FieldValue, null>, second: Exclude<FieldValue, null>, column: ListColumn): number {
    if (column.type === 'choice') {
      return this.compareChoiceValues(first, second, column.choiceConfig)
    }
    const type = column.type
    if (type === 'date') {
      if (normalizeReservedColumnName(column.name) === 'birthday') {
        return this.compareBirthdayValues(first, second)
      }
      return String(dateFieldString(first) ?? '').localeCompare(String(dateFieldString(second) ?? ''), undefined, { numeric: true, sensitivity: 'base' })
    }
    if (type === 'integer' || type === 'decimal' || type === 'currency' || type === 'duration') {
      return Number(first) - Number(second)
    }
    if (type === 'boolean') {
      return Number(Boolean(first)) - Number(Boolean(second))
    }
    return String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: 'base' })
  }

  private compareChoiceValues(first: Exclude<FieldValue, null>, second: Exclude<FieldValue, null>, config: ChoiceConfig | null): number {
    const firstKey = this.choiceSortKey(first, config)
    const secondKey = this.choiceSortKey(second, config)
    if (typeof firstKey === 'number' && typeof secondKey === 'number') return firstKey - secondKey
    return String(firstKey).localeCompare(String(secondKey), undefined, { numeric: true, sensitivity: 'base' })
  }

  private compareBirthdayValues(first: Exclude<FieldValue, null>, second: Exclude<FieldValue, null>): number {
    const firstOccurrence = this.nextBirthdayOccurrence(dateFieldString(first), new Date())
    const secondOccurrence = this.nextBirthdayOccurrence(dateFieldString(second), new Date())
    if (!firstOccurrence && !secondOccurrence) return 0
    if (!firstOccurrence) return 1
    if (!secondOccurrence) return -1
    return firstOccurrence.getTime() - secondOccurrence.getTime()
  }

  private nextBirthdayOccurrence(value: string | null, now: Date): Date | null {
    if (!value) return null
    const source = new Date(value.includes('T') ? value : `${value}T00:00:00`)
    if (Number.isNaN(source.getTime())) return null
    const occurrence = new Date(now.getFullYear(), source.getMonth(), source.getDate(), 9, 0, 0, 0)
    if (occurrence.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
      occurrence.setFullYear(occurrence.getFullYear() + 1)
    }
    return occurrence
  }

  private choiceSortKey(value: Exclude<FieldValue, null>, config: ChoiceConfig | null): string | number {
    const selected = Array.isArray(value) ? value : [String(value)]
    const options = selected
      .map((id) => config?.options.find((option) => option.id === id || option.label === id))
      .filter((option): option is ChoiceOption => Boolean(option))
    if (options.length === 0) return Array.isArray(value) ? value.join(', ') : String(value)
    if (config?.ranked) return Math.min(...options.map((option) => option.rank))
    return options.map((option) => option.label).join(', ')
  }

  private readValue(row: ValueRow): FieldValue {
    if (row.column_type === 'boolean') return row.value_boolean === null ? null : row.value_boolean === 1
    if (row.column_type === 'date') return this.readDateValue(row.value_date, row.value_json)
    if (row.column_type === 'integer' || row.column_type === 'decimal' || row.column_type === 'currency' || row.column_type === 'duration') return row.value_number
    if (row.column_type === 'choice' && row.value_json !== null) return JSON.parse(row.value_json)
    if (row.column_type === 'hyperlink') return row.value_text
    if (row.value_json !== null) return JSON.parse(row.value_json)
    return row.value_text
  }

  private writeValue(value: FieldValue, type: ColumnType): Omit<ValueRow, 'item_id' | 'column_id' | 'column_type'> {
    const dateValue = type === 'date' ? this.normalizeDateValue(value) : null
    return {
      value_text: type === 'text' || type === 'hyperlink' ? (value === null ? null : String(value)) : null,
      value_number:
          type === 'integer' || type === 'decimal' || type === 'currency' || type === 'duration'
          ? value === null || value === ''
            ? null
            : Number(value)
          : null,
      value_date: type === 'date' ? dateValue?.value ?? null : null,
      value_boolean: type === 'boolean' ? (value === null ? null : value ? 1 : 0) : null,
      value_json:
        type === 'choice'
          ? JSON.stringify(value)
          : type === 'date' && dateValue && dateValue.recurrence !== 'none'
            ? JSON.stringify({ recurrence: dateValue.recurrence, recurrenceDays: dateValue.recurrenceDays, recurrenceInterval: dateValue.recurrenceInterval })
            : null
    }
  }

  private readDateValue(value: string | null, json: string | null): FieldValue {
    if (!json) return value
    try {
      const parsed = JSON.parse(json) as { recurrence?: RecurrenceMode; recurrenceDays?: number[]; recurrenceInterval?: number }
      const recurrence = normalizeRecurrenceMode(parsed.recurrence)
      if (recurrence === 'none') return value
      return {
        value: value ?? '',
        recurrence,
        recurrenceDays: recurrenceNeedsDays(recurrence) ? normalizeRecurrenceDays(parsed.recurrenceDays) : [],
        recurrenceInterval: normalizeRecurrenceInterval(parsed.recurrenceInterval)
      }
    } catch {
      return value
    }
  }

  private normalizeDateValue(value: FieldValue): DateFieldValue | null {
    if (value === null || value === '') return null
    if (isDateFieldValue(value)) {
      const recurrence = normalizeRecurrenceMode(value.recurrence)
      return {
        value: value.value,
        recurrence,
        recurrenceDays: recurrenceNeedsDays(recurrence) ? normalizeRecurrenceDays(value.recurrenceDays) : [],
        recurrenceInterval: normalizeRecurrenceInterval(value.recurrenceInterval)
      }
    }
    return { value: String(value), recurrence: 'none', recurrenceDays: [], recurrenceInterval: 1 }
  }

  private ensureDeadlineColumn(listId: string, mandatory: boolean): string {
    const linked = this.client.database
      .prepare(
        `SELECT c.id, c.name, c.display_format
         FROM lists l
         JOIN list_columns c ON c.id = l.due_date_column_id
         WHERE l.id = ?`
      )
      .get<{ id: string; name: string; display_format: string | null }>(listId)
    const existing = linked
      ? linked
      : this.client.database
      .prepare(
        `SELECT id, name, display_format
         FROM list_columns
         WHERE list_id = ?
           AND display_format LIKE '%"role":"deadline"%'
         ORDER BY sort_order
         LIMIT 1`
      )
      .get<{ id: string; name: string; display_format: string | null }>(listId)
    if (existing) {
      const existingFormat = this.readColumnDisplayFormat(existing.display_format)
      const role = existingFormat.role === 'deadline' ? 'deadline' : null
      this.run(
        `UPDATE list_columns
         SET name = ?,
              column_type = 'date',
              is_required = ?,
              display_format = ?,
              updated_at = ?
         WHERE id = ?`,
        role === 'deadline' ? 'Deadline' : existing.name,
        mandatory ? 1 : 0,
        this.writeColumnDisplayFormat(
          role,
          null,
          role === 'deadline' ? normalizeDeadlineDisplayFormat(existingFormat.dateDisplayFormat) : existingFormat.dateDisplayFormat,
          role === 'deadline' ? 'none' : existingFormat.recurrence,
          role === 'deadline' ? [] : existingFormat.recurrenceDays,
          undefined,
          existingFormat.showOnBoard
        ),
        new Date().toISOString(),
        existing.id
      )
      return existing.id
    }

    const nextOrder = this.client.database
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM list_columns WHERE list_id = ?')
      .get<{ next_order: number }>(listId)?.next_order ?? 0
    return this.createSeedColumn(
      listId,
      'Deadline',
      'date',
      nextOrder,
      mandatory,
      null,
      true,
      true,
      true,
      this.writeColumnDisplayFormat('deadline', null, 'datetime', 'none', [], undefined, true)
    )
  }

  private readColumnDisplayFormat(format: string | null): {
    role: ColumnRole | null
    choiceConfig: ChoiceConfig | null
    dateDisplayFormat: DateDisplayFormat
    durationDisplayFormat: DurationDisplayFormat
    recurrence: RecurrenceMode
    recurrenceDays: number[]
    currencyCode: CurrencyCode
    showOnBoard: boolean
  } {
    if (!format) return { role: null, choiceConfig: null, dateDisplayFormat: 'date', durationDisplayFormat: 'days_hours', recurrence: 'none', recurrenceDays: [], currencyCode: 'USD', showOnBoard: true }
    try {
      const parsed = JSON.parse(format) as {
        role?: ColumnRole
        choiceConfig?: ChoiceConfig
        dateDisplayFormat?: DateDisplayFormat
        durationDisplayFormat?: DurationDisplayFormat
        recurrence?: RecurrenceMode
        recurrenceDays?: number[]
        currencyCode?: CurrencyCode
        showOnBoard?: boolean
      }
      const role = parsed.role === 'deadline' ? parsed.role : null
      const dateDisplayFormat = parsed.dateDisplayFormat ? normalizeDateDisplayFormat(parsed.dateDisplayFormat) : role === 'deadline' ? 'datetime' : 'date'
      const durationDisplayFormat = normalizeDurationDisplayFormat(parsed.durationDisplayFormat)
      const recurrence = dateDisplayFormat === 'time' ? normalizeRecurrenceMode(parsed.recurrence) : 'none'
      return {
        role,
        choiceConfig: parsed.choiceConfig ? normalizeChoiceConfig(parsed.choiceConfig) : null,
        dateDisplayFormat,
        durationDisplayFormat,
        recurrence,
        recurrenceDays: recurrenceNeedsDays(recurrence) ? normalizeRecurrenceDays(parsed.recurrenceDays) : [],
        currencyCode: normalizeCurrencyCode(parsed.currencyCode),
        showOnBoard: parsed.showOnBoard !== false
      }
    } catch {
      return { role: null, choiceConfig: null, dateDisplayFormat: 'date', durationDisplayFormat: 'days_hours', recurrence: 'none', recurrenceDays: [], currencyCode: 'USD', showOnBoard: true }
    }
  }

  private writeColumnDisplayFormat(
    role: ColumnRole | null,
    choiceConfig: ChoiceConfig | null,
    dateDisplayFormat: DateDisplayFormat = 'date',
    recurrence: RecurrenceMode = 'none',
    recurrenceDays: number[] = [],
    currencyCode: CurrencyCode | undefined = undefined,
    showOnBoard = true,
    durationDisplayFormat: DurationDisplayFormat | undefined = undefined
  ): string | null {
    const normalizedDateDisplayFormat = normalizeDateDisplayFormat(dateDisplayFormat)
    const normalizedRecurrence = normalizedDateDisplayFormat === 'time' ? normalizeRecurrenceMode(recurrence) : 'none'
    const normalizedRecurrenceDays = recurrenceNeedsDays(normalizedRecurrence) ? normalizeRecurrenceDays(recurrenceDays) : []
    const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode)
    const normalizedDurationDisplayFormat = normalizeDurationDisplayFormat(durationDisplayFormat)
    if (!role && !choiceConfig && normalizedDateDisplayFormat === 'date' && normalizedRecurrence === 'none' && normalizedCurrencyCode === 'USD' && normalizedDurationDisplayFormat === 'days_hours' && showOnBoard) return null
    return JSON.stringify({
      ...(role ? { role } : {}),
      ...(choiceConfig ? { choiceConfig: normalizeChoiceConfig(choiceConfig) } : {}),
      ...(role === 'deadline' || normalizedDateDisplayFormat !== 'date' ? { dateDisplayFormat: normalizedDateDisplayFormat } : {}),
      ...(normalizedRecurrence !== 'none' ? { recurrence: normalizedRecurrence } : {}),
      ...(normalizedRecurrenceDays.length > 0 ? { recurrenceDays: normalizedRecurrenceDays } : {}),
      ...(normalizedCurrencyCode !== 'USD' ? { currencyCode: normalizedCurrencyCode } : {}),
      ...(normalizedDurationDisplayFormat !== 'days_hours' ? { durationDisplayFormat: normalizedDurationDisplayFormat } : {}),
      ...(!showOnBoard ? { showOnBoard: false } : {})
    })
  }

  private readGroupDisplayConfig(format: string | null): { showIdOnBoard: boolean; summaries: GroupSummaryConfig[] } {
    if (!format) return { showIdOnBoard: true, summaries: [] }
    try {
      const parsed = JSON.parse(format) as { showIdOnBoard?: boolean; summaries?: Array<{ columnId?: string; method?: GroupSummaryMethod }> }
      return {
        showIdOnBoard: parsed.showIdOnBoard !== false,
        summaries: this.normalizeGroupSummaries(parsed.summaries ?? [])
      }
    } catch {
      return { showIdOnBoard: true, summaries: [] }
    }
  }

  private writeGroupDisplayConfig(showIdOnBoard: boolean, summaries: GroupSummaryConfig[]): string | null {
    const normalized = this.normalizeGroupSummaries(summaries)
    if (showIdOnBoard && normalized.length === 0) return null
    return JSON.stringify({
      ...(!showIdOnBoard ? { showIdOnBoard: false } : {}),
      ...(normalized.length > 0 ? { summaries: normalized } : {})
    })
  }

  private normalizeGroupSummaries(summaries: Array<{ columnId?: string; method?: GroupSummaryMethod }>): GroupSummaryConfig[] {
    const seen = new Set<string>()
    return summaries
      .filter((summary): summary is { columnId: string; method?: GroupSummaryMethod } => Boolean(summary.columnId))
      .map((summary) => ({
        columnId: summary.columnId,
        method: this.normalizeGroupSummaryMethod(summary.method)
      }))
      .filter((summary) => {
        if (seen.has(summary.columnId)) return false
        seen.add(summary.columnId)
        return true
      })
  }

  private normalizeGroupSummaryMethod(method: GroupSummaryMethod | undefined): GroupSummaryMethod {
    return method === 'max' || method === 'avg' || method === 'count' ? method : 'sum'
  }

  private readWidgetConfig(type: WidgetType, json: string | null): BoardWidgetConfig {
    const fallback = defaultWidgetConfig(normalizeWidgetType(type))
    if (!json) return fallback
    try {
      return this.normalizeWidgetConfig(type, JSON.parse(json) as BoardWidgetConfig)
    } catch {
      return fallback
    }
  }

  private normalizeWidgetConfig(type: WidgetType, config: BoardWidgetConfig | undefined): BoardWidgetConfig {
    const normalizedType = normalizeWidgetType(type)
    if (normalizedType === 'weather') {
      return {
        weather: {
          temperatureUnit: config?.weather?.temperatureUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius'
        }
      }
    }
    if (normalizedType === 'word_of_day') {
      return {
        wordOfDay: {
          accent: typeof config?.wordOfDay?.accent === 'string' && config.wordOfDay.accent.trim() ? config.wordOfDay.accent.trim() : 'calm'
        }
      }
    }
    if (normalizedType === 'world_clocks') {
      const rawLocations = config?.worldClocks?.locations ?? defaultWorldClockLocations()
      let locations = rawLocations
        .filter((location) => location.label.trim() && location.timeZone.trim())
        .slice(0, 16)
        .map((location) => ({
          id: location.id || randomUUID(),
          label: location.label.trim(),
          timeZone: location.timeZone.trim()
        }))
      if (locations.length < 2) locations = defaultWorldClockLocations().slice(0, 2)
      return {
        worldClocks: {
          locations,
          showSeconds: Boolean(config?.worldClocks?.showSeconds),
          style: config?.worldClocks?.style === 'analogue' ? 'analogue' : 'digital'
        }
      }
    }
    if (normalizedType === 'countdown') {
      return {
        countdown: {
          targetAt: typeof config?.countdown?.targetAt === 'string' ? config.countdown.targetAt : '',
          label: typeof config?.countdown?.label === 'string' && config.countdown.label.trim() ? config.countdown.label.trim() : 'Next milestone'
        }
      }
    }
    return {
      clock: {
        showSeconds: config?.clock?.showSeconds !== false
      }
    }
  }

  private readListTemplateConfig(type: ListTemplateType | undefined, json: string | null): ListTemplateConfig {
    const normalizedType = normalizeListTemplateType(type)
    const fallback = defaultListTemplateConfig(normalizedType)
    if (!json) return fallback
    try {
      const parsed = JSON.parse(json) as { behavior?: string; birthday?: { boardView?: string } }
      const boardView = parsed.birthday?.boardView
      const behavior = normalizedType === 'custom' ? this.normalizeListBehavior(parsed.behavior) : fallback.behavior
      return {
        ...fallback,
        behavior,
        ...(normalizedType === 'birthday_calendar'
          ? {
              birthday: {
                boardView:
                  boardView === 'this_week' ||
                  boardView === 'this_month' ||
                  boardView === 'next_10_days' ||
                  boardView === 'next_30_days' ||
                  boardView === 'next_2_months' ||
                  boardView === 'all'
                    ? boardView
                    : 'this_month'
              }
            }
          : {})
      }
    } catch {
      return fallback
    }
  }

  private normalizeListBehavior(behavior: string | undefined): ListBehavior {
    if (behavior === 'tasks' || behavior === 'purchases' || behavior === 'calendar' || behavior === 'other') return behavior
    return 'other'
  }

  private createTemplateList(listId: string, templateType: ListTemplateType): void {
    const normalizedType = normalizeListTemplateType(templateType)
    if (normalizedType === 'todo') return this.createTodoTemplate(listId)
    if (normalizedType === 'shopping_list') return this.createShoppingListTemplate(listId)
    if (normalizedType === 'wishlist') return this.createWishlistTemplate(listId)
    if (normalizedType === 'health') return this.createHealthTemplate(listId)
    if (normalizedType === 'trips_events') return this.createTripsEventsTemplate(listId)
    if (normalizedType === 'birthday_calendar') return this.createBirthdayCalendarTemplate(listId)
    this.createCustomListTemplate(listId)
  }

  private createBirthdayCalendarTemplate(listId: string): void {
    this.createSeedColumn(listId, 'Name', 'text', 0, true, 160, false, false, true)
    const birthdayId = this.createSeedColumn(listId, 'Birthday', 'date', 1, true, null, false, false, true, this.writeColumnDisplayFormat(null, null, 'date'))
    this.createSeedColumn(listId, 'Year of Birth', 'integer', 2, false, null, false, false, true)
    this.createSeedColumn(listId, 'Location', 'text', 3, false, 120, false, false, false, this.writeColumnDisplayFormat(null, null, 'date', 'none', [], undefined, false))
    this.run(
      `UPDATE lists
       SET show_item_id_on_board = 0,
           show_dependencies_on_board = 0,
           sort_column_id = ?,
           sort_direction = 'asc',
           updated_at = ?
       WHERE id = ?`,
      birthdayId,
      new Date().toISOString(),
      listId
    )
  }

  private createCustomListTemplate(listId: string): void {
    this.createSeedColumn(listId, 'Item Name', 'text', 0, true, 120, false, false, true)
  }

  private createTodoTemplate(listId: string): void {
    this.createSeedColumn(listId, 'Task Name', 'text', 0, true, 160, true, true, true)
    this.createSeedColumn(listId, 'Details', 'text', 1, false, 500, false, false, false, this.writeColumnDisplayFormat(null, null, 'date', 'none', [], undefined, false))
    const deadlineId = this.createSeedColumn(
      listId,
      'Deadline',
      'date',
      2,
      false,
      null,
        false,
        true,
        true,
      this.writeColumnDisplayFormat('deadline', null, 'datetime', 'none', [], undefined, true)
    )
    this.createSeedColumn(
      listId,
      'Priority',
      'choice',
      3,
      false,
      null,
      false,
      false,
      false,
      this.writeColumnDisplayFormat(null, choiceConfigFromLabels(DEFAULT_PRIORITY_OPTIONS), 'date', 'none', [], undefined, true)
    )
    this.createSeedColumn(listId, 'People', 'text', 4, false, 160, false, false, false, this.writeColumnDisplayFormat(null, null, 'date', 'none', [], undefined, false))
    this.createSeedColumn(listId, 'Location', 'text', 5, false, 160, false, false, false, this.writeColumnDisplayFormat(null, null, 'date', 'none', [], undefined, false))
    this.createSeedColumn(listId, 'Effort', 'duration', 6, false, null, true, true, true, this.writeColumnDisplayFormat(null, null, 'date', 'none', [], undefined, true, 'days_hours'))
    this.createSeedColumn(listId, '% Done', 'integer', 7, false, null, false, false, false, this.writeColumnDisplayFormat(null, null, 'date', 'none', [], undefined, true))
    this.createSeedColumn(listId, 'Comments', 'text', 8, false, 500, false, false, false, this.writeColumnDisplayFormat(null, null, 'date', 'none', [], undefined, false))
    this.run(
      `UPDATE lists
       SET due_date_enabled = 1,
           due_date_column_id = ?,
           deadline_mandatory = 0,
           sort_column_id = (SELECT id FROM list_columns WHERE list_id = ? AND lower(name) = 'priority'),
           sort_direction = 'asc',
           show_item_id_on_board = 0,
           show_dependencies_on_board = 0,
           updated_at = ?
       WHERE id = ?`,
      deadlineId,
      listId,
      new Date().toISOString(),
      listId
    )
  }

  private createShoppingListTemplate(listId: string): void {
    this.createSeedColumn(listId, 'Product', 'text', 0, true, 160, false, false, true)
    this.createSeedColumn(listId, 'Pieces', 'integer', 1, false, null, false, false, false)
    this.createSeedColumn(listId, 'Store', 'text', 2, false, 120, false, false, false)
    const neededById = this.createSeedColumn(
      listId,
      'Needed By',
      'date',
      3,
      false,
      null,
      false,
      false,
      false,
      this.writeColumnDisplayFormat('deadline', null, 'date', 'none', [], undefined, true)
    )
    this.createSeedColumn(listId, 'Price / pc', 'currency', 4, false, null, false, false, false, this.writeColumnDisplayFormat(null, null, 'date', 'none', [], 'USD', true))
    this.createSeedColumn(listId, 'Cost', 'currency', 5, false, null, false, false, false, this.writeColumnDisplayFormat(null, null, 'date', 'none', [], 'USD', true))
    this.createSeedColumn(listId, 'Link', 'hyperlink', 6, false, null, false, false, false)
    this.run(
      `UPDATE lists
       SET due_date_enabled = 1,
           due_date_column_id = ?,
           deadline_mandatory = 0,
           sort_column_id = ?,
           sort_direction = 'asc',
           show_item_id_on_board = 0,
           show_dependencies_on_board = 0,
           updated_at = ?
       WHERE id = ?`,
      neededById,
      neededById,
      new Date().toISOString(),
      listId
    )
  }

  private createWishlistTemplate(listId: string): void {
    this.createSeedColumn(listId, 'Product', 'text', 0, true, 160, false, false, true)
    this.createSeedColumn(listId, 'Description', 'text', 1, false, 500, false, false, false)
    this.createSeedColumn(listId, 'Link', 'hyperlink', 2, false, null, false, false, true)
    this.createSeedColumn(listId, 'Price', 'currency', 3, false, null, false, false, true)
    this.createSeedColumn(
      listId,
      'Wishmeter',
      'choice',
      4,
      false,
      null,
      false,
      false,
      false,
      this.writeColumnDisplayFormat(null, choiceConfigFromLabels(WISHMETER_OPTIONS), 'date', 'none', [], undefined, true)
    )
    this.run(
      `UPDATE lists
       SET sort_column_id = (SELECT id FROM list_columns WHERE list_id = ? AND lower(name) = 'wishmeter'),
           sort_direction = 'asc',
           show_item_id_on_board = 0,
           show_dependencies_on_board = 0,
           updated_at = ?
       WHERE id = ?`,
      listId,
      new Date().toISOString(),
      listId
    )
  }

  private createHealthTemplate(listId: string): void {
    this.createSeedGroup(listId, 'Upcoming Check-ups', 0)
    this.createSeedGroup(listId, 'Recurring Appointments', 1)
    this.createSeedGroup(listId, 'Scheduled Investigations', 2)
    this.createSeedGroup(listId, 'Treatment Plan', 3)
    this.createSeedColumn(listId, 'Entry', 'text', 0, true, 160, false, false, true)
    const appointmentId = this.createSeedColumn(
      listId,
      'Appointment Date',
      'date',
      1,
      false,
      null,
        false,
        false,
        false,
      this.writeColumnDisplayFormat(null, null, 'datetime', 'none', [], undefined, true)
    )
    this.createSeedColumn(
      listId,
      'Recurrence',
      'date',
      2,
      false,
      null,
      false,
      false,
      false,
      this.writeColumnDisplayFormat(null, null, 'time', 'daily', [], undefined, true)
    )
    this.createSeedColumn(listId, 'Mentions', 'text', 3, false, 120, false, false, false)
    this.createSeedColumn(listId, 'Details', 'text', 4, false, 500, false, false, false, this.writeColumnDisplayFormat(null, null, 'date', 'none', [], undefined, false))
    this.run(
      `UPDATE lists
       SET due_date_enabled = 0,
           due_date_column_id = NULL,
           deadline_mandatory = 0,
           sort_column_id = ?,
           sort_direction = 'asc',
           show_item_id_on_board = 0,
           show_dependencies_on_board = 0,
           updated_at = ?
       WHERE id = ?`,
      appointmentId,
      new Date().toISOString(),
      listId
    )
  }

  private createTripsEventsTemplate(listId: string): void {
    this.createSeedColumn(listId, 'Title', 'text', 0, true, 160, false, false, true)
    this.createSeedColumn(listId, 'Type', 'choice', 1, false, 120, false, false, false, this.writeColumnDisplayFormat(null, { selection: 'single', ranked: false, options: ['Personal Time', 'Event', 'Work Trip', 'Work Event', 'Other'].map((label, index) => ({ id: normalizeReservedColumnName(label).replace(/\s+/g, '-'), label, rank: index + 1 })) }, 'date', 'none', [], undefined, true))
    const startId = this.createSeedColumn(listId, 'Start', 'date', 2, false, null, false, false, false, this.writeColumnDisplayFormat(null, null, 'datetime', 'none', [], undefined, true))
    this.createSeedColumn(listId, 'End', 'date', 3, false, null, false, false, false, this.writeColumnDisplayFormat(null, null, 'datetime', 'none', [], undefined, true))
    this.createSeedColumn(listId, 'Topic / Theme', 'text', 4, false, 160, false, false, false)
    this.createSeedColumn(listId, 'Location', 'text', 5, false, 160, false, false, false)
    this.run(
      `UPDATE lists
       SET sort_column_id = ?,
           sort_direction = 'asc',
           show_item_id_on_board = 0,
           show_dependencies_on_board = 0,
           updated_at = ?
       WHERE id = ?`,
      startId,
      new Date().toISOString(),
      listId
    )
  }

  private retemplateList(listId: string, templateType: ListTemplateType): void {
    this.run('DELETE FROM list_columns WHERE list_id = ?', listId)
    this.run(
      `UPDATE lists
       SET due_date_enabled = 0,
           due_date_column_id = NULL,
           deadline_mandatory = 0,
           sort_column_id = NULL,
           sort_direction = 'manual'
       WHERE id = ?`,
      listId
    )
    this.createTemplateList(listId, templateType)
  }

  private defaultWidgetName(type: WidgetType): string {
    if (type === 'weather') return 'Weather'
    if (type === 'word_of_day') return 'Word of the Day'
    if (type === 'world_clocks') return 'World Clocks'
    if (type === 'countdown') return 'Countdown'
    return 'Clock'
  }

  private createSeedList(
    boardId: string,
    name: string,
    code: string,
    order: number,
    grid: { x: number; y: number; w: number; h: number },
    dueDateEnabled: boolean
  ): string {
    const id = randomUUID()
    const now = new Date().toISOString()
    this.run(
      `INSERT INTO lists
         (id, board_id, name, code, sort_order, grid_x, grid_y, grid_w, grid_h, due_date_enabled, display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board, show_status_on_board, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 0, 0, 1, ?, ?)`,
      id,
      boardId,
      name,
      code,
      order,
      grid.x,
      grid.y,
      grid.w,
      grid.h,
      dueDateEnabled ? 1 : 0,
      now,
      now
    )
    return id
  }

  private createSeedColumn(
    listId: string,
    name: string,
    type: ColumnType,
    order: number,
    required: boolean,
    maxLength: number | null,
    listSummaryEligible: boolean,
    boardSummaryEligible: boolean,
    system: boolean,
    displayFormat: string | null = null
  ): string {
    const id = randomUUID()
    const now = new Date().toISOString()
    this.run(
      `INSERT INTO list_columns
         (id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_list_summary_eligible, is_board_summary_eligible, display_format, is_system, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      listId,
      name,
      type,
      order,
      required ? 1 : 0,
      maxLength,
      listSummaryEligible || boardSummaryEligible ? 1 : 0,
      listSummaryEligible ? 1 : 0,
      boardSummaryEligible ? 1 : 0,
      displayFormat,
      system ? 1 : 0,
      now,
      now
    )
    return id
  }

  private moveColumnToOrder(listId: string, columnId: string, targetOrder: number): void {
    const columns = this.client.database
      .prepare('SELECT id FROM list_columns WHERE list_id = ? ORDER BY sort_order, name')
      .all<{ id: string }>(listId)
    const currentIndex = columns.findIndex((column) => column.id === columnId)
    if (currentIndex < 0) return
    const [moved] = columns.splice(currentIndex, 1)
    const nextIndex = this.clamp(targetOrder - 1, 0, columns.length)
    columns.splice(nextIndex, 0, moved)
    this.writeColumnOrder(listId, columns.map((column) => column.id))
  }

  private applyColumnSortOrder(listId: string, sortOrder: ColumnSortOrder, listType: ListTemplateType): void {
    const mode = normalizeColumnSortOrder(sortOrder)
    if (mode === 'manual') return
    const normalizedType = normalizeListTemplateType(listType)
    const columns = this.client.database
      .prepare(
        `SELECT id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_list_summary_eligible, is_board_summary_eligible, is_system, display_format
         FROM list_columns
         WHERE list_id = ?
         ORDER BY sort_order, name`
      )
      .all<ColumnRow>(listId)

    const ordered = [...columns].sort((left, right) => this.compareColumnsForSort(left, right, mode, normalizedType))
    this.writeColumnOrder(listId, ordered.map((column) => column.id))
  }

  private compareColumnsForSort(left: ColumnRow, right: ColumnRow, mode: ColumnSortOrder, listType: ListTemplateType): number {
    if (mode === 'default') {
      const leftDefault = defaultColumnOrderIndex(listType, left.name)
      const rightDefault = defaultColumnOrderIndex(listType, right.name)
      if (leftDefault !== rightDefault) return leftDefault - rightDefault
      if (leftDefault !== Number.MAX_SAFE_INTEGER) return left.sort_order - right.sort_order
      return left.sort_order - right.sort_order
    }
    if (mode === 'name') {
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) || left.sort_order - right.sort_order
    }
    if (mode === 'field_type') {
      return left.column_type.localeCompare(right.column_type) || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) || left.sort_order - right.sort_order
    }
    if (mode === 'required') {
      return right.is_required - left.is_required || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) || left.sort_order - right.sort_order
    }
    if (mode === 'visibility') {
      const leftVisible = this.readColumnDisplayFormat(left.display_format).showOnBoard ? 1 : 0
      const rightVisible = this.readColumnDisplayFormat(right.display_format).showOnBoard ? 1 : 0
      return rightVisible - leftVisible || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) || left.sort_order - right.sort_order
    }
    return left.sort_order - right.sort_order
  }

  private writeColumnOrder(listId: string, orderedIds: string[]): void {
    const now = new Date().toISOString()
    orderedIds.forEach((columnId, index) => {
      this.run('UPDATE list_columns SET sort_order = ?, updated_at = ? WHERE id = ? AND list_id = ?', index, now, columnId, listId)
    })
  }

  private createSeedGroup(listId: string, name: string, order: number, parentGroupId: string | null = null): string {
    const existingCodes = this.client.database
      .prepare('SELECT code FROM item_groups WHERE list_id = ?')
      .all<{ code: string }>(listId)
      .map((row) => row.code)
    let index = order + 1
    let code = `G${String(index).padStart(2, '0')}`
    while (existingCodes.includes(code)) {
      index += 1
      code = `G${String(index).padStart(2, '0')}`
    }
    const id = randomUUID()
    const now = new Date().toISOString()
    this.run(
      `INSERT INTO item_groups (id, list_id, parent_group_id, name, code, sort_order, display_config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      id,
      listId,
      parentGroupId,
      name,
      code,
      order,
      now,
      now
    )
    return id
  }

  private assertColumnNameAllowed(listId: string, name: string, ignoreColumnId?: string): void {
    const normalized = normalizeReservedColumnName(name)
    if (normalized.length === 0) return
    if (RESERVED_COLUMN_NAMES.has(normalized)) {
      throw new Error(`"${name.trim()}" is a reserved system field name and cannot be used.`)
    }
    const rows = this.client.database
      .prepare(`SELECT id, name FROM list_columns WHERE list_id = ?${ignoreColumnId ? ' AND id <> ?' : ''}`)
      .all<{ id: string; name: string }>(...(ignoreColumnId ? [listId, ignoreColumnId] : [listId]))
    if (rows.some((row) => normalizeReservedColumnName(row.name) === normalized)) {
      throw new Error(`"${name.trim()}" already exists in this list. Column names must be unique within a list.`)
    }
  }

  private isProtectedBirthdayColumn(listType: ListTemplateType, name: string): boolean {
    return normalizeListTemplateType(listType) === 'birthday_calendar' && BIRTHDAY_PROTECTED_COLUMN_NAMES.has(normalizeReservedColumnName(name))
  }

  private isShoppingPriceColumn(listType: ListTemplateType, name: string): boolean {
    return normalizeListTemplateType(listType) === 'shopping_list' && normalizeReservedColumnName(name) === 'price / pc'
  }

  private isShoppingCostColumn(listType: ListTemplateType, name: string): boolean {
    return normalizeListTemplateType(listType) === 'shopping_list' && normalizeReservedColumnName(name) === 'cost'
  }

  private shoppingPriceCurrencyCode(listId: string): CurrencyCode {
    const priceColumn = this.client.database
      .prepare("SELECT display_format FROM list_columns WHERE list_id = ? AND lower(name) = 'price / pc' ORDER BY sort_order LIMIT 1")
      .get<{ display_format: string | null }>(listId)
    return this.readColumnDisplayFormat(priceColumn?.display_format ?? null).currencyCode
  }

  private syncShoppingCostCurrency(listId: string, currencyCode: CurrencyCode): void {
    const costColumn = this.client.database
      .prepare("SELECT id, display_format FROM list_columns WHERE list_id = ? AND lower(name) = 'cost' ORDER BY sort_order LIMIT 1")
      .get<{ id: string; display_format: string | null }>(listId)
    if (!costColumn) return
    const existingFormat = this.readColumnDisplayFormat(costColumn.display_format)
    this.run(
      'UPDATE list_columns SET display_format = ?, updated_at = ? WHERE id = ?',
      this.writeColumnDisplayFormat(
        existingFormat.role,
        existingFormat.choiceConfig,
        existingFormat.dateDisplayFormat,
        existingFormat.recurrence,
        existingFormat.recurrenceDays,
        currencyCode,
        existingFormat.showOnBoard,
        existingFormat.durationDisplayFormat
      ),
      new Date().toISOString(),
      costColumn.id
    )
  }

  private assertProtectedBirthdayColumnUpdateAllowed(
    existing: { name: string; column_type: ColumnType; is_required: number; max_length: number | null },
    resolvedName: string,
    type: ColumnType,
    input: UpdateColumnInput
  ): void {
    const structuralChange =
      normalizeReservedColumnName(resolvedName) !== normalizeReservedColumnName(existing.name) ||
      type !== existing.column_type ||
      input.required !== (existing.is_required === 1) ||
      (input.maxLength ?? null) !== existing.max_length ||
      typeof input.order === 'number'

    if (structuralChange) {
      throw new Error(`"${existing.name}" is a protected Birthday Calendar field and cannot be structurally changed.`)
    }
  }

  private canRetemplateList(listId: string, currentTemplateType: ListTemplateType): boolean {
    const itemCount = this.client.database.prepare('SELECT COUNT(*) AS count FROM items WHERE list_id = ?').get<{ count: number }>(listId)?.count ?? 0
    const groupCount = this.client.database.prepare('SELECT COUNT(*) AS count FROM item_groups WHERE list_id = ?').get<{ count: number }>(listId)?.count ?? 0
    if (itemCount > 0 || groupCount > 0) return false

    const columns = this.client.database
      .prepare('SELECT name FROM list_columns WHERE list_id = ? ORDER BY sort_order')
      .all<{ name: string }>(listId)
      .map((row) => normalizeReservedColumnName(row.name))

    const normalizedType = normalizeListTemplateType(currentTemplateType)
    const expected =
      normalizedType === 'birthday_calendar'
        ? ['name', 'birthday', 'year of birth', 'location']
        : normalizedType === 'todo'
          ? ['task name', 'details', 'deadline', 'priority', 'people', 'location', 'effort', '% done', 'comments']
          : normalizedType === 'shopping_list'
            ? ['product', 'pieces', 'store', 'needed by', 'price / pc', 'cost', 'link']
            : normalizedType === 'wishlist'
              ? ['product', 'description', 'link', 'price', 'wishmeter']
            : normalizedType === 'health'
                ? ['entry', 'appointment date', 'recurrence', 'mentions', 'details']
                : normalizedType === 'trips_events'
                  ? ['title', 'type', 'start', 'end', 'topic / theme', 'location']
                  : ['item name']

    return columns.length === expected.length && columns.every((name, index) => name === expected[index])
  }

  private applyTemplateComputedValues(
    templateType: ListTemplateType | undefined,
    columns: ListColumn[],
    values: Record<string, FieldValue>
  ): Record<string, FieldValue> {
    const normalizedType = normalizeListTemplateType(templateType)
    if (normalizedType !== 'shopping_list') return values

    const piecesColumn = columns.find((column) => normalizeReservedColumnName(column.name) === 'pieces')
    const priceColumn = columns.find((column) => normalizeReservedColumnName(column.name) === 'price / pc')
    const costColumn = columns.find((column) => normalizeReservedColumnName(column.name) === 'cost')
    if (!piecesColumn || !priceColumn || !costColumn) return values

    const pieces = Number(values[piecesColumn.id] ?? 0)
    const price = Number(values[priceColumn.id] ?? 0)
    return {
      ...values,
      [costColumn.id]: Number.isFinite(pieces) && Number.isFinite(price) ? Number((pieces * price).toFixed(2)) : 0
    }
  }

  private validateItemValues(listId: string, incomingValues: Record<string, FieldValue>, itemId?: string): Record<string, FieldValue> {
    const columns = this.getColumnsByList([listId])[listId] ?? []
    const allowedColumnIds = new Set(columns.map((column) => column.id))
    const unknownColumnId = Object.keys(incomingValues).find((columnId) => !allowedColumnIds.has(columnId))
    if (unknownColumnId) throw new Error('One or more submitted fields are not valid for this list.')

    const existingValues =
      itemId === undefined
        ? {}
        : {
            ...(this.getItemValues([itemId], 'published')[itemId] ?? {}),
            ...(this.getItemValues([itemId], 'draft')[itemId] ?? {})
          }
    const mergedValues: Record<string, FieldValue> = { ...existingValues, ...incomingValues }

    for (const column of columns) {
      const value = mergedValues[column.id]
      if (column.required && this.isMissingFieldValue(value)) {
        throw new Error(`"${column.name}" is required.`)
      }
      if (!this.isMissingFieldValue(value)) this.assertFieldValueFitsColumn(column, value)
    }

    return incomingValues
  }

  private resolveColumnSummaryEligibility(
    listId: string,
    name: string,
    type: ColumnType,
    role: ColumnRole | null,
    requestedListSummary: boolean,
    requestedBoardSummary: boolean,
    columnId?: string
  ): { list: boolean; board: boolean } {
    const list = this.columnSupportsListSummary(name, type, role) && requestedListSummary
    const board = this.columnSupportsBoardSummary(name, type, role) && requestedBoardSummary

    if (list) this.assertSummaryColumnLimit(listId, 'list', columnId)
    if (board) this.assertSummaryColumnLimit(listId, 'board', columnId)

    return { list, board }
  }

  private assertSummaryColumnLimit(listId: string, scope: 'list' | 'board', columnId?: string): void {
    const columnName = scope === 'list' ? 'is_list_summary_eligible' : 'is_board_summary_eligible'
    const currentCount = this.client.database
      .prepare(`SELECT COUNT(*) AS count FROM list_columns WHERE list_id = ? AND ${columnName} = 1 AND (? IS NULL OR id <> ?)`)
      .get<{ count: number }>(listId, columnId ?? null, columnId ?? null)?.count ?? 0
    const max = scope === 'list' ? MAX_LIST_SUMMARY_COLUMNS : MAX_BOARD_SUMMARY_COLUMNS
    if (currentCount >= max) {
      throw new Error(scope === 'list' ? `You can select at most ${MAX_LIST_SUMMARY_COLUMNS} list summary fields.` : `You can select at most ${MAX_BOARD_SUMMARY_COLUMNS} board summary fields.`)
    }
  }

  private columnSupportsListSummary(
    name: string,
    type: ColumnType,
    role: ColumnRole | null
  ): boolean {
    const normalizedName = normalizeReservedColumnName(name)
    if (role === 'deadline') return true
    if (type === 'text') return SUMMARY_COUNT_TEXT_COLUMNS.has(normalizedName)
    if (type === 'currency') return normalizedName !== 'price / pc'
    if (type === 'integer' || type === 'decimal' || type === 'duration') return !NON_SUMMARY_NUMERIC_COLUMNS.has(normalizedName)
    if (type === 'date') return SUMMARY_DATE_COLUMNS.has(normalizedName)
    return false
  }

  private columnSupportsBoardSummary(
    name: string,
    type: ColumnType,
    role: ColumnRole | null
  ): boolean {
    const normalizedName = normalizeReservedColumnName(name)
    if (role === 'deadline') return true
    if (type === 'text') return SUMMARY_COUNT_TEXT_COLUMNS.has(normalizedName)
    if (type === 'currency') return normalizedName !== 'price / pc'
    if (type === 'integer' || type === 'decimal' || type === 'duration') return !NON_SUMMARY_NUMERIC_COLUMNS.has(normalizedName)
    if (type === 'date') return SUMMARY_DATE_COLUMNS.has(normalizedName)
    return false
  }

  private isMissingFieldValue(value: FieldValue | undefined): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim().length === 0
    if (Array.isArray(value)) return value.length === 0
    if (isDateFieldValue(value)) return value.value.trim().length === 0
    return false
  }

  private assertFieldValueFitsColumn(column: ListColumn, value: FieldValue): void {
    if (value === null || value === undefined) return

    if (column.type === 'integer') {
      const numeric = Number(value)
      if (!Number.isInteger(numeric)) throw new Error(`"${column.name}" must be a whole number.`)
      return
    }
    if (column.type === 'decimal' || column.type === 'currency' || column.type === 'duration') {
      const numeric = Number(value)
      if (!Number.isFinite(numeric)) throw new Error(`"${column.name}" must be a valid number.`)
      return
    }
    if (column.type === 'boolean') {
      if (typeof value !== 'boolean') throw new Error(`"${column.name}" must be true or false.`)
      return
    }
    if (column.type === 'choice') {
      const selected = Array.isArray(value) ? value.map(String) : [String(value)]
      const options = new Set((column.choiceConfig?.options ?? []).flatMap((option) => [option.id, option.label]))
      if (selected.some((entry) => !options.has(entry))) throw new Error(`"${column.name}" contains an invalid choice value.`)
      return
    }
    if (column.type === 'date') {
      const dateValue = isDateFieldValue(value) ? value.value : String(value)
      if (!dateValue.trim()) throw new Error(`"${column.name}" must contain a valid date or time value.`)
      return
    }
    if (typeof value !== 'string') throw new Error(`"${column.name}" must be text.`)
  }

  private archiveValuesForItem(itemId: string, publicationStatus: PublicationStatus, scope: ArchiveValueScope | undefined): Record<string, FieldValue> {
    const normalizedScope: ArchiveValueScope = scope === 'draft' || scope === 'published' ? scope : 'visible'
    const draftValues = this.getItemValues([itemId], 'draft')[itemId] ?? {}
    const publishedValues = this.getItemValues([itemId], 'published')[itemId] ?? {}

    if (normalizedScope === 'draft') return Object.keys(draftValues).length > 0 ? draftValues : publishedValues
    if (normalizedScope === 'published') return Object.keys(publishedValues).length > 0 ? publishedValues : draftValues
    if (publicationStatus === 'draft') return Object.keys(draftValues).length > 0 ? draftValues : publishedValues
    return Object.keys(publishedValues).length > 0 ? publishedValues : draftValues
  }

  private assertListGridPlacement(boardId: string, currentListId: string, grid: BoardList['grid']): void {
    const listRows = this.client.database
      .prepare(
        `SELECT grid_x, grid_y, grid_w, grid_h
         FROM lists
         WHERE board_id = ?
           AND display_enabled = 1
           AND id <> ?`
      )
      .all<{ grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId, currentListId)
    const widgetRows = this.client.database
      .prepare(
        `SELECT grid_x, grid_y, grid_w, grid_h
         FROM board_widgets
         WHERE board_id = ?
           AND display_enabled = 1`
      )
      .all<{ grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)
    const overlaps = [...listRows, ...widgetRows]
      .map((row) => ({ x: row.grid_x, y: row.grid_y, w: row.grid_w, h: row.grid_h }))
      .some((candidate) => this.gridsOverlap(candidate, grid))
    if (overlaps) throw new Error('This list overlaps another visible board element. Move or resize it first.')
  }

  private assertListGridPlacementBatch(boardId: string, updates: Array<{ listId: string; grid: BoardList['grid'] }>): void {
    const listRows = this.client.database
      .prepare(
        `SELECT id, grid_x, grid_y, grid_w, grid_h
         FROM lists
         WHERE board_id = ?
           AND display_enabled = 1`
      )
      .all<{ id: string; grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)
    const widgetRows = this.client.database
      .prepare(
        `SELECT grid_x, grid_y, grid_w, grid_h
         FROM board_widgets
         WHERE board_id = ?
           AND display_enabled = 1`
      )
      .all<{ grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)

    const updateMap = new Map(updates.map((entry) => [entry.listId, entry.grid]))
    const finalListGrids = listRows.map((row) => ({
      id: row.id,
      grid: updateMap.get(row.id) ?? { x: row.grid_x, y: row.grid_y, w: row.grid_w, h: row.grid_h }
    }))

    for (const entry of finalListGrids) {
      const { grid } = entry
      const valid =
        grid.x >= 1 && grid.y >= 1 && grid.w >= MIN_LIST_GRID_WIDTH && grid.h >= MIN_LIST_GRID_HEIGHT && grid.x + grid.w <= 17 && grid.y + grid.h <= 9
      if (!valid) throw new Error('This list overlaps another visible board element. Move or resize it first.')
    }

    for (let index = 0; index < finalListGrids.length; index += 1) {
      const current = finalListGrids[index]
      const overlapsList = finalListGrids.some(
        (candidate, candidateIndex) => candidateIndex !== index && this.gridsOverlap(current.grid, candidate.grid)
      )
      if (overlapsList) throw new Error('This list overlaps another visible board element. Move or resize it first.')
      const overlapsWidget = widgetRows.some((row) =>
        this.gridsOverlap(current.grid, { x: row.grid_x, y: row.grid_y, w: row.grid_w, h: row.grid_h })
      )
      if (overlapsWidget) throw new Error('This list overlaps another visible board element. Move or resize it first.')
    }
  }

  private assertWidgetGridPlacement(boardId: string, currentWidgetId: string, grid: BoardWidget['grid']): void {
    const listRows = this.client.database
      .prepare(
        `SELECT grid_x, grid_y, grid_w, grid_h
         FROM lists
         WHERE board_id = ?
           AND display_enabled = 1`
      )
      .all<{ grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)
    const widgetRows = this.client.database
      .prepare(
        `SELECT grid_x, grid_y, grid_w, grid_h
         FROM board_widgets
         WHERE board_id = ?
           AND display_enabled = 1
           AND id <> ?`
      )
      .all<{ grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId, currentWidgetId)
    const overlaps = [...listRows, ...widgetRows]
      .map((row) => ({ x: row.grid_x, y: row.grid_y, w: row.grid_w, h: row.grid_h }))
      .some((candidate) => this.gridsOverlap(candidate, grid))
    if (overlaps) throw new Error('This widget overlaps another visible board element. Move or resize it first.')
  }

  private assertWidgetGridPlacementBatch(boardId: string, updates: Array<{ widgetId: string; grid: BoardWidget['grid'] }>): void {
    const listRows = this.client.database
      .prepare(
        `SELECT grid_x, grid_y, grid_w, grid_h
         FROM lists
         WHERE board_id = ?
           AND display_enabled = 1`
      )
      .all<{ grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)
    const widgetRows = this.client.database
      .prepare(
        `SELECT id, grid_x, grid_y, grid_w, grid_h
         FROM board_widgets
         WHERE board_id = ?
           AND display_enabled = 1`
      )
      .all<{ id: string; grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)

    const updateMap = new Map(updates.map((entry) => [entry.widgetId, entry.grid]))
    const finalWidgetGrids = widgetRows.map((row) => ({
      id: row.id,
      grid: updateMap.get(row.id) ?? { x: row.grid_x, y: row.grid_y, w: row.grid_w, h: row.grid_h }
    }))

    for (const entry of finalWidgetGrids) {
      const { grid } = entry
      const valid =
        grid.x >= 1 && grid.y >= 1 && grid.w >= MIN_WIDGET_GRID_WIDTH && grid.h >= MIN_WIDGET_GRID_HEIGHT && grid.x + grid.w <= 17 && grid.y + grid.h <= 9
      if (!valid) throw new Error('This widget overlaps another visible board element. Move or resize it first.')
    }

    for (let index = 0; index < finalWidgetGrids.length; index += 1) {
      const current = finalWidgetGrids[index]
      const overlapsWidget = finalWidgetGrids.some(
        (candidate, candidateIndex) => candidateIndex !== index && this.gridsOverlap(current.grid, candidate.grid)
      )
      if (overlapsWidget) throw new Error('This widget overlaps another visible board element. Move or resize it first.')
      const overlapsList = listRows.some((row) =>
        this.gridsOverlap(current.grid, { x: row.grid_x, y: row.grid_y, w: row.grid_w, h: row.grid_h })
      )
      if (overlapsList) throw new Error('This widget overlaps another visible board element. Move or resize it first.')
    }
  }

  private assertBoardLayoutPlacementBatch(
    boardId: string,
    listUpdates: Array<{ listId: string; grid: BoardList['grid'] }>,
    widgetUpdates: Array<{ widgetId: string; grid: BoardWidget['grid'] }>
  ): void {
    const listRows = this.client.database
      .prepare(
        `SELECT id, grid_x, grid_y, grid_w, grid_h
         FROM lists
         WHERE board_id = ?
           AND display_enabled = 1`
      )
      .all<{ id: string; grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)
    const widgetRows = this.client.database
      .prepare(
        `SELECT id, grid_x, grid_y, grid_w, grid_h
         FROM board_widgets
         WHERE board_id = ?
           AND display_enabled = 1`
      )
      .all<{ id: string; grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)

    const listUpdateMap = new Map(listUpdates.map((entry) => [entry.listId, entry.grid]))
    const widgetUpdateMap = new Map(widgetUpdates.map((entry) => [entry.widgetId, entry.grid]))
    const finalListGrids = listRows.map((row) => ({
      id: row.id,
      grid: listUpdateMap.get(row.id) ?? { x: row.grid_x, y: row.grid_y, w: row.grid_w, h: row.grid_h }
    }))
    const finalWidgetGrids = widgetRows.map((row) => ({
      id: row.id,
      grid: widgetUpdateMap.get(row.id) ?? { x: row.grid_x, y: row.grid_y, w: row.grid_w, h: row.grid_h }
    }))

    for (const entry of finalListGrids) {
      const { grid } = entry
      const valid =
        grid.x >= 1 && grid.y >= 1 && grid.w >= MIN_LIST_GRID_WIDTH && grid.h >= MIN_LIST_GRID_HEIGHT && grid.x + grid.w <= 17 && grid.y + grid.h <= 9
      if (!valid) throw new Error('This list overlaps another visible board element. Move or resize it first.')
    }

    for (const entry of finalWidgetGrids) {
      const { grid } = entry
      const valid =
        grid.x >= 1 && grid.y >= 1 && grid.w >= MIN_WIDGET_GRID_WIDTH && grid.h >= MIN_WIDGET_GRID_HEIGHT && grid.x + grid.w <= 17 && grid.y + grid.h <= 9
      if (!valid) throw new Error('This widget overlaps another visible board element. Move or resize it first.')
    }

    for (let index = 0; index < finalListGrids.length; index += 1) {
      const current = finalListGrids[index]
      const overlapsList = finalListGrids.some(
        (candidate, candidateIndex) => candidateIndex !== index && this.gridsOverlap(current.grid, candidate.grid)
      )
      if (overlapsList) throw new Error('This list overlaps another visible board element. Move or resize it first.')
      const overlapsWidget = finalWidgetGrids.some((candidate) => this.gridsOverlap(current.grid, candidate.grid))
      if (overlapsWidget) throw new Error('This list overlaps another visible board element. Move or resize it first.')
    }

    for (let index = 0; index < finalWidgetGrids.length; index += 1) {
      const current = finalWidgetGrids[index]
      const overlapsWidget = finalWidgetGrids.some(
        (candidate, candidateIndex) => candidateIndex !== index && this.gridsOverlap(current.grid, candidate.grid)
      )
      if (overlapsWidget) throw new Error('This widget overlaps another visible board element. Move or resize it first.')
      const overlapsList = finalListGrids.some((candidate) => this.gridsOverlap(current.grid, candidate.grid))
      if (overlapsList) throw new Error('This widget overlaps another visible board element. Move or resize it first.')
    }
  }

  private createSeedItem(
    listId: string,
    itemNumber: number,
    publicationStatus: PublicationStatus,
    values: Record<string, FieldValue>
  ): string {
    const id = randomUUID()
    const now = new Date().toISOString()
    this.run(
      `INSERT INTO items
         (id, list_id, group_id, item_number, item_order, publication_status, operational_state, created_by, created_at, updated_at, published_at)
       VALUES (?, ?, NULL, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      id,
      listId,
      itemNumber,
      itemNumber,
      publicationStatus,
      'admin',
      now,
      now,
      publicationStatus === 'published' ? now : null
    )
    this.upsertValues(id, values, 'draft')
    if (publicationStatus === 'published') {
      this.upsertValues(id, values, 'published')
    }
    return id
  }

  private createSeedSummary(
    boardId: string,
    slotIndex: number,
    label: string,
    sourceListId: string | null,
    sourceColumnId: string | null,
    aggregationMethod: AggregationMethod
  ): void {
    const now = new Date().toISOString()
    this.run(
      `INSERT INTO bottom_bar_widget_configs
         (id, board_id, slot_index, label, source_list_id, source_column_id, aggregation_method, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      boardId,
      slotIndex,
      label,
      sourceListId,
      sourceColumnId,
      aggregationMethod,
      now,
      now
    )
  }

  private inferBoardSummaryAggregation(column: ListColumn): AggregationMethod {
    if (column.role === 'deadline' || column.type === 'date') return 'next_due'
    if (column.type === 'currency' || column.type === 'integer' || column.type === 'decimal' || column.type === 'duration') return 'sum'
    return 'count'
  }

  private setDueDateColumn(listId: string, columnId: string): void {
    this.run('UPDATE lists SET due_date_column_id = ?, updated_at = ? WHERE id = ?', columnId, new Date().toISOString(), listId)
  }

  private transaction(action: () => void): void {
    this.client.database.exec('BEGIN')
    try {
      action()
      this.client.database.exec('COMMIT')
    } catch (error) {
      this.client.database.exec('ROLLBACK')
      throw error
    }
  }

  private run(sql: string, ...params: unknown[]): void {
    this.client.database.prepare(sql).run(...params)
  }

  private getDefaultUserId(): string {
    const user = this.client.database.prepare('SELECT id FROM users ORDER BY created_at LIMIT 1').get<{ id: string }>()
    if (!user) throw new Error('No local user exists.')
    return user.id
  }

  private validGroupId(listId: string, groupId: string | null): string | null {
    if (!groupId) return null
    const group = this.client.database
      .prepare('SELECT id FROM item_groups WHERE id = ? AND list_id = ?')
      .get<{ id: string }>(groupId, listId)
    return group?.id ?? null
  }

  private validParentGroupId(listId: string, parentGroupId: string | null, currentGroupId: string): string | null {
    if (!parentGroupId || parentGroupId === currentGroupId) return null
    const parent = this.client.database
      .prepare('SELECT id FROM item_groups WHERE id = ? AND list_id = ?')
      .get<{ id: string }>(parentGroupId, listId)
    return parent?.id ?? null
  }

  private getNextListPosition(boardId: string): { order: number; code: string } {
    const next = this.client.database
      .prepare(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order,
                COALESCE(MAX(CAST(SUBSTR(code, 2) AS INTEGER)), 0) + 1 AS next_code
         FROM lists
         WHERE board_id = ?`
      )
      .get<{ next_order: number; next_code: number }>(boardId)
    return {
      order: next?.next_order ?? 0,
      code: `L${String(next?.next_code ?? 1).padStart(2, '0')}`
    }
  }

  private getNextGroupPosition(listId: string): { order: number; code: string } {
    const next = this.client.database
      .prepare(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order,
                COALESCE(MAX(CAST(SUBSTR(code, 2) AS INTEGER)), 0) + 1 AS next_code
         FROM item_groups
         WHERE list_id = ?`
      )
      .get<{ next_order: number; next_code: number }>(listId)
    return {
      order: next?.next_order ?? 0,
      code: `G${String(next?.next_code ?? 1).padStart(2, '0')}`
    }
  }

  private findOpenListSlot(boardId: string): BoardList['grid'] | null {
    const listRows = this.client.database
      .prepare(
        `SELECT grid_x, grid_y, grid_w, grid_h
         FROM lists
         WHERE board_id = ?
           AND display_enabled = 1
         ORDER BY sort_order`
      )
      .all<{ grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)
    const widgetRows = this.client.database
      .prepare(
        `SELECT grid_x, grid_y, grid_w, grid_h
         FROM board_widgets
         WHERE board_id = ?
           AND display_enabled = 1`
      )
      .all<{ grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)
    const occupied = [...listRows, ...widgetRows]
      .map((row) => ({ x: row.grid_x, y: row.grid_y, w: row.grid_w, h: row.grid_h }))
      .filter((grid) => grid.x >= 1 && grid.y >= 1 && grid.w >= MIN_LIST_GRID_WIDTH && grid.h >= MIN_LIST_GRID_HEIGHT)

    for (let y = 1; y <= 9 - MIN_LIST_GRID_HEIGHT; y += MIN_LIST_GRID_HEIGHT) {
      for (let x = 1; x <= 17 - MIN_LIST_GRID_WIDTH; x += MIN_LIST_GRID_WIDTH) {
        const candidate = { x, y, w: MIN_LIST_GRID_WIDTH, h: MIN_LIST_GRID_HEIGHT }
        if (!occupied.some((grid) => this.gridsOverlap(grid, candidate))) return candidate
      }
    }

    return null
  }

  private findOpenWidgetSlot(boardId: string, type: WidgetType, config: BoardWidgetConfig): BoardWidget['grid'] | null {
    const listRows = this.client.database
      .prepare(
        `SELECT grid_x, grid_y, grid_w, grid_h
         FROM lists
         WHERE board_id = ?
           AND display_enabled = 1`
      )
      .all<{ grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)
    const widgetRows = this.client.database
      .prepare(
        `SELECT grid_x, grid_y, grid_w, grid_h
         FROM board_widgets
         WHERE board_id = ?
           AND display_enabled = 1`
      )
      .all<{ grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)
    const occupied = [...listRows, ...widgetRows]
      .map((row) => ({ x: row.grid_x, y: row.grid_y, w: row.grid_w, h: row.grid_h }))
      .filter((grid) => grid.x >= 1 && grid.y >= 1 && grid.w >= 1 && grid.h >= 1)

    const spec = this.widgetAspectSpec(type, config)
    const candidateSize = this.widgetGridForScale(spec, spec.minScale)

    for (let y = 1; y <= 9 - candidateSize.h; y += 1) {
      for (let x = 1; x <= 17 - candidateSize.w; x += 1) {
        const candidate = { x, y, ...candidateSize }
        if (!occupied.some((grid) => this.gridsOverlap(grid, candidate))) return candidate
      }
    }

    return null
  }

  private normalizeWidgetGrid(grid: BoardWidget['grid'], type: WidgetType, config: BoardWidgetConfig): BoardWidget['grid'] {
    const spec = this.widgetAspectSpec(type, config)
    const maxScale = Math.max(spec.minScale, Math.min(Math.floor(16 / spec.ratioW), Math.floor(8 / spec.ratioH)))
    const desiredScale = Math.max(grid.w / spec.ratioW, grid.h / spec.ratioH)
    const scale = this.clamp(Math.round(desiredScale), spec.minScale, maxScale)
    const { w, h } = this.widgetGridForScale(spec, scale)
    const x = this.clamp(grid.x, 1, 17 - w)
    const y = this.clamp(grid.y, 1, 9 - h)
    return { x, y, w, h }
  }

  private widgetAspectSpec(type: WidgetType, config: BoardWidgetConfig): { ratioW: number; ratioH: number; minScale: number } {
    if (type === 'word_of_day') return { ratioW: 3, ratioH: 2, minScale: 1 }
    if (type === 'world_clocks') {
      const count = this.clamp(config.worldClocks?.locations?.length ?? 2, 2, 16)
      return { ratioW: count, ratioH: 2, minScale: 1 }
    }
    return { ratioW: 1, ratioH: 1, minScale: 2 }
  }

  private widgetGridForScale(spec: { ratioW: number; ratioH: number }, scale: number): Pick<BoardWidget['grid'], 'w' | 'h'> {
    return {
      w: spec.ratioW * scale,
      h: spec.ratioH * scale
    }
  }

  private gridsOverlap(a: BoardList['grid'], b: BoardList['grid']): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  }

  private placeholders(values: unknown[]): string {
    return values.map(() => '?').join(', ')
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(Math.trunc(value), min), max)
  }

  private offsetDate(days: number): string {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
  }
}
