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
export const helpArticles: HelpArticle[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    category: 'Getting Started',
    keywords: ['first run', 'tour', 'tutorial', 'help', 'start'],
    summary: 'Understand the app in two layers: a quick guided tour and a deeper reference library.',
    sections: [
      {
        paragraphs: [
          'Life Plan Lite is meant to be learned in two passes. The Guided Tour gives you the mental map, while Help articles explain the deeper behavior of boards, lists, widgets, and item logic.',
          'In everyday use, most work should happen on the board itself. The admin workspace exists to shape structure, defaults, display, and behavior.'
        ]
      },
      {
        title: 'Best first steps',
        paragraphs: [],
        bullets: [
          'Run the LPL Wizard if you want a faster setup flow.',
          'Use the Guided Tour to understand the main interface.',
          'Return to Help whenever you need a specific explanation.'
        ]
      }
    ]
  },
  {
    id: 'app-menu',
    title: 'App Menu (Bottom Left)',
    category: 'Workspace',
    keywords: ['left rail', 'bottom left', 'app menu', 'wizard', 'help', 'show board', 'view here', 'exit'],
    summary: 'The bottom-left action rail is your launch point for setup, learning, board viewing, and app control.',
    sections: [
      {
        paragraphs: [
          'The lower-left action area is the app menu. It is where you launch the Wizard, open Help, control the display board, and exit the application.'
        ]
      },
      {
        title: 'Buttons in the app menu',
        paragraphs: [],
        bullets: [
          'LPL Wizard: creates boards and lists faster, or resets the app to first-run state.',
          'Help: opens the guided tour and the searchable help library.',
          'Show Board / Hide Board: opens or closes the external display board on the selected monitor.',
          'View Here: opens the board view inside the main app window for preview or direct work.',
          'Exit App: closes the desktop application.'
        ]
      }
    ]
  },
  {
    id: 'wizard-overview',
    title: 'Wizard Overview',
    category: 'Getting Started',
    keywords: ['wizard', 'quick add', 'new board', 'reset', 'first run'],
    summary: 'The wizard is the fast lane for creating structure without going through every list tab manually.',
    sections: [
      {
        paragraphs: [
          'The wizard is ideal when you want to create a useful board quickly, especially on first run or when adding several lists at once.',
          'It is intentionally lighter than the full admin editor. Use it to create a strong starting point, then refine structure later if needed.'
        ]
      },
      {
        title: 'Wizard modes',
        paragraphs: [],
        bullets: [
          'Quick-add lists: adds several configured lists to an existing board.',
          'Create a new board: builds a separate board without touching existing ones.',
          'Reset to first run: clears boards and data after confirmation, then lets you rebuild or leave the app empty for manual setup.'
        ]
      }
    ]
  },
  {
    id: 'boards-and-navigation',
    title: 'Boards and Navigation',
    category: 'Workspace',
    keywords: ['boards', 'navigation', 'tree', 'lists', 'widgets', 'left rail', 'selection'],
    summary: 'Boards live in the left rail, while the tree shows the lists and widgets inside the selected board.',
    sections: [
      {
        paragraphs: [
          'The board list on the left lets you switch the editing context. The active board stays on top, and the selected board is loaded into the edit workspace.',
          'The navigation tree shows the structure of the currently loaded board. The top portion is for lists, groups, and items. The bottom portion is for widgets.'
        ]
      },
      {
        title: 'What selection does',
        paragraphs: [
          'Whatever you select in the board tree becomes the editing scope in the panel on the right. Select a board to edit board-level settings, a list to edit that list, a group to edit grouping context, an item to edit its full details, or a widget to change widget configuration.'
        ]
      }
    ]
  },
  {
    id: 'admin-workspace',
    title: 'Admin Workspace Structure',
    category: 'Workspace',
    keywords: ['admin', 'edit panel', 'workspace', 'board', 'list', 'group', 'item'],
    summary: 'The admin page is organized around scope: boards contain lists and widgets, lists contain groups and items, and the edit panel changes accordingly.',
    sections: [
      {
        paragraphs: [
          'The admin page has three main areas: the left board rail, the navigation tree, and the edit workspace. The edit workspace is where the real configuration work happens.',
          'Editing in Life Plan Lite is scope-based. Boards hold lists and widgets. Lists hold groups and items. The edit panel updates so you are always working on the currently selected level.'
        ]
      },
      {
        title: 'Scope progression',
        paragraphs: [],
        bullets: [
          'Board: board properties, board summaries, and top-level display decisions.',
          'List: structure, sorting, settings, visibility, and summaries for one list.',
          'Group: grouping context and grouped item organization.',
          'Item: full details for one real entry, including fields that may be hidden on the board.'
        ]
      }
    ]
  },
  {
    id: 'groups',
    title: 'Groups',
    category: 'Lists',
    keywords: ['groups', 'nested groups', 'sections', 'organize items'],
    summary: 'Groups let you segment a list into meaningful sections without needing separate lists for everything.',
    sections: [
      {
        paragraphs: [
          'Groups are containers inside a list. They are useful when items belong to the same list model but should still be separated into distinct sections such as workstreams, areas, phases, or categories.',
          'Use groups when you want shared structure but clearer organization. Use separate lists when the behavior or purpose is genuinely different.'
        ]
      },
      {
        title: 'When groups help most',
        paragraphs: [],
        bullets: [
          'Multiple workstreams in one task list',
          'Recurring versus one-off health entries',
          'Different shopping contexts within one shopping list',
          'Project phases inside the same project-style list'
        ]
      }
    ]
  },
  {
    id: 'application-settings',
    title: 'Application Settings',
    category: 'Workspace',
    keywords: ['application settings', 'close confirmation', 'display', 'theme'],
    summary: 'Application Settings affect the whole workspace rather than a single board or list.',
    sections: [
      {
        paragraphs: [
          'Application Settings are global. They affect how the app behaves overall, not just the currently selected board.'
        ]
      },
      {
        title: 'Available settings',
        paragraphs: [],
        bullets: [
          'Close confirmation: controls whether the app asks for confirmation and comments before closing.',
          'Display: selects which monitor or screen target should be used when opening the board display.',
          'Theme: switches between the built-in visual themes.'
        ]
      }
    ]
  },
  {
    id: 'list-templates-overview',
    title: 'List Templates Overview',
    category: 'Templates',
    keywords: ['templates', 'list templates', 'default structure', 'intended use'],
    summary: 'Templates are opinionated starting points: each one comes with a default structure, a typical use case, and some built-in assumptions.',
    sections: [
      {
        paragraphs: [
          'A template saves time by giving you the fields, defaults, and behavior patterns that fit a common use case. You can still customize the structure afterward.',
          'Templates are meant to help, not trap you. Start from the closest model, then refine show/hide, required fields, summaries, and sort behavior to fit your real usage.'
        ]
      }
    ]
  },
  {
    id: 'template-todo',
    title: 'Template: To Do',
    category: 'Templates',
    keywords: ['todo', 'tasks', 'deadline', 'effort', 'progress'],
    summary: 'The To Do template is built for actionable work with deadlines, priority, effort, and progress tracking.',
    sections: [
      {
        paragraphs: [
          'To Do is intended for work that has clear actions, optional deadlines, visible progress, and effort awareness.',
          'Its default structure includes task-oriented fields such as task name, deadline, priority, effort, percent done, and supporting context like people or details.'
        ]
      }
    ]
  },
  {
    id: 'template-shopping',
    title: 'Template: Shopping List',
    category: 'Templates',
    keywords: ['shopping', 'price', 'cost', 'pieces', 'needed by'],
    summary: 'Shopping List is designed for practical purchases, near-term needs, and total-cost tracking.',
    sections: [
      {
        paragraphs: [
          'Shopping List is an execution list. It is for real planned purchases rather than loose desire or idea capture.',
          'The default structure includes product, pieces, unit price, total cost, store, and needed-by date. In this template, deadline behavior is surfaced to the user as Needed By.'
        ]
      }
    ]
  },
  {
    id: 'template-wishlist',
    title: 'Template: Wishlist',
    category: 'Templates',
    keywords: ['wishlist', 'wishmeter', 'priority', 'buy advice'],
    summary: 'Wishlist is for considered future purchases, with desire, practical urgency, and purchase burden kept separate.',
    sections: [
      {
        paragraphs: [
          'Wishlist is for things you may want or plan to buy, but that are not yet in the operational shopping flow.',
          'Its default structure includes Product, Pieces, Price, Total Cost, Wishmeter, and Priority. It also supports calculated Buy Score and Advised Buy Order logic.'
        ]
      }
    ]
  },
  {
    id: 'template-health',
    title: 'Template: Health',
    category: 'Templates',
    keywords: ['health', 'appointments', 'recurrence', 'mentions'],
    summary: 'Health is intended for check-ups, treatment planning, recurring appointments, and investigations.',
    sections: [
      {
        paragraphs: [
          'Health is designed to combine scheduled dates with recurring patterns and practical tracking.',
          'The default structure supports appointment dates, recurrence, mentions, and related treatment or investigation context.'
        ]
      }
    ]
  },
  {
    id: 'template-trips-events',
    title: 'Template: Trips & Events',
    category: 'Templates',
    keywords: ['trips', 'events', 'travel', 'type', 'theme', 'start'],
    summary: 'Trips & Events is for time-bound plans such as travel, work events, personal time, and other scheduled experiences.',
    sections: [
      {
        paragraphs: [
          'Trips & Events works best for plans defined by a date range, a type, a topic or theme, and a location.',
          'It is meant to answer “what is coming up, when, where, and what kind of plan is it?” rather than behave like a task list.'
        ]
      }
    ]
  },
  {
    id: 'template-birthday',
    title: 'Template: Birthday Calendar',
    category: 'Templates',
    keywords: ['birthday', 'calendar', 'gift task', 'perpetual'],
    summary: 'Birthday Calendar is a perpetual reminder list for recurring birthdays and gift planning.',
    sections: [
      {
        paragraphs: [
          'Birthday Calendar stores birthdays as recurring annual events rather than one-time dated tasks.',
          'It is intended to answer who is coming up next, how old they are turning, and whether you may want to generate a gift-related follow-up task.'
        ]
      }
    ]
  },
  {
    id: 'template-custom',
    title: 'Template: Build Custom List',
    category: 'Templates',
    keywords: ['custom list', 'blank list', 'behavior'],
    summary: 'Build Custom List gives you a light starting point when none of the predefined templates quite fits.',
    sections: [
      {
        paragraphs: [
          'Custom lists are for structures the standard templates do not capture well enough.',
          'A custom list is still easier to manage if you decide what behavior it mostly resembles, such as tasks, purchases, calendar, or other. That helps future summaries and logic stay meaningful.'
        ]
      }
    ]
  },
  {
    id: 'list-tabs',
    title: 'List Tabs',
    category: 'Lists',
    keywords: ['list tabs', 'properties', 'structure', 'contents', 'settings', 'summary'],
    summary: 'Each list tab has a distinct job, so it helps to think of them as different editing lenses rather than random sections.',
    sections: [
      {
        title: 'What each tab is for',
        paragraphs: [],
        bullets: [
          'List Properties: identity, template, board visibility, sorting, layout size, and quick actions.',
          'List Structure: fields, field types, required/show settings, and board-facing structure decisions.',
          'List Contents: the actual items and groups in the list.',
          'List Settings: behavior-specific options, such as Wishlist recommendation profile.',
          'List Summary: what this list should summarize and expose at list level.'
        ]
      }
    ]
  },
  {
    id: 'list-structure',
    title: 'List Structure',
    category: 'Lists',
    keywords: ['list structure', 'show hide', 'required', 'field type', 'board visibility'],
    summary: 'List Structure defines what fields exist and how the list presents them to users.',
    sections: [
      {
        paragraphs: [
          'List Structure is where a list becomes intentional. It defines field names, field types, whether fields are required, and whether they show on the board.',
          'Show or Hide controls board visibility, not whether the field exists. A hidden field can still exist in the item editor and still matter to logic or summaries.'
        ]
      },
      {
        title: 'Common structure controls',
        paragraphs: [],
        bullets: [
          'Field Type: decides how the value behaves and how it can be summarized or sorted.',
          'Required: enforces that a value must be provided for the item to be valid.',
          'Show: controls whether the field appears on the board list view.',
          'Order / sorting controls: shape the display order of fields in the list.'
        ]
      }
    ]
  },
  {
    id: 'deadline-logic',
    title: 'Deadline Logic',
    category: 'Lists',
    keywords: ['deadline', 'date', 'time', 'needed by', 'overdue'],
    summary: 'Deadline is a shared concept used by multiple templates, even when the user-facing label changes.',
    sections: [
      {
        paragraphs: [
          'Deadline is the common due-date concept in Life Plan Lite. Some templates use the plain label Deadline, while others present the same underlying concept under a more natural label such as Needed By.',
          'If only a date is provided and no time is entered, the app can still reason about the field. The important part is that the date participates consistently in sorting, overdue logic, and summary behavior.'
        ]
      }
    ]
  },
  {
    id: 'system-fields',
    title: 'System Fields and Reserved Names',
    category: 'Reference',
    keywords: ['system fields', 'reserved names', 'status', 'created at', 'item id', 'dependencies'],
    summary: 'Some fields are structural or protected because the app relies on them for behavior and calculations.',
    sections: [
      {
        paragraphs: [
          'System fields are fields the app uses for built-in behavior, traceability, or structural consistency. They may be visible or hidden, but they are not the same as ordinary user-defined fields.',
          'Reserved names are names the app treats specially in certain contexts, especially where summaries or calculated behaviors rely on recognizable meanings.'
        ]
      },
      {
        title: 'Common system fields',
        paragraphs: [],
        bullets: [
          'Item ID: the stable identifier shown to the user for that item.',
          'Dependencies: links an item to other items it depends on.',
          'Created At / Created By: provenance fields for tracking origin.',
          'Status: derived board-facing state such as due or overdue signals.'
        ]
      }
    ]
  },
  {
    id: 'items-and-item-actions',
    title: 'Creating, Editing, Completing, and Deleting Items',
    category: 'Lists',
    keywords: ['items', 'create item', 'edit item', 'complete', 'delete', 'admin', 'board'],
    summary: 'Items can be managed both from the admin workspace and from the live board, with the board remaining the preferred day-to-day surface.',
    sections: [
      {
        paragraphs: [
          'You can create items from admin mode or directly from the board. In normal use, the board should be the preferred daily surface because it keeps the workflow quick and close to the visible context.',
          'Editing an item opens the full item detail modal. Completing or deleting items can also happen from the board, depending on the list and the visible controls.'
        ]
      }
    ]
  },
  {
    id: 'live-layout',
    title: 'Live Layout',
    category: 'Boards',
    keywords: ['live layout', 'grid', 'resize', 'swap', 'min size', 'max visible'],
    summary: 'Live Layout is where you reshape the board grid, balance visible space, and decide how lists and widgets coexist.',
    sections: [
      {
        paragraphs: [
          'Live Layout is not just a preview. It is an active grid editor for the visible board.',
          'Dragging or resizing here updates the board layout, can push or swap neighboring elements, and is how you rebalance the board when structure grows.'
        ]
      },
      {
        title: 'How it relates to List Size & Grid Placement',
        paragraphs: [
          'List Size & Grid Placement in list properties defines the intended footprint of a list. Live Layout is the faster, more visual way to adjust that same placement on the board.',
          'In practice, use list properties when you want exact values, and use Live Layout when you want to reason spatially.'
        ]
      },
      {
        title: 'Practical guidance',
        paragraphs: [],
        bullets: [
          'Keep dense operational lists larger than passive reference lists.',
          'Let widgets occupy the narrow informational areas rather than stealing core task space.',
          'Prefer fewer visible lists over too many cramped ones.',
          'Use the board to optimize readability, not to force every possible field into view.'
        ]
      }
    ]
  },
  {
    id: 'board-view-and-display',
    title: 'Board View and Display',
    category: 'Boards',
    keywords: ['board view', 'show board', 'view here', 'display', 'daily work'],
    summary: 'The board is the daily action surface, whether you open it on a dedicated display or inside the app window.',
    sections: [
      {
        paragraphs: [
          'Show Board opens the board on the selected display target. View Here opens the same board view inside the main app window.',
          'This is the interface users should spend most of their time with once structure is in place. The admin workspace is there to shape the experience, not to replace it.'
        ]
      }
    ]
  },
  {
    id: 'summaries',
    title: 'Board and List Summaries',
    category: 'Boards',
    keywords: ['summaries', 'board summary', 'list summary', 'totals', 'counts'],
    summary: 'Summaries turn raw items into quick signals at both board and list level.',
    sections: [
      {
        paragraphs: [
          'Board summaries are for cross-list signals such as open tasks, purchases, overdue items, and other top-level indicators.',
          'List summaries stay closer to a single list, for example count, total cost, total effort, or next due signal.'
        ]
      },
      {
        title: 'Common board-level summary meanings',
        paragraphs: [],
        bullets: [
          'Open Tasks: counts open items from task-type lists.',
          'Board Items: counts currently visible board items.',
          'Total Board Entries: counts all active items defined in the board, even if not currently displayed.',
          'Total Purchases: sums purchase totals across purchase-oriented lists.',
          'Total Effort on Tasks: sums effort across task-oriented lists.',
          'Overdue Items / Overdue Tasks: count late items based on their relevant due or deadline logic.',
          'Archived Items: counts archived entries.'
        ]
      },
      {
        title: 'Board vs list summary mindset',
        paragraphs: [
          'Board summaries should answer broad operational questions. List summaries should answer narrow questions about one list. If a signal only matters inside one list, keep it there instead of crowding the top band.'
        ]
      }
    ]
  },
  {
    id: 'board-summary-slots',
    title: 'Board Summary Slots',
    category: 'Boards',
    keywords: ['board summary slots', 'top bar', 'summary slots', 'header row'],
    summary: 'Board summary slots control what appears in the top summary band of the board.',
    sections: [
      {
        paragraphs: [
          'Each board summary slot defines one visible top-level signal. If a slot is not configured, it should stay out of the way rather than occupying empty space.',
          'Use summary slots for high-value signals you want to see at a glance while working with the board.'
        ]
      }
    ]
  },
  {
    id: 'widgets-and-display',
    title: 'Widgets and Display',
    category: 'Widgets',
    keywords: ['widgets', 'clock', 'weather', 'display style', 'world clock', 'countdown'],
    summary: 'Widgets are configurable board elements with their own display styles, data sources, and layout behavior.',
    sections: [
      {
        paragraphs: [
          'Widgets are configured from the editor, then shown on the board as lightweight information surfaces. Some widgets use the current context, while others can be pointed at custom locations or targets.',
          'Display style is a widget-level setting. Some widgets currently have one style, while others have multiple designed views.'
        ]
      }
    ]
  },
  {
    id: 'widget-clock',
    title: 'Widget: Clock',
    category: 'Widgets',
    keywords: ['clock widget', 'time', 'display style', 'seconds'],
    summary: 'The Clock widget shows the current local time in one of the built-in display styles.',
    sections: [
      {
        paragraphs: [
          'Clock is the local time anchor widget. It is useful both as a practical time surface and as a visual pacing element on the board.',
          'The widget supports display-style choices and can optionally show seconds, depending on the selected style and context.'
        ]
      }
    ]
  },
  {
    id: 'widget-weather',
    title: 'Widget: Weather',
    category: 'Widgets',
    keywords: ['weather widget', 'current location', 'custom location', 'forecast'],
    summary: 'The Weather widget shows current conditions either for the current location or a custom selected location.',
    sections: [
      {
        paragraphs: [
          'Weather supports two location modes: Current Location and Custom Location. This makes it possible to add multiple weather widgets for different places if needed.',
          'Current Location uses the app’s location logic. Custom Location lets you point the widget at a specific searched location.'
        ]
      }
    ]
  },
  {
    id: 'widget-world-clocks',
    title: 'Widget: World Clocks',
    category: 'Widgets',
    keywords: ['world clocks', 'time zones', 'cities', 'global time'],
    summary: 'World Clocks shows several saved locations side by side so you can keep track of other time zones.',
    sections: [
      {
        paragraphs: [
          'World Clocks is useful when your life or work spans multiple regions. Each saved location appears as its own compact time tile.',
          'This widget is best used when you need quick timezone awareness rather than a full scheduling workflow.'
        ]
      }
    ]
  },
  {
    id: 'widget-countdown',
    title: 'Widget: Countdown',
    category: 'Widgets',
    keywords: ['countdown widget', 'deadline', 'milestone', 'target date'],
    summary: 'Countdown keeps one named milestone visible as a live decreasing timer.',
    sections: [
      {
        paragraphs: [
          'Countdown is ideal for one high-importance event, milestone, launch, trip, or deadline you want to keep visible.',
          'It is a motivational and orienting widget, not a replacement for full list-based scheduling.'
        ]
      }
    ]
  },
  {
    id: 'widget-word-of-day',
    title: 'Widget: Word of the Day',
    category: 'Widgets',
    keywords: ['word of the day', 'motivation', 'quote', 'widget'],
    summary: 'Word of the Day adds a small reflective or motivational prompt to the board.',
    sections: [
      {
        paragraphs: [
          'Word of the Day is lightweight by design. It is there to add a little texture or mindset framing without becoming a major interactive surface.',
          'Use it when you want a board that feels a little more alive or personal.'
        ]
      }
    ]
  },
  {
    id: 'birthday-behavior',
    title: 'Birthday Calendar Behavior',
    category: 'Templates',
    keywords: ['birthday behavior', 'perpetual birthdays', 'upcoming birthdays', 'gift task'],
    summary: 'Birthday Calendar behaves like a perpetual annual reminder list rather than a one-time dated task list.',
    sections: [
      {
        paragraphs: [
          'Birthdays are treated as recurring annual events. That means the app should continue surfacing them in future years without the user having to re-enter them.',
          'Upcoming birthday views such as next 10 days or next 30 days are meant to be practical filters over that recurring calendar logic.'
        ]
      },
      {
        title: 'Gift task idea',
        paragraphs: [
          'Birthday Calendar can also act as a lightweight trigger surface for gift-related planning. The birthday itself belongs in the calendar; any resulting preparation work can be turned into a task when useful.'
        ]
      }
    ]
  },
  {
    id: 'shopping-list-logic',
    title: 'Shopping List Logic',
    category: 'Templates',
    keywords: ['shopping logic', 'unit price', 'total cost', 'needed by', 'store'],
    summary: 'Shopping List is built for practical purchases, which is why it tracks pieces, unit price, total cost, and near-term timing.',
    sections: [
      {
        paragraphs: [
          'Shopping List treats purchasing as an operational flow. Pieces and unit price combine into total cost, and the date field behaves as a practical “Needed By” concept.',
          'Store can be used for planning where the item may be bought, but it should remain helpful rather than bureaucratic. The list is meant to stay efficient.'
        ]
      }
    ]
  },
  {
    id: 'custom-list-behavior',
    title: 'Custom List Behavior',
    category: 'Templates',
    keywords: ['custom behavior', 'tasks', 'purchases', 'calendar', 'other'],
    summary: 'A custom list can still declare a broad behavior type so the rest of the app can reason about it more intelligently.',
    sections: [
      {
        paragraphs: [
          'Custom lists are flexible, but they should still tell the app what kind of thing they mostly are. That is what the behavior selector is for.',
          'Behavior does not force the structure of a custom list. It gives the app a better basis for board summaries, due logic, and future cross-list features.'
        ]
      },
      {
        title: 'Available behavior types',
        paragraphs: [],
        bullets: [
          'Tasks: use when the list behaves mostly like action-oriented work.',
          'Purchases: use when the list represents items to buy or acquire.',
          'Calendar: use when the list is driven mainly by dates or recurring events.',
          'Other: use when none of the above captures the list well enough.'
        ]
      }
    ]
  },
  {
    id: 'sorting-and-columns',
    title: 'Sorting Lists from the Board',
    category: 'Lists',
    keywords: ['sorting', 'column click', 'headers', 'ascending', 'descending'],
    summary: 'Clicking a column header in board view temporarily sorts that list by the selected field.',
    sections: [
      {
        paragraphs: [
          'Column-header sorting in board view is meant for quick inspection. Click once for the natural order of that field, then click again to invert it.',
          'Empty values are treated as low values rather than being forced to the bottom regardless of field type.'
        ]
      },
      {
        title: 'How grouped lists behave',
        paragraphs: [
          'When a list is grouped, sorting should respect that structure. The intent is to reorder items meaningfully inside their current grouped context rather than destroy the organization of the list.'
        ]
      }
    ]
  },
  {
    id: 'wishlist-buy-advice',
    title: 'How Wishlist Buy Advice Works',
    category: 'Wishlist',
    keywords: ['wishlist', 'wishmeter', 'priority', 'buy score', 'advised buy order', 'pieces', 'total cost'],
    summary: 'Wishlist separates desire from practical urgency, then combines them with total purchase cost into a buy recommendation.',
    sections: [
      {
        paragraphs: [
          'Wishmeter answers “How much do I want this?” while Priority answers “How justified is it to buy this next?” Those two signals are intentionally separate.',
          'Each wishlist row represents one purchase decision. Pieces and Price combine into Total Cost, and affordability is based on that total purchase cost, not the unit price alone.'
        ]
      },
      {
        title: 'Calculated outputs',
        paragraphs: [
          'Buy Score is a stored calculated value shown in the item header as a percentage. Advised Buy Order is the resulting ranked order and can be shown on the board if you want it visible.',
          'Missing Wishmeter, Priority, or Price are treated as neutral. Scores built with missing data are visually muted so the recommendation stays honest.'
        ]
      }
    ]
  },
  {
    id: 'wishlist-profiles',
    title: 'Wishlist Recommendation Profiles',
    category: 'Wishlist',
    keywords: ['wishlist profiles', 'default', 'balanced', 'priority first', 'value first'],
    summary: 'Recommendation profiles change how strongly desire, practical urgency, and affordability influence Wishlist Buy Score.',
    sections: [
      {
        paragraphs: [
          'Profiles let the same wishlist behave a little differently depending on the philosophy you want the app to follow.',
          'The current built-in profiles are intentionally simple and opinionated so users can choose a direction without having to tune raw weights manually.'
        ]
      },
      {
        title: 'Current profiles',
        paragraphs: [],
        bullets: [
          'Default: Wish 50%, Priority 30%, Price 20%',
          'Balanced: Wish 35%, Priority 35%, Price 30%',
          'Priority First: Wish 25%, Priority 55%, Price 20%',
          'Value First: Wish 10%, Priority 35%, Price 55%'
        ]
      }
    ]
  },
  {
    id: 'system-board-summary-logic',
    title: 'System Summary Logic',
    category: 'Reference',
    keywords: ['system summary', 'reserved summary names', 'open tasks', 'archived items'],
    summary: 'Some summary concepts are application-level meanings rather than arbitrary labels, so they deserve consistent explanation.',
    sections: [
      {
        paragraphs: [
          'Certain summary ideas such as Open Tasks or Archived Items are not just decorative names. They represent specific application-level concepts with defined counting logic.',
          'Treat these as semantic summaries: the label matters because the app and the user both expect a recognizable meaning behind it.'
        ]
      }
    ]
  }
]

export function helpArticleMatches(article: HelpArticle, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  const haystack = [
    article.title,
    article.category,
    article.summary,
    ...article.keywords,
    ...article.sections.flatMap((section) => [
      section.title ?? '',
      ...section.paragraphs,
      ...(section.bullets ?? [])
    ])
  ].join(' ').toLowerCase()
  return haystack.includes(normalizedQuery)
}
