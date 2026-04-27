export type ColumnType = 'text' | 'integer' | 'decimal' | 'currency' | 'duration' | 'date' | 'boolean' | 'choice' | 'hyperlink'

export type ListSortDirection = 'manual' | 'asc' | 'desc'
export type ColumnSortOrder = 'default' | 'manual' | 'name' | 'field_type' | 'required' | 'visibility'

export type PublicationStatus = 'draft' | 'published' | 'dirty'

export type OperationalState = 'active' | 'completed' | 'cancelled'
export type ArchiveValueScope = 'visible' | 'draft' | 'published'

export type AggregationMethod =
  | 'sum'
  | 'count'
  | 'active_count'
  | 'completed_count'
  | 'sum_active'
  | 'next_due'
  | 'open_tasks'
  | 'board_items'
  | 'total_board_entries'
  | 'total_purchases'
  | 'total_effort_tasks'
  | 'overdue_items'
  | 'overdue_tasks'
  | 'archived_items'

export type ColumnRole = 'deadline'

export type DateDisplayFormat = 'date' | 'datetime' | 'time'
export type DurationDisplayFormat = 'days_hours' | 'hours'

export type RecurrenceMode = 'none' | 'daily' | 'weekly' | 'interval_weeks' | 'monthly' | 'interval_months' | 'custom_weekdays'

export type CurrencyCode = 'RON' | 'EUR' | 'USD' | 'GBP' | 'CNY' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'PLN'
export type WidgetType = 'clock' | 'weather' | 'word_of_day' | 'world_clocks' | 'countdown'
export type ListTemplateType =
  | 'custom'
  | 'todo'
  | 'shopping_list'
  | 'wishlist'
  | 'health'
  | 'trips_events'
  | 'birthday_calendar'
export type ListBehavior = 'tasks' | 'purchases' | 'calendar' | 'other'
export type BirthdayBoardView = 'this_week' | 'this_month' | 'next_10_days' | 'next_30_days' | 'next_2_months' | 'all'

export type ListTemplateConfig = {
  behavior?: ListBehavior
  birthday?: {
    boardView: BirthdayBoardView
  }
}

export type WorldClockLocation = {
  id: string
  label: string
  timeZone: string
}

export type BoardWidgetConfig = {
  clock?: {
    showSeconds: boolean
  }
  weather?: {
    temperatureUnit: 'celsius' | 'fahrenheit'
  }
  wordOfDay?: {
    accent: string
  }
  worldClocks?: {
    locations: WorldClockLocation[]
    showSeconds: boolean
    style: 'digital' | 'analogue'
  }
  countdown?: {
    targetAt: string
    label: string
  }
}

export type GroupSummaryMethod = 'sum' | 'max' | 'avg' | 'count'

export type GroupSummaryConfig = {
  columnId: string
  method: GroupSummaryMethod
}

export type ChoiceOption = {
  id: string
  label: string
  rank: number
}

export type ChoiceConfig = {
  selection: 'single' | 'multi'
  ranked: boolean
  options: ChoiceOption[]
}

export type DateFieldValue = {
  value: string
  recurrence: RecurrenceMode
  recurrenceDays: number[]
  recurrenceInterval: number
}

export type FieldValue = string | number | boolean | string[] | DateFieldValue | null

export type ListColumn = {
  id: string
  listId: string
  name: string
  type: ColumnType
  order: number
  required: boolean
  maxLength: number | null
  listSummaryEligible: boolean
  boardSummaryEligible: boolean
  system: boolean
  role: ColumnRole | null
  choiceConfig: ChoiceConfig | null
  dateDisplayFormat: DateDisplayFormat
  durationDisplayFormat: DurationDisplayFormat
  recurrence: RecurrenceMode
  recurrenceDays: number[]
  currencyCode: CurrencyCode
  showOnBoard: boolean
}

export type BoardSummary = {
  id: string
  name: string
  description: string
  owner: string
  active: boolean
}

export type BoardList = {
  id: string
  boardId: string
  name: string
  code: string
  templateType: ListTemplateType
  templateConfig: ListTemplateConfig
  order: number
  grid: {
    x: number
    y: number
    w: number
    h: number
  }
  dueDateEnabled: boolean
  dueDateColumnId: string | null
  deadlineMandatory: boolean
  columnSortOrder: ColumnSortOrder
  sortColumnId: string | null
  sortDirection: ListSortDirection
  displayEnabled: boolean
  showItemIdOnBoard: boolean
  showDependenciesOnBoard: boolean
  showCreatedAtOnBoard: boolean
  showCreatedByOnBoard: boolean
  showStatusOnBoard: boolean
  columns: ListColumn[]
  groups: ItemGroup[]
  items: BoardItem[]
}

export type BoardWidget = {
  id: string
  boardId: string
  type: WidgetType
  name: string
  order: number
  displayEnabled: boolean
  grid: {
    x: number
    y: number
    w: number
    h: number
  }
  config: BoardWidgetConfig
}

export type ItemGroup = {
  id: string
  listId: string
  parentGroupId: string | null
  name: string
  code: string
  order: number
  showIdOnBoard: boolean
  summaries: GroupSummaryConfig[]
}

export type BoardItem = {
  id: string
  listId: string
  groupId: string | null
  code: string
  displayCode: string
  order: number
  publicationStatus: PublicationStatus
  operationalState: OperationalState
  values: Record<string, FieldValue>
  dependencyCodes: string[]
  dependencyItemIds: string[]
  createdAt: string
  createdBy: string
  isOverdue: boolean
  deadlineStatus: string
  deadlineTone: 'none' | 'ok' | 'soon' | 'urgent' | 'critical' | 'overdue'
  updatedAt: string
}

export type SummarySlot = {
  slotIndex: number
  label: string
  sourceListId: string | null
  sourceColumnId: string | null
  aggregationMethod: AggregationMethod
  value: string
}

export type UpdateSummarySlotsInput = {
  boardId: string
  slots: Array<{
    slotIndex: number
    label: string
    sourceListId: string | null
    sourceColumnId: string | null
    aggregationMethod: AggregationMethod
  }>
}

export type DisplayInfo = {
  id: string
  label: string
  primary: boolean
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}

export type DisplayState = {
  visible: boolean
  selectedDisplayId: string | null
  displays: DisplayInfo[]
}

export type CloseConfirmationMode = 'with_comments' | 'without_comments' | 'none'

export type AppTheme = 'black_glass_blue' | 'liquid_gunmetal' | 'midnight_clear'

export type AppSettings = {
  closeConfirmationMode: CloseConfirmationMode
  theme: AppTheme
  addColumnOnTopByBoard: Record<string, boolean>
}

export type AdminModeRequestResult = {
  switchInPlace: boolean
}

export type BoardSnapshot = {
  id: string
  name: string
  description: string
  owner: string
  active: boolean
  lists: BoardList[]
  widgets: BoardWidget[]
  summarySlots: SummarySlot[]
  mode: 'admin' | 'display'
  generatedAt: string
}

export type ArchiveRecord = {
  id: string
  itemId: string
  boardId: string
  listId: string
  listName: string
  itemCode: string
  values: Record<string, FieldValue>
  closedAt: string
  closeAction: Exclude<OperationalState, 'active'>
  closeComment: string
}

export type CreateItemInput = {
  listId: string
  groupId?: string | null
  values: Record<string, FieldValue>
  dependencyItemIds: string[]
}

export type UpdateItemInput = {
  itemId: string
  groupId?: string | null
  values: Record<string, FieldValue>
  dependencyItemIds: string[]
}

export type UpdateBoardInput = {
  boardId: string
  name: string
  description: string
  owner: string
  summarySlots?: UpdateSummarySlotsInput['slots']
}

export type CreateBoardInput = {
  name: string
}

export type DeleteBoardInput = {
  boardId: string
  keepBoardId?: string | null
}

export type DuplicateBoardInput = {
  boardId: string
}

export type CreateListInput = {
  boardId: string
  name: string
  templateType?: ListTemplateType
}

export type MoveListInput = {
  listId: string
  targetBoardId: string
}

export type CreateGroupInput = {
  listId: string
  parentGroupId?: string | null
  name: string
}

export type UpdateGroupInput = {
  groupId: string
  parentGroupId?: string | null
  name: string
  showIdOnBoard?: boolean
  summaries?: GroupSummaryConfig[]
}

export type UpdateListInput = {
  listId: string
  name: string
  templateType?: ListTemplateType
  templateConfig?: ListTemplateConfig
  grid: {
    x: number
    y: number
    w: number
    h: number
  }
  dueDateEnabled: boolean
  dueDateColumnId: string | null
  deadlineMandatory: boolean
  columnSortOrder: ColumnSortOrder
  sortColumnId: string | null
  sortDirection: ListSortDirection
  displayEnabled: boolean
  showItemIdOnBoard: boolean
  showDependenciesOnBoard: boolean
  showCreatedAtOnBoard: boolean
  showCreatedByOnBoard: boolean
  showStatusOnBoard: boolean
}

export type UpdateListGridInput = {
  listId: string
  grid: {
    x: number
    y: number
    w: number
    h: number
  }
}

export type CreateColumnInput = {
  listId: string
  name: string
  type: ColumnType
  choiceConfig?: ChoiceConfig | null
  dateDisplayFormat?: DateDisplayFormat
  durationDisplayFormat?: DurationDisplayFormat
  recurrence?: RecurrenceMode
  recurrenceDays?: number[]
  currencyCode?: CurrencyCode
  showOnBoard?: boolean
  addOnTop?: boolean
  columnSortOrder?: ColumnSortOrder
}

export type CreateWidgetInput = {
  boardId: string
  type: WidgetType
  name: string
}

export type UpdateWidgetInput = {
  widgetId: string
  type: WidgetType
  name: string
  displayEnabled: boolean
  grid: {
    x: number
    y: number
    w: number
    h: number
  }
  config: BoardWidgetConfig
}

export type UpdateWidgetGridInput = {
  widgetId: string
  grid: {
    x: number
    y: number
    w: number
    h: number
  }
}

export type UpdateBoardLayoutsInput = {
  lists: UpdateListGridInput[]
  widgets: UpdateWidgetGridInput[]
}

export type UpdateColumnInput = {
  columnId: string
  name: string
  type: ColumnType
  required: boolean
  maxLength: number | null
  listSummaryEligible: boolean
  boardSummaryEligible: boolean
  choiceConfig?: ChoiceConfig | null
  dateDisplayFormat?: DateDisplayFormat
  durationDisplayFormat?: DurationDisplayFormat
  recurrence?: RecurrenceMode
  recurrenceDays?: number[]
  currencyCode?: CurrencyCode
  showOnBoard?: boolean
  order?: number
}

export type CloseItemInput = {
  itemId: string
  action: Exclude<OperationalState, 'active'>
  comment?: string | null
  archiveScope?: ArchiveValueScope
}

export type LplApi = {
  listBoards: () => Promise<BoardSummary[]>
  getActiveBoardSnapshot: (mode?: 'admin' | 'display') => Promise<BoardSnapshot>
  getBoardSnapshot: (boardId: string, mode?: 'admin' | 'display') => Promise<BoardSnapshot>
  setActiveBoard: (boardId: string) => Promise<BoardSnapshot>
  closeApp: () => Promise<void>
  requestAdminMode: () => Promise<AdminModeRequestResult>
  getDisplayState: () => Promise<DisplayState>
  getAppSettings: () => Promise<AppSettings>
  updateAppSettings: (settings: AppSettings) => Promise<AppSettings>
  openDisplayWindow: () => Promise<DisplayState>
  hideDisplayWindow: () => Promise<DisplayState>
  setDisplayTarget: (displayId: string) => Promise<DisplayState>
  publishItem: (itemId: string) => Promise<BoardSnapshot>
  publishList: (listId: string) => Promise<BoardSnapshot>
  publishBoard: (boardId: string) => Promise<BoardSnapshot>
  completeItem: (itemId: string) => Promise<BoardSnapshot>
  closeItem: (input: CloseItemInput) => Promise<BoardSnapshot>
  createItem: (input: CreateItemInput) => Promise<BoardSnapshot>
  updateItem: (input: UpdateItemInput) => Promise<BoardSnapshot>
  deleteItem: (itemId: string) => Promise<BoardSnapshot>
  createBoard: (input: CreateBoardInput) => Promise<BoardSnapshot>
  updateBoard: (input: UpdateBoardInput) => Promise<BoardSnapshot>
  updateSummarySlots: (input: UpdateSummarySlotsInput) => Promise<BoardSnapshot>
  deleteBoard: (input: DeleteBoardInput) => Promise<BoardSnapshot>
  duplicateBoard: (input: DuplicateBoardInput) => Promise<BoardSnapshot>
  createList: (input: CreateListInput) => Promise<BoardSnapshot>
  updateList: (input: UpdateListInput) => Promise<BoardSnapshot>
  updateListLayouts: (input: UpdateListGridInput[]) => Promise<BoardSnapshot>
  updateBoardLayouts: (input: UpdateBoardLayoutsInput) => Promise<BoardSnapshot>
  deleteList: (listId: string) => Promise<BoardSnapshot>
  moveListToBoard: (input: MoveListInput) => Promise<BoardSnapshot>
  copyListToBoard: (input: MoveListInput) => Promise<BoardSnapshot>
  createGroup: (input: CreateGroupInput) => Promise<BoardSnapshot>
  updateGroup: (input: UpdateGroupInput) => Promise<BoardSnapshot>
  deleteGroup: (groupId: string) => Promise<BoardSnapshot>
  createColumn: (input: CreateColumnInput) => Promise<BoardSnapshot>
  updateColumn: (input: UpdateColumnInput) => Promise<BoardSnapshot>
  deleteColumn: (columnId: string) => Promise<BoardSnapshot>
  createWidget: (input: CreateWidgetInput) => Promise<BoardSnapshot>
  updateWidget: (input: UpdateWidgetInput) => Promise<BoardSnapshot>
  updateWidgetLayouts: (input: UpdateWidgetGridInput[]) => Promise<BoardSnapshot>
  deleteWidget: (widgetId: string) => Promise<BoardSnapshot>
  listArchive: (filters?: { listId?: string; closedAfter?: string; closedBefore?: string }) => Promise<ArchiveRecord[]>
  openExternalUrl: (url: string) => Promise<void>
  onDataChanged: (callback: () => void) => () => void
}
