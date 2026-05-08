import type { BoardDisplayColumn, ListTemplateModule } from '../types'

export const wishlistTemplateModule: ListTemplateModule = {
  type: 'wishlist',
  displayName: 'Wishlist',
  capabilities: {
    computedFields: true
  },
  buildBoardColumns: (list, helpers): BoardDisplayColumn[] => {
    const entries: BoardDisplayColumn[] = helpers.boardVisibleColumns(list).map((column) => ({
      kind: 'real' as const,
      key: column.id,
      label: helpers.boardColumnLabel(column),
      column
    }))
    if (!list.templateConfig.wishlist?.showAdvisedBuyOrder) return entries
    const priorityIndex = entries.findIndex(
      (entry) => entry.kind === 'real' && helpers.normalizeColumnName(entry.column.name) === 'priority'
    )
    const insertIndex = priorityIndex >= 0 ? priorityIndex + 1 : entries.length
    entries.splice(insertIndex, 0, {
      kind: 'wishlist_advised_buy_order',
      key: 'wishlist-advised-buy-order',
      label: list.templateConfig.wishlist?.advisedBuyOrderDisplayName?.trim() || 'Advised Buy Order'
    })
    return entries
  }
}
