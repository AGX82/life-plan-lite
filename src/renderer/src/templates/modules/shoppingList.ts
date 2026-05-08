import type { ListTemplateModule } from '../types'

export const shoppingListTemplateModule: ListTemplateModule = {
  type: 'shopping_list',
  displayName: 'Shopping List',
  capabilities: {
    computedFields: true
  }
}
