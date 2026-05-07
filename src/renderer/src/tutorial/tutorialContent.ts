import type { BoardSnapshot } from '@shared/domain'

export type TutorialScene = 'admin' | 'display'

export type TutorialSelectedNode =
  | { kind: 'board'; id: string }
  | { kind: 'list'; id: string }
  | { kind: 'group'; id: string }
  | { kind: 'item'; id: string }
  | { kind: 'widget'; id: string }

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
  selection?: TutorialSelectedNode
  activateTarget?: boolean
  clickTargetId?: TutorialTargetId
  maskless?: boolean
  centerCard?: boolean
}
export function tutorialSteps(snapshot: BoardSnapshot): TutorialStep[] {
  const steps: TutorialStep[] = [
    {
      id: 'boards',
      scene: 'admin',
      targetId: 'boards-list',
      title: 'Your boards live here',
      body:
        'The active board stays on top. Click any board to load it into the editor, and right-click a board when you want quick actions like duplicate or delete.'
    },
    {
      id: 'tree',
      scene: 'admin',
      targetId: 'tree',
      title: 'This is the navigation tree',
      body:
        'This pane maps the content of the loaded board. It shows the structure of the board and lets you move quickly between lists, groups, items, and widgets.'
    },
    {
      id: 'tree-lists',
      scene: 'admin',
      targetId: 'tree-lists-section',
      title: 'Lists sit at the top of the tree',
      body:
        'The upper part of the navigation tree is for lists. This is where you add new lists and drill into their groups and tasks.'
    },
    {
      id: 'tree-widgets',
      scene: 'admin',
      targetId: 'tree-widgets-section',
      title: 'Widgets live in their own section',
      body:
        'The lower part of the navigation tree is for widgets. From here you can add, edit, and remove the board widgets that support your daily view.'
    },
    {
      id: 'edit-board',
      scene: 'admin',
      targetId: 'edit-panel',
      title: 'The edit panel is where the work happens',
      body:
        'This is the main working area of the app. Based on what you select, this panel switches between board, list, group, task, and widget editing so the right controls appear in the same place.',
      selection: { kind: 'board', id: snapshot.id }
    }
  ]

  const firstList = snapshot.lists[0]
  if (firstList) {
    steps.push(
      {
        id: 'list-tab-properties',
        scene: 'admin',
        targetId: 'list-editor-shell',
        title: 'List Properties sets the operating rules',
        body:
          'This is where you name the list, choose the template, control board visibility, enable deadlines, and set the main size and placement defaults.',
        selection: { kind: 'list', id: firstList.id },
        activateTarget: true,
        clickTargetId: 'list-tab-properties'
      },
      {
        id: 'list-tab-structure',
        scene: 'admin',
        targetId: 'list-editor-shell',
        title: 'List Structure defines the fields',
        body:
          'Use this tab to show or hide columns, change field types, decide which ones are required, and control the order in which fields appear on the board.',
        selection: { kind: 'list', id: firstList.id },
        activateTarget: true,
        clickTargetId: 'list-tab-structure'
      },
      {
        id: 'list-tab-contents',
        scene: 'admin',
        targetId: 'list-editor-shell',
        title: 'List Contents is where the entries live',
        body:
          'Add items and groups here, then edit or reorganize the actual content of the list. This is the working area for day-to-day data inside that list.',
        selection: { kind: 'list', id: firstList.id },
        activateTarget: true,
        clickTargetId: 'list-tab-contents'
      },
      {
        id: 'list-tab-settings',
        scene: 'admin',
        targetId: 'list-editor-shell',
        title: 'List Settings handles behavior details',
        body:
          'This tab is for the list-level options that shape how entries behave, which includes template-specific controls and automation-related settings.',
        selection: { kind: 'list', id: firstList.id },
        activateTarget: true,
        clickTargetId: 'list-tab-settings'
      },
      {
        id: 'list-tab-wishlist',
        scene: 'admin',
        targetId: 'list-editor-shell',
        title: 'Wishlist combines desire, urgency, and affordability',
        body:
          'Wishlist uses Wishmeter for desire, Priority for practical urgency, and Pieces plus Price to calculate Total Cost. The app then turns those into Buy Score in the item details and Advised Buy Order on the board, so the user sees a clean recommendation instead of doing the math by hand.',
        selection: { kind: 'list', id: 'tutorial-list-wishlist' },
        activateTarget: true,
        clickTargetId: 'list-tab-settings'
      },
      {
        id: 'list-tab-summary',
        scene: 'admin',
        targetId: 'list-editor-shell',
        title: 'List Summary controls what the list reports',
        body:
          'Define the summary values shown for the list here, like counts, totals, or deadline-oriented rollups. These summaries also feed into board-level reporting.',
        selection: { kind: 'list', id: firstList.id },
        activateTarget: true,
        clickTargetId: 'list-tab-summary'
      }
    )
  }

  steps.push(
    {
      id: 'live-layout',
      scene: 'admin',
      targetId: 'live-layout',
      title: 'Live Layout is an active tool',
      body:
        'This is where you resize, reposition, and rebalance the visible board. Dragging here is not just a preview: it updates the board layout and can swap or push neighboring elements to make space.'
    },
    {
      id: 'wizard',
      scene: 'admin',
      targetId: 'wizard-launch',
      title: 'The wizard is your friend',
      body:
        'Use the LPL Wizard when you want to create several lists quickly, add a new board in a guided flow, or reset the app without rebuilding everything by hand.'
    },
    {
      id: 'tutorial-launch',
      scene: 'admin',
      targetId: 'tutorial-launch',
      title: 'Help keeps both the tour and the details nearby',
      body:
        'Use Help any time you want a refresher. It gives you quick access to the guided tour, plus searchable articles when you want a focused explanation without stepping through the whole walkthrough again.'
    },
    {
      id: 'settings',
      scene: 'admin',
      targetId: 'app-settings',
      title: 'Application Settings affect the whole workspace',
      body:
        'This panel controls the global behavior of the app. It is where you manage close confirmation, display targeting, and the current visual theme.'
    },
    {
      id: 'close-confirmation',
      scene: 'admin',
      targetId: 'close-confirmation',
      title: 'Close confirmation controls how items are closed',
      body:
        'Here you decide whether finishing or cancelling an item should ask for comments, ask without comments, or happen immediately. It affects the way closure actions behave across the app.'
    },
    {
      id: 'theme',
      scene: 'admin',
      targetId: 'theme-select',
      title: 'Themes let you switch the visual style',
      body:
        'You can move between the built-in themes here. The theme changes the look and contrast of the workspace without changing the structure or data.'
    },
    {
      id: 'display-target',
      scene: 'admin',
      targetId: 'display-target',
      title: 'Choose the display before showing the board',
      body:
        'If you use more than one monitor, set the target display here first. LPL uses this selection when it opens the fullscreen board window.'
    },
    {
      id: 'board-display-actions',
      scene: 'admin',
      targetId: 'board-display-actions',
      title: 'Show Board, Hide Board, and View Here',
      body:
        'Show Board opens the board window on the selected display. Hide Board closes that display window. View Here opens the same board view inside this window so you can inspect the board locally.'
    },
    {
      id: 'display-intro',
      scene: 'admin',
      targetId: 'board-display-actions',
      title: "Let's step into the live board",
      body:
        'When you are ready to leave setup behind, View Here opens the actual board inside this window. That is the same live surface you will use day to day.',
      activateTarget: true,
      clickTargetId: 'view-here-action'
    },
    {
      id: 'display-board-intro',
      scene: 'display',
      targetId: 'display-board-shell',
      title: 'This is the board you will actually live in',
      body:
        'This is the main working surface of Life Plan Lite. The editor is there to help you set up structure and make occasional deeper changes, but most of the time this live board is where you will review, update, and move your planning forward.',
      maskless: true,
      centerCard: true
    },
    {
      id: 'display-summary-row',
      scene: 'display',
      targetId: 'display-summary-row',
      title: 'The board header keeps key summaries visible',
      body:
        'This summary row keeps the board-level rollups in view while you work. These values are configured in the edit panel under Board Summary and act as the quick status line for the whole board.'
    },
    {
      id: 'display-day-actions',
      scene: 'display',
      targetId: 'display-day-actions',
      title: 'These quick filters help with day-focused planning',
      body:
        'The 24 and day buttons help you focus on immediate time windows. They are quick board-level lenses for what matters today and in the next day.'
    },
    {
      id: 'display-add-item',
      scene: 'display',
      targetId: 'display-add-item',
      title: 'You can add new items directly from the board',
      body:
        'After the initial setup, many everyday actions can happen directly on the live board. Adding a new item does not require going back through the full list editor.'
    },
    {
      id: 'display-edit-list',
      scene: 'display',
      targetId: 'display-edit-list',
      title: 'You can also open list settings from the board',
      body:
        'The board is not just for reading. It also gives you direct access to common list-level adjustments, so basic user-focused work stays close to the live context.'
    },
    {
      id: 'display-list-summary',
      scene: 'display',
      targetId: 'display-list-summary',
      title: 'List summaries keep the key signals visible',
      body:
        'These compact summaries surface the most useful roll-ups for the list, like counts, deadlines, and effort, without forcing you to scan the full table each time.'
    },
    {
      id: 'display-list-table',
      scene: 'display',
      targetId: 'display-list-table',
      title: 'Board lists show the right amount of detail',
      body:
        'A list may have many fields defined, but only a few need to stay visible on the board for readability. Clicking an item brings up its full detail editor, where you can see and edit all of the item fields.'
    },
    {
      id: 'finish',
      scene: 'display',
      targetId: 'display-board-shell',
      title: 'That is the core Life Plan Lite flow',
      body:
        'You now have the main mental map: boards and structure on the left, editing in the panel, layout management below, and the live board as the daily action surface. You can return to this tutorial any time.'
    }
  )

  return steps
}

