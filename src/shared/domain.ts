export type ColumnType = 'text' | 'integer' | 'decimal' | 'currency' | 'date' | 'boolean' | 'choice' | 'hyperlink'

export type ListSortDirection = 'manual' | 'asc' | 'desc'

export type PublicationStatus = 'draft' | 'published' | 'dirty'

export type OperationalState = 'active' | 'completed' | 'cancelled'

export type AggregationMethod = 'sum' | 'count' | 'active_count' | 'completed_count' | 'sum_active'

export type ColumnRole = 'deadline'

export type DateDisplayFormat = 'date' | 'datetime' | 'time'

export type RecurrenceMode = 'none' | 'daily' | 'weekly' | 'biweekly' | 'custom_weekdays'

export type CurrencyCode = 'RON' | 'EUR' | 'USD' | 'GBP' | 'CNY' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'PLN'

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
  summaryEligible: boolean
  system: boolean
  role: ColumnRole | null
  choiceConfig: ChoiceConfig | null
  dateDisplayFormat: DateDisplayFormat
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
  sortColumnId: string | null
  sortDirection: ListSortDirection
  displayEnabled: boolean
  showItemIdOnBoard: boolean
  showDependenciesOnBoard: boolean
  showCreatedAtOnBoard: boolean
  showCreatedByOnBoard: boolean
  columns: ListColumn[]
  groups: ItemGroup[]
  items: BoardItem[]
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

export type AppSettings = {
  closeConfirmationMode: CloseConfirmationMode
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
}

export type CreateBoardInput = {
  name: string
}

export type CreateListInput = {
  boardId: string
  name: string
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
  grid: {
    x: number
    y: number
    w: number
    h: number
  }
  dueDateEnabled: boolean
  dueDateColumnId: string | null
  deadlineMandatory: boolean
  sortColumnId: string | null
  sortDirection: ListSortDirection
  displayEnabled: boolean
  showItemIdOnBoard: boolean
  showDependenciesOnBoard: boolean
  showCreatedAtOnBoard: boolean
  showCreatedByOnBoard: boolean
}

export type CreateColumnInput = {
  listId: string
  name: string
  type: ColumnType
  choiceConfig?: ChoiceConfig | null
  dateDisplayFormat?: DateDisplayFormat
  recurrence?: RecurrenceMode
  recurrenceDays?: number[]
  currencyCode?: CurrencyCode
  showOnBoard?: boolean
}

export type UpdateColumnInput = {
  columnId: string
  name: string
  type: ColumnType
  required: boolean
  maxLength: number | null
  summaryEligible: boolean
  choiceConfig?: ChoiceConfig | null
  dateDisplayFormat?: DateDisplayFormat
  recurrence?: RecurrenceMode
  recurrenceDays?: number[]
  currencyCode?: CurrencyCode
  showOnBoard?: boolean
}

export type CloseItemInput = {
  itemId: string
  action: Exclude<OperationalState, 'active'>
  comment?: string | null
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
  createList: (input: CreateListInput) => Promise<BoardSnapshot>
  updateList: (input: UpdateListInput) => Promise<BoardSnapshot>
  deleteList: (listId: string) => Promise<BoardSnapshot>
  moveListToBoard: (input: MoveListInput) => Promise<BoardSnapshot>
  copyListToBoard: (input: MoveListInput) => Promise<BoardSnapshot>
  createGroup: (input: CreateGroupInput) => Promise<BoardSnapshot>
  updateGroup: (input: UpdateGroupInput) => Promise<BoardSnapshot>
  deleteGroup: (groupId: string) => Promise<BoardSnapshot>
  createColumn: (input: CreateColumnInput) => Promise<BoardSnapshot>
  updateColumn: (input: UpdateColumnInput) => Promise<BoardSnapshot>
  deleteColumn: (columnId: string) => Promise<BoardSnapshot>
  listArchive: (filters?: { listId?: string; closedAfter?: string; closedBefore?: string }) => Promise<ArchiveRecord[]>
  openExternalUrl: (url: string) => Promise<void>
  onDataChanged: (callback: () => void) => () => void
}
