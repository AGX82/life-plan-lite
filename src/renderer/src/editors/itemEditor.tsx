import { Check, ChevronDown, ChevronRight, Save, Trash2 } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import type { Dispatch, FormEvent, ReactElement, SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import type {
  AppSettings,
  BoardItem,
  BoardList,
  BoardSnapshot,
  CloseConfirmationMode,
  FieldValue,
  ItemGroup,
  ListColumn,
  RecurrenceMode
} from '@shared/domain'
import { EditorHeading } from './chrome'
import {
  choiceInputValue,
  coerceInputValue,
  dateFieldValue,
  durationDraftFromMinutes,
  durationMinutesFromDraft,
  inputType,
  inputValue,
  isItemLevelRecurringTimeColumn,
  normalizeRecurrenceDays,
  normalizeRecurrenceInterval,
  recurrenceNeedsInterval,
  recurrenceNeedsWeekdays,
  sanitizeDurationPart,
  weekdayLabels
} from './itemFieldHelpers'

type FormValues = Record<string, FieldValue>
type RunAction = (action: () => Promise<any>) => Promise<any>
type ItemEditorMode = 'create' | 'edit'
type ItemEditorPresentation = 'panel' | 'modal'

type ItemMutationInput = {
  mode: ItemEditorMode
  item: BoardItem | null
  list: BoardList
  groupId: string | null
  parentItemId: string | null
  values: FormValues
  dependencyItemIds: string[]
}

type ItemEditorHelpers = {
  blankValues: (columns: ListColumn[], list?: BoardList) => FormValues
  editableItemColumns: (list: BoardList) => ListColumn[]
  groupOptions: (list: BoardList) => Array<{ id: string; label: string }>
  isProjectMilestoneLikeType: (type: string) => boolean
  itemTitle: (item: BoardItem, list: BoardList) => string
  projectEditableFieldColumns: (list: BoardList, columns: ListColumn[], values: FormValues) => ListColumn[]
  projectParentOptions: (list: BoardList, currentItemId: string | null) => Array<{ id: string; label: string }>
  projectRootItemsForBucket: (list: BoardList, groupId: string | null) => BoardItem[]
  projectTypeFromValues: (list: BoardList, values: FormValues) => string
  renderProjectDependencyItemRows: (
    item: BoardItem,
    list: BoardList,
    depth: number,
    currentItemId: string,
    dependencies: string[],
    setDependencies: Dispatch<SetStateAction<string[]>>
  ) => ReactElement
  submitProjectAwareItemMutation: (input: ItemMutationInput) => Promise<any>
  valuesForItem: (item: BoardItem, columns: ListColumn[]) => FormValues
  wishlistScoreTooltip: (item: BoardItem) => string
}

export type ItemEditorPanelProps = {
  appSettings: AppSettings
  busy: boolean
  helpers: ItemEditorHelpers
  initialGroupId?: string | null
  item: BoardItem | null
  list: BoardList
  mode?: ItemEditorMode
  onClose?: () => void
  presentation?: ItemEditorPresentation
  runAction: RunAction
  snapshot: BoardSnapshot
}

export function ItemEditorPanel({
  appSettings,
  busy,
  helpers,
  initialGroupId,
  item,
  list,
  mode = 'edit',
  onClose,
  presentation = 'panel',
  runAction,
  snapshot
}: ItemEditorPanelProps): ReactElement {
  const editableColumns = helpers.editableItemColumns(list)
  const [values, setValues] = useState<FormValues>(() => (item ? helpers.valuesForItem(item, editableColumns) : helpers.blankValues(editableColumns, list)))
  const [dependencies, setDependencies] = useState<string[]>(item?.dependencyItemIds ?? [])
  const [groupId, setGroupId] = useState<string | null>(item?.groupId ?? initialGroupId ?? null)
  const [parentItemId, setParentItemId] = useState<string | null>(item?.parentItemId ?? null)
  const [activeTab, setActiveTab] = useState<'details' | 'dependencies'>('details')
  const [closeDialog, setCloseDialog] = useState<{ action: 'completed' | 'cancelled' } | null>(null)
  const [closeComment, setCloseComment] = useState('')
  const [closing, setClosing] = useState(false)
  const confirmationMode = appSettings.closeConfirmationMode
  const fieldColumns = helpers.projectEditableFieldColumns(list, editableColumns, values)
  const currentProjectType = list.templateType === 'project' ? helpers.projectTypeFromValues(list, values) : null
  const canCloseItem = mode === 'edit' && Boolean(item && item.publicationStatus !== 'draft')
  const canDeleteItem = mode === 'edit' && Boolean(item)
  const wishlistScore =
    mode === 'edit' && item && list.templateType === 'wishlist' && item.wishlistRecommendation
      ? {
          label: `Buy Score: ${(((item.wishlistRecommendation.buyScore ?? 0) * 100)).toFixed(1)}%`,
          title: helpers.wishlistScoreTooltip(item)
        }
      : null

  useEffect(() => {
    setValues(item ? helpers.valuesForItem(item, editableColumns) : helpers.blankValues(editableColumns, list))
    setDependencies(item?.dependencyItemIds ?? [])
    setGroupId(item?.groupId ?? initialGroupId ?? null)
    setParentItemId(item?.parentItemId ?? null)
    setActiveTab('details')
  }, [initialGroupId, item?.id, list.id, mode])

  useEffect(() => {
    if (currentProjectType && helpers.isProjectMilestoneLikeType(currentProjectType) && parentItemId) {
      setParentItemId(null)
    }
  }, [currentProjectType, helpers, parentItemId])

  function setValue(column: ListColumn, value: FieldValue): void {
    setValues((current) => ({ ...current, [column.id]: coerceInputValue(column, value) }))
  }

  function submit(event: FormEvent): void {
    event.preventDefault()
    runAction(async () => {
      const result = await helpers.submitProjectAwareItemMutation({
        mode,
        item,
        list,
        groupId,
        parentItemId,
        values,
        dependencyItemIds: dependencies
      })
      if (presentation === 'modal' && result && 'lists' in result) onClose?.()
      return result
    })
  }

  function requestDeleteItem(): void {
    if (!item) return
    runAction(async () => {
      const result = await window.lpl.deleteItem(item.id)
      if (presentation === 'modal') onClose?.()
      return result
    })
  }

  function requestClose(action: 'completed' | 'cancelled'): void {
    if (!item) return
    if (confirmationMode === 'none') {
      void confirmClose(action, null)
      return
    }
    setCloseComment('')
    setCloseDialog({ action })
  }

  async function confirmClose(action: 'completed' | 'cancelled', comment: string | null): Promise<void> {
    if (!item) return
    setClosing(true)
    try {
      await runAction(() => window.lpl.closeItem({ itemId: item.id, action, comment, archiveScope: 'draft' }))
      setCloseDialog(null)
      setCloseComment('')
      if (presentation === 'modal') onClose?.()
    } finally {
      setClosing(false)
    }
  }

  const content = (
    <>
      {presentation === 'modal' && (
        <div className="modal-header">
          <div>
            <p className="eyebrow">{mode === 'edit' ? 'Edit Item' : 'Quick Add Item'}</p>
            <h3>{mode === 'edit' && item ? helpers.itemTitle(item, list) : list.name}</h3>
          </div>
          {wishlistScore && (
            <div className={`modal-meta-chip ${item?.wishlistRecommendation?.missingInputs.length ? 'partial' : ''}`} title={wishlistScore.title}>
              {wishlistScore.label}
            </div>
          )}
        </div>
      )}
      <form className="editor-tabbed" onSubmit={submit}>
        <div className="editor-tabbar">
          <button className={activeTab === 'details' ? 'editor-tab active' : 'editor-tab'} onClick={() => setActiveTab('details')} type="button">
            Item Details
          </button>
          <button className={activeTab === 'dependencies' ? 'editor-tab active' : 'editor-tab'} onClick={() => setActiveTab('dependencies')} type="button">
            Dependencies
          </button>
        </div>
        <div className={presentation === 'modal' ? 'modal-body modal-body-form' : 'editor-tab-content'}>
          {activeTab === 'details' && (
            <section className="list-tab-panel item-tab-panel">
              <div className="field-grid two">
                <label>
                  <span>Group</span>
                  <select onChange={(event) => setGroupId(event.target.value || null)} value={groupId ?? ''}>
                    <option value="">List root</option>
                    {helpers.groupOptions(list).map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </label>
                {list.templateType === 'project' && !helpers.isProjectMilestoneLikeType(currentProjectType ?? 'task') && (
                  <label>
                    <span>Parent Task</span>
                    <select onChange={(event) => setParentItemId(event.target.value || null)} value={parentItemId ?? ''}>
                      <option value="">Project root</option>
                      {helpers.projectParentOptions(list, item?.id ?? null).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <ItemFields columns={fieldColumns} setValue={setValue} values={values} />
            </section>
          )}
          {activeTab === 'dependencies' && (
            <section className="list-tab-panel item-tab-panel dependency-tab-panel">
              <DependencyTreePicker
                currentItemId={item?.id ?? ''}
                dependencies={dependencies}
                helpers={helpers}
                list={list}
                setDependencies={setDependencies}
                snapshot={snapshot}
              />
            </section>
          )}
        </div>
        <div className={presentation === 'modal' ? 'modal-actions' : 'form-actions'}>
          {presentation === 'modal' && (
            <button className="icon-button" disabled={busy || closing} onClick={onClose} type="button">
              Cancel
            </button>
          )}
          {canCloseItem && (
            <button className="icon-button" disabled={busy || closing} onClick={() => requestClose('completed')} type="button">
              <Check size={16} />
              Mark Done
            </button>
          )}
          {canDeleteItem && (
            <button className="danger-button" disabled={busy || closing} onClick={requestDeleteItem} type="button">
              <Trash2 size={16} />
              Delete
            </button>
          )}
          <button className="primary-button" disabled={busy || closing} type="submit">
            <Save size={16} />
            {mode === 'edit' ? 'Save Item' : 'Add Item'}
          </button>
        </div>
      </form>
      {closeDialog && item && (
        <CloseItemModal
          action={closeDialog.action}
          busy={busy || closing}
          comments={closeComment}
          itemTitle={helpers.itemTitle(item, list)}
          mode={confirmationMode}
          onCancel={() => {
            setCloseDialog(null)
            setCloseComment('')
          }}
          onCommentsChange={setCloseComment}
          onConfirm={() => confirmClose(closeDialog.action, confirmationMode === 'with_comments' ? closeComment : null)}
        />
      )}
    </>
  )

  if (presentation === 'modal' && onClose) {
    return createPortal(
      <div className="modal-backdrop" onClick={onClose} role="presentation">
        <div aria-modal="true" className="modal-card modal-card-large" onClick={(event) => event.stopPropagation()} role="dialog">
          {content}
        </div>
      </div>,
      document.body
    )
  }

  return content
}

type CloseItemModalProps = {
  action: 'completed' | 'cancelled'
  busy: boolean
  comments: string
  itemTitle: string
  mode: CloseConfirmationMode
  onCancel: () => void
  onCommentsChange: (value: string) => void
  onConfirm: () => void | Promise<void>
}

export function CloseItemModal({ action, busy, comments, itemTitle, mode, onCancel, onCommentsChange, onConfirm }: CloseItemModalProps): ReactElement {
  const message =
    mode === 'without_comments'
      ? action === 'completed'
        ? 'You are about to mark this item as completed. Please confirm.'
        : 'You are about to cancel this task before completion. Please confirm.'
      : action === 'completed'
        ? 'You are about to mark this item as completed. Do you want to log any comments?'
        : 'You are about to cancel this task before completion. Do you want to log any comments?'

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div aria-modal="true" className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Close Item</p>
            <h3>{itemTitle}</h3>
          </div>
        </div>
        <div className="modal-body">
          <p>{message}</p>
          {mode === 'with_comments' && (
            <label className="modal-field">
              <span>Comments</span>
              <textarea
                onChange={(event) => onCommentsChange(event.target.value)}
                placeholder="Add an optional note for the closure log"
                rows={4}
                value={comments}
              />
            </label>
          )}
        </div>
        <div className="modal-actions">
          <button className="icon-button" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={busy} onClick={() => void onConfirm()} type="button">
            {action === 'completed' ? 'Mark Completed' : 'Cancel Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

type ItemFieldsProps = {
  columns: ListColumn[]
  setValue: (column: ListColumn, value: FieldValue) => void
  values: FormValues
}

function ItemFields({ columns, setValue, values }: ItemFieldsProps): ReactElement {
  return (
    <div className="field-grid two">
      {columns.map((column) => {
        if (isItemLevelRecurringTimeColumn(column)) {
          const dateValue = dateFieldValue(values[column.id])
          return (
            <div className="item-recurring-field" key={column.id}>
              <label>
                <span>{column.name}</span>
                <input
                  onChange={(event) => setValue(column, { ...dateValue, value: event.target.value })}
                  required={column.required}
                  type="time"
                  value={dateValue.value}
                />
              </label>
              <label>
                <span>Recurrence</span>
                <select
                  onChange={(event) => {
                    const recurrence = event.target.value as RecurrenceMode
                    setValue(column, {
                      ...dateValue,
                      recurrence,
                      recurrenceDays: recurrenceNeedsWeekdays(recurrence) ? dateValue.recurrenceDays : [],
                      recurrenceInterval: recurrenceNeedsInterval(recurrence) ? dateValue.recurrenceInterval : 1
                    })
                  }}
                  value={dateValue.recurrence}
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="interval_weeks">Every x weeks</option>
                  <option value="monthly">Monthly</option>
                  <option value="interval_months">Every x months</option>
                  <option value="custom_weekdays">Weekdays...</option>
                </select>
              </label>
              {recurrenceNeedsInterval(dateValue.recurrence) && (
                <label>
                  <span>{dateValue.recurrence === 'interval_months' ? 'Months' : 'Weeks'}</span>
                  <input
                    min={1}
                    onChange={(event) =>
                      setValue(column, {
                        ...dateValue,
                        recurrenceInterval: normalizeRecurrenceInterval(Number.parseInt(event.target.value, 10))
                      })
                    }
                    type="number"
                    value={dateValue.recurrenceInterval}
                  />
                </label>
              )}
              {recurrenceNeedsWeekdays(dateValue.recurrence) && (
                <fieldset className="weekday-picker">
                  <legend>Days</legend>
                  {weekdayLabels.map((day, index) => (
                    <label key={day.long}>
                      <input
                        checked={dateValue.recurrenceDays.includes(index)}
                        onChange={(event) =>
                          setValue(column, {
                            ...dateValue,
                            recurrenceDays: event.target.checked
                              ? [...dateValue.recurrenceDays, index].sort((a, b) => a - b)
                              : dateValue.recurrenceDays.filter((dayIndex) => dayIndex !== index)
                          })
                        }
                        type="checkbox"
                      />
                      {day.short}
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
          )
        }

        return (
          <label key={column.id}>
            <span>{column.type === 'currency' ? `${column.name} (${column.currencyCode})` : column.name}</span>
            {column.type === 'boolean' ? (
              <input checked={Boolean(values[column.id])} onChange={(event) => setValue(column, event.target.checked)} type="checkbox" />
            ) : column.type === 'duration' ? (
              <DurationValueInput
                column={column}
                onChange={(value) => setValue(column, value)}
                required={column.required}
                value={typeof values[column.id] === 'number' ? (values[column.id] as number) : null}
              />
            ) : column.type === 'choice' ? (
              <select
                multiple={column.choiceConfig?.selection === 'multi'}
                onChange={(event) =>
                  setValue(
                    column,
                    column.choiceConfig?.selection === 'multi'
                      ? Array.from(event.target.selectedOptions, (option) => option.value)
                      : event.target.value
                  )
                }
                required={column.required}
                value={choiceInputValue(values[column.id], column)}
              >
                {column.choiceConfig?.selection !== 'multi' && <option value="">None</option>}
                {(column.choiceConfig?.options ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                maxLength={column.maxLength ?? undefined}
                onChange={(event) => setValue(column, event.target.value)}
                required={column.required}
                type={inputType(column)}
                value={inputValue(values[column.id], column)}
              />
            )}
          </label>
        )
      })}
    </div>
  )
}

type DurationValueInputProps = {
  column: ListColumn
  onChange: (value: FieldValue) => void
  required: boolean
  value: number | null
}

function DurationValueInput({ column, onChange, required, value }: DurationValueInputProps): ReactElement {
  const initial = durationDraftFromMinutes(value)
  const [hours, setHours] = useState(initial.hours)
  const [minutes, setMinutes] = useState(initial.minutes)

  useEffect(() => {
    const next = durationDraftFromMinutes(value)
    setHours(next.hours)
    setMinutes(next.minutes)
  }, [column.id, value])

  function commit(nextHours: string, nextMinutes: string): void {
    const total = durationMinutesFromDraft(nextHours, nextMinutes)
    onChange(total)
  }

  function normalizeFromCurrent(nextHours: string, nextMinutes: string): void {
    const total = durationMinutesFromDraft(nextHours, nextMinutes)
    const normalized = durationDraftFromMinutes(typeof total === 'number' ? total : null)
    setHours(normalized.hours)
    setMinutes(normalized.minutes)
    onChange(total)
  }

  return (
    <div className="duration-editor">
      <div className="duration-editor-grid">
        <label>
          <span>Hours</span>
          <input
            inputMode="numeric"
            onBlur={() => normalizeFromCurrent(hours, minutes)}
            onChange={(event) => {
              const next = sanitizeDurationPart(event.target.value)
              setHours(next)
              commit(next, minutes)
            }}
            placeholder="0"
            required={required && !minutes}
            type="text"
            value={hours}
          />
        </label>
        <label>
          <span>Minutes</span>
          <input
            inputMode="numeric"
            onBlur={() => normalizeFromCurrent(hours, minutes)}
            onChange={(event) => {
              const next = sanitizeDurationPart(event.target.value)
              setMinutes(next)
              commit(hours, next)
            }}
            placeholder="00"
            required={required && !hours}
            type="text"
            value={minutes}
          />
        </label>
      </div>
    </div>
  )
}

type DependencyTreePickerProps = {
  currentItemId: string
  dependencies: string[]
  helpers: Pick<ItemEditorHelpers, 'itemTitle' | 'projectRootItemsForBucket' | 'renderProjectDependencyItemRows'>
  list: BoardList
  setDependencies: Dispatch<SetStateAction<string[]>>
  snapshot: BoardSnapshot
}

function DependencyTreePicker({ currentItemId, dependencies, helpers, list, setDependencies, snapshot }: DependencyTreePickerProps): ReactElement {
  const [boardExpanded, setBoardExpanded] = useState(false)
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setBoardExpanded(false)
    setExpandedLists({})
    setExpandedGroups({})
  }, [snapshot.id, currentItemId])

  function toggleItemDependency(itemId: string, checked: boolean): void {
    setDependencies((current) => (checked ? [...current, itemId] : current.filter((id) => id !== itemId)))
  }

  function renderItemRow(item: BoardItem, currentList: BoardList, depth: number): ReactElement {
    return (
      <div className="dependency-tree-row" key={item.id}>
        <label className="dependency-tree-item" style={{ paddingInlineStart: `${0.65 + depth * 1.05}rem` }}>
          <input checked={dependencies.includes(item.id)} onChange={(event) => toggleItemDependency(item.id, event.target.checked)} type="checkbox" />
          <span>{helpers.itemTitle(item, currentList)}</span>
          <small>{item.displayCode}</small>
        </label>
      </div>
    )
  }

  function renderGroupRows(group: ItemGroup, currentList: BoardList, depth: number): ReactElement {
    const expanded = expandedGroups[group.id] ?? true
    const childGroups = currentList.groups.filter((candidate) => candidate.parentGroupId === group.id)
    const childItems = helpers.projectRootItemsForBucket(currentList, group.id).filter((candidate) => candidate.id !== currentItemId)
    const hasChildren = childGroups.length > 0 || childItems.length > 0

    return (
      <div key={group.id}>
        <button
          className="dependency-tree-branch dependency-tree-level-group"
          onClick={() => {
            if (hasChildren) {
              setExpandedGroups((current) => ({ ...current, [group.id]: !expanded }))
            }
          }}
          style={{ paddingInlineStart: `${0.65 + depth * 1.05}rem` }}
          type="button"
        >
          <span className="dependency-tree-expander">
            {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span />}
          </span>
          <span>{group.name}</span>
          <small>{group.code}</small>
        </button>
        {expanded && (
          <>
            {childGroups.map((child) => renderGroupRows(child, currentList, depth + 1))}
            {childItems.map((child) =>
              helpers.renderProjectDependencyItemRows(child, currentList, depth + 1, currentItemId, dependencies, setDependencies)
            )}
          </>
        )}
      </div>
    )
  }

  function renderListRows(currentList: BoardList): ReactElement {
    const expanded = expandedLists[currentList.id] ?? false
    const childGroups = currentList.groups.filter((group) => !group.parentGroupId)
    const rootItems = helpers.projectRootItemsForBucket(currentList, null).filter((candidate) => candidate.id !== currentItemId)
    const hasChildren = childGroups.length > 0 || rootItems.length > 0

    return (
      <div key={currentList.id}>
        <button
          className="dependency-tree-branch dependency-tree-level-list"
          onClick={() => {
            if (hasChildren) {
              setExpandedLists((current) => ({ ...current, [currentList.id]: !expanded }))
            }
          }}
          style={{ paddingInlineStart: '1.7rem' }}
          type="button"
        >
          <span className="dependency-tree-expander">
            {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span />}
          </span>
          <span>{currentList.name}</span>
          <small>{currentList.code}</small>
        </button>
        {expanded && (
          <>
            {childGroups.map((group) => renderGroupRows(group, currentList, 2))}
            {rootItems.map((rootItem) =>
              currentList.templateType === 'project'
                ? helpers.renderProjectDependencyItemRows(rootItem, currentList, 2, currentItemId, dependencies, setDependencies)
                : renderItemRow(rootItem, currentList, 2)
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="dependency-tree-panel">
      <div className="dependency-tree-toolbar">
        <span>Board Dependency Tree</span>
        <small>Select the tasks this item depends on.</small>
      </div>
      <div className="dependency-tree-scroll">
        <button className="dependency-tree-branch dependency-tree-level-board" onClick={() => setBoardExpanded((current) => !current)} type="button">
          <span className="dependency-tree-expander">{boardExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
          <span>{snapshot.name}</span>
          <small>{snapshot.lists.length} lists</small>
        </button>
        {boardExpanded && <div className="dependency-tree-body">{snapshot.lists.map((boardList) => renderListRows(boardList))}</div>}
      </div>
    </div>
  )
}
