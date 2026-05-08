import type { AggregationMethod, BoardList, ListColumn } from '@shared/domain'
import { normalizeColumnName, visibleColumns } from '../lists/helpers'

export type SystemBoardFieldKey = 'itemId' | 'dependencies' | 'createdAt' | 'createdBy' | 'status'
type SpecialBoardFieldKey = 'wishlistAdvisedBuyOrder'
type BoardFieldOrderKey = `system:${SystemBoardFieldKey}` | `special:${SpecialBoardFieldKey}` | string

export type StructureFieldEntry =
  | {
      kind: 'system'
      key: `system:${SystemBoardFieldKey}`
      field: SystemBoardFieldKey
      name: string
      displayName: string
      typeLabel: string
      statusLabel: string
      showOnBoard: boolean
    }
  | {
      kind: 'special'
      key: `special:${SpecialBoardFieldKey}`
      field: SpecialBoardFieldKey
      name: string
      displayName: string
      typeLabel: string
      statusLabel: string
      showOnBoard: boolean
    }
  | {
      kind: 'column'
      key: string
      column: ListColumn
      name: string
      displayName: string
      typeLabel: string
      statusLabel: string
      showOnBoard: boolean
    }

const summaryCountTextColumns = new Set(['item name', 'task', 'task name', 'product', 'entry', 'title', 'name'].map((name) => normalizeColumnName(name)))
const summaryDateColumns = new Set(['deadline', 'needed by', 'appointment date', 'birthday', 'start'].map((name) => normalizeColumnName(name)))
const nonSummaryNumericColumns = new Set(['year of birth', 'birth year', '% done'].map((name) => normalizeColumnName(name)))

export function supportsListSummaryForColumn(column: Pick<ListColumn, 'name' | 'type' | 'role'>): boolean {
  const normalizedName = normalizeColumnName(column.name)
  if (column.role === 'deadline') return true
  if (column.type === 'text') return summaryCountTextColumns.has(normalizedName)
  if (column.type === 'currency') return normalizedName !== 'price / pc'
  if (column.type === 'integer' || column.type === 'decimal' || column.type === 'duration') return !nonSummaryNumericColumns.has(normalizedName)
  if (column.type === 'date') return summaryDateColumns.has(normalizedName)
  return false
}

export function supportsBoardSummaryForColumn(column: Pick<ListColumn, 'name' | 'type' | 'role'>): boolean {
  return supportsListSummaryForColumn(column)
}

export function inferredBoardSummaryAggregation(column: Pick<ListColumn, 'type' | 'role'>): AggregationMethod {
  if (column.role === 'deadline' || column.type === 'date') return 'next_due'
  if (column.type === 'currency' || column.type === 'integer' || column.type === 'decimal' || column.type === 'duration') return 'sum'
  return 'count'
}

function defaultStructureFieldEntries(
  list: BoardList,
  systemDisplayNames?: { itemId?: string; dependencies?: string; createdAt?: string; createdBy?: string; status?: string },
  systemVisibility?: {
    itemId?: boolean
    dependencies?: boolean
    createdAt?: boolean
    createdBy?: boolean
    status?: boolean
  },
  wishlistOverrides?: { showAdvisedBuyOrder?: boolean; advisedBuyOrderDisplayName?: string }
): StructureFieldEntry[] {
  const systemEntries: StructureFieldEntry[] = [
    {
      kind: 'system',
      key: 'system:itemId',
      field: 'itemId',
      name: 'Item ID',
      displayName: systemDisplayNames?.itemId ?? '',
      typeLabel: 'system',
      statusLabel: 'System',
      showOnBoard: systemVisibility?.itemId ?? list.showItemIdOnBoard
    },
    {
      kind: 'system',
      key: 'system:dependencies',
      field: 'dependencies',
      name: 'Dependencies',
      displayName: systemDisplayNames?.dependencies ?? '',
      typeLabel: 'system',
      statusLabel: 'System',
      showOnBoard: systemVisibility?.dependencies ?? list.showDependenciesOnBoard
    },
    {
      kind: 'system',
      key: 'system:createdAt',
      field: 'createdAt',
      name: 'Created At',
      displayName: systemDisplayNames?.createdAt ?? '',
      typeLabel: 'system',
      statusLabel: 'System',
      showOnBoard: systemVisibility?.createdAt ?? list.showCreatedAtOnBoard
    },
    {
      kind: 'system',
      key: 'system:createdBy',
      field: 'createdBy',
      name: 'Created By',
      displayName: systemDisplayNames?.createdBy ?? '',
      typeLabel: 'system',
      statusLabel: 'System',
      showOnBoard: systemVisibility?.createdBy ?? list.showCreatedByOnBoard
    },
    {
      kind: 'system',
      key: 'system:status',
      field: 'status',
      name: 'Status',
      displayName: systemDisplayNames?.status ?? '',
      typeLabel: 'system',
      statusLabel: 'System',
      showOnBoard: systemVisibility?.status ?? list.showStatusOnBoard
    }
  ]

  const specialEntries: StructureFieldEntry[] =
    list.templateType === 'wishlist'
      ? [
          {
            kind: 'special',
            key: 'special:wishlistAdvisedBuyOrder',
            field: 'wishlistAdvisedBuyOrder',
            name: 'Advised Buy Order',
            displayName: wishlistOverrides?.advisedBuyOrderDisplayName ?? list.templateConfig.wishlist?.advisedBuyOrderDisplayName ?? '',
            typeLabel: 'calculated',
            statusLabel: 'Calculated',
            showOnBoard: wishlistOverrides?.showAdvisedBuyOrder ?? list.templateConfig.wishlist?.showAdvisedBuyOrder ?? false
          }
        ]
      : []

  const columnEntries: StructureFieldEntry[] = visibleColumns(list).map((column) => ({
    kind: 'column',
    key: column.id,
    column,
    name: column.name,
    displayName: column.displayName ?? '',
    typeLabel: column.type,
    statusLabel: column.required ? 'Required' : '',
    showOnBoard: column.showOnBoard
  }))

  return [...systemEntries, ...specialEntries, ...columnEntries]
}

export function normalizedBoardFieldOrderKeys(
  list: BoardList,
  structureEntries: StructureFieldEntry[] = defaultStructureFieldEntries(list)
): BoardFieldOrderKey[] {
  const defaults = structureEntries.map((entry) => entry.key)
  const saved = list.templateConfig.boardFieldOrder ?? []
  const validSaved = saved.filter((key) => defaults.includes(key))
  const missingDefaults = defaults.filter((key) => !validSaved.includes(key))
  return [...validSaved, ...missingDefaults]
}

export function orderedStructureFieldEntries(
  list: BoardList,
  systemDisplayNames?: { itemId?: string; dependencies?: string; createdAt?: string; createdBy?: string; status?: string },
  systemVisibility?: {
    itemId?: boolean
    dependencies?: boolean
    createdAt?: boolean
    createdBy?: boolean
    status?: boolean
  },
  wishlistOverrides?: { showAdvisedBuyOrder?: boolean; advisedBuyOrderDisplayName?: string }
): StructureFieldEntry[] {
  const entries = defaultStructureFieldEntries(list, systemDisplayNames, systemVisibility, wishlistOverrides)
  const order = normalizedBoardFieldOrderKeys(list, entries)
  const entryMap = new Map(entries.map((entry) => [entry.key, entry]))
  return order.map((key) => entryMap.get(key)).filter((entry): entry is StructureFieldEntry => Boolean(entry))
}
