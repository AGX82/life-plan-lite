import type { ListTemplateType } from '@shared/domain'
import type { ListTemplateModule } from './types'
import { birthdayCalendarTemplateModule } from './modules/birthdayCalendar'
import { customTemplateModule } from './modules/custom'
import { healthTemplateModule } from './modules/health'
import { projectTemplateModule } from './modules/project'
import { shoppingListTemplateModule } from './modules/shoppingList'
import { todoTemplateModule } from './modules/todo'
import { tripsEventsTemplateModule } from './modules/tripsEvents'
import { wishlistTemplateModule } from './modules/wishlist'

const templateModules: Record<ListTemplateType, ListTemplateModule> = {
  custom: customTemplateModule,
  todo: todoTemplateModule,
  shopping_list: shoppingListTemplateModule,
  wishlist: wishlistTemplateModule,
  project: projectTemplateModule,
  health: healthTemplateModule,
  trips_events: tripsEventsTemplateModule,
  birthday_calendar: birthdayCalendarTemplateModule
}

export function getListTemplateModule(templateType: ListTemplateType): ListTemplateModule {
  return templateModules[templateType]
}

export function allListTemplateModules(): ListTemplateModule[] {
  return Object.values(templateModules)
}
