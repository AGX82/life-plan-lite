import { randomUUID } from 'node:crypto'
import type { DbClient } from './client'

export function migrate(client: DbClient): void {
  client.database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      list_type TEXT NOT NULL DEFAULT 'custom',
      list_config TEXT,
      sort_order INTEGER NOT NULL,
      grid_x INTEGER NOT NULL,
      grid_y INTEGER NOT NULL,
      grid_w INTEGER NOT NULL,
      grid_h INTEGER NOT NULL,
      due_date_enabled INTEGER NOT NULL DEFAULT 0,
      due_date_column_id TEXT,
      deadline_mandatory INTEGER NOT NULL DEFAULT 0,
      column_sort_order TEXT NOT NULL DEFAULT 'default',
      sort_column_id TEXT,
      sort_direction TEXT NOT NULL DEFAULT 'manual',
      display_enabled INTEGER NOT NULL DEFAULT 1,
      show_item_id_on_board INTEGER NOT NULL DEFAULT 1,
      show_dependencies_on_board INTEGER NOT NULL DEFAULT 1,
      show_created_at_on_board INTEGER NOT NULL DEFAULT 0,
      show_created_by_on_board INTEGER NOT NULL DEFAULT 0,
      show_status_on_board INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(board_id, code)
    );

    CREATE TABLE IF NOT EXISTS item_groups (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      parent_group_id TEXT REFERENCES item_groups(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      display_config TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(list_id, code)
    );

    CREATE TABLE IF NOT EXISTS list_columns (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      column_type TEXT NOT NULL CHECK(column_type IN ('text', 'integer', 'decimal', 'currency', 'duration', 'date', 'boolean', 'choice', 'hyperlink')),
      sort_order INTEGER NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 0,
      max_length INTEGER,
      is_summary_eligible INTEGER NOT NULL DEFAULT 0,
      is_list_summary_eligible INTEGER NOT NULL DEFAULT 0,
      is_board_summary_eligible INTEGER NOT NULL DEFAULT 0,
      display_format TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      group_id TEXT REFERENCES item_groups(id) ON DELETE SET NULL,
      item_number INTEGER NOT NULL,
      item_order INTEGER NOT NULL,
      publication_status TEXT NOT NULL CHECK(publication_status IN ('draft', 'published', 'dirty')),
      operational_state TEXT NOT NULL CHECK(operational_state IN ('active', 'completed', 'cancelled')),
      created_by TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT,
      UNIQUE(list_id, item_number)
    );

    CREATE TABLE IF NOT EXISTS item_field_values (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      column_id TEXT NOT NULL REFERENCES list_columns(id) ON DELETE CASCADE,
      version_scope TEXT NOT NULL CHECK(version_scope IN ('draft', 'published')),
      value_text TEXT,
      value_number REAL,
      value_date TEXT,
      value_boolean INTEGER,
      value_json TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(item_id, column_id, version_scope)
    );

    CREATE TABLE IF NOT EXISTS dependencies (
      id TEXT PRIMARY KEY,
      source_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      target_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      dependency_type TEXT NOT NULL DEFAULT 'prerequisite',
      created_at TEXT NOT NULL,
      UNIQUE(source_item_id, target_item_id, dependency_type)
    );

    CREATE TABLE IF NOT EXISTS item_archives (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      list_id TEXT NOT NULL,
      list_name TEXT NOT NULL,
      item_code TEXT NOT NULL,
      values_json TEXT NOT NULL,
      close_action TEXT NOT NULL DEFAULT 'completed',
      close_comment TEXT NOT NULL DEFAULT '',
      closed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bottom_bar_widget_configs (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 0 AND 7),
      label TEXT NOT NULL,
      source_list_id TEXT REFERENCES lists(id) ON DELETE SET NULL,
      source_column_id TEXT REFERENCES list_columns(id) ON DELETE SET NULL,
      aggregation_method TEXT NOT NULL CHECK(aggregation_method IN ('sum', 'count', 'active_count', 'completed_count', 'sum_active', 'next_due', 'open_tasks', 'board_items', 'total_board_entries', 'total_purchases', 'total_effort_tasks', 'overdue_items', 'overdue_tasks', 'archived_items')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(board_id, slot_index)
    );

    CREATE TABLE IF NOT EXISTS board_widgets (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      widget_type TEXT NOT NULL CHECK(widget_type IN ('clock', 'weather', 'word_of_day', 'world_clocks', 'countdown')),
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      grid_x INTEGER NOT NULL,
      grid_y INTEGER NOT NULL,
      grid_w INTEGER NOT NULL,
      grid_h INTEGER NOT NULL,
      display_enabled INTEGER NOT NULL DEFAULT 1,
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS display_configs (
      id TEXT PRIMARY KEY,
      active_board_id TEXT REFERENCES boards(id) ON DELETE SET NULL,
      target_display_id TEXT,
      display_mode TEXT NOT NULL DEFAULT 'single-screen',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  addColumnIfMissing(client, 'boards', 'description', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(client, 'boards', 'owner', "TEXT NOT NULL DEFAULT ''")
  rebuildListColumnsForRichTypesIfNeeded(client)
  client.database.exec(`
    UPDATE list_columns
    SET is_summary_eligible = 1,
        is_list_summary_eligible = 1,
        is_board_summary_eligible = 1
    WHERE id IN (
      SELECT c.id
      FROM list_columns c
      JOIN lists l ON l.id = c.list_id
      WHERE l.list_type = 'todo'
        AND lower(c.name) IN ('task', 'task name')
        AND c.column_type = 'text'
    );

    UPDATE item_field_values
    SET value_number = value_number * 60
    WHERE value_number IS NOT NULL
      AND column_id IN (
        SELECT c.id
        FROM list_columns c
        JOIN lists l ON l.id = c.list_id
        WHERE l.list_type = 'todo'
          AND lower(c.name) = 'effort'
          AND c.column_type IN ('integer', 'decimal')
      );

    UPDATE list_columns
    SET column_type = 'duration',
        is_summary_eligible = 1,
        is_list_summary_eligible = 1,
        is_board_summary_eligible = 1,
        display_format = '{"durationDisplayFormat":"days_hours"}'
    WHERE id IN (
      SELECT c.id
      FROM list_columns c
      JOIN lists l ON l.id = c.list_id
      WHERE l.list_type = 'todo'
        AND lower(c.name) = 'effort'
        AND c.column_type IN ('integer', 'decimal')
    );
  `)
  addColumnIfMissing(client, 'lists', 'deadline_mandatory', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(client, 'lists', 'list_type', "TEXT NOT NULL DEFAULT 'custom'")
  addColumnIfMissing(client, 'lists', 'list_config', 'TEXT')
  client.database.exec("UPDATE lists SET list_type = 'custom' WHERE list_type = 'standard';")
  addColumnIfMissing(client, 'lists', 'sort_column_id', 'TEXT')
  addColumnIfMissing(client, 'lists', 'sort_direction', "TEXT NOT NULL DEFAULT 'manual'")
  addColumnIfMissing(client, 'lists', 'column_sort_order', "TEXT NOT NULL DEFAULT 'default'")
  addColumnIfMissing(client, 'lists', 'display_enabled', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(client, 'lists', 'show_item_id_on_board', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(client, 'lists', 'show_dependencies_on_board', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(client, 'lists', 'show_created_at_on_board', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(client, 'lists', 'show_created_by_on_board', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(client, 'lists', 'show_status_on_board', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(client, 'item_groups', 'display_config', 'TEXT')
  addColumnIfMissing(client, 'list_columns', 'is_list_summary_eligible', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(client, 'list_columns', 'is_board_summary_eligible', 'INTEGER NOT NULL DEFAULT 0')
  client.database.exec(`
    UPDATE list_columns
    SET is_list_summary_eligible = is_summary_eligible
    WHERE is_summary_eligible = 1 AND is_list_summary_eligible = 0;

    UPDATE list_columns
    SET is_board_summary_eligible = is_summary_eligible
    WHERE is_summary_eligible = 1 AND is_board_summary_eligible = 0;
  `)
  rebuildItemsForCloseActionsIfNeeded(client)
  addColumnIfMissing(client, 'items', 'group_id', 'TEXT REFERENCES item_groups(id) ON DELETE SET NULL')
  addColumnIfMissing(client, 'items', 'created_by', "TEXT NOT NULL DEFAULT 'admin'")
  addColumnIfMissing(client, 'item_archives', 'close_action', "TEXT NOT NULL DEFAULT 'completed'")
  addColumnIfMissing(client, 'item_archives', 'close_comment', "TEXT NOT NULL DEFAULT ''")
  rebuildBoardWidgetsForNewTypesIfNeeded(client)
  rebuildBottomBarSlotsForEightAndSystemSummariesIfNeeded(client)
  client.database.exec(`
    UPDATE list_columns
    SET name = 'Deadline',
        display_format = '{"role":"deadline","dateDisplayFormat":"datetime"}'
    WHERE id IN (SELECT due_date_column_id FROM lists WHERE due_date_column_id IS NOT NULL)
      AND (display_format IS NULL OR display_format = '');
  `)
  runMigrationOnce(client, 2026042601, () => applyTemplateDefaultMigrations(client))
  runMigrationOnce(client, 2026042602, () => applyBirthdayCalendarSortMigration(client))
  runMigrationOnce(client, 2026042603, () => applyShoppingCostCurrencyMigration(client))
  runMigrationOnce(client, 2026042701, () => applyWishlistWishmeterOrderMigration(client))
}

function runMigrationOnce(client: DbClient, version: number, migrateOnce: () => void): void {
  const existing = client.database.prepare('SELECT version FROM schema_migrations WHERE version = ?').get<{ version: number }>(version)
  if (existing) return
  migrateOnce()
  client.database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString())
}

function applyTemplateDefaultMigrations(client: DbClient): void {
  const now = new Date().toISOString()
  const typeChoiceConfig = {
    selection: 'single',
    ranked: false,
    options: ['Personal Time', 'Event', 'Work Trip', 'Work Event', 'Other'].map((label, index) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      label,
      rank: index + 1
    }))
  }
  const wishmeterConfig = {
    selection: 'single',
    ranked: true,
    options: ["It's so fluffy I'm gonna die!", 'My precious!', 'Shut up and take my money!', 'Gotta get me one of those!', 'Asking for a friend...'].map((label, index) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      label,
      rank: index + 1
    }))
  }

  client.database.exec(`
    UPDATE list_columns
    SET is_summary_eligible = 0,
        is_list_summary_eligible = 0,
        is_board_summary_eligible = 0
    WHERE list_id IN (
      SELECT id FROM lists WHERE list_type IN ('todo', 'shopping_list', 'wishlist', 'health', 'trips_events', 'birthday_calendar')
    );

    UPDATE list_columns
    SET is_summary_eligible = 1,
        is_list_summary_eligible = 1,
        is_board_summary_eligible = 1
    WHERE id IN (
      SELECT c.id
      FROM list_columns c
      JOIN lists l ON l.id = c.list_id
      WHERE l.list_type = 'todo'
        AND lower(c.name) IN ('task', 'task name', 'deadline', 'effort')
    );

    UPDATE lists
    SET show_item_id_on_board = 0,
        show_dependencies_on_board = 0,
        show_status_on_board = CASE WHEN list_type = 'todo' THEN 1 ELSE show_status_on_board END
    WHERE list_type IN ('todo', 'shopping_list', 'wishlist', 'health', 'trips_events', 'birthday_calendar');

    UPDATE lists
    SET due_date_enabled = 0,
        due_date_column_id = NULL,
        deadline_mandatory = 0
    WHERE list_type = 'health';

    UPDATE list_columns
    SET name = 'Mentions'
    WHERE id IN (
      SELECT c.id
      FROM list_columns c
      JOIN lists l ON l.id = c.list_id
      WHERE l.list_type = 'health'
        AND lower(c.name) = 'frequency'
    );
  `)

  setColumnDisplay(client, 'todo', ['People', 'Location'], false)
  setColumnDisplay(client, 'todo', ['% Done'], true)
  setColumnDisplay(client, 'shopping_list', ['Link'], false)
  setColumnDisplay(client, 'wishlist', ['Description'], false)
  setColumnDisplay(client, 'trips_events', ['Topic / Theme', 'Location'], false)
  setColumnDisplay(client, 'birthday_calendar', ['Location'], false)

  setColumnFormat(client, 'shopping_list', 'Needed By', { role: 'deadline', dateDisplayFormat: 'date' })
  setColumnFormat(client, 'wishlist', 'Wishmeter', { choiceConfig: wishmeterConfig })
  setColumnFormat(client, 'trips_events', 'Type', { choiceConfig: typeChoiceConfig })

  client.database
    .prepare(
      `UPDATE list_columns
       SET column_type = 'choice'
       WHERE id IN (
         SELECT c.id
         FROM list_columns c
         JOIN lists l ON l.id = c.list_id
         WHERE l.list_type = 'trips_events'
           AND lower(c.name) = 'type'
       )`
    )
    .run()

  ensureWishlistPriceColumns(client, now)
  updateSortColumn(client, 'todo', 'Priority', 'asc')
  updateSortColumn(client, 'shopping_list', 'Needed By', 'asc')
  updateSortColumn(client, 'wishlist', 'Wishmeter', 'asc')
  updateSortColumn(client, 'health', 'Appointment Date', 'asc')
  updateSortColumn(client, 'trips_events', 'Start', 'asc')
  updateSortColumn(client, 'birthday_calendar', 'Birthday', 'asc')
}

function applyBirthdayCalendarSortMigration(client: DbClient): void {
  updateSortColumn(client, 'birthday_calendar', 'Birthday', 'asc')
}

function applyShoppingCostCurrencyMigration(client: DbClient): void {
  const lists = client.database.prepare("SELECT id FROM lists WHERE list_type = 'shopping_list'").all<{ id: string }>()
  const now = new Date().toISOString()
  for (const list of lists) {
    const price = client.database
      .prepare("SELECT display_format FROM list_columns WHERE list_id = ? AND lower(name) = 'price / pc' ORDER BY sort_order LIMIT 1")
      .get<{ display_format: string | null }>(list.id)
    const cost = client.database
      .prepare("SELECT id, display_format FROM list_columns WHERE list_id = ? AND lower(name) = 'cost' ORDER BY sort_order LIMIT 1")
      .get<{ id: string; display_format: string | null }>(list.id)
    if (!cost) continue
    const currencyCode = readCurrencyCode(price?.display_format ?? null)
    const showOnBoard = readShowOnBoard(cost.display_format)
    client.database
      .prepare('UPDATE list_columns SET display_format = ?, updated_at = ? WHERE id = ?')
      .run(writeCurrencyDisplayFormat(currencyCode, showOnBoard), now, cost.id)
  }
}

function applyWishlistWishmeterOrderMigration(client: DbClient): void {
  const now = new Date().toISOString()
  const choiceConfig = {
    selection: 'single',
    ranked: true,
    options: ["It's so fluffy I'm gonna die!", 'My precious!', 'Shut up and take my money!', 'Gotta get me one of those!', 'Asking for a friend...'].map((label, index) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      label,
      rank: index + 1
    }))
  }
  const columns = client.database
    .prepare(
      `SELECT c.id, c.display_format
       FROM list_columns c
       JOIN lists l ON l.id = c.list_id
       WHERE l.list_type = 'wishlist'
         AND lower(c.name) = 'wishmeter'`
    )
    .all<{ id: string; display_format: string | null }>()

  for (const column of columns) {
    const existing = parseDisplayFormat(column.display_format)
    const nextFormat = { ...existing, choiceConfig }
    client.database.prepare('UPDATE list_columns SET display_format = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(nextFormat), now, column.id)
  }

  updateSortColumn(client, 'wishlist', 'Wishmeter', 'asc')
}

function setColumnDisplay(client: DbClient, listType: string, names: string[], showOnBoard: boolean): void {
  const format = showOnBoard ? null : JSON.stringify({ showOnBoard: false })
  const placeholders = names.map(() => '?').join(', ')
  client.database
    .prepare(
      `UPDATE list_columns
       SET display_format = ?
       WHERE id IN (
         SELECT c.id
         FROM list_columns c
         JOIN lists l ON l.id = c.list_id
         WHERE l.list_type = ?
           AND lower(c.name) IN (${placeholders})
       )`
    )
    .run(format, listType, ...names.map((name) => name.toLowerCase()))
}

function setColumnFormat(client: DbClient, listType: string, name: string, format: Record<string, unknown>): void {
  client.database
    .prepare(
      `UPDATE list_columns
       SET display_format = ?
       WHERE id IN (
         SELECT c.id
         FROM list_columns c
         JOIN lists l ON l.id = c.list_id
         WHERE l.list_type = ?
           AND lower(c.name) = ?
       )`
    )
    .run(JSON.stringify(format), listType, name.toLowerCase())
}

function updateSortColumn(client: DbClient, listType: string, columnName: string, direction: string): void {
  client.database
    .prepare(
      `UPDATE lists
       SET sort_column_id = (
             SELECT c.id
             FROM list_columns c
             WHERE c.list_id = lists.id
               AND lower(c.name) = ?
             ORDER BY c.sort_order
             LIMIT 1
           ),
           sort_direction = ?
       WHERE list_type = ?
         AND EXISTS (
           SELECT 1
           FROM list_columns c
           WHERE c.list_id = lists.id
             AND lower(c.name) = ?
         )`
    )
    .run(columnName.toLowerCase(), direction, listType, columnName.toLowerCase())
}

function ensureWishlistPriceColumns(client: DbClient, now: string): void {
  const wishlistLists = client.database.prepare("SELECT id FROM lists WHERE list_type = 'wishlist'").all<{ id: string }>()
  for (const list of wishlistLists) {
    const existing = client.database
      .prepare("SELECT id FROM list_columns WHERE list_id = ? AND lower(name) = 'price'")
      .get<{ id: string }>(list.id)
    if (existing) continue
    client.database.prepare('UPDATE list_columns SET sort_order = sort_order + 1 WHERE list_id = ? AND sort_order >= 3').run(list.id)
    client.database
      .prepare(
        `INSERT INTO list_columns
           (id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_list_summary_eligible, is_board_summary_eligible, display_format, is_system, created_at, updated_at)
         VALUES (?, ?, 'Price', 'currency', 3, 0, NULL, 0, 0, 0, NULL, 0, ?, ?)`
      )
      .run(randomUUID(), list.id, now, now)
  }
}

function parseDisplayFormat(displayFormat: string | null): Record<string, unknown> {
  if (!displayFormat) return {}
  try {
    const parsed = JSON.parse(displayFormat)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function readCurrencyCode(displayFormat: string | null): string {
  if (!displayFormat) return 'USD'
  try {
    const parsed = JSON.parse(displayFormat) as { currencyCode?: unknown }
    return typeof parsed.currencyCode === 'string' && parsed.currencyCode.trim() ? parsed.currencyCode.trim().toUpperCase() : 'USD'
  } catch {
    return 'USD'
  }
}

function readShowOnBoard(displayFormat: string | null): boolean {
  if (!displayFormat) return true
  try {
    const parsed = JSON.parse(displayFormat) as { showOnBoard?: unknown }
    return parsed.showOnBoard !== false
  } catch {
    return true
  }
}

function writeCurrencyDisplayFormat(currencyCode: string, showOnBoard: boolean): string | null {
  const normalizedCurrencyCode = currencyCode.toUpperCase()
  const format = {
    ...(normalizedCurrencyCode !== 'USD' ? { currencyCode: normalizedCurrencyCode } : {}),
    ...(!showOnBoard ? { showOnBoard: false } : {})
  }
  return Object.keys(format).length > 0 ? JSON.stringify(format) : null
}

function rebuildBoardWidgetsForNewTypesIfNeeded(client: DbClient): void {
  const table = client.database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'board_widgets'").get<{ sql: string }>()
  if (!table?.sql || table.sql.includes("'countdown'")) return

  client.database.exec(`
    PRAGMA foreign_keys = OFF;

    CREATE TABLE board_widgets_new (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      widget_type TEXT NOT NULL CHECK(widget_type IN ('clock', 'weather', 'word_of_day', 'world_clocks', 'countdown')),
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      grid_x INTEGER NOT NULL,
      grid_y INTEGER NOT NULL,
      grid_w INTEGER NOT NULL,
      grid_h INTEGER NOT NULL,
      display_enabled INTEGER NOT NULL DEFAULT 1,
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO board_widgets_new
      (id, board_id, widget_type, name, sort_order, grid_x, grid_y, grid_w, grid_h, display_enabled, config_json, created_at, updated_at)
    SELECT id, board_id, widget_type, name, sort_order, grid_x, grid_y, grid_w, grid_h, display_enabled, config_json, created_at, updated_at
    FROM board_widgets;

    DROP TABLE board_widgets;
    ALTER TABLE board_widgets_new RENAME TO board_widgets;

    PRAGMA foreign_keys = ON;
  `)
}

function rebuildBottomBarSlotsForEightAndSystemSummariesIfNeeded(client: DbClient): void {
  const table = client.database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bottom_bar_widget_configs'")
    .get<{ sql: string }>()
  if (table?.sql?.includes('BETWEEN 0 AND 7') && table.sql.includes("'total_purchases'")) return

  client.database.exec(`
    PRAGMA foreign_keys = OFF;

    CREATE TABLE bottom_bar_widget_configs_new (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 0 AND 7),
      label TEXT NOT NULL,
      source_list_id TEXT REFERENCES lists(id) ON DELETE SET NULL,
      source_column_id TEXT REFERENCES list_columns(id) ON DELETE SET NULL,
      aggregation_method TEXT NOT NULL CHECK(aggregation_method IN ('sum', 'count', 'active_count', 'completed_count', 'sum_active', 'next_due', 'open_tasks', 'board_items', 'total_board_entries', 'total_purchases', 'total_effort_tasks', 'overdue_items', 'overdue_tasks', 'archived_items')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(board_id, slot_index)
    );

    INSERT INTO bottom_bar_widget_configs_new
      (id, board_id, slot_index, label, source_list_id, source_column_id, aggregation_method, created_at, updated_at)
    SELECT id, board_id, slot_index, label, source_list_id, source_column_id,
           CASE
             WHEN aggregation_method = 'active_count' AND source_list_id IS NULL THEN 'open_tasks'
             WHEN aggregation_method = 'completed_count' AND source_list_id IS NULL THEN 'archived_items'
             ELSE aggregation_method
           END,
           created_at, updated_at
    FROM bottom_bar_widget_configs
    WHERE slot_index BETWEEN 0 AND 7;

    DROP TABLE bottom_bar_widget_configs;
    ALTER TABLE bottom_bar_widget_configs_new RENAME TO bottom_bar_widget_configs;

    PRAGMA foreign_keys = ON;
  `)
}

function addColumnIfMissing(client: DbClient, table: string, column: string, definition: string): void {
  const columns = client.database.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()
  if (!columns.some((row) => row.name === column)) {
    client.database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`)
  }
}

function rebuildListColumnsForRichTypesIfNeeded(client: DbClient): void {
  const table = client.database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'list_columns'")
    .get<{ sql: string }>()
  if (table?.sql.includes("'choice'") && table.sql.includes("'hyperlink'") && table.sql.includes("'duration'")) return

  client.database.exec(`
    PRAGMA foreign_keys = OFF;

    CREATE TABLE list_columns_new (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      column_type TEXT NOT NULL CHECK(column_type IN ('text', 'integer', 'decimal', 'currency', 'duration', 'date', 'boolean', 'choice', 'hyperlink')),
      sort_order INTEGER NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 0,
      max_length INTEGER,
      is_summary_eligible INTEGER NOT NULL DEFAULT 0,
      is_list_summary_eligible INTEGER NOT NULL DEFAULT 0,
      is_board_summary_eligible INTEGER NOT NULL DEFAULT 0,
      display_format TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO list_columns_new
      (id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_list_summary_eligible, is_board_summary_eligible, display_format, is_system, created_at, updated_at)
    SELECT id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, is_summary_eligible, is_summary_eligible, display_format, is_system, created_at, updated_at
    FROM list_columns;

    DROP TABLE list_columns;
    ALTER TABLE list_columns_new RENAME TO list_columns;

    PRAGMA foreign_keys = ON;
  `)
}

function rebuildItemsForCloseActionsIfNeeded(client: DbClient): void {
  const table = client.database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'items'").get<{ sql: string }>()
  if (table?.sql.includes("'cancelled'")) return

  client.database.exec(`
    PRAGMA foreign_keys = OFF;

    CREATE TABLE items_new (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      group_id TEXT REFERENCES item_groups(id) ON DELETE SET NULL,
      item_number INTEGER NOT NULL,
      item_order INTEGER NOT NULL,
      publication_status TEXT NOT NULL CHECK(publication_status IN ('draft', 'published', 'dirty')),
      operational_state TEXT NOT NULL CHECK(operational_state IN ('active', 'completed', 'cancelled')),
      created_by TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT,
      UNIQUE(list_id, item_number)
    );

    INSERT INTO items_new
      (id, list_id, group_id, item_number, item_order, publication_status, operational_state, created_by, created_at, updated_at, published_at)
    SELECT id, list_id, group_id, item_number, item_order, publication_status, operational_state, created_by, created_at, updated_at, published_at
    FROM items;

    DROP TABLE items;
    ALTER TABLE items_new RENAME TO items;

    PRAGMA foreign_keys = ON;
  `)
}
