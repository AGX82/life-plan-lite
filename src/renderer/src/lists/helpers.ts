import type { BoardItem, BoardList, ChoiceConfig, FieldValue, ListColumn } from '@shared/domain'
import { isDateFieldValue } from '../editors/itemFieldHelpers'

export type FormValues = Record<string, FieldValue>

export function normalizeColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function visibleColumns(list: BoardList): ListColumn[] {
  return list.columns.filter(
    (column) =>
      column.name !== 'Item ID' &&
      !column.name.toLowerCase().includes('dependency') &&
      (column.role !== 'deadline' || list.dueDateEnabled)
  )
}

export function isComputedTemplateColumn(list: BoardList, column: ListColumn): boolean {
  if (list.templateType === 'shopping_list' && normalizeColumnName(column.name) === 'cost') return true
  return list.templateType === 'wishlist' && normalizeColumnName(column.name) === 'total cost'
}

export function editableItemColumns(list: BoardList): ListColumn[] {
  return visibleColumns(list).filter((column) => !isComputedTemplateColumn(list, column))
}

export function blankValues(columns: ListColumn[], list?: BoardList): FormValues {
  return columns.reduce<FormValues>((acc, column) => {
    if (list?.templateType === 'wishlist' && normalizeColumnName(column.name) === 'pieces') {
      acc[column.id] = 1
      return acc
    }
    acc[column.id] = column.type === 'boolean' ? false : column.type === 'choice' && column.choiceConfig?.selection === 'multi' ? [] : ''
    return acc
  }, {})
}

export function valuesForItem(item: BoardItem, columns: ListColumn[]): FormValues {
  return columns.reduce<FormValues>((acc, column) => {
    acc[column.id] =
      item.values[column.id] ?? (column.type === 'boolean' ? false : column.type === 'choice' && column.choiceConfig?.selection === 'multi' ? [] : '')
    return acc
  }, {})
}

export function itemTitle(item: BoardItem, list: BoardList): string {
  const nameColumn = visibleColumns(list)[0]
  return String(item.values[nameColumn?.id] ?? item.displayCode)
}

export function dateStringFromField(value: FieldValue | undefined): string | null {
  if (isDateFieldValue(value)) return value.value || null
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function localDateTimeInputValue(date: Date): string {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

export function parseColumnDateValue(value: string, column: ListColumn): Date | null {
  if (column.role === 'deadline' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`)
  }
  const candidate = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(candidate.getTime()) ? null : candidate
}

export function defaultChoiceConfig(name: string): ChoiceConfig {
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

export function choiceConfigToText(config: ChoiceConfig): string {
  return config.options.map((option) => `${option.rank}. ${option.label}`).join('\n')
}

export function parseChoiceOptions(text: string, existing?: ChoiceConfig): ChoiceConfig['options'] {
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

export function choiceId(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || `choice-${index + 1}`
}
