import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

type SqliteStatement = {
  run: (...params: unknown[]) => unknown
  get: <T = unknown>(...params: unknown[]) => T | undefined
  all: <T = unknown>(...params: unknown[]) => T[]
}

type SqliteDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
  close: () => void
}

type DatabaseSyncConstructor = new (path: string) => SqliteDatabase

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: DatabaseSyncConstructor }

export type DbClient = {
  path: string
  database: SqliteDatabase
}

export function createDbClient(userDataPath: string): DbClient {
  const path = join(userDataPath, 'life-plan-lite.sqlite')
  mkdirSync(dirname(path), { recursive: true })

  const database = new DatabaseSync(path)
  database.exec('PRAGMA foreign_keys = ON;')
  database.exec('PRAGMA journal_mode = WAL;')

  return { path, database }
}
