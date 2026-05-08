import type { ListTemplateModule } from '../types'

export const todoTemplateModule: ListTemplateModule = {
  type: 'todo',
  displayName: 'To Do',
  capabilities: {
    computedFields: true
  }
}
