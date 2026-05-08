import { useState } from 'react'
import type { ReactElement } from 'react'
import type { AppSettings, BoardList, BoardSnapshot, ColumnType, CurrencyCode, DateDisplayFormat, DisplayState, ListColumn } from '@shared/domain'
import { choiceConfigToText, defaultChoiceConfig, normalizeColumnName } from '../lists/helpers'
import { ConfirmActionModal } from '../modals/dialogs'
import { currencyOptions, columnTypes } from './options'
import type { ColumnDraft } from './drafts'
import { supportsBoardSummaryForColumn, supportsListSummaryForColumn } from './structure'

type AppActionResult = BoardSnapshot | DisplayState | AppSettings | void
type RunAction = (action: () => Promise<AppActionResult>) => Promise<AppActionResult>

type ConfirmDialogState = {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
} | null

export function SystemColumnRow({
  displayName,
  manualOrderEnabled = false,
  name,
  onDisplayNameChange,
  onOrderChange = () => undefined,
  onSave = () => undefined,
  onToggle,
  order = 1,
  orderCount = 1,
  showOnBoard,
  typeLabel,
  statusLabel = 'System'
}: {
  displayName: string
  manualOrderEnabled?: boolean
  name: string
  onDisplayNameChange?: (value: string) => void
  onOrderChange?: (order: number) => void
  onSave?: () => void
  onToggle: (checked: boolean) => void
  order?: number
  orderCount?: number
  showOnBoard: boolean
  typeLabel: string
  statusLabel?: string
}): ReactElement {
  return (
    <div className="column-row system-column-row">
      <input disabled value={name} />
      <input
        onChange={(event) => onDisplayNameChange?.(event.target.value)}
        placeholder="Use field name"
        value={displayName}
      />
      <input disabled value={typeLabel} />
      <span className="readonly-field">{statusLabel}</span>
      <label>
        <input checked={showOnBoard} onChange={(event) => onToggle(event.target.checked)} type="checkbox" />
        Show
      </label>
      <select aria-label={`${name} sort order`} disabled={!manualOrderEnabled} onChange={(event) => onOrderChange(Number(event.target.value))} value={order}>
        {Array.from({ length: orderCount }, (_, index) => index + 1).map((position) => (
          <option key={position} value={position}>
            {position}
          </option>
        ))}
      </select>
      <div className="column-actions">
        <button className="mini-button" onClick={onSave} type="button">
          Save
        </button>
        <button className="mini-button danger-mini" disabled type="button">
          Delete
        </button>
      </div>
    </div>
  )
}

export function ColumnRow({
  column,
  draft,
  list,
  locked = false,
  manualOrderEnabled,
  order,
  orderCount,
  onDraftChange,
  onOrderChange,
  onSave,
  runAction
}: {
  column: ListColumn
  draft: ColumnDraft
  list: BoardList
  locked?: boolean
  manualOrderEnabled: boolean
  order: number
  orderCount: number
  onDraftChange: (patch: Partial<ColumnDraft>) => void
  onOrderChange: (order: number) => void
  onSave: () => void
  runAction: RunAction
}): ReactElement {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null)
  const inheritedShoppingCostCurrency =
    list.templateType === 'shopping_list' && normalizeColumnName(column.name) === 'cost'
      ? list.columns.find((candidate) => normalizeColumnName(candidate.name) === 'price / pc')?.currencyCode ?? draft.currencyCode
      : null

  function remove(): void {
    setConfirmDialog({
      title: 'Delete Field',
      message: `Delete "${column.name}"? Existing values stored in this field on child items will be deleted.`,
      confirmLabel: 'Delete Field',
      destructive: true,
      onConfirm: async () => {
        await runAction(() => window.lpl.deleteColumn(column.id))
      }
    })
  }

  return (
    <div className={draft.type === 'choice' || draft.type === 'date' || draft.type === 'currency' || draft.type === 'duration' ? 'column-row column-row-with-config' : 'column-row'}>
      <input disabled={column.role === 'deadline' || locked} onChange={(event) => onDraftChange({ name: event.target.value })} value={draft.name} />
      <input onChange={(event) => onDraftChange({ displayName: event.target.value })} placeholder="Use field name" value={draft.displayName} />
      <select
        disabled={column.role === 'deadline' || locked}
        onChange={(event) => {
          const nextType = event.target.value as ColumnType
          const patch: Partial<ColumnDraft> = { type: nextType }
          if (nextType === 'date') {
            patch.dateDisplayFormat = column.role === 'deadline' ? draft.dateDisplayFormat : 'date'
          }
          if (nextType === 'choice') {
            const nextConfig = draft.choiceConfig.options.length ? draft.choiceConfig : defaultChoiceConfig(draft.name)
            patch.choiceConfig = nextConfig
            patch.choicesDraft = choiceConfigToText(nextConfig)
          }
          onDraftChange(patch)
        }}
        value={draft.type}
      >
        {columnTypes.map((candidate) => (
          <option key={candidate} value={candidate}>
            {candidate}
          </option>
        ))}
      </select>
      <label>
        <input checked={draft.required} disabled={locked} onChange={(event) => onDraftChange({ required: event.target.checked })} type="checkbox" />
        Required
      </label>
      <label>
        <input checked={draft.showOnBoard} disabled={locked} onChange={(event) => onDraftChange({ showOnBoard: event.target.checked })} type="checkbox" />
        Show
      </label>
      <select
        aria-label={`${column.name} sort order`}
        disabled={locked || !manualOrderEnabled}
        onChange={(event) => onOrderChange(Number(event.target.value))}
        value={order}
      >
        {Array.from({ length: orderCount }, (_, index) => index + 1).map((position) => (
          <option key={position} value={position}>
            {position}
          </option>
        ))}
      </select>
      <div className="column-actions">
        <button className="mini-button" disabled={locked} onClick={onSave} type="button">
          Save
        </button>
        <button className="mini-button danger-mini" disabled={locked || list.columns.length <= 1 || column.role === 'deadline'} onClick={remove} type="button">
          Delete
        </button>
      </div>
      {draft.type === 'date' && (
        <div className="date-config-row">
          <label>
            <span>Display</span>
            <select
              disabled={locked}
              onChange={(event) => onDraftChange({ dateDisplayFormat: event.target.value as DateDisplayFormat })}
              value={draft.dateDisplayFormat}
            >
              <option value="date">Date</option>
              <option value="datetime">Date + time</option>
              {column.role !== 'deadline' && <option value="time">Time only</option>}
            </select>
          </label>
        </div>
      )}
      {draft.type === 'currency' && (
        <div className="date-config-row">
          <label>
            <span>{inheritedShoppingCostCurrency ? 'Currency inherited from Price / pc' : 'Currency'}</span>
            <select
              disabled={locked || Boolean(inheritedShoppingCostCurrency)}
              onChange={(event) => onDraftChange({ currencyCode: event.target.value as CurrencyCode })}
              value={inheritedShoppingCostCurrency ?? draft.currencyCode}
            >
              {currencyOptions.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {draft.type === 'choice' && (
        <div className="choice-config-row">
          <label>
            <span>Selection</span>
            <select
              disabled={locked}
              onChange={(event) => onDraftChange({ choiceConfig: { ...draft.choiceConfig, selection: event.target.value === 'multi' ? 'multi' : 'single' } })}
              value={draft.choiceConfig.selection}
            >
              <option value="single">Single</option>
              <option value="multi">Multi</option>
            </select>
          </label>
          <label>
            <input
              checked={draft.choiceConfig.ranked}
              disabled={locked}
              onChange={(event) => onDraftChange({ choiceConfig: { ...draft.choiceConfig, ranked: event.target.checked } })}
              type="checkbox"
            />
            Ranked
          </label>
          <label className="choice-options-field">
            <span>Options</span>
            <textarea
              disabled={locked}
              onChange={(event) => onDraftChange({ choicesDraft: event.target.value })}
              rows={Math.min(5, Math.max(3, draft.choicesDraft.split('\n').length))}
              value={draft.choicesDraft}
            />
          </label>
        </div>
      )}
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
    </div>
  )
}

export function ColumnSummaryRow({
  column,
  list,
  runAction
}: {
  column: ListColumn
  list: BoardList
  runAction: RunAction
}): ReactElement {
  const listSummaryAllowed = supportsListSummaryForColumn(column)
  const boardSummaryAllowed = supportsBoardSummaryForColumn(column)
  const listSummaryCount = list.columns.filter((candidate) => candidate.listSummaryEligible).length
  const boardSummaryCount = list.columns.filter((candidate) => candidate.boardSummaryEligible).length

  function summaryBehaviorLabel(): string {
    if (!listSummaryAllowed && !boardSummaryAllowed) return 'Not summarizable'
    if (column.role === 'deadline' || column.type === 'date') return 'Next due / overdue'
    if (column.type === 'duration') return 'Sum duration'
    if (column.type === 'currency' || column.type === 'integer' || column.type === 'decimal') return 'Sum'
    return 'Count items'
  }

  function updateSummaryFlags(nextListSummaryEligible: boolean, nextBoardSummaryEligible: boolean): void {
    runAction(() =>
      window.lpl.updateColumn({
        columnId: column.id,
        name: column.name,
        type: column.type,
        required: column.required,
        maxLength: column.maxLength,
        listSummaryEligible: nextListSummaryEligible,
        boardSummaryEligible: nextBoardSummaryEligible,
        choiceConfig: column.choiceConfig,
        dateDisplayFormat: column.dateDisplayFormat,
        durationDisplayFormat: column.durationDisplayFormat,
        recurrence: 'none',
        recurrenceDays: [],
        currencyCode: column.currencyCode,
        showOnBoard: column.showOnBoard
      })
    )
  }

  return (
    <div className="summary-row">
      <span>{column.name}</span>
      <span>{summaryBehaviorLabel()}</span>
      <label>
        <input
          checked={column.listSummaryEligible}
          disabled={!listSummaryAllowed || (!column.listSummaryEligible && listSummaryCount >= 3)}
          onChange={(event) => updateSummaryFlags(event.target.checked, column.boardSummaryEligible)}
          type="checkbox"
        />
      </label>
      <label>
        <input
          checked={column.boardSummaryEligible}
          disabled={!boardSummaryAllowed || (!column.boardSummaryEligible && boardSummaryCount >= 5)}
          onChange={(event) => updateSummaryFlags(column.listSummaryEligible, event.target.checked)}
          type="checkbox"
        />
      </label>
    </div>
  )
}
