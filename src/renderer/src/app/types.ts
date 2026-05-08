import type {
  AppSettings,
  BirthdayBoardView,
  BoardSnapshot,
  BoardSummary,
  DisplayState,
  FieldValue,
  ListSortDirection,
  ListTemplateType,
  SummarySlot,
  WidgetType
} from '@shared/domain'

export type Route = 'admin' | 'display'
export type TutorialScene = 'admin' | 'display'

export type FormValues = Record<string, FieldValue>

export type AppActionResult = BoardSnapshot | DisplayState | AppSettings | void
export type RunAction = (action: () => Promise<AppActionResult>) => Promise<AppActionResult>

export type SelectedNode =
  | { kind: 'board'; id: string }
  | { kind: 'list'; id: string }
  | { kind: 'group'; id: string }
  | { kind: 'item'; id: string }
  | { kind: 'widget'; id: string }

export type ContextMenuState = {
  x: number
  y: number
  node: SelectedNode
} | null

export type BoardRailMenuState = {
  x: number
  y: number
  board: BoardSummary
} | null

export type EditableSummarySlot = Omit<SummarySlot, 'value'>

export type ConfirmDialogState = {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
} | null

export type PromptDialogState = {
  title: string
  label: string
  initialValue: string
  confirmLabel?: string
  onConfirm: (value: string) => void | Promise<void>
} | null

export type TutorialTargetId =
  | 'boards-list'
  | 'tree'
  | 'tree-lists-section'
  | 'tree-widgets-section'
  | 'edit-panel'
  | 'wizard-launch'
  | 'tutorial-launch'
  | 'list-editor-shell'
  | 'list-tab-properties'
  | 'list-tab-structure'
  | 'list-tab-contents'
  | 'list-tab-settings'
  | 'list-tab-summary'
  | 'live-layout'
  | 'app-settings'
  | 'close-confirmation'
  | 'theme-select'
  | 'display-target'
  | 'board-display-actions'
  | 'view-here-action'
  | 'display-top-band'
  | 'display-summary-row'
  | 'display-day-actions'
  | 'display-primary-list-header'
  | 'display-wishlist-header'
  | 'display-wishlist-table'
  | 'display-add-item'
  | 'display-edit-list'
  | 'display-list-summary'
  | 'display-list-table'
  | 'display-board-shell'

export type TutorialStep = {
  id: string
  scene: TutorialScene
  targetId: TutorialTargetId
  title: string
  body: string
  selection?: SelectedNode
  activateTarget?: boolean
  clickTargetId?: TutorialTargetId
  maskless?: boolean
  centerCard?: boolean
}

export type TutorialSession = {
  scene: TutorialScene
  adminSnapshot: BoardSnapshot
  displaySnapshot: BoardSnapshot
  boards: BoardSummary[]
  selectedNode: SelectedNode
}

export type HelpArticleSection = {
  title?: string
  paragraphs: string[]
  bullets?: string[]
}

export type HelpArticle = {
  id: string
  title: string
  category: string
  keywords: string[]
  summary: string
  sections: HelpArticleSection[]
}

export type WizardTemplateType = Exclude<ListTemplateType, 'custom'>
export type WizardMode = 'firstRun' | 'quickAdd' | 'newBoard' | 'reset'
export type WizardStepId = 'mode' | 'welcome' | 'templates' | 'lists' | 'specifics' | 'sorting' | 'finalTouches' | 'widgets' | 'done'

export type WizardListDraft = {
  id: string
  templateType: WizardTemplateType
  name: string
  sortField: string
  sortDirection: ListSortDirection
  displayEnabled: boolean
  dueDateEnabled: boolean
  deadlineMandatory: boolean
}

export type WizardWidgetDraft = {
  id: string
  name: string
  type: WidgetType
  displayEnabled: boolean
  layout: string
}

export type WizardData = {
  mode: WizardMode
  targetBoardId: string | null
  userName: string
  boardName: string
  listDrafts: WizardListDraft[]
  useStoreList: boolean
  storeText: string
  birthdayBoardView: BirthdayBoardView
  widgets: WizardWidgetDraft[]
}
