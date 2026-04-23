import { randomUUID } from 'node:crypto'
import type {
  AggregationMethod,
  AppTheme,
  AppSettings,
  ArchiveRecord,
  BoardItem,
  BoardList,
  BoardSnapshot,
  BoardSummary,
  ChoiceConfig,
  ChoiceOption,
  CloseConfirmationMode,
  CloseItemInput,
  ColumnRole,
  ColumnType,
  CreateBoardInput,
  CreateColumnInput,
  CurrencyCode,
  CreateGroupInput,
  CreateItemInput,
  CreateListInput,
  DateFieldValue,
  DateDisplayFormat,
  FieldValue,
  GroupSummaryConfig,
  GroupSummaryMethod,
  ItemGroup,
  ListColumn,
  ListSortDirection,
  OperationalState,
  PublicationStatus,
  RecurrenceMode,
  SummarySlot,
  MoveListInput,
  UpdateBoardInput,
  UpdateColumnInput,
  UpdateGroupInput,
  UpdateListInput,
  UpdateItemInput
} from '../../shared/domain'
import type { DbClient } from './client'

const MIN_LIST_GRID_WIDTH = 4
const MIN_LIST_GRID_HEIGHT = 2
const RESERVED_COLUMN_NAMES = new Set(
  ['item id', 'item name', 'created at', 'created by', 'dependency', 'dependencies', 'close_comm'].map((name) =>
    normalizeReservedColumnName(name)
  )
)
const DEFAULT_APP_SETTINGS: AppSettings = {
  closeConfirmationMode: 'with_comments',
  theme: 'midnight_clear'
}

type ListRow = {
  id: string
  board_id: string
  name: string
  code: string
  sort_order: number
  grid_x: number
  grid_y: number
  grid_w: number
  grid_h: number
  due_date_enabled: number
  due_date_column_id: string | null
  deadline_mandatory: number
  sort_column_id: string | null
  sort_direction: ListSortDirection
  display_enabled: number
  show_item_id_on_board: number
  show_dependencies_on_board: number
  show_created_at_on_board: number
  show_created_by_on_board: number
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
  if (mode === 'daily' || mode === 'weekly' || mode === 'biweekly' || mode === 'custom_weekdays') return mode
  return 'none'
}

function recurrenceNeedsDays(mode: RecurrenceMode): boolean {
  return mode === 'weekly' || mode === 'biweekly' || mode === 'custom_weekdays'
}

function normalizeRecurrenceDays(days: number[] | undefined): number[] {
  return [...new Set((days ?? []).map((day) => Math.trunc(day)).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b)
}

function normalizeReservedColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
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

      const todoName = this.createSeedColumn(todo, 'Item Name', 'text', 0, true, 120, false, true)
      const todoDue = this.createSeedColumn(
        todo,
        'Deadline',
        'date',
        1,
        false,
        null,
        false,
        true,
        JSON.stringify({ role: 'deadline', dateDisplayFormat: 'datetime' })
      )
      const todoEffort = this.createSeedColumn(todo, 'Effort', 'decimal', 2, false, null, true, false)
      this.setDueDateColumn(todo, todoDue)

      const shoppingName = this.createSeedColumn(shopping, 'Item Name', 'text', 0, true, 120, false, true)
      const shoppingPrice = this.createSeedColumn(shopping, 'Price', 'currency', 1, false, null, true, false)
      const shoppingBought = this.createSeedColumn(shopping, 'Bought', 'boolean', 2, false, null, false, false)

      const houseName = this.createSeedColumn(house, 'Item Name', 'text', 0, true, 120, false, true)
      const houseDue = this.createSeedColumn(
        house,
        'Deadline',
        'date',
        1,
        false,
        null,
        false,
        true,
        JSON.stringify({ role: 'deadline', dateDisplayFormat: 'datetime' })
      )
      const houseBudget = this.createSeedColumn(house, 'Budget', 'currency', 2, false, null, true, false)
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
        [todoEffort]: 1
      })
      this.createSeedItem(todo, 2, 'draft', {
        [todoName]: 'Book utility setup',
        [todoDue]: this.offsetDate(3),
        [todoEffort]: 2
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

      this.createSeedSummary(boardId, 0, 'Open Tasks', todo, todoName, 'active_count')
      this.createSeedSummary(boardId, 1, 'Cart Total', shopping, shoppingPrice, 'sum')
      this.createSeedSummary(boardId, 2, 'House Budget', house, houseBudget, 'sum_active')
      this.createSeedSummary(boardId, 3, 'Archived', null, null, 'completed_count')
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
      const parsed = JSON.parse(row.value_json) as { closeConfirmationMode?: CloseConfirmationMode; theme?: AppTheme }
      return {
        closeConfirmationMode: this.normalizeCloseConfirmationMode(parsed.closeConfirmationMode),
        theme: this.normalizeTheme(parsed.theme)
      }
    } catch {
      return DEFAULT_APP_SETTINGS
    }
  }

  updateAppSettings(settings: AppSettings): AppSettings {
    const normalized: AppSettings = {
      closeConfirmationMode: this.normalizeCloseConfirmationMode(settings.closeConfirmationMode),
      theme: this.normalizeTheme(settings.theme)
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

    return {
      id: board.id,
      name: board.name,
      description: board.description,
      owner: board.owner,
      active: board.is_active === 1,
      lists,
      summarySlots: this.getSummarySlots(board.id, lists),
      mode,
      generatedAt: new Date().toISOString()
    }
  }

  publishItem(itemId: string): BoardSnapshot {
    this.transaction(() => this.publishItems([itemId]))
    return this.getActiveBoardSnapshot('admin')
  }

  publishList(listId: string): BoardSnapshot {
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
    return this.getActiveBoardSnapshot('admin')
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
    return this.getActiveBoardSnapshot('admin')
  }

  completeItem(itemId: string): BoardSnapshot {
    return this.closeItem({ itemId, action: 'completed', comment: null })
  }

  closeItem(input: CloseItemInput): BoardSnapshot {
    const item = this.client.database
      .prepare(
        `SELECT i.id, i.item_number, l.id AS list_id, l.name AS list_name, l.code AS list_code, b.id AS board_id
         FROM items i
         JOIN lists l ON l.id = i.list_id
         JOIN boards b ON b.id = l.board_id
         WHERE i.id = ?`
      )
      .get<{ id: string; item_number: number; list_id: string; list_name: string; list_code: string; board_id: string }>(input.itemId)

    if (!item) throw new Error('Item not found.')

    const action = input.action === 'cancelled' ? 'cancelled' : 'completed'
    const draftValues = this.getItemValues([input.itemId], 'draft')[input.itemId] ?? {}
    const publishedValues = this.getItemValues([input.itemId], 'published')[input.itemId] ?? {}
    const values = Object.keys(draftValues).length > 0 ? draftValues : publishedValues
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

    this.transaction(() => {
      this.run(
        `INSERT INTO items (id, list_id, group_id, item_number, item_order, publication_status, operational_state, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'draft', 'active', ?, ?, ?)`,
        itemId,
        input.listId,
        groupId,
        nextNumber,
        nextOrder,
        'admin',
        now,
        now
      )
      this.upsertValues(itemId, input.values, 'draft')
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

    const nextStatus: PublicationStatus = item.publication_status === 'draft' ? 'draft' : 'dirty'
    const now = new Date().toISOString()
    const groupId = this.validGroupId(item.list_id, input.groupId === undefined ? item.group_id : input.groupId)

    this.transaction(() => {
      this.run(
        `UPDATE items
         SET group_id = ?,
             publication_status = ?,
             updated_at = ?
         WHERE id = ?`,
        groupId,
        nextStatus,
        now,
        input.itemId
      )
      this.upsertValues(input.itemId, input.values, 'draft')
      this.replaceDependencies(input.itemId, input.dependencyItemIds)
    })

    const boardId = this.client.database
      .prepare('SELECT l.board_id FROM items i JOIN lists l ON l.id = i.list_id WHERE i.id = ?')
      .get<{ board_id: string }>(input.itemId)?.board_id
    return boardId ? this.getBoardSnapshot(boardId, 'admin') : this.getActiveBoardSnapshot('admin')
  }

  deleteItem(itemId: string): BoardSnapshot {
    this.transaction(() => {
      this.run('DELETE FROM dependencies WHERE source_item_id = ? OR target_item_id = ?', itemId, itemId)
      this.run('DELETE FROM items WHERE id = ?', itemId)
    })
    return this.getActiveBoardSnapshot('admin')
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
      this.createSeedSummary(boardId, 0, 'Slot 1', null, null, 'count')
      this.createSeedSummary(boardId, 1, 'Slot 2', null, null, 'count')
      this.createSeedSummary(boardId, 2, 'Slot 3', null, null, 'count')
      this.createSeedSummary(boardId, 3, 'Slot 4', null, null, 'count')
    })

    return this.getBoardSnapshot(boardId, 'admin')
  }

  updateBoard(input: UpdateBoardInput): BoardSnapshot {
    this.run(
      'UPDATE boards SET name = ?, description = ?, owner = ?, updated_at = ? WHERE id = ?',
      input.name.trim() || 'Untitled Board',
      input.description,
      input.owner,
      new Date().toISOString(),
      input.boardId
    )
    return this.getBoardSnapshot(input.boardId, 'admin')
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

    this.transaction(() => {
      this.run(
        `INSERT INTO lists
           (id, board_id, name, code, sort_order, grid_x, grid_y, grid_w, grid_h, due_date_enabled, display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, 1, 0, 0, ?, ?)`,
        listId,
        input.boardId,
        input.name.trim() || 'New List',
        code,
        next?.next_order ?? 0,
        0,
        0,
        0,
        0,
        0,
        now,
        now
      )
      this.createSeedColumn(listId, 'Item Name', 'text', 0, true, 120, false, true)
    })

    return this.getBoardSnapshot(input.boardId, 'admin')
  }

  updateList(input: UpdateListInput): BoardSnapshot {
    const list = this.client.database
      .prepare('SELECT board_id FROM lists WHERE id = ?')
      .get<{ board_id: string }>(input.listId)
    if (!list) throw new Error('List not found.')

    const dueDateColumnId = input.dueDateEnabled ? this.ensureDeadlineColumn(input.listId, input.deadlineMandatory) : null
    const now = new Date().toISOString()

    this.run(
      `UPDATE lists
       SET name = ?,
           grid_x = ?,
           grid_y = ?,
           grid_w = ?,
           grid_h = ?,
           due_date_enabled = ?,
           due_date_column_id = ?,
           deadline_mandatory = ?,
           sort_column_id = ?,
           sort_direction = ?,
           display_enabled = ?,
           show_item_id_on_board = ?,
           show_dependencies_on_board = ?,
           show_created_at_on_board = ?,
           show_created_by_on_board = ?,
           updated_at = ?
       WHERE id = ?`,
      input.name.trim() || 'Untitled List',
      input.displayEnabled ? this.clamp(input.grid.x, 1, 16) : 0,
      input.displayEnabled ? this.clamp(input.grid.y, 1, 8) : 0,
      input.displayEnabled ? this.clamp(input.grid.w, MIN_LIST_GRID_WIDTH, 16) : 0,
      input.displayEnabled ? this.clamp(input.grid.h, MIN_LIST_GRID_HEIGHT, 8) : 0,
      input.dueDateEnabled ? 1 : 0,
      dueDateColumnId,
      input.dueDateEnabled && input.deadlineMandatory ? 1 : 0,
      input.sortDirection === 'manual' ? null : input.sortColumnId,
      input.sortColumnId ? input.sortDirection : 'manual',
      input.displayEnabled ? 1 : 0,
      input.showItemIdOnBoard ? 1 : 0,
      input.showDependenciesOnBoard ? 1 : 0,
      input.showCreatedAtOnBoard ? 1 : 0,
      input.showCreatedByOnBoard ? 1 : 0,
      now,
      input.listId
    )

    return this.getBoardSnapshot(list.board_id, 'admin')
  }

  deleteList(listId: string): BoardSnapshot {
    this.run('DELETE FROM lists WHERE id = ?', listId)
    return this.getActiveBoardSnapshot('admin')
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
    return this.getActiveBoardSnapshot('admin')
  }

  copyListToBoard(input: MoveListInput): BoardSnapshot {
    const sourceList = this.client.database
      .prepare(
        `SELECT id, name, due_date_enabled, due_date_column_id, deadline_mandatory, sort_column_id, sort_direction, display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board, grid_w, grid_h
         FROM lists
         WHERE id = ?`
      )
      .get<{
        id: string
        name: string
        due_date_enabled: number
        due_date_column_id: string | null
        deadline_mandatory: number
        sort_column_id: string | null
        sort_direction: ListSortDirection
        display_enabled: number
        show_item_id_on_board: number
        show_dependencies_on_board: number
        show_created_at_on_board: number
        show_created_by_on_board: number
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
           (id, board_id, name, code, sort_order, grid_x, grid_y, grid_w, grid_h, due_date_enabled, deadline_mandatory, display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newListId,
        input.targetBoardId,
        `${sourceList.name} Copy`,
        next.code,
        next.order,
        0,
        0,
        0,
        0,
        sourceList.due_date_enabled,
        sourceList.deadline_mandatory,
        0,
        sourceList.show_item_id_on_board,
        sourceList.show_dependencies_on_board,
        sourceList.show_created_at_on_board,
        sourceList.show_created_by_on_board,
        now,
        now
      )

      const columns = this.client.database
        .prepare(
          `SELECT id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_system, display_format
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
             (id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, display_format, is_system, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newColumnId,
          newListId,
          column.name,
          column.column_type,
          column.sort_order,
          column.is_required,
          column.max_length,
          column.is_summary_eligible,
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

    return this.getActiveBoardSnapshot('admin')
  }

  createColumn(input: CreateColumnInput): BoardSnapshot {
    this.assertColumnNameAllowed(input.name)
    const nextOrder = this.client.database
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM list_columns WHERE list_id = ?')
      .get<{ next_order: number }>(input.listId)?.next_order ?? 0

    this.createSeedColumn(
      input.listId,
      input.name.trim() || 'New Column',
      input.type,
      nextOrder,
      false,
      null,
      true,
      false,
      this.writeColumnDisplayFormat(
        null,
        input.type === 'choice' ? (input.choiceConfig ?? defaultChoiceConfig(input.name.trim() || 'New Column', input.type)) : null,
        input.type === 'date' ? (input.dateDisplayFormat ?? 'date') : 'date',
        input.type === 'date' ? (input.recurrence ?? 'none') : 'none',
        input.type === 'date' ? (input.recurrenceDays ?? []) : [],
        input.type === 'currency' ? input.currencyCode : undefined,
        input.showOnBoard ?? true
      )
    )
    return this.getActiveBoardSnapshot('admin')
  }

  updateColumn(input: UpdateColumnInput): BoardSnapshot {
    const existing = this.client.database
      .prepare('SELECT name, display_format FROM list_columns WHERE id = ?')
      .get<{ name: string; display_format: string | null }>(input.columnId)
    if (!existing) throw new Error('Column not found.')
    const existingFormat = this.readColumnDisplayFormat(existing?.display_format ?? null)
    const role = existingFormat.role
    if (role !== 'deadline') this.assertColumnNameAllowed(input.name)
    const type = role === 'deadline' ? 'date' : input.type
    const dateDisplayFormat = role === 'deadline' ? 'datetime' : type === 'date' ? (input.dateDisplayFormat ?? existingFormat.dateDisplayFormat) : 'date'
    const recurrence = type === 'date' && dateDisplayFormat === 'time' ? (input.recurrence ?? existingFormat.recurrence) : 'none'
    const recurrenceDays = type === 'date' && dateDisplayFormat === 'time' ? (input.recurrenceDays ?? existingFormat.recurrenceDays) : []
    const currencyCode = type === 'currency' ? normalizeCurrencyCode(input.currencyCode ?? existingFormat.currencyCode) : 'USD'
    const showOnBoard = input.showOnBoard ?? existingFormat.showOnBoard

    this.run(
      `UPDATE list_columns
       SET name = ?,
           column_type = ?,
           is_required = ?,
           max_length = ?,
           is_summary_eligible = ?,
           display_format = ?,
           updated_at = ?
       WHERE id = ?`,
      role === 'deadline' ? 'Deadline' : input.name.trim() || 'Untitled Column',
      type,
      input.required ? 1 : 0,
      input.maxLength,
      input.summaryEligible ? 1 : 0,
      this.writeColumnDisplayFormat(
        role,
        type === 'choice' ? (input.choiceConfig ?? defaultChoiceConfig(input.name, type)) : null,
        dateDisplayFormat,
        recurrence,
        recurrenceDays,
        currencyCode,
        showOnBoard
      ),
      new Date().toISOString(),
      input.columnId
    )
    return this.getActiveBoardSnapshot('admin')
  }

  deleteColumn(columnId: string): BoardSnapshot {
    this.transaction(() => {
      this.run('UPDATE lists SET due_date_column_id = NULL, due_date_enabled = 0 WHERE due_date_column_id = ?', columnId)
      this.run("UPDATE lists SET sort_column_id = NULL, sort_direction = 'manual' WHERE sort_column_id = ?", columnId)
      this.run('DELETE FROM list_columns WHERE id = ?', columnId)
    })
    return this.getActiveBoardSnapshot('admin')
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
        `SELECT id, board_id, name, code, sort_order, grid_x, grid_y, grid_w, grid_h, due_date_enabled, due_date_column_id,
                deadline_mandatory,
                sort_column_id, sort_direction, display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board
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
      sortColumnId: row.sort_column_id,
      sortDirection: row.sort_column_id ? row.sort_direction : 'manual',
      displayEnabled: row.display_enabled === 1,
      showItemIdOnBoard: row.show_item_id_on_board === 1,
      showDependenciesOnBoard: row.show_dependencies_on_board === 1,
      showCreatedAtOnBoard: row.show_created_at_on_board === 1,
      showCreatedByOnBoard: row.show_created_by_on_board === 1,
      columns: columnsByList[row.id] ?? [],
      groups: groupsByList[row.id] ?? [],
      items: itemsByList[row.id] ?? []
    }))
    return mode === 'display' ? this.displayableLists(lists) : lists
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
        `SELECT id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_system, display_format
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
        summaryEligible: row.is_summary_eligible === 1,
        system: row.is_system === 1,
        role: displayFormat.role,
        choiceConfig: displayFormat.choiceConfig,
        dateDisplayFormat: displayFormat.dateDisplayFormat,
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
      const activeValues = values[row.id] ?? publishedFallback[row.id] ?? {}
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
        `SELECT id, code, due_date_enabled, due_date_column_id, deadline_mandatory, sort_column_id, sort_direction
         FROM lists
         WHERE id IN (${this.placeholders(listIds)})`
      )
      .all<{
        id: string
        code: string
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
    return [0, 1, 2, 3].map((slotIndex) => {
      const row = bySlot.get(slotIndex)
      if (!row) {
        return {
          slotIndex,
          label: `Slot ${slotIndex + 1}`,
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
        aggregationMethod: row.aggregation_method,
        value: this.calculateSummary(row, lists)
      }
    })
  }

  private calculateSummary(slot: BottomSlotRow, lists: BoardList[]): string {
    if (slot.aggregation_method === 'completed_count') {
      const count = this.client.database
        .prepare('SELECT COUNT(*) AS count FROM item_archives WHERE (? IS NULL OR list_id = ?)')
        .get<{ count: number }>(slot.source_list_id, slot.source_list_id)?.count ?? 0
      return String(count)
    }

    const list = lists.find((candidate) => candidate.id === slot.source_list_id)

    if (slot.aggregation_method === 'count' || slot.aggregation_method === 'active_count') {
      const shouldCountBoard = !list || slot.label.trim().toLowerCase() === 'open tasks'
      return String(shouldCountBoard ? lists.reduce((count, candidate) => count + candidate.items.length, 0) : list.items.length)
    }

    if (!list) return '0'

    const total = list.items.reduce((sum, item) => {
      if (!slot.source_column_id) return sum
      const value = item.values[slot.source_column_id]
      return typeof value === 'number' ? sum + value : sum
    }, 0)

    const column = list.columns.find((candidate) => candidate.id === slot.source_column_id)
    return column?.type === 'currency'
      ? new Intl.NumberFormat(undefined, { style: 'currency', currency: column.currencyCode }).format(total)
      : String(total)
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
    const date = new Date(value.includes('T') ? value : `${value}T23:59:59`)
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
    if (theme === 'black_glass_blue' || theme === 'liquid_gunmetal') return theme
    return 'midnight_clear'
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
      return String(dateFieldString(first) ?? '').localeCompare(String(dateFieldString(second) ?? ''), undefined, { numeric: true, sensitivity: 'base' })
    }
    if (type === 'integer' || type === 'decimal' || type === 'currency') {
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
    if (row.column_type === 'integer' || row.column_type === 'decimal' || row.column_type === 'currency') return row.value_number
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
        type === 'integer' || type === 'decimal' || type === 'currency'
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
            ? JSON.stringify({ recurrence: dateValue.recurrence, recurrenceDays: dateValue.recurrenceDays })
            : null
    }
  }

  private readDateValue(value: string | null, json: string | null): FieldValue {
    if (!json) return value
    try {
      const parsed = JSON.parse(json) as { recurrence?: RecurrenceMode; recurrenceDays?: number[] }
      const recurrence = normalizeRecurrenceMode(parsed.recurrence)
      if (recurrence === 'none') return value
      return {
        value: value ?? '',
        recurrence,
        recurrenceDays: recurrenceNeedsDays(recurrence) ? normalizeRecurrenceDays(parsed.recurrenceDays) : []
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
        recurrenceDays: recurrenceNeedsDays(recurrence) ? normalizeRecurrenceDays(value.recurrenceDays) : []
      }
    }
    return { value: String(value), recurrence: 'none', recurrenceDays: [] }
  }

  private ensureDeadlineColumn(listId: string, mandatory: boolean): string {
    const linked = this.client.database
      .prepare('SELECT due_date_column_id FROM lists WHERE id = ?')
      .get<{ due_date_column_id: string | null }>(listId)
    const existing = linked?.due_date_column_id
      ? { id: linked.due_date_column_id }
      : this.client.database
      .prepare(
        `SELECT id
         FROM list_columns
         WHERE list_id = ?
           AND display_format LIKE '%"role":"deadline"%'
         ORDER BY sort_order
         LIMIT 1`
      )
      .get<{ id: string }>(listId)
    if (existing) {
      this.run(
        `UPDATE list_columns
         SET name = 'Deadline',
             column_type = 'date',
             is_required = ?,
             display_format = ?,
             updated_at = ?
        WHERE id = ?`,
        mandatory ? 1 : 0,
        this.writeColumnDisplayFormat('deadline', null, 'datetime', 'none', [], undefined, true),
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
      false,
      true,
      this.writeColumnDisplayFormat('deadline', null, 'datetime', 'none', [], undefined, true)
    )
  }

  private readColumnDisplayFormat(format: string | null): {
    role: ColumnRole | null
    choiceConfig: ChoiceConfig | null
    dateDisplayFormat: DateDisplayFormat
    recurrence: RecurrenceMode
    recurrenceDays: number[]
    currencyCode: CurrencyCode
    showOnBoard: boolean
  } {
    if (!format) return { role: null, choiceConfig: null, dateDisplayFormat: 'date', recurrence: 'none', recurrenceDays: [], currencyCode: 'USD', showOnBoard: true }
    try {
      const parsed = JSON.parse(format) as {
        role?: ColumnRole
        choiceConfig?: ChoiceConfig
        dateDisplayFormat?: DateDisplayFormat
        recurrence?: RecurrenceMode
        recurrenceDays?: number[]
        currencyCode?: CurrencyCode
        showOnBoard?: boolean
      }
      const role = parsed.role === 'deadline' ? parsed.role : null
      const dateDisplayFormat = parsed.dateDisplayFormat ? normalizeDateDisplayFormat(parsed.dateDisplayFormat) : role === 'deadline' ? 'datetime' : 'date'
      const recurrence = dateDisplayFormat === 'time' ? normalizeRecurrenceMode(parsed.recurrence) : 'none'
      return {
        role,
        choiceConfig: parsed.choiceConfig ? normalizeChoiceConfig(parsed.choiceConfig) : null,
        dateDisplayFormat,
        recurrence,
        recurrenceDays: recurrenceNeedsDays(recurrence) ? normalizeRecurrenceDays(parsed.recurrenceDays) : [],
        currencyCode: normalizeCurrencyCode(parsed.currencyCode),
        showOnBoard: parsed.showOnBoard !== false
      }
    } catch {
      return { role: null, choiceConfig: null, dateDisplayFormat: 'date', recurrence: 'none', recurrenceDays: [], currencyCode: 'USD', showOnBoard: true }
    }
  }

  private writeColumnDisplayFormat(
    role: ColumnRole | null,
    choiceConfig: ChoiceConfig | null,
    dateDisplayFormat: DateDisplayFormat = 'date',
    recurrence: RecurrenceMode = 'none',
    recurrenceDays: number[] = [],
    currencyCode: CurrencyCode | undefined = undefined,
    showOnBoard = true
  ): string | null {
    const normalizedDateDisplayFormat = normalizeDateDisplayFormat(dateDisplayFormat)
    const normalizedRecurrence = normalizedDateDisplayFormat === 'time' ? normalizeRecurrenceMode(recurrence) : 'none'
    const normalizedRecurrenceDays = recurrenceNeedsDays(normalizedRecurrence) ? normalizeRecurrenceDays(recurrenceDays) : []
    const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode)
    if (!role && !choiceConfig && normalizedDateDisplayFormat === 'date' && normalizedRecurrence === 'none' && normalizedCurrencyCode === 'USD' && showOnBoard) return null
    return JSON.stringify({
      ...(role ? { role } : {}),
      ...(choiceConfig ? { choiceConfig: normalizeChoiceConfig(choiceConfig) } : {}),
      ...(normalizedDateDisplayFormat !== 'date' ? { dateDisplayFormat: normalizedDateDisplayFormat } : {}),
      ...(normalizedRecurrence !== 'none' ? { recurrence: normalizedRecurrence } : {}),
      ...(normalizedRecurrenceDays.length > 0 ? { recurrenceDays: normalizedRecurrenceDays } : {}),
      ...(normalizedCurrencyCode !== 'USD' ? { currencyCode: normalizedCurrencyCode } : {}),
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
         (id, board_id, name, code, sort_order, grid_x, grid_y, grid_w, grid_h, due_date_enabled, display_enabled, show_item_id_on_board, show_dependencies_on_board, show_created_at_on_board, show_created_by_on_board, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 0, 0, ?, ?)`,
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
    summaryEligible: boolean,
    system: boolean,
    displayFormat: string | null = null
  ): string {
    const id = randomUUID()
    const now = new Date().toISOString()
    this.run(
      `INSERT INTO list_columns
         (id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, display_format, is_system, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      listId,
      name,
      type,
      order,
      required ? 1 : 0,
      maxLength,
      summaryEligible ? 1 : 0,
      displayFormat,
      system ? 1 : 0,
      now,
      now
    )
    return id
  }

  private assertColumnNameAllowed(name: string): void {
    const normalized = normalizeReservedColumnName(name)
    if (normalized.length === 0) return
    if (RESERVED_COLUMN_NAMES.has(normalized)) {
      throw new Error(`"${name.trim()}" is a reserved system field name and cannot be used.`)
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
    const rows = this.client.database
      .prepare(
        `SELECT grid_x, grid_y, grid_w, grid_h
         FROM lists
         WHERE board_id = ?
           AND display_enabled = 1
         ORDER BY sort_order`
      )
      .all<{ grid_x: number; grid_y: number; grid_w: number; grid_h: number }>(boardId)
    const occupied = rows
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
