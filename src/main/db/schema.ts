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
      sort_order INTEGER NOT NULL,
      grid_x INTEGER NOT NULL,
      grid_y INTEGER NOT NULL,
      grid_w INTEGER NOT NULL,
      grid_h INTEGER NOT NULL,
      due_date_enabled INTEGER NOT NULL DEFAULT 0,
      due_date_column_id TEXT,
      deadline_mandatory INTEGER NOT NULL DEFAULT 0,
      sort_column_id TEXT,
      sort_direction TEXT NOT NULL DEFAULT 'manual',
      display_enabled INTEGER NOT NULL DEFAULT 1,
      show_item_id_on_board INTEGER NOT NULL DEFAULT 1,
      show_dependencies_on_board INTEGER NOT NULL DEFAULT 1,
      show_created_at_on_board INTEGER NOT NULL DEFAULT 0,
      show_created_by_on_board INTEGER NOT NULL DEFAULT 0,
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
      column_type TEXT NOT NULL CHECK(column_type IN ('text', 'integer', 'decimal', 'currency', 'date', 'boolean', 'choice', 'hyperlink')),
      sort_order INTEGER NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 0,
      max_length INTEGER,
      is_summary_eligible INTEGER NOT NULL DEFAULT 0,
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
      slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 0 AND 3),
      label TEXT NOT NULL,
      source_list_id TEXT REFERENCES lists(id) ON DELETE SET NULL,
      source_column_id TEXT REFERENCES list_columns(id) ON DELETE SET NULL,
      aggregation_method TEXT NOT NULL CHECK(aggregation_method IN ('sum', 'count', 'active_count', 'completed_count', 'sum_active')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(board_id, slot_index)
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
  addColumnIfMissing(client, 'lists', 'deadline_mandatory', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(client, 'lists', 'sort_column_id', 'TEXT')
  addColumnIfMissing(client, 'lists', 'sort_direction', "TEXT NOT NULL DEFAULT 'manual'")
  addColumnIfMissing(client, 'lists', 'display_enabled', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(client, 'lists', 'show_item_id_on_board', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(client, 'lists', 'show_dependencies_on_board', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(client, 'lists', 'show_created_at_on_board', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(client, 'lists', 'show_created_by_on_board', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(client, 'item_groups', 'display_config', 'TEXT')
  rebuildItemsForCloseActionsIfNeeded(client)
  addColumnIfMissing(client, 'items', 'group_id', 'TEXT REFERENCES item_groups(id) ON DELETE SET NULL')
  addColumnIfMissing(client, 'items', 'created_by', "TEXT NOT NULL DEFAULT 'admin'")
  addColumnIfMissing(client, 'item_archives', 'close_action', "TEXT NOT NULL DEFAULT 'completed'")
  addColumnIfMissing(client, 'item_archives', 'close_comment', "TEXT NOT NULL DEFAULT ''")
  client.database.exec(`
    UPDATE list_columns
    SET name = 'Deadline',
        display_format = '{"role":"deadline","dateDisplayFormat":"datetime"}'
    WHERE id IN (SELECT due_date_column_id FROM lists WHERE due_date_column_id IS NOT NULL)
      AND (display_format IS NULL OR display_format = '');
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
  if (table?.sql.includes("'choice'") && table.sql.includes("'hyperlink'")) return

  client.database.exec(`
    PRAGMA foreign_keys = OFF;

    CREATE TABLE list_columns_new (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      column_type TEXT NOT NULL CHECK(column_type IN ('text', 'integer', 'decimal', 'currency', 'date', 'boolean', 'choice', 'hyperlink')),
      sort_order INTEGER NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 0,
      max_length INTEGER,
      is_summary_eligible INTEGER NOT NULL DEFAULT 0,
      display_format TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO list_columns_new
      (id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, display_format, is_system, created_at, updated_at)
    SELECT id, list_id, name, column_type, sort_order, is_required, max_length, is_summary_eligible, display_format, is_system, created_at, updated_at
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
