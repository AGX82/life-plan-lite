import { Fragment } from 'react'
import type { Dispatch, ReactElement, SetStateAction } from 'react'
import type { BoardItem, BoardList, BoardSnapshot, FieldValue, ListColumn } from '@shared/domain'
import {
  dateStringFromField,
  editableItemColumns,
  itemTitle,
  localDateTimeInputValue,
  normalizeColumnName,
  parseColumnDateValue,
  type FormValues,
  valuesForItem
} from '../lists/helpers'

type SubmitProjectItemMutationInput = {
  mode: 'create' | 'edit'
  item: BoardItem | null
  list: BoardList
  groupId: string | null
  parentItemId: string | null
  values: FormValues
  dependencyItemIds: string[]
}

type ProjectBoardRow = { kind: 'group'; group: BoardList['groups'][number] } | { kind: 'item'; item: BoardItem; depth: number }

export function projectEditableFieldColumns(list: BoardList, columns: ListColumn[], values: FormValues): ListColumn[] {
  if (list.templateType !== 'project') return columns
  const type = projectTypeFromValues(list, values)
  if (!isProjectMilestoneLikeType(type)) return columns
  return columns
    .filter((column) => {
      const normalized = normalizeColumnName(column.name)
      return !['responsible', 'planned end', 'actual end', 'effort', 'output / deliverable'].includes(normalized)
    })
    .map((column) => {
      const normalized = normalizeColumnName(column.name)
      if (normalized === 'planned start') return { ...column, name: 'Planned Date' }
      if (normalized === 'actual start') return { ...column, name: 'Actual Date' }
      return column
    })
}

export async function submitProjectAwareItemMutation(input: SubmitProjectItemMutationInput): Promise<BoardSnapshot> {
  if (input.list.templateType !== 'project') {
    if (input.mode === 'edit' && input.item) {
      return window.lpl.updateItem({
        itemId: input.item.id,
        groupId: input.groupId,
        parentItemId: input.parentItemId,
        values: input.values,
        dependencyItemIds: input.dependencyItemIds
      })
    }
    return window.lpl.createItem({
      listId: input.list.id,
      groupId: input.groupId,
      parentItemId: input.parentItemId,
      values: input.values,
      dependencyItemIds: input.dependencyItemIds
    })
  }

  const normalizedValues = normalizeProjectSubmissionValues(input.list, input.values)
  const dependencyAligned = alignProjectMilestonePlannedDate(input.list, normalizedValues, input.dependencyItemIds)
  if (dependencyAligned.message) window.alert(dependencyAligned.message)
  const normalizedParentItemId = isProjectMilestoneLikeType(projectTypeFromValues(input.list, normalizedValues)) ? null : input.parentItemId
  const reconciliation = reconcileProjectParentDateRanges(input.list, input.item, normalizedParentItemId, dependencyAligned.values)

  for (const update of reconciliation.parentUpdates) {
    await window.lpl.updateItem({
      itemId: update.item.id,
      groupId: update.item.groupId,
      parentItemId: update.item.parentItemId,
      values: update.values,
      dependencyItemIds: update.item.dependencyItemIds
    })
  }

  if (input.mode === 'edit' && input.item) {
    return window.lpl.updateItem({
      itemId: input.item.id,
      groupId: input.groupId,
      parentItemId: normalizedParentItemId,
      values: reconciliation.values,
      dependencyItemIds: input.dependencyItemIds
    })
  }

  return window.lpl.createItem({
    listId: input.list.id,
    groupId: input.groupId,
    parentItemId: normalizedParentItemId,
    values: reconciliation.values,
    dependencyItemIds: input.dependencyItemIds
  })
}

export function projectTypeFromValues(list: BoardList, values: FormValues): string {
  const typeColumn = projectTypeColumn(list)
  const raw = typeColumn ? values[typeColumn.id] : 'task'
  return normalizeColumnName(String(raw ?? 'task')) || 'task'
}

export function isProjectMilestoneLikeType(type: string): boolean {
  return type === 'milestone' || type === 'project start' || type === 'project end'
}

export function projectRootItemsForBucket(list: BoardList, groupId: string | null): BoardItem[] {
  const itemsById = projectItemMap(list)
  return projectOrderedPeerItems(
    list,
    list.items
      .filter((item) => item.groupId === groupId)
      .filter((item) => !isProjectBoundaryType(projectItemType(item, list)))
      .filter((item) => {
        if (isProjectMilestoneLikeType(projectItemType(item, list))) return true
        if (!item.parentItemId) return true
        const parent = itemsById.get(item.parentItemId)
        return !parent || parent.groupId !== groupId
      })
  )
}

export function projectParentOptions(list: BoardList, currentItemId: string | null): Array<{ id: string; label: string }> {
  const descendants = currentItemId ? projectDescendantIds(list, currentItemId) : new Set<string>()
  const options: Array<{ id: string; label: string }> = []

  const appendItems = (items: BoardItem[], depth: number): void => {
    for (const item of items) {
      if (item.id === currentItemId || descendants.has(item.id)) continue
      if (projectParentEligible(item, list)) {
        options.push({ id: item.id, label: `${'  '.repeat(depth)}${itemTitle(item, list)}` })
      }
      appendItems(projectChildItems(list, item.id, item.groupId), depth + 1)
    }
  }

  const appendGroupBuckets = (parentGroupId: string | null, depth: number): void => {
    for (const group of list.groups.filter((entry) => entry.parentGroupId === parentGroupId).sort((left, right) => left.order - right.order)) {
      appendItems(projectRootItemsForBucket(list, group.id), depth)
      appendGroupBuckets(group.id, depth + 1)
    }
  }

  appendItems(projectRootItemsForBucket(list, null), 0)
  appendGroupBuckets(null, 1)
  return options
}

export function renderProjectDependencyItemRows(
  item: BoardItem,
  list: BoardList,
  depth: number,
  currentItemId: string,
  dependencies: string[],
  setDependencies: Dispatch<SetStateAction<string[]>>
): ReactElement {
  const toggle = (itemId: string, checked: boolean): void => {
    setDependencies((current) => (checked ? [...current, itemId] : current.filter((id) => id !== itemId)))
  }

  return (
    <Fragment key={item.id}>
      <div className="dependency-tree-row">
        <label className="dependency-tree-item" style={{ paddingInlineStart: `${0.65 + depth * 1.05}rem` }}>
          <input checked={dependencies.includes(item.id)} onChange={(event) => toggle(item.id, event.target.checked)} type="checkbox" />
          <span>{itemTitle(item, list)}</span>
          <small>{item.displayCode}</small>
        </label>
      </div>
      {projectChildItems(list, item.id, item.groupId)
        .filter((child) => child.id !== currentItemId)
        .map((child) => renderProjectDependencyItemRows(child, list, depth + 1, currentItemId, dependencies, setDependencies))}
    </Fragment>
  )
}

function normalizeProjectSubmissionValues(list: BoardList, values: FormValues): FormValues {
  if (list.templateType !== 'project') return values
  const type = projectTypeFromValues(list, values)
  if (!isProjectMilestoneLikeType(type)) return values
  const nextValues = { ...values }
  const columns = projectDateColumns(list)
  if (columns.plannedStart && columns.plannedEnd) nextValues[columns.plannedEnd.id] = nextValues[columns.plannedStart.id] ?? ''
  if (columns.actualStart && columns.actualEnd) nextValues[columns.actualEnd.id] = nextValues[columns.actualStart.id] ?? ''
  for (const column of list.columns) {
    const normalized = normalizeColumnName(column.name)
    if (['responsible', 'effort', 'output / deliverable'].includes(normalized)) {
      nextValues[column.id] = column.type === 'boolean' ? false : column.type === 'choice' && column.choiceConfig?.selection === 'multi' ? [] : ''
    }
  }
  return nextValues
}

function alignProjectMilestonePlannedDate(list: BoardList, values: FormValues, dependencyItemIds: string[]): { values: FormValues; message: string | null } {
  if (list.templateType !== 'project') return { values, message: null }
  if (projectTypeFromValues(list, values) !== 'milestone') return { values, message: null }
  if (dependencyItemIds.length === 0) return { values, message: null }

  const columns = projectDateColumns(list)
  const plannedStartColumn = columns.plannedStart
  const plannedEndColumn = columns.plannedEnd
  const currentPlannedDate = projectFieldDateValue(values, plannedStartColumn)
  const latestDependencyDate = projectLatestDependencyPlannedDate(list, dependencyItemIds)
  if (!plannedStartColumn || !latestDependencyDate) return { values, message: null }
  if (currentPlannedDate && currentPlannedDate.getTime() >= latestDependencyDate.getTime()) return { values, message: null }

  const nextValues = { ...values }
  nextValues[plannedStartColumn.id] = formatProjectDateForMutation(latestDependencyDate, plannedStartColumn)
  if (plannedEndColumn) nextValues[plannedEndColumn.id] = formatProjectDateForMutation(latestDependencyDate, plannedEndColumn)

  return {
    values: nextValues,
    message: `Milestone planned date was updated to ${projectTimelineLabel(latestDependencyDate)} so it does not fall before the latest planned completion of its dependencies.`
  }
}

function reconcileProjectParentDateRanges(
  list: BoardList,
  _item: BoardItem | null,
  parentItemId: string | null,
  values: FormValues
): { values: FormValues; parentUpdates: Array<{ item: BoardItem; values: FormValues }> } {
  const columns = projectDateColumns(list)
  const parentChain = parentItemId ? projectParentChain(list, parentItemId) : []

  const childPlannedStart = projectFieldDateValue(values, columns.plannedStart)
  const childPlannedEnd = projectFieldDateValue(values, columns.plannedEnd)
  const childActualStart = projectFieldDateValue(values, columns.actualStart)
  const childActualEnd = projectFieldDateValue(values, columns.actualEnd)
  const itemType = projectTypeFromValues(list, values)

  const conflicts = [
    ...projectRangeConflicts(list, parentChain, columns.plannedStart, columns.plannedEnd, childPlannedStart, childPlannedEnd),
    ...projectRangeConflicts(list, parentChain, columns.actualStart, columns.actualEnd, childActualStart, childActualEnd),
    ...(itemType === 'task'
      ? projectTimelineConflicts(list, columns, {
          plannedStart: childPlannedStart,
          plannedEnd: childPlannedEnd,
          actualStart: childActualStart,
          actualEnd: childActualEnd
        })
      : [])
  ]
  if (conflicts.length === 0) return { values, parentUpdates: [] }

  const shouldExtendParents = window.confirm(
    `One or more project dates fall outside the current parent or project timeline.\n\n${conflicts.join('\n')}\n\nPress OK to extend the parent range(s) or project boundary items to fit the child.\nPress Cancel to confine the child dates inside the current ranges.`
  )

  if (shouldExtendParents) {
    return {
      values,
      parentUpdates: [
        ...projectParentRangeUpdates(parentChain, columns, {
          plannedStart: childPlannedStart,
          plannedEnd: childPlannedEnd,
          actualStart: childActualStart,
          actualEnd: childActualEnd
        }),
        ...(itemType === 'task'
          ? projectTimelineBoundaryUpdates(list, columns, {
              plannedStart: childPlannedStart,
              plannedEnd: childPlannedEnd,
              actualStart: childActualStart,
              actualEnd: childActualEnd
            })
          : [])
      ]
    }
  }

  return {
    values: confineProjectChildDatesToTimeline(list, confineProjectChildDates(values, parentChain, columns), columns, itemType === 'task'),
    parentUpdates: []
  }
}

function projectDateColumns(list: BoardList): { plannedStart: ListColumn | null; plannedEnd: ListColumn | null; actualStart: ListColumn | null; actualEnd: ListColumn | null } {
  return {
    plannedStart: list.columns.find((column) => normalizeColumnName(column.name) === 'planned start') ?? null,
    plannedEnd: list.columns.find((column) => normalizeColumnName(column.name) === 'planned end') ?? null,
    actualStart: list.columns.find((column) => normalizeColumnName(column.name) === 'actual start') ?? null,
    actualEnd: list.columns.find((column) => normalizeColumnName(column.name) === 'actual end') ?? null
  }
}

function projectParentChain(list: BoardList, parentItemId: string): BoardItem[] {
  const itemsById = projectItemMap(list)
  const chain: BoardItem[] = []
  let cursor = itemsById.get(parentItemId) ?? null
  while (cursor) {
    chain.push(cursor)
    cursor = cursor.parentItemId ? (itemsById.get(cursor.parentItemId) ?? null) : null
  }
  return chain
}

function projectTimelineBoundaryItems(list: BoardList): { projectStart: BoardItem | null; projectEnd: BoardItem | null } {
  const orderedItems = [...list.items].sort((left, right) => left.order - right.order)
  return {
    projectStart: orderedItems.find((item) => projectItemType(item, list) === 'project start') ?? null,
    projectEnd: orderedItems.find((item) => projectItemType(item, list) === 'project end') ?? null
  }
}

function projectFieldDateValue(values: FormValues | Record<string, FieldValue>, column: ListColumn | null): Date | null {
  if (!column) return null
  const raw = dateStringFromField(values[column.id])
  return raw ? parseColumnDateValue(raw, column) : null
}

function formatProjectDateForMutation(date: Date, column: ListColumn | null): string {
  if (!column || column.dateDisplayFormat === 'date') return date.toISOString().slice(0, 10)
  if (column.dateDisplayFormat === 'datetime') return localDateTimeInputValue(date)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function projectRangeConflicts(
  list: BoardList,
  parentChain: BoardItem[],
  startColumn: ListColumn | null,
  endColumn: ListColumn | null,
  childStart: Date | null,
  childEnd: Date | null
): string[] {
  const conflicts: string[] = []
  for (const parent of parentChain) {
    const parentStart = projectFieldDateValue(parent.values, startColumn)
    const parentEnd = projectFieldDateValue(parent.values, endColumn)
    if (childStart && parentStart && childStart.getTime() < parentStart.getTime()) {
      conflicts.push(`${itemTitle(parent, list)} ${startColumn?.name ?? 'Start'} would need to move earlier.`)
    }
    if (childStart && !parentStart && startColumn) {
      conflicts.push(`${itemTitle(parent, list)} is missing ${startColumn.name}.`)
    }
    if (childEnd && parentEnd && childEnd.getTime() > parentEnd.getTime()) {
      conflicts.push(`${itemTitle(parent, list)} ${endColumn?.name ?? 'End'} would need to move later.`)
    }
    if (childEnd && !parentEnd && endColumn) {
      conflicts.push(`${itemTitle(parent, list)} is missing ${endColumn.name}.`)
    }
  }
  return conflicts
}

function projectTimelineConflicts(
  list: BoardList,
  columns: ReturnType<typeof projectDateColumns>,
  childDates: { plannedStart: Date | null; plannedEnd: Date | null; actualStart: Date | null; actualEnd: Date | null }
): string[] {
  const conflicts: string[] = []
  const boundaries = projectTimelineBoundaryItems(list)
  const projectPlannedStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.plannedStart) : null
  const projectPlannedEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.plannedStart) : null
  const projectActualStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.actualStart) : null
  const projectActualEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.actualStart) : null

  if (projectPlannedStart && childDates.plannedStart && childDates.plannedStart.getTime() < projectPlannedStart.getTime()) {
    conflicts.push(`Planned start begins before Project Start (${projectTimelineLabel(projectPlannedStart)}).`)
  }
  if (projectPlannedEnd && childDates.plannedEnd && childDates.plannedEnd.getTime() > projectPlannedEnd.getTime()) {
    conflicts.push(`Planned end falls after Project End (${projectTimelineLabel(projectPlannedEnd)}).`)
  }
  if (projectActualStart && childDates.actualStart && childDates.actualStart.getTime() < projectActualStart.getTime()) {
    conflicts.push(`Actual start begins before Project Start (${projectTimelineLabel(projectActualStart)}).`)
  }
  if (projectActualEnd && childDates.actualEnd && childDates.actualEnd.getTime() > projectActualEnd.getTime()) {
    conflicts.push(`Actual end falls after Project End (${projectTimelineLabel(projectActualEnd)}).`)
  }

  return conflicts
}

function projectParentRangeUpdates(
  parentChain: BoardItem[],
  columns: ReturnType<typeof projectDateColumns>,
  childDates: { plannedStart: Date | null; plannedEnd: Date | null; actualStart: Date | null; actualEnd: Date | null }
): Array<{ item: BoardItem; values: FormValues }> {
  return parentChain
    .map((parent) => {
      const values: FormValues = {}
      const updates: Array<[ListColumn | null, Date | null, Date | null, 'min' | 'max']> = [
        [columns.plannedStart, projectFieldDateValue(parent.values, columns.plannedStart), childDates.plannedStart, 'min'],
        [columns.plannedEnd, projectFieldDateValue(parent.values, columns.plannedEnd), childDates.plannedEnd, 'max'],
        [columns.actualStart, projectFieldDateValue(parent.values, columns.actualStart), childDates.actualStart, 'min'],
        [columns.actualEnd, projectFieldDateValue(parent.values, columns.actualEnd), childDates.actualEnd, 'max']
      ]
      for (const [column, parentDate, childDate, mode] of updates) {
        if (!column || !childDate) continue
        const shouldWrite = !parentDate || (mode === 'min' ? childDate.getTime() < parentDate.getTime() : childDate.getTime() > parentDate.getTime())
        if (shouldWrite) values[column.id] = formatProjectDateForMutation(childDate, column)
      }
      return Object.keys(values).length > 0 ? { item: parent, values } : null
    })
    .filter((entry): entry is { item: BoardItem; values: FormValues } => entry !== null)
}

function projectTimelineBoundaryUpdates(
  list: BoardList,
  columns: ReturnType<typeof projectDateColumns>,
  childDates: { plannedStart: Date | null; plannedEnd: Date | null; actualStart: Date | null; actualEnd: Date | null }
): Array<{ item: BoardItem; values: FormValues }> {
  const boundaries = projectTimelineBoundaryItems(list)
  const updates = new Map<string, { item: BoardItem; values: FormValues }>()

  const updateBoundaryDate = (item: BoardItem | null, sourceDate: Date | null, startColumn: ListColumn | null, endColumn: ListColumn | null): void => {
    if (!item || !sourceDate || !startColumn) return
    const current = updates.get(item.id) ?? { item, values: valuesForItem(item, editableItemColumns(list)) }
    current.values[startColumn.id] = formatProjectDateForMutation(sourceDate, startColumn)
    if (endColumn) current.values[endColumn.id] = formatProjectDateForMutation(sourceDate, endColumn)
    updates.set(item.id, current)
  }

  const currentProjectPlannedStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.plannedStart) : null
  const currentProjectPlannedEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.plannedStart) : null
  const currentProjectActualStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.actualStart) : null
  const currentProjectActualEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.actualStart) : null

  if (childDates.plannedStart && (!currentProjectPlannedStart || childDates.plannedStart.getTime() < currentProjectPlannedStart.getTime())) {
    updateBoundaryDate(boundaries.projectStart, childDates.plannedStart, columns.plannedStart, columns.plannedEnd)
  }
  if (childDates.plannedEnd && (!currentProjectPlannedEnd || childDates.plannedEnd.getTime() > currentProjectPlannedEnd.getTime())) {
    updateBoundaryDate(boundaries.projectEnd, childDates.plannedEnd, columns.plannedStart, columns.plannedEnd)
  }
  if (childDates.actualStart && (!currentProjectActualStart || childDates.actualStart.getTime() < currentProjectActualStart.getTime())) {
    updateBoundaryDate(boundaries.projectStart, childDates.actualStart, columns.actualStart, columns.actualEnd)
  }
  if (childDates.actualEnd && (!currentProjectActualEnd || childDates.actualEnd.getTime() > currentProjectActualEnd.getTime())) {
    updateBoundaryDate(boundaries.projectEnd, childDates.actualEnd, columns.actualStart, columns.actualEnd)
  }

  return Array.from(updates.values())
}

function confineProjectChildDates(values: FormValues, parentChain: BoardItem[], columns: ReturnType<typeof projectDateColumns>): FormValues {
  const nextValues: FormValues = { ...values }
  const confine = (startColumn: ListColumn | null, endColumn: ListColumn | null): void => {
    const lowerBound = parentChain.map((parent) => projectFieldDateValue(parent.values, startColumn)).filter((entry): entry is Date => entry !== null).sort((left, right) => right.getTime() - left.getTime())[0] ?? null
    const upperBound = parentChain.map((parent) => projectFieldDateValue(parent.values, endColumn)).filter((entry): entry is Date => entry !== null).sort((left, right) => left.getTime() - right.getTime())[0] ?? null
    const currentStart = projectFieldDateValue(nextValues, startColumn)
    const currentEnd = projectFieldDateValue(nextValues, endColumn)
    if (startColumn && currentStart && lowerBound && currentStart.getTime() < lowerBound.getTime()) {
      nextValues[startColumn.id] = formatProjectDateForMutation(lowerBound, startColumn)
    }
    if (endColumn && currentEnd && upperBound && currentEnd.getTime() > upperBound.getTime()) {
      nextValues[endColumn.id] = formatProjectDateForMutation(upperBound, endColumn)
    }
  }
  confine(columns.plannedStart, columns.plannedEnd)
  confine(columns.actualStart, columns.actualEnd)
  return nextValues
}

function confineProjectChildDatesToTimeline(list: BoardList, values: FormValues, columns: ReturnType<typeof projectDateColumns>, active: boolean): FormValues {
  if (!active) return values
  const boundaries = projectTimelineBoundaryItems(list)
  const nextValues: FormValues = { ...values }
  const projectPlannedStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.plannedStart) : null
  const projectPlannedEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.plannedStart) : null
  const projectActualStart = boundaries.projectStart ? projectFieldDateValue(boundaries.projectStart.values, columns.actualStart) : null
  const projectActualEnd = boundaries.projectEnd ? projectFieldDateValue(boundaries.projectEnd.values, columns.actualStart) : null

  const confine = (startColumn: ListColumn | null, endColumn: ListColumn | null, lowerBound: Date | null, upperBound: Date | null): void => {
    const currentStart = projectFieldDateValue(nextValues, startColumn)
    const currentEnd = projectFieldDateValue(nextValues, endColumn)
    if (startColumn && currentStart && lowerBound && currentStart.getTime() < lowerBound.getTime()) {
      nextValues[startColumn.id] = formatProjectDateForMutation(lowerBound, startColumn)
    }
    if (endColumn && currentEnd && upperBound && currentEnd.getTime() > upperBound.getTime()) {
      nextValues[endColumn.id] = formatProjectDateForMutation(upperBound, endColumn)
    }
  }

  confine(columns.plannedStart, columns.plannedEnd, projectPlannedStart, projectPlannedEnd)
  confine(columns.actualStart, columns.actualEnd, projectActualStart, projectActualEnd)
  return nextValues
}

function projectTypeColumn(list: BoardList): ListColumn | null {
  return list.columns.find((column) => normalizeColumnName(column.name) === 'type') ?? null
}

function projectItemType(item: BoardItem, list: BoardList): string {
  const typeColumn = projectTypeColumn(list)
  return normalizeColumnName(String((typeColumn ? item.values[typeColumn.id] : 'task') ?? 'task')) || 'task'
}

function isProjectBoundaryType(type: string): boolean {
  return type === 'project start' || type === 'project end'
}

function projectParentEligible(item: BoardItem, list: BoardList): boolean {
  return list.templateType === 'project' ? projectItemType(item, list) === 'task' : true
}

function projectItemMap(list: BoardList): Map<string, BoardItem> {
  return new Map(list.items.map((item) => [item.id, item]))
}

function projectOrderingDate(item: BoardItem, list: BoardList): Date | null {
  const columns = projectDateColumns(list)
  return (
    projectFieldDateValue(item.values, columns.actualEnd) ??
    projectFieldDateValue(item.values, columns.plannedEnd) ??
    projectFieldDateValue(item.values, columns.actualStart) ??
    projectFieldDateValue(item.values, columns.plannedStart)
  )
}

function projectPlannedCompletionDate(item: BoardItem, list: BoardList): Date | null {
  const columns = projectDateColumns(list)
  return projectFieldDateValue(item.values, columns.plannedEnd) ?? projectFieldDateValue(item.values, columns.plannedStart)
}

function projectLatestSubtreePlannedDate(list: BoardList, item: BoardItem): Date | null {
  const candidateDates = [projectPlannedCompletionDate(item, list)]
  for (const descendantId of projectDescendantIds(list, item.id)) {
    const descendant = list.items.find((entry) => entry.id === descendantId)
    if (descendant) candidateDates.push(projectPlannedCompletionDate(descendant, list))
  }
  return candidateDates.filter((entry): entry is Date => entry !== null).sort((left, right) => right.getTime() - left.getTime())[0] ?? null
}

function projectLatestDependencyPlannedDate(list: BoardList, dependencyItemIds: string[]): Date | null {
  return dependencyItemIds
    .map((dependencyId) => list.items.find((item) => item.id === dependencyId))
    .filter((item): item is BoardItem => item !== undefined)
    .map((item) => projectLatestSubtreePlannedDate(list, item))
    .filter((entry): entry is Date => entry !== null)
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null
}

function projectDependencyAnchor(list: BoardList, item: BoardItem, peers: BoardItem[]): BoardItem | null {
  if (!isProjectMilestoneLikeType(projectItemType(item, list)) || item.dependencyItemIds.length === 0) return null
  const itemsById = projectItemMap(list)
  const peerSubtrees = peers
    .filter((peer) => peer.id !== item.id)
    .map((peer) => ({ peer, ids: new Set<string>([peer.id, ...projectDescendantIds(list, peer.id)]) }))

  let anchor: BoardItem | null = null
  let latestDate = Number.NEGATIVE_INFINITY
  let latestIndex = -1

  for (const dependencyId of item.dependencyItemIds) {
    const dependency = itemsById.get(dependencyId)
    if (!dependency) continue
    const peerIndex = peerSubtrees.findIndex((candidate) => candidate.ids.has(dependencyId))
    if (peerIndex < 0) continue
    const dependencyDate = projectOrderingDate(dependency, list)?.getTime() ?? Number.NEGATIVE_INFINITY
    if (dependencyDate > latestDate || (dependencyDate === latestDate && peerIndex > latestIndex)) {
      anchor = peerSubtrees[peerIndex].peer
      latestDate = dependencyDate
      latestIndex = peerIndex
    }
  }

  return anchor
}

function projectOrderedPeerItems(list: BoardList, items: BoardItem[]): BoardItem[] {
  const ordered = [...items].sort((left, right) => left.order - right.order)
  const milestoneItems = ordered.filter((item) => isProjectMilestoneLikeType(projectItemType(item, list)))

  for (const milestone of milestoneItems) {
    const anchor = projectDependencyAnchor(list, milestone, ordered)
    if (!anchor || anchor.id === milestone.id) continue
    const currentIndex = ordered.findIndex((candidate) => candidate.id === milestone.id)
    const anchorIndex = ordered.findIndex((candidate) => candidate.id === anchor.id)
    if (currentIndex < 0 || anchorIndex < 0 || currentIndex === anchorIndex + 1) continue
    const [entry] = ordered.splice(currentIndex, 1)
    const nextAnchorIndex = ordered.findIndex((candidate) => candidate.id === anchor.id)
    ordered.splice(nextAnchorIndex + 1, 0, entry)
  }

  return ordered
}

function projectChildItems(list: BoardList, parentItemId: string, groupId: string | null): BoardItem[] {
  return projectOrderedPeerItems(
    list,
    list.items.filter((item) => item.parentItemId === parentItemId && item.groupId === groupId && !isProjectMilestoneLikeType(projectItemType(item, list)))
  )
}

function appendProjectRows(rows: ProjectBoardRow[], list: BoardList, item: BoardItem, depth: number, groupId: string | null): void {
  rows.push({ kind: 'item', item, depth })
  for (const child of projectChildItems(list, item.id, groupId)) {
    appendProjectRows(rows, list, child, depth + 1, groupId)
  }
}

function projectDescendantIds(list: BoardList, itemId: string): Set<string> {
  const descendants = new Set<string>()
  const queue = [itemId]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue
    for (const child of list.items.filter((item) => item.parentItemId === current)) {
      if (descendants.has(child.id)) continue
      descendants.add(child.id)
      queue.push(child.id)
    }
  }
  return descendants
}

function projectTimelineLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}
