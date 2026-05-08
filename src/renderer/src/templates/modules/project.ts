import type { BoardDisplayColumn, ListTemplateModule } from '../types'

export const projectTemplateModule: ListTemplateModule = {
  type: 'project',
  displayName: 'Project',
  capabilities: {
    customBoardView: true,
    customItemEditor: true,
    computedFields: true
  },
  buildBoardColumns: (list, helpers): BoardDisplayColumn[] => [
    ...helpers.boardVisibleColumns(list).map((column) => ({
      kind: 'real' as const,
      key: column.id,
      label: helpers.boardColumnLabel(column),
      column
    })),
    { kind: 'project_gantt' as const, key: 'project-gantt', label: 'Gantt' }
  ]
}
