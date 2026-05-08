import type { BoardList, ChoiceConfig, ListColumn, UpdateColumnInput } from '@shared/domain'
import { choiceConfigToText, defaultChoiceConfig, parseChoiceOptions, visibleColumns } from '../lists/helpers'

export type ColumnDraft = {
  name: string
  displayName: string
  type: ListColumn['type']
  required: boolean
  choiceConfig: ChoiceConfig
  choicesDraft: string
  dateDisplayFormat: ListColumn['dateDisplayFormat']
  durationDisplayFormat: ListColumn['durationDisplayFormat']
  currencyCode: ListColumn['currencyCode']
  showOnBoard: boolean
}

export function columnDraftFromColumn(column: ListColumn): ColumnDraft {
  const choiceConfig = column.choiceConfig ?? defaultChoiceConfig(column.name)
  return {
    name: column.name,
    displayName: column.displayName ?? '',
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

export function columnDraftsForList(list: BoardList): Record<string, ColumnDraft> {
  return Object.fromEntries(visibleColumns(list).map((column) => [column.id, columnDraftFromColumn(column)]))
}

function columnDraftChoiceConfig(draft: ColumnDraft): ChoiceConfig | null {
  return draft.type === 'choice'
    ? { ...draft.choiceConfig, options: parseChoiceOptions(draft.choicesDraft, draft.choiceConfig) }
    : null
}

export function columnDraftToInput(column: ListColumn, draft: ColumnDraft): UpdateColumnInput {
  return {
    columnId: column.id,
    name: draft.name,
    displayName: draft.displayName.trim() || null,
    type: draft.type,
    required: draft.required,
    maxLength: column.maxLength,
    listSummaryEligible: column.listSummaryEligible,
    boardSummaryEligible: column.boardSummaryEligible,
    choiceConfig: columnDraftChoiceConfig(draft),
    dateDisplayFormat: draft.type === 'date' ? draft.dateDisplayFormat : 'date',
    durationDisplayFormat: draft.type === 'duration' ? draft.durationDisplayFormat : 'hours',
    recurrence: 'none',
    recurrenceDays: [],
    currencyCode: draft.type === 'currency' ? draft.currencyCode : 'USD',
    showOnBoard: draft.showOnBoard
  }
}

export function columnDraftMatchesColumn(draft: ColumnDraft, column: ListColumn): boolean {
  const original = columnDraftFromColumn(column)
  const originalChoice = columnDraftChoiceConfig(original)
  const draftChoice = columnDraftChoiceConfig(draft)
  return (
    draft.name === original.name &&
    draft.displayName.trim() === original.displayName.trim() &&
    draft.type === original.type &&
    draft.required === original.required &&
    draft.dateDisplayFormat === original.dateDisplayFormat &&
    draft.durationDisplayFormat === original.durationDisplayFormat &&
    draft.currencyCode === original.currencyCode &&
    draft.showOnBoard === original.showOnBoard &&
    JSON.stringify(draftChoice) === JSON.stringify(originalChoice)
  )
}
