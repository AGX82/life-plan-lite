import type { BoardList, BoardWidget, BoardWidgetConfig, ListTemplateType, WidgetType } from '@shared/domain'
import { clamp, widgetAspectSpec, widgetGridForScale, widgetScaleBounds } from '../widgets'

const MIN_LIST_GRID_WIDTH = 2
const MIN_LIST_GRID_HEIGHT = 2

type LayoutGrid = BoardList['grid']
type WidgetGrid = BoardWidget['grid']

type LayoutElement =
  | { kind: 'list'; id: string; grid: LayoutGrid; list: BoardList }
  | { kind: 'widget'; id: string; grid: WidgetGrid; widget: BoardWidget }

type MixedLayoutChange = {
  grid: LayoutGrid
  movedLists: { list: BoardList; grid: LayoutGrid }[]
  movedWidgets: { widget: BoardWidget; grid: WidgetGrid }[]
}

export function placeListForDisplay(
  lists: BoardList[],
  widgets: BoardWidget[],
  listId: string,
  preferredGrid: LayoutGrid
): { grid: LayoutGrid; moved: { list: BoardList; grid: LayoutGrid }[] } | null {
  const others = lists.filter((list) => list.id !== listId && list.displayEnabled && validDisplayGrid(list.grid))
  const widgetGrids = widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)
  const normalized = normalizeDisplayGrid(preferredGrid)
  if (canPlaceAgainst(normalized, [...others.map((list) => list.grid), ...widgetGrids])) return { grid: normalized, moved: [] }

  const open = firstOpenSlot([...others.map((list) => list.grid), ...widgetGrids])
  if (open) return { grid: open, moved: [] }

  const pushed = pushRightPlacement(others, widgetGrids)
  return pushed ? { grid: pushed.grid, moved: pushed.moved } : null
}

export function placeListForDisplaySizes(
  lists: BoardList[],
  widgets: BoardWidget[],
  listId: string,
  sizes: Array<Pick<LayoutGrid, 'w' | 'h'>>
): { grid: LayoutGrid; moved: { list: BoardList; grid: LayoutGrid }[] } | null {
  const others = lists.filter((list) => list.id !== listId && list.displayEnabled && validDisplayGrid(list.grid))
  const occupied = [...others.map((list) => list.grid), ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)]
  for (const size of sizes) {
    for (let y = 1; y <= 9 - size.h; y += 1) {
      for (let x = 1; x <= 17 - size.w; x += 1) {
        const candidate = { x, y, w: size.w, h: size.h }
        if (canPlaceAgainst(candidate, occupied)) return { grid: candidate, moved: [] }
      }
    }
  }
  return placeListForDisplay(lists, widgets, listId, { x: 1, y: 1, ...sizes[sizes.length - 1] })
}

export function listTemplateGridSizes(templateType: ListTemplateType): Array<Pick<LayoutGrid, 'w' | 'h'>> {
  if (templateType === 'todo') return [{ w: 6, h: 4 }, { w: 6, h: 3 }, { w: 6, h: 2 }, { w: 5, h: 4 }, { w: 5, h: 3 }, { w: 5, h: 2 }, { w: 4, h: 3 }, { w: 4, h: 2 }]
  if (templateType === 'shopping_list') return [{ w: 4, h: 4 }, { w: 4, h: 3 }, { w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }]
  if (templateType === 'project') return [{ w: 10, h: 4 }, { w: 10, h: 3 }, { w: 11, h: 4 }, { w: 12, h: 4 }, { w: 10, h: 2 }]
  if (templateType === 'health') return [{ w: 5, h: 4 }, { w: 5, h: 3 }, { w: 4, h: 4 }, { w: 4, h: 3 }, { w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }]
  if (templateType === 'wishlist' || templateType === 'birthday_calendar') {
    return [{ w: 6, h: 4 }, { w: 6, h: 3 }, { w: 5, h: 4 }, { w: 5, h: 3 }, { w: 4, h: 4 }, { w: 4, h: 3 }, { w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }]
  }
  return [{ w: 4, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 2 }]
}

export function validDisplayGrid(grid: LayoutGrid): boolean {
  return grid.x >= 1 && grid.y >= 1 && grid.w >= MIN_LIST_GRID_WIDTH && grid.h >= MIN_LIST_GRID_HEIGHT && grid.x + grid.w <= 17 && grid.y + grid.h <= 9
}

export function resolveListGridChange(
  list: BoardList,
  candidate: LayoutGrid,
  lists: BoardList[],
  widgets: BoardWidget[]
): { grid: LayoutGrid; moved: { list: BoardList; grid: LayoutGrid }[]; movedWidgets?: { widget: BoardWidget; grid: WidgetGrid }[]; message?: string } | null {
  const normalized = normalizeDisplayGrid(candidate)
  if (canPlaceGrid(normalized, lists, widgets, list.id)) return { grid: normalized, moved: [] }

  const mixedHorizontalReflow = resolveHorizontalMixedReflow({ kind: 'list', id: list.id, grid: list.grid, list }, normalized, lists, widgets)
  if (mixedHorizontalReflow) return { grid: mixedHorizontalReflow.grid, moved: mixedHorizontalReflow.movedLists, movedWidgets: mixedHorizontalReflow.movedWidgets }

  const mixedVerticalReflow = resolveVerticalMixedReflow({ kind: 'list', id: list.id, grid: list.grid, list }, normalized, lists, widgets)
  if (mixedVerticalReflow) return { grid: mixedVerticalReflow.grid, moved: mixedVerticalReflow.movedLists, movedWidgets: mixedVerticalReflow.movedWidgets }

  const overlappingLists = lists.filter((entry) => entry.displayEnabled && entry.id !== list.id && validDisplayGrid(entry.grid) && gridsOverlap(normalized, entry.grid))
  const overlappingWidgets = widgets.filter((entry) => entry.displayEnabled && validWidgetGrid(entry.grid) && gridsOverlap(normalized, entry.grid))

  const horizontalReflow = resolveHorizontalListReflow(list, normalized, lists, widgets)
  if (horizontalReflow) return horizontalReflow

  const verticalReflow = resolveVerticalListReflow(list, normalized, lists, widgets)
  if (verticalReflow) return verticalReflow

  const bestEffortMove = resolveBestEffortListMove(list, normalized, lists, widgets)
  if (bestEffortMove) return bestEffortMove

  const mixedOverlaps = [
    ...overlappingLists.map((entry) => ({ kind: 'list' as const, id: entry.id, grid: entry.grid, list: entry })),
    ...overlappingWidgets.map((entry) => ({ kind: 'widget' as const, id: entry.id, grid: entry.grid, widget: entry }))
  ]
  if (mixedOverlaps.length === 1) {
    const mixedSwap = resolveMixedSwap({ kind: 'list', id: list.id, grid: list.grid, list }, normalized, mixedOverlaps[0], lists, widgets)
    if (mixedSwap) return { grid: mixedSwap.grid, moved: mixedSwap.movedLists, movedWidgets: mixedSwap.movedWidgets }
  }

  if (overlappingLists.length === 1) {
    const target = overlappingLists[0]
    if (sameGridSize(normalized, target.grid)) {
      const swappedTargetGrid = { ...target.grid, x: list.grid.x, y: list.grid.y }
      const remainingLists = lists.filter((entry) => entry.id !== list.id && entry.id !== target.id)
      const canSwap =
        canPlaceAgainst(swappedTargetGrid, [...remainingLists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid), ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)]) &&
        canPlaceAgainst(normalized, [...remainingLists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid), ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)])

      if (canSwap) return { grid: normalized, moved: [{ list: target, grid: swappedTargetGrid }] }
    }

    return {
      grid: list.grid,
      moved: [],
      message: 'You are attempting to swap positions of two lists of different sizes. Position swapping is only possible if the two items are of the same size.'
    }
  }

  return null
}

export function resolveWidgetGridChange(
  widget: BoardWidget,
  candidate: WidgetGrid,
  widgets: BoardWidget[],
  lists: BoardList[]
): { grid: WidgetGrid; moved: { widget: BoardWidget; grid: WidgetGrid }[]; movedLists?: { list: BoardList; grid: LayoutGrid }[] } | null {
  if (canPlaceWidgetGrid(candidate, lists, widgets, widget.id, widget.type, widget.config)) return { grid: candidate, moved: [] }

  const mixedHorizontalReflow = resolveHorizontalMixedReflow({ kind: 'widget', id: widget.id, grid: widget.grid, widget }, candidate, lists, widgets)
  if (mixedHorizontalReflow) return { grid: mixedHorizontalReflow.grid, moved: mixedHorizontalReflow.movedWidgets, movedLists: mixedHorizontalReflow.movedLists }

  const mixedVerticalReflow = resolveVerticalMixedReflow({ kind: 'widget', id: widget.id, grid: widget.grid, widget }, candidate, lists, widgets)
  if (mixedVerticalReflow) return { grid: mixedVerticalReflow.grid, moved: mixedVerticalReflow.movedWidgets, movedLists: mixedVerticalReflow.movedLists }

  const overlappingWidgets = widgets.filter((entry) => entry.displayEnabled && entry.id !== widget.id && validWidgetGrid(entry.grid) && gridsOverlap(candidate, entry.grid))
  const overlappingLists = lists.filter((entry) => entry.displayEnabled && validDisplayGrid(entry.grid) && gridsOverlap(candidate, entry.grid))

  const horizontalReflow = resolveHorizontalWidgetReflow(widget, candidate, widgets, lists)
  if (horizontalReflow) return horizontalReflow

  const verticalReflow = resolveVerticalWidgetReflow(widget, candidate, widgets, lists)
  if (verticalReflow) return verticalReflow

  const bestEffortMove = resolveBestEffortWidgetMove(widget, candidate, widgets, lists)
  if (bestEffortMove) return bestEffortMove

  const mixedOverlaps = [
    ...overlappingWidgets.map((entry) => ({ kind: 'widget' as const, id: entry.id, grid: entry.grid, widget: entry })),
    ...overlappingLists.map((entry) => ({ kind: 'list' as const, id: entry.id, grid: entry.grid, list: entry }))
  ]
  if (mixedOverlaps.length === 1) {
    const mixedSwap = resolveMixedSwap({ kind: 'widget', id: widget.id, grid: widget.grid, widget }, candidate, mixedOverlaps[0], lists, widgets)
    if (mixedSwap) return { grid: mixedSwap.grid, moved: mixedSwap.movedWidgets, movedLists: mixedSwap.movedLists }
  }

  if (overlappingWidgets.length === 1) {
    const target = overlappingWidgets[0]
    if (sameGridSize(candidate, target.grid)) {
      const swappedTargetGrid = { ...target.grid, x: widget.grid.x, y: widget.grid.y }
      const remainingWidgets = widgets.filter((entry) => entry.id !== widget.id && entry.id !== target.id)
      const canSwap =
        canPlaceAgainst(swappedTargetGrid, [...lists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid), ...remainingWidgets.filter((entry) => entry.displayEnabled).map((entry) => entry.grid)]) &&
        canPlaceAgainst(candidate, [...lists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid), ...remainingWidgets.filter((entry) => entry.displayEnabled).map((entry) => entry.grid)])

      if (canSwap) return { grid: candidate, moved: [{ widget: target, grid: swappedTargetGrid }] }
    }
  }

  return null
}

export function pointerMoveGrid(grid: LayoutGrid, rect: DOMRect, pointerX: number, pointerY: number): LayoutGrid {
  const unitW = rect.width / 16
  const unitH = rect.height / 8
  const centeredX = Math.round((pointerX - rect.left) / unitW - grid.w / 2 + 0.5) + 1
  const centeredY = Math.round((pointerY - rect.top) / unitH - grid.h / 2 + 0.5) + 1
  return {
    ...grid,
    x: clamp(centeredX, 1, 17 - grid.w),
    y: clamp(centeredY, 1, 9 - grid.h)
  }
}

export function resizeGrid(
  grid: LayoutGrid,
  handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
  dx: number,
  dy: number
): LayoutGrid {
  let next = { ...grid }
  if (handle.includes('e')) next.w = clamp(grid.w + dx, MIN_LIST_GRID_WIDTH, 17 - grid.x)
  if (handle.includes('s')) next.h = clamp(grid.h + dy, MIN_LIST_GRID_HEIGHT, 9 - grid.y)
  if (handle.includes('w')) {
    const newX = clamp(grid.x + dx, 1, grid.x + grid.w - MIN_LIST_GRID_WIDTH)
    next = { ...next, x: newX, w: grid.w + (grid.x - newX) }
  }
  if (handle.includes('n')) {
    const newY = clamp(grid.y + dy, 1, grid.y + grid.h - MIN_LIST_GRID_HEIGHT)
    next = { ...next, y: newY, h: grid.h + (grid.y - newY) }
  }
  return next
}

export function pointerMoveWidgetGridWithOffset(
  grid: WidgetGrid,
  rect: DOMRect,
  pointerX: number,
  pointerY: number,
  offsetX: number,
  offsetY: number
): WidgetGrid {
  const unitW = rect.width / 16
  const unitH = rect.height / 8
  const left = pointerX - rect.left - offsetX
  const top = pointerY - rect.top - offsetY
  const x = Math.round(left / unitW) + 1
  const y = Math.round(top / unitH) + 1
  return {
    ...grid,
    x: clamp(x, 1, 17 - grid.w),
    y: clamp(y, 1, 9 - grid.h)
  }
}

export function resizeWidgetGrid(
  grid: WidgetGrid,
  type: WidgetType,
  config: BoardWidgetConfig,
  handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
  dx: number,
  dy: number
): WidgetGrid {
  let raw = { ...grid }
  if (handle.includes('e')) raw.w = clamp(grid.w + dx, 1, 17 - grid.x)
  if (handle.includes('s')) raw.h = clamp(grid.h + dy, 1, 9 - grid.y)
  if (handle.includes('w')) {
    const newX = clamp(grid.x + dx, 1, grid.x + grid.w - 1)
    raw = { ...raw, x: newX, w: grid.w + (grid.x - newX) }
  }
  if (handle.includes('n')) {
    const newY = clamp(grid.y + dy, 1, grid.y + grid.h - 1)
    raw = { ...raw, y: newY, h: grid.h + (grid.y - newY) }
  }

  const spec = widgetAspectSpec(type, config)
  const scaleBounds = widgetScaleBounds(spec)
  const widthDrivenScale = raw.w / spec.ratioW
  const heightDrivenScale = raw.h / spec.ratioH
  const desiredScale =
    handle === 'e' || handle === 'w'
      ? widthDrivenScale
      : handle === 'n' || handle === 's'
        ? heightDrivenScale
        : Math.max(widthDrivenScale, heightDrivenScale)

  const maxWidth = handle.includes('w') ? grid.x + grid.w - 1 : 17 - grid.x
  const maxHeight = handle.includes('n') ? grid.y + grid.h - 1 : 9 - grid.y
  const maxScale = Math.max(scaleBounds.min, Math.min(scaleBounds.max, Math.floor(maxWidth / spec.ratioW), Math.floor(maxHeight / spec.ratioH)))
  const scale = clamp(Math.round(desiredScale), scaleBounds.min, maxScale)
  const sized = widgetGridForScale(spec, scale)
  const x = handle.includes('w') ? grid.x + grid.w - sized.w : grid.x
  const y = handle.includes('n') ? grid.y + grid.h - sized.h : grid.y

  return {
    x: clamp(x, 1, 17 - sized.w),
    y: clamp(y, 1, 9 - sized.h),
    ...sized
  }
}

export function normalizeWidgetDisplayGrid(grid: WidgetGrid, type: WidgetType, config: BoardWidgetConfig): WidgetGrid {
  const spec = widgetAspectSpec(type, config)
  const scaleBounds = widgetScaleBounds(spec)
  const desiredScale = Math.max(grid.w / spec.ratioW, grid.h / spec.ratioH)
  const scale = clamp(Math.round(desiredScale), scaleBounds.min, scaleBounds.max)
  const { w, h } = widgetGridForScale(spec, scale)
  return {
    x: clamp(grid.x, 1, 17 - w),
    y: clamp(grid.y, 1, 9 - h),
    w,
    h
  }
}

export function canPlaceWidgetGrid(
  grid: WidgetGrid,
  lists: BoardList[],
  widgets: BoardWidget[],
  currentWidgetId: string,
  type: WidgetType,
  config: BoardWidgetConfig
): boolean {
  const normalized = normalizeWidgetDisplayGrid(grid, type, config)
  return !lists.some((list) => list.displayEnabled && gridsOverlap(normalized, list.grid)) &&
    !widgets.some((widget) => widget.displayEnabled && widget.id !== currentWidgetId && gridsOverlap(normalized, widget.grid))
}

function nextOpenDisplaySlot(lists: BoardList[]): LayoutGrid | null {
  const occupied = lists.filter((list) => list.displayEnabled && validDisplayGrid(list.grid)).map((list) => list.grid)
  for (let y = 1; y <= 9 - MIN_LIST_GRID_HEIGHT; y += MIN_LIST_GRID_HEIGHT) {
    for (let x = 1; x <= 17 - MIN_LIST_GRID_WIDTH; x += 1) {
      const candidate = { x, y, w: MIN_LIST_GRID_WIDTH, h: MIN_LIST_GRID_HEIGHT }
      if (!occupied.some((grid) => gridsOverlap(grid, candidate))) return candidate
    }
  }
  return null
}

function pushRightPlacement(
  lists: BoardList[],
  occupiedExternal: LayoutGrid[]
): { grid: LayoutGrid; moved: { list: BoardList; grid: LayoutGrid }[] } | null {
  for (let y = 1; y <= 9 - MIN_LIST_GRID_HEIGHT; y += MIN_LIST_GRID_HEIGHT) {
    const rowLists = lists
      .filter((list) => list.grid.y <= y && y + MIN_LIST_GRID_HEIGHT - 1 < list.grid.y + list.grid.h)
      .sort((a, b) => a.grid.x - b.grid.x)
    const allRowGrids = [...lists.filter((list) => !rowLists.includes(list)).map((list) => list.grid), ...occupiedExternal]

    for (let insertX = 1; insertX <= 17 - MIN_LIST_GRID_WIDTH; insertX += 1) {
      const candidate = { x: insertX, y, w: MIN_LIST_GRID_WIDTH, h: MIN_LIST_GRID_HEIGHT }
      const moved: { list: BoardList; grid: LayoutGrid }[] = []
      const rowGrids = rowLists.map((list) => ({ list, grid: { ...list.grid } }))

      let changed = true
      while (changed && rowGrids.some((entry) => gridsOverlap(entry.grid, candidate))) {
        changed = false
        const overlapping = rowGrids.filter((entry) => gridsOverlap(entry.grid, candidate)).sort((a, b) => b.grid.x - a.grid.x)[0]
        if (!overlapping) break
        const blocking = rightBlockingEntry(overlapping, rowGrids)
        const target = blocking ?? overlapping
        if (target.grid.x + target.grid.w > 16) break
        target.grid = { ...target.grid, x: target.grid.x + 1 }
        changed = true
      }

      const nextRow = rowGrids.map((entry) => entry.grid)
      if (canPlaceAgainst(candidate, [...allRowGrids, ...nextRow]) && nextRow.every((grid, index) => !nextRow.some((other, otherIndex) => index !== otherIndex && gridsOverlap(grid, other)))) {
        for (const entry of rowGrids) {
          const original = entry.list.grid
          if (entry.grid.x !== original.x || entry.grid.y !== original.y || entry.grid.w !== original.w || entry.grid.h !== original.h) {
            moved.push({ list: entry.list, grid: entry.grid })
          }
        }
        return { grid: candidate, moved }
      }
    }
  }
  return null
}

function rightBlockingEntry(
  entry: { list: BoardList; grid: LayoutGrid },
  row: { list: BoardList; grid: LayoutGrid }[]
): { list: BoardList; grid: LayoutGrid } | null {
  return row.filter((candidate) => candidate.list.id !== entry.list.id && candidate.grid.x >= entry.grid.x + entry.grid.w).sort((a, b) => a.grid.x - b.grid.x)[0] ?? null
}

function firstOpenSlot(occupied: LayoutGrid[]): LayoutGrid | null {
  for (let y = 1; y <= 9 - MIN_LIST_GRID_HEIGHT; y += MIN_LIST_GRID_HEIGHT) {
    for (let x = 1; x <= 17 - MIN_LIST_GRID_WIDTH; x += 1) {
      const candidate = { x, y, w: MIN_LIST_GRID_WIDTH, h: MIN_LIST_GRID_HEIGHT }
      if (canPlaceAgainst(candidate, occupied)) return candidate
    }
  }
  return null
}

function normalizeDisplayGrid(grid: LayoutGrid): LayoutGrid {
  if (!validDisplayGrid(grid)) return { x: 1, y: 1, w: MIN_LIST_GRID_WIDTH, h: MIN_LIST_GRID_HEIGHT }
  return { x: grid.x, y: grid.y, w: Math.max(MIN_LIST_GRID_WIDTH, grid.w), h: Math.max(MIN_LIST_GRID_HEIGHT, grid.h) }
}

function canPlaceAgainst(grid: LayoutGrid, occupied: LayoutGrid[]): boolean {
  return validDisplayGrid(grid) && !occupied.some((candidate) => gridsOverlap(grid, candidate))
}

function canPlaceGrid(grid: LayoutGrid, lists: BoardList[], widgets: BoardWidget[], currentListId: string): boolean {
  if (grid.x < 1 || grid.y < 1 || grid.w < MIN_LIST_GRID_WIDTH || grid.h < MIN_LIST_GRID_HEIGHT) return false
  if (grid.x + grid.w > 17 || grid.y + grid.h > 9) return false
  return !lists.some((list) => list.displayEnabled && list.id !== currentListId && gridsOverlap(grid, list.grid)) &&
    !widgets.some((widget) => widget.displayEnabled && gridsOverlap(grid, widget.grid))
}

function gridsOverlap(a: LayoutGrid, b: LayoutGrid): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function sameGridSize(a: LayoutGrid, b: LayoutGrid): boolean {
  return a.w === b.w && a.h === b.h
}

function sameGridPosition(a: LayoutGrid, b: LayoutGrid): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
}

function sameRowBand(a: LayoutGrid, b: LayoutGrid): boolean {
  return a.y === b.y && a.h === b.h
}

function sameColumnBand(a: LayoutGrid, b: LayoutGrid): boolean {
  return a.x === b.x && a.w === b.w
}

function validWidgetGrid(grid: WidgetGrid): boolean {
  return grid.x >= 1 && grid.y >= 1 && grid.w >= 2 && grid.h >= 2 && grid.x + grid.w <= 17 && grid.y + grid.h <= 9
}

function allLayoutElements(lists: BoardList[], widgets: BoardWidget[]): LayoutElement[] {
  return [
    ...lists.filter((entry) => entry.displayEnabled).map((list) => ({ kind: 'list' as const, id: list.id, grid: list.grid, list })),
    ...widgets.filter((entry) => entry.displayEnabled).map((widget) => ({ kind: 'widget' as const, id: widget.id, grid: widget.grid, widget }))
  ]
}

function validLayoutGrid(element: LayoutElement): boolean {
  return element.kind === 'list' ? validDisplayGrid(element.grid) : validWidgetGrid(element.grid)
}

function resolveHorizontalListReflow(
  list: BoardList,
  candidate: LayoutGrid,
  lists: BoardList[],
  widgets: BoardWidget[]
): { grid: LayoutGrid; moved: { list: BoardList; grid: LayoutGrid }[] } | null {
  if (candidate.y !== list.grid.y || candidate.h !== list.grid.h) return null
  const rowPeers = lists.filter((entry) => entry.displayEnabled && entry.id !== list.id && validDisplayGrid(entry.grid) && sameRowBand(entry.grid, list.grid)).sort((a, b) => a.grid.x - b.grid.x)
  if (rowPeers.length === 0) return null
  const peers = affectedHorizontalPeers(list, candidate, rowPeers)
  if (peers.length === 0) return null
  const overlappingPeers = peers.filter((entry) => gridsOverlap(entry.grid, candidate))
  const desiredOrder = [...peers]
  const insertIndex = horizontalInsertIndex(list, candidate, desiredOrder, overlappingPeers)
  desiredOrder.splice(insertIndex, 0, list)
  const positioned = positionHorizontalRun(desiredOrder, list.id, candidate)
  const occupiedExternal = [...lists.filter((entry) => entry.displayEnabled && entry.id !== list.id && !peers.some((peer) => peer.id === entry.id)).map((entry) => entry.grid), ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)]
  if (!validatePositionedRun(positioned, occupiedExternal)) return null
  return positionedResult(list.id, positioned)
}

function resolveHorizontalWidgetReflow(
  widget: BoardWidget,
  candidate: WidgetGrid,
  widgets: BoardWidget[],
  lists: BoardList[]
): { grid: WidgetGrid; moved: { widget: BoardWidget; grid: WidgetGrid }[] } | null {
  if (candidate.y !== widget.grid.y || candidate.h !== widget.grid.h) return null
  const rowPeers = widgets.filter((entry) => entry.displayEnabled && entry.id !== widget.id && validWidgetGrid(entry.grid) && sameRowBand(entry.grid, widget.grid)).sort((a, b) => a.grid.x - b.grid.x)
  if (rowPeers.length === 0) return null
  const peers = affectedHorizontalWidgetPeers(widget, candidate, rowPeers)
  if (peers.length === 0) return null
  const overlappingPeers = peers.filter((entry) => gridsOverlap(entry.grid, candidate))
  const desiredOrder = [...peers]
  const insertIndex = horizontalWidgetInsertIndex(widget, candidate, desiredOrder, overlappingPeers)
  desiredOrder.splice(insertIndex, 0, widget)
  const positioned = positionHorizontalWidgetRun(desiredOrder, widget.id, candidate)
  const occupiedExternal = [...lists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid), ...widgets.filter((entry) => entry.displayEnabled && entry.id !== widget.id && !peers.some((peer) => peer.id === entry.id)).map((entry) => entry.grid)]
  if (!validateWidgetPositionedRun(positioned, occupiedExternal)) return null
  return widgetPositionedResult(widget.id, positioned)
}

function resolveHorizontalMixedReflow(moving: LayoutElement, candidate: LayoutGrid, lists: BoardList[], widgets: BoardWidget[]): MixedLayoutChange | null {
  if (candidate.y !== moving.grid.y || candidate.h !== moving.grid.h) return null
  const peers = allLayoutElements(lists, widgets).filter((entry) => entry.id !== moving.id && sameRowBand(entry.grid, moving.grid) && validLayoutGrid(entry)).sort((a, b) => a.grid.x - b.grid.x)
  if (peers.length === 0) return null
  const corridorStart = Math.min(moving.grid.x, candidate.x)
  const corridorEnd = Math.max(moving.grid.x + moving.grid.w - 1, candidate.x + candidate.w - 1)
  const affected = peers.filter((entry) => rangesOverlap(entry.grid.x, entry.grid.x + entry.grid.w - 1, corridorStart, corridorEnd))
  if (affected.length === 0) return null
  const overlappingPeers = affected.filter((entry) => gridsOverlap(entry.grid, candidate))
  const ordered = [...affected]
  const insertIndex = genericInsertIndex(moving, candidate, ordered, overlappingPeers, 'horizontal')
  ordered.splice(insertIndex, 0, moving)
  const positioned = positionHorizontalMixedRun(ordered, moving.id, candidate)
  const affectedIds = new Set(affected.map((entry) => entry.id))
  const occupiedExternal = allLayoutElements(lists, widgets).filter((entry) => entry.id !== moving.id && !affectedIds.has(entry.id)).map((entry) => entry.grid)
  if (!validateMixedPositionedRun(positioned, occupiedExternal)) return null
  return mixedPositionedResult(moving.id, positioned)
}

function horizontalInsertIndex(list: BoardList, candidate: LayoutGrid, orderedPeers: BoardList[], overlappingPeers: BoardList[]): number {
  if (overlappingPeers.length > 0) {
    if (candidate.x > list.grid.x) return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[overlappingPeers.length - 1].id) + 1
    if (candidate.x < list.grid.x) return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[0].id)
  }
  const candidateCenter = candidate.x + candidate.w / 2
  const byCenter = orderedPeers.findIndex((entry) => candidateCenter < entry.grid.x + entry.grid.w / 2)
  return byCenter === -1 ? orderedPeers.length : byCenter
}

function positionHorizontalRun(ordered: BoardList[], movingListId: string, candidate: LayoutGrid): { list: BoardList; grid: LayoutGrid }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingListId)
  const placed = new Map<string, LayoutGrid>()
  placed.set(movingListId, { ...candidate })
  let nextX = candidate.x
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextX -= entry.grid.w
    placed.set(entry.id, { ...entry.grid, x: nextX, y: candidate.y })
  }
  let trailingX = candidate.x + candidate.w
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: trailingX, y: candidate.y })
    trailingX += entry.grid.w
  }
  const positioned = ordered.map((entry) => ({ list: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minX = Math.min(...positioned.map((entry) => entry.grid.x))
  if (minX < 1) for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x + (1 - minX) }
  const maxX = Math.max(...positioned.map((entry) => entry.grid.x + entry.grid.w - 1))
  if (maxX > 16) for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x - (maxX - 16) }
  return positioned
}

function positionHorizontalWidgetRun(ordered: BoardWidget[], movingWidgetId: string, candidate: WidgetGrid): { widget: BoardWidget; grid: WidgetGrid }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingWidgetId)
  const placed = new Map<string, WidgetGrid>()
  placed.set(movingWidgetId, { ...candidate })
  let nextX = candidate.x
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextX -= entry.grid.w
    placed.set(entry.id, { ...entry.grid, x: nextX, y: candidate.y })
  }
  let trailingX = candidate.x + candidate.w
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: trailingX, y: candidate.y })
    trailingX += entry.grid.w
  }
  const positioned = ordered.map((entry) => ({ widget: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minX = Math.min(...positioned.map((entry) => entry.grid.x))
  if (minX < 1) for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x + (1 - minX) }
  const maxX = Math.max(...positioned.map((entry) => entry.grid.x + entry.grid.w - 1))
  if (maxX > 16) for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x - (maxX - 16) }
  return positioned
}

function resolveVerticalListReflow(list: BoardList, candidate: LayoutGrid, lists: BoardList[], widgets: BoardWidget[]): { grid: LayoutGrid; moved: { list: BoardList; grid: LayoutGrid }[] } | null {
  if (candidate.x !== list.grid.x || candidate.w !== list.grid.w) return null
  const columnPeers = lists.filter((entry) => entry.displayEnabled && entry.id !== list.id && validDisplayGrid(entry.grid) && sameColumnBand(entry.grid, list.grid)).sort((a, b) => a.grid.y - b.grid.y)
  if (columnPeers.length === 0) return null
  const peers = affectedVerticalPeers(list, candidate, columnPeers)
  if (peers.length === 0) return null
  const overlappingPeers = peers.filter((entry) => gridsOverlap(entry.grid, candidate))
  const desiredOrder = [...peers]
  const insertIndex = verticalInsertIndex(list, candidate, desiredOrder, overlappingPeers)
  desiredOrder.splice(insertIndex, 0, list)
  const positioned = positionVerticalRun(desiredOrder, list.id, candidate)
  const occupiedExternal = [...lists.filter((entry) => entry.displayEnabled && entry.id !== list.id && !peers.some((peer) => peer.id === entry.id)).map((entry) => entry.grid), ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)]
  if (!validatePositionedRun(positioned, occupiedExternal)) return null
  return positionedResult(list.id, positioned)
}

function resolveVerticalWidgetReflow(widget: BoardWidget, candidate: WidgetGrid, widgets: BoardWidget[], lists: BoardList[]): { grid: WidgetGrid; moved: { widget: BoardWidget; grid: WidgetGrid }[] } | null {
  if (candidate.x !== widget.grid.x || candidate.w !== widget.grid.w) return null
  const columnPeers = widgets.filter((entry) => entry.displayEnabled && entry.id !== widget.id && validWidgetGrid(entry.grid) && sameColumnBand(entry.grid, widget.grid)).sort((a, b) => a.grid.y - b.grid.y)
  if (columnPeers.length === 0) return null
  const peers = affectedVerticalWidgetPeers(widget, candidate, columnPeers)
  if (peers.length === 0) return null
  const overlappingPeers = peers.filter((entry) => gridsOverlap(entry.grid, candidate))
  const desiredOrder = [...peers]
  const insertIndex = verticalWidgetInsertIndex(widget, candidate, desiredOrder, overlappingPeers)
  desiredOrder.splice(insertIndex, 0, widget)
  const positioned = positionVerticalWidgetRun(desiredOrder, widget.id, candidate)
  const occupiedExternal = [...lists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid), ...widgets.filter((entry) => entry.displayEnabled && entry.id !== widget.id && !peers.some((peer) => peer.id === entry.id)).map((entry) => entry.grid)]
  if (!validateWidgetPositionedRun(positioned, occupiedExternal)) return null
  return widgetPositionedResult(widget.id, positioned)
}

function resolveVerticalMixedReflow(moving: LayoutElement, candidate: LayoutGrid, lists: BoardList[], widgets: BoardWidget[]): MixedLayoutChange | null {
  if (candidate.x !== moving.grid.x || candidate.w !== moving.grid.w) return null
  const peers = allLayoutElements(lists, widgets).filter((entry) => entry.id !== moving.id && sameColumnBand(entry.grid, moving.grid) && validLayoutGrid(entry)).sort((a, b) => a.grid.y - b.grid.y)
  if (peers.length === 0) return null
  const corridorStart = Math.min(moving.grid.y, candidate.y)
  const corridorEnd = Math.max(moving.grid.y + moving.grid.h - 1, candidate.y + candidate.h - 1)
  const affected = peers.filter((entry) => rangesOverlap(entry.grid.y, entry.grid.y + entry.grid.h - 1, corridorStart, corridorEnd))
  if (affected.length === 0) return null
  const overlappingPeers = affected.filter((entry) => gridsOverlap(entry.grid, candidate))
  const ordered = [...affected]
  const insertIndex = genericInsertIndex(moving, candidate, ordered, overlappingPeers, 'vertical')
  ordered.splice(insertIndex, 0, moving)
  const positioned = positionVerticalMixedRun(ordered, moving.id, candidate)
  const affectedIds = new Set(affected.map((entry) => entry.id))
  const occupiedExternal = allLayoutElements(lists, widgets).filter((entry) => entry.id !== moving.id && !affectedIds.has(entry.id)).map((entry) => entry.grid)
  if (!validateMixedPositionedRun(positioned, occupiedExternal)) return null
  return mixedPositionedResult(moving.id, positioned)
}

function affectedHorizontalPeers(list: BoardList, candidate: LayoutGrid, peers: BoardList[]): BoardList[] {
  const corridorStart = Math.min(list.grid.x, candidate.x)
  const corridorEnd = Math.max(list.grid.x + list.grid.w - 1, candidate.x + candidate.w - 1)
  return peers.filter((entry) => rangesOverlap(entry.grid.x, entry.grid.x + entry.grid.w - 1, corridorStart, corridorEnd))
}

function affectedVerticalPeers(list: BoardList, candidate: LayoutGrid, peers: BoardList[]): BoardList[] {
  const corridorStart = Math.min(list.grid.y, candidate.y)
  const corridorEnd = Math.max(list.grid.y + list.grid.h - 1, candidate.y + candidate.h - 1)
  return peers.filter((entry) => rangesOverlap(entry.grid.y, entry.grid.y + entry.grid.h - 1, corridorStart, corridorEnd))
}

function affectedHorizontalWidgetPeers(widget: BoardWidget, candidate: WidgetGrid, peers: BoardWidget[]): BoardWidget[] {
  const corridorStart = Math.min(widget.grid.x, candidate.x)
  const corridorEnd = Math.max(widget.grid.x + widget.grid.w - 1, candidate.x + candidate.w - 1)
  return peers.filter((entry) => rangesOverlap(entry.grid.x, entry.grid.x + entry.grid.w - 1, corridorStart, corridorEnd))
}

function affectedVerticalWidgetPeers(widget: BoardWidget, candidate: WidgetGrid, peers: BoardWidget[]): BoardWidget[] {
  const corridorStart = Math.min(widget.grid.y, candidate.y)
  const corridorEnd = Math.max(widget.grid.y + widget.grid.h - 1, candidate.y + candidate.h - 1)
  return peers.filter((entry) => rangesOverlap(entry.grid.y, entry.grid.y + entry.grid.h - 1, corridorStart, corridorEnd))
}

function resolveMixedSwap(moving: LayoutElement, candidate: LayoutGrid, target: LayoutElement, lists: BoardList[], widgets: BoardWidget[]): MixedLayoutChange | null {
  if (!sameGridSize(candidate, target.grid)) return null
  const swappedTargetGrid = { ...target.grid, x: moving.grid.x, y: moving.grid.y }
  const occupied = allLayoutElements(lists, widgets).filter((entry) => entry.id !== moving.id && entry.id !== target.id).map((entry) => entry.grid)
  const canSwap = canPlaceAgainst(swappedTargetGrid, occupied) && canPlaceAgainst(candidate, occupied)
  if (!canSwap) return null
  return mixedPositionedResult(moving.id, [{ element: moving, grid: candidate }, { element: target, grid: swappedTargetGrid }])
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA <= endB && endA >= startB
}

function resolveBestEffortListMove(list: BoardList, candidate: LayoutGrid, lists: BoardList[], widgets: BoardWidget[]): { grid: LayoutGrid; moved: { list: BoardList; grid: LayoutGrid }[] } | null {
  const others = lists.filter((entry) => entry.displayEnabled && entry.id !== list.id)
  const occupied = [...others.map((entry) => entry.grid), ...widgets.filter((widget) => widget.displayEnabled).map((widget) => widget.grid)]
  const dx = candidate.x - list.grid.x
  const dy = candidate.y - list.grid.y
  const candidates: LayoutGrid[] = []
  for (let y = 1; y <= 9 - candidate.h; y += 1) {
    for (let x = 1; x <= 17 - candidate.w; x += 1) {
      const probe = { ...candidate, x, y }
      if (canPlaceAgainst(probe, occupied)) candidates.push(probe)
    }
  }
  if (candidates.length === 0) return null
  const directional = candidates.filter((probe) => matchesMoveDirection(list.grid, candidate, probe)).sort((a, b) => compareBestEffortGrid(list.grid, candidate, a, b, dx, dy))
  const chosen = (directional[0] ?? candidates.sort((a, b) => compareBestEffortGrid(list.grid, candidate, a, b, dx, dy))[0]) ?? null
  if (!chosen || sameGridPosition(chosen, list.grid)) return null
  return { grid: chosen, moved: [] }
}

function resolveBestEffortWidgetMove(widget: BoardWidget, candidate: WidgetGrid, widgets: BoardWidget[], lists: BoardList[]): { grid: WidgetGrid; moved: { widget: BoardWidget; grid: WidgetGrid }[] } | null {
  const others = widgets.filter((entry) => entry.displayEnabled && entry.id !== widget.id)
  const occupied = [...others.map((entry) => entry.grid), ...lists.filter((entry) => entry.displayEnabled).map((entry) => entry.grid)]
  const dx = candidate.x - widget.grid.x
  const dy = candidate.y - widget.grid.y
  const candidates: WidgetGrid[] = []
  for (let y = 1; y <= 9 - candidate.h; y += 1) {
    for (let x = 1; x <= 17 - candidate.w; x += 1) {
      const probe = { ...candidate, x, y }
      if (canPlaceAgainst(probe, occupied)) candidates.push(probe)
    }
  }
  if (candidates.length === 0) return null
  const directional = candidates.filter((probe) => matchesMoveDirection(widget.grid, candidate, probe)).sort((a, b) => compareBestEffortGrid(widget.grid, candidate, a, b, dx, dy))
  const chosen = (directional[0] ?? candidates.sort((a, b) => compareBestEffortGrid(widget.grid, candidate, a, b, dx, dy))[0]) ?? null
  if (!chosen || sameGridPosition(chosen, widget.grid)) return null
  return { grid: chosen, moved: [] }
}

function matchesMoveDirection(origin: LayoutGrid, candidate: LayoutGrid, probe: LayoutGrid): boolean {
  const dx = candidate.x - origin.x
  const dy = candidate.y - origin.y
  const horizontalOkay = dx === 0 || Math.sign(probe.x - origin.x) === Math.sign(dx) || probe.x === origin.x
  const verticalOkay = dy === 0 || Math.sign(probe.y - origin.y) === Math.sign(dy) || probe.y === origin.y
  return horizontalOkay && verticalOkay
}

function compareBestEffortGrid(origin: LayoutGrid, candidate: LayoutGrid, a: LayoutGrid, b: LayoutGrid, dx: number, dy: number): number {
  const scoreA = bestEffortScore(origin, candidate, a, dx, dy)
  const scoreB = bestEffortScore(origin, candidate, b, dx, dy)
  if (scoreA.progress !== scoreB.progress) return scoreB.progress - scoreA.progress
  if (scoreA.distance !== scoreB.distance) return scoreA.distance - scoreB.distance
  if (scoreA.secondary !== scoreB.secondary) return scoreA.secondary - scoreB.secondary
  return scoreA.tertiary - scoreB.tertiary
}

function bestEffortScore(origin: LayoutGrid, candidate: LayoutGrid, probe: LayoutGrid, dx: number, dy: number): { progress: number; distance: number; secondary: number; tertiary: number } {
  const progressX = dx === 0 ? 0 : Math.max(0, Math.sign(dx) * (probe.x - origin.x))
  const progressY = dy === 0 ? 0 : Math.max(0, Math.sign(dy) * (probe.y - origin.y))
  const distance = Math.abs(probe.x - candidate.x) + Math.abs(probe.y - candidate.y)
  const secondary = Math.abs(probe.x - candidate.x)
  const tertiary = Math.abs(probe.y - candidate.y)
  return { progress: progressX + progressY, distance, secondary, tertiary }
}

function verticalInsertIndex(list: BoardList, candidate: LayoutGrid, orderedPeers: BoardList[], overlappingPeers: BoardList[]): number {
  if (overlappingPeers.length > 0) {
    if (candidate.y > list.grid.y) return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[overlappingPeers.length - 1].id) + 1
    if (candidate.y < list.grid.y) return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[0].id)
  }
  const candidateCenter = candidate.y + candidate.h / 2
  const byCenter = orderedPeers.findIndex((entry) => candidateCenter < entry.grid.y + entry.grid.h / 2)
  return byCenter === -1 ? orderedPeers.length : byCenter
}

function horizontalWidgetInsertIndex(widget: BoardWidget, candidate: WidgetGrid, orderedPeers: BoardWidget[], overlappingPeers: BoardWidget[]): number {
  if (overlappingPeers.length > 0) {
    if (candidate.x > widget.grid.x) return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[overlappingPeers.length - 1].id) + 1
    if (candidate.x < widget.grid.x) return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[0].id)
  }
  const candidateCenter = candidate.x + candidate.w / 2
  const byCenter = orderedPeers.findIndex((entry) => candidateCenter < entry.grid.x + entry.grid.w / 2)
  return byCenter === -1 ? orderedPeers.length : byCenter
}

function verticalWidgetInsertIndex(widget: BoardWidget, candidate: WidgetGrid, orderedPeers: BoardWidget[], overlappingPeers: BoardWidget[]): number {
  if (overlappingPeers.length > 0) {
    if (candidate.y > widget.grid.y) return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[overlappingPeers.length - 1].id) + 1
    if (candidate.y < widget.grid.y) return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[0].id)
  }
  const candidateCenter = candidate.y + candidate.h / 2
  const byCenter = orderedPeers.findIndex((entry) => candidateCenter < entry.grid.y + entry.grid.h / 2)
  return byCenter === -1 ? orderedPeers.length : byCenter
}

function genericInsertIndex(moving: LayoutElement, candidate: LayoutGrid, orderedPeers: LayoutElement[], overlappingPeers: LayoutElement[], axis: 'horizontal' | 'vertical'): number {
  const movingCoord = axis === 'horizontal' ? moving.grid.x : moving.grid.y
  const candidateCoord = axis === 'horizontal' ? candidate.x : candidate.y
  if (overlappingPeers.length > 0) {
    if (candidateCoord > movingCoord) return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[overlappingPeers.length - 1].id) + 1
    if (candidateCoord < movingCoord) return orderedPeers.findIndex((entry) => entry.id === overlappingPeers[0].id)
  }
  const candidateCenter = axis === 'horizontal' ? candidate.x + candidate.w / 2 : candidate.y + candidate.h / 2
  const byCenter = orderedPeers.findIndex((entry) => candidateCenter < (axis === 'horizontal' ? entry.grid.x + entry.grid.w / 2 : entry.grid.y + entry.grid.h / 2))
  return byCenter === -1 ? orderedPeers.length : byCenter
}

function positionVerticalRun(ordered: BoardList[], movingListId: string, candidate: LayoutGrid): { list: BoardList; grid: LayoutGrid }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingListId)
  const placed = new Map<string, LayoutGrid>()
  placed.set(movingListId, { ...candidate })
  let nextY = candidate.y
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextY -= entry.grid.h
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: nextY })
  }
  let trailingY = candidate.y + candidate.h
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: trailingY })
    trailingY += entry.grid.h
  }
  const positioned = ordered.map((entry) => ({ list: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minY = Math.min(...positioned.map((entry) => entry.grid.y))
  if (minY < 1) for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y + (1 - minY) }
  const maxY = Math.max(...positioned.map((entry) => entry.grid.y + entry.grid.h - 1))
  if (maxY > 8) for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y - (maxY - 8) }
  return positioned
}

function positionVerticalWidgetRun(ordered: BoardWidget[], movingWidgetId: string, candidate: WidgetGrid): { widget: BoardWidget; grid: WidgetGrid }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingWidgetId)
  const placed = new Map<string, WidgetGrid>()
  placed.set(movingWidgetId, { ...candidate })
  let nextY = candidate.y
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextY -= entry.grid.h
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: nextY })
  }
  let trailingY = candidate.y + candidate.h
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: trailingY })
    trailingY += entry.grid.h
  }
  const positioned = ordered.map((entry) => ({ widget: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minY = Math.min(...positioned.map((entry) => entry.grid.y))
  if (minY < 1) for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y + (1 - minY) }
  const maxY = Math.max(...positioned.map((entry) => entry.grid.y + entry.grid.h - 1))
  if (maxY > 8) for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y - (maxY - 8) }
  return positioned
}

function positionHorizontalMixedRun(ordered: LayoutElement[], movingId: string, candidate: LayoutGrid): { element: LayoutElement; grid: LayoutGrid }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingId)
  const placed = new Map<string, LayoutGrid>()
  placed.set(movingId, { ...candidate })
  let nextX = candidate.x
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextX -= entry.grid.w
    placed.set(entry.id, { ...entry.grid, x: nextX, y: candidate.y })
  }
  let trailingX = candidate.x + candidate.w
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: trailingX, y: candidate.y })
    trailingX += entry.grid.w
  }
  const positioned = ordered.map((entry) => ({ element: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minX = Math.min(...positioned.map((entry) => entry.grid.x))
  if (minX < 1) for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x + (1 - minX) }
  const maxX = Math.max(...positioned.map((entry) => entry.grid.x + entry.grid.w - 1))
  if (maxX > 16) for (const entry of positioned) entry.grid = { ...entry.grid, x: entry.grid.x - (maxX - 16) }
  return positioned
}

function positionVerticalMixedRun(ordered: LayoutElement[], movingId: string, candidate: LayoutGrid): { element: LayoutElement; grid: LayoutGrid }[] {
  const movingIndex = ordered.findIndex((entry) => entry.id === movingId)
  const placed = new Map<string, LayoutGrid>()
  placed.set(movingId, { ...candidate })
  let nextY = candidate.y
  for (let index = movingIndex - 1; index >= 0; index -= 1) {
    const entry = ordered[index]
    nextY -= entry.grid.h
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: nextY })
  }
  let trailingY = candidate.y + candidate.h
  for (let index = movingIndex + 1; index < ordered.length; index += 1) {
    const entry = ordered[index]
    placed.set(entry.id, { ...entry.grid, x: candidate.x, y: trailingY })
    trailingY += entry.grid.h
  }
  const positioned = ordered.map((entry) => ({ element: entry, grid: placed.get(entry.id) ?? entry.grid }))
  const minY = Math.min(...positioned.map((entry) => entry.grid.y))
  if (minY < 1) for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y + (1 - minY) }
  const maxY = Math.max(...positioned.map((entry) => entry.grid.y + entry.grid.h - 1))
  if (maxY > 8) for (const entry of positioned) entry.grid = { ...entry.grid, y: entry.grid.y - (maxY - 8) }
  return positioned
}

function validatePositionedRun(positioned: { list: BoardList; grid: LayoutGrid }[], occupiedExternal: LayoutGrid[]): boolean {
  for (let index = 0; index < positioned.length; index += 1) {
    const entry = positioned[index]
    if (!validDisplayGrid(entry.grid)) return false
    const occupied = [...occupiedExternal, ...positioned.filter((_, otherIndex) => otherIndex !== index).map((item) => item.grid)]
    if (!canPlaceAgainst(entry.grid, occupied)) return false
  }
  return true
}

function validateWidgetPositionedRun(positioned: { widget: BoardWidget; grid: WidgetGrid }[], occupiedExternal: LayoutGrid[]): boolean {
  for (let index = 0; index < positioned.length; index += 1) {
    const entry = positioned[index]
    if (!validWidgetGrid(entry.grid)) return false
    const occupied = [...occupiedExternal, ...positioned.filter((_, otherIndex) => otherIndex !== index).map((item) => item.grid)]
    if (!canPlaceAgainst(entry.grid, occupied)) return false
  }
  return true
}

function validateMixedPositionedRun(positioned: { element: LayoutElement; grid: LayoutGrid }[], occupiedExternal: LayoutGrid[]): boolean {
  for (let index = 0; index < positioned.length; index += 1) {
    const entry = positioned[index]
    const valid = entry.element.kind === 'list' ? validDisplayGrid(entry.grid) : validWidgetGrid(entry.grid)
    if (!valid) return false
    const occupied = [...occupiedExternal, ...positioned.filter((_, otherIndex) => otherIndex !== index).map((item) => item.grid)]
    if (!canPlaceAgainst(entry.grid, occupied)) return false
  }
  return true
}

function positionedResult(movingListId: string, positioned: { list: BoardList; grid: LayoutGrid }[]): { grid: LayoutGrid; moved: { list: BoardList; grid: LayoutGrid }[] } {
  const moving = positioned.find((entry) => entry.list.id === movingListId)
  return {
    grid: moving?.grid ?? positioned[0].grid,
    moved: positioned.filter((entry) => entry.list.id !== movingListId && !sameGridPosition(entry.grid, entry.list.grid)).map((entry) => ({ list: entry.list, grid: entry.grid }))
  }
}

function widgetPositionedResult(movingWidgetId: string, positioned: { widget: BoardWidget; grid: WidgetGrid }[]): { grid: WidgetGrid; moved: { widget: BoardWidget; grid: WidgetGrid }[] } {
  const moving = positioned.find((entry) => entry.widget.id === movingWidgetId)
  return {
    grid: moving?.grid ?? positioned[0].grid,
    moved: positioned.filter((entry) => entry.widget.id !== movingWidgetId && !sameGridPosition(entry.grid, entry.widget.grid)).map((entry) => ({ widget: entry.widget, grid: entry.grid }))
  }
}

function mixedPositionedResult(movingId: string, positioned: { element: LayoutElement; grid: LayoutGrid }[]): MixedLayoutChange {
  const moving = positioned.find((entry) => entry.element.id === movingId)
  return {
    grid: moving?.grid ?? positioned[0].grid,
    movedLists: positioned.filter((entry) => entry.element.kind === 'list' && entry.element.id !== movingId && !sameGridPosition(entry.grid, entry.element.grid)).map((entry) => ({ list: (entry.element as Extract<LayoutElement, { kind: 'list' }>).list, grid: entry.grid })),
    movedWidgets: positioned.filter((entry) => entry.element.kind === 'widget' && entry.element.id !== movingId && !sameGridPosition(entry.grid, entry.element.grid)).map((entry) => ({ widget: (entry.element as Extract<LayoutElement, { kind: 'widget' }>).widget, grid: entry.grid }))
  }
}
