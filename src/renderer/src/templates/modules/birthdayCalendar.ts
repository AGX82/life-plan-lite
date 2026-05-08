import type { ListColumn } from '@shared/domain'
import type { BoardDisplayColumn, ListTemplateModule, TemplateBoardColumnHelpers } from '../types'

function birthdayCoreColumns(listColumns: ListColumn[], normalizeColumnName: (name: string) => string): ListColumn[] {
  return listColumns.filter((column) => {
    const normalized = normalizeColumnName(column.name)
    return normalized === 'name' || normalized === 'person name' || normalized === 'birthday' || normalized === 'year of birth' || normalized === 'birth year'
  })
}

function buildBirthdayBoardColumns(listColumns: ListColumn[], helpers: TemplateBoardColumnHelpers): BoardDisplayColumn[] {
  const core = birthdayCoreColumns(listColumns, helpers.normalizeColumnName)
  return [
    ...core
      .filter((column) => {
        const normalized = helpers.normalizeColumnName(column.name)
        return normalized !== 'birth year' && normalized !== 'year of birth'
      })
      .map((column) => ({
        kind: 'real' as const,
        key: column.id,
        label: helpers.boardColumnLabel(column),
        column
      })),
    { kind: 'birthday_turning' as const, key: 'birthday-turning', label: 'Turning' }
  ]
}

export const birthdayCalendarTemplateModule: ListTemplateModule = {
  type: 'birthday_calendar',
  displayName: 'Birthday Calendar',
  capabilities: {
    computedFields: true
  },
  buildBoardColumns: (list, helpers) => buildBirthdayBoardColumns(helpers.visibleColumns(list), helpers)
}
