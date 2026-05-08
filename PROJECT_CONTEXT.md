# Life Plan Lite Project Context

This file is the current-truth reference for Life Plan Lite. It should describe how the app is intended to work now, not the full history of how a decision evolved.

Last updated: 2026-05-08

## Product Intent

- Life Plan Lite is a local-first Electron desktop application for managing personal planning boards.
- The app has two primary surfaces:
  - `Admin Mode` for structure, configuration, editing, and review
  - `Display Mode` for the full-screen operational board
- The product should feel dense, calm, readable, and dependable rather than decorative or marketing-like.
- Only one board can be active/displayed at a time, but inactive boards can still be opened and edited in Admin Mode.

## Core Operating Principles

- Data is stored locally through the app database.
- Admin Mode and Display Mode are separate workflows, but the same entities must follow the same logic and behavior regardless of where they are opened.
- There should be one live behavior path for each entity type:
  - one list editing path
  - one item editing path
  - one shared logic model behind board/admin access
- Destructive user actions should be confirmed.
- Build and typecheck should pass before a change is considered stable.

## Data Model

- Boards contain:
  - lists
  - widgets
  - board summary slots
  - metadata
  - active/display state
- Lists contain:
  - fields
  - optional groups
  - items
  - layout geometry
  - display visibility
  - sorting rules
  - deadline settings
  - template metadata
- Groups are first-class entities.
- Items may belong to groups and, for Project lists, may also belong to parent items through `parentItemId`.
- Draft/published item state is preserved so Admin edits can be staged before Display Mode reflects them.
- Closed/cancelled items are archived with action and comment context.

## Board And Layout Model

- Display board uses a 16:9 model.
- The top band is one unit high and carries board identity plus board summary slots.
- The content grid is `16 x 8`.
- Lists and widgets use normalized grid geometry with overlap prevention.
- Displayed elements should auto-place where possible and geometry changes should propagate live to the board.
- List minimum display size is generally `4 x 2`, except:
  - `Project` lists have a minimum width of `10`
- Widget geometry is type-specific and normalized by widget rules.

## Field Model

- Supported field types:
  - text
  - integer
  - decimal
  - currency
  - duration
  - boolean
  - date
  - choice
  - hyperlink
- `Deadline` is implemented as special date behavior on a list.
- Date fields can display:
  - date
  - date + time
  - time only
- Time-only date fields may support recurrence.
- Hyperlinks open through the default browser and should only allow safe external protocols.

## Duration And Effort

- Duration values are stored internally as minutes.
- Current UX treats duration and effort as an `hours + minutes` concept everywhere.
- The app no longer uses day-based duration editing or display for normal user-facing workflows.
- Duration values should display with explicit unit labels such as:
  - `4h 0min`
  - `16h 30min`
- The old `days + hours` / `8h day` / `24h day` interpretation is considered legacy and should not drive current UX.

## Template System

- Built-in list templates:
  - `custom`
  - `todo`
  - `shopping_list`
  - `wishlist`
  - `project`
  - `health`
  - `trips_events`
  - `birthday_calendar`
- `custom` is the canonical default template.
- Template-specific behavior and UI should live in template modules on top of a shared core, not as scattered renderer special cases.

## Template Behaviors

### To Do

- Behavior category: `tasks`
- Supports deadlines, priority, effort, progress, and comments.
- Default summaries are task count, deadline, and effort.

### Shopping List

- Behavior category: `purchases`
- `Needed By` is the shopping-specific label for the deadline field.
- `Cost` is a computed field based on `Pieces * Price / pc`.
- `Cost` currency is inherited from `Price / pc`.

### Wishlist

- Behavior category: `purchases`
- Core concepts:
  - `Wishmeter` = desire
  - `Priority` = practical urgency
  - `Pieces`
  - `Price`
  - calculated `Total Cost`
  - calculated `Buy Score`
  - calculated `Advised Buy Order`
- One wishlist row represents one purchase decision, not necessarily one physical unit.
- `Buy Score` is budget-agnostic for now and is calculated from:
  - Wishmeter
  - Priority
  - affordability based on total purchase cost
- Built-in recommendation profiles:
  - `Default`: Wish `50%`, Priority `30%`, Price `20%`
  - `Balanced`: Wish `35%`, Priority `35%`, Price `30%`
  - `Priority First`: Wish `25%`, Priority `55%`, Price `20%`
  - `Value First`: Wish `10%`, Priority `35%`, Price `55%`
- Missing recommendation inputs are treated as neutral rather than blocking calculation.
- `Buy Score` is stored data and shown in item details, not as a normal board column by default.
- `Advised Buy Order` is the board-facing calculated ordering field and may be shown or hidden by the user.

### Health

- Behavior category: `calendar`
- Health uses a template-specific board presentation.
- Standard sections are:
  - Recurring Appointments
  - Scheduled Investigations
  - Treatment Plan
- Each section may present a different set of visible columns in board view.

### Trips & Events

- Behavior category: `calendar`
- Intended for high-level events, travel, and plans with dates, type, topic/theme, and location.

### Birthday Calendar

- Behavior category: `calendar`
- Birthdays are treated as perpetual month/day occurrences rather than one-time historical dates.
- Birthday board display supports interval-style views such as:
  - this week
  - this month
  - next 10 days
  - next 30 days
  - next 2 months
  - all
- Core birthday fields remain protected, though safe visibility/configuration changes are allowed.

### Project

- Behavior category: `tasks`, but Project lists are intentionally distinct from generic personal task lists.
- The Project template is meant for high-level project overview, not a full PM tool.
- Project supports real item hierarchy through `parentItemId`.
- Groups remain phase/stream buckets; nested items represent:
  - task
  - sub-task
  - work package
- First-pass project fields:
  - Type
  - Responsible
  - Planned Start
  - Planned End
  - Actual Start
  - Actual End
  - Effort
  - Output / Deliverable
- First-pass project item types:
  - Task
  - Milestone
  - Project Start
  - Project End
- Milestone-style items:
  - use `Planned Date` / `Actual Date` semantics in the editor
  - do not expose `Parent Task`
  - persist with `parentItemId = null`
  - render as shared checkpoints, not as subordinate children
- `Project Start` and `Project End` are hidden boundary items for overall timeline control.
- Task dates outside parent or project boundary ranges should trigger a confirmation flow:
  - extend parent/boundary range
  - or confine child dates
- Milestones should never remain earlier than the latest planned completion of their dependencies; if needed, milestone planned dates should auto-update and the user should be informed.
- Project board uses a synthetic `Gantt` display column inside the normal list shell.
- If planned/actual date columns are enabled on the board, they remain visible alongside the Gantt.
- Project milestone deliverable rollups remain planned, not yet implemented.

## Board Summaries

- Board summary slots currently use `8` positions.
- Summary slots should describe the active board surface, not hidden data elsewhere.
- Board-level system summaries such as:
  - Open Tasks
  - Board Items
  - Total Board Entries
  - Total Purchases
  - Total Effort on Tasks
  - Overdue Items
  - Overdue Tasks
  - Archived Items
  are reserved labels with explicit meanings.
- `Open Tasks` should summarize displayed task-type content on the board and must not include hidden lists.
- `Project` lists are excluded from the generic task-focused board summaries such as:
  - Open Tasks
  - Overdue Tasks
  - Total Effort on Tasks
- Board-facing summary presentation should stay compact, readable, and signal-oriented rather than oversized.

## List And Board Presentation

- List-facing board labels may differ from underlying field names.
- Real fields may have an optional board/display name override.
- System/reserved board fields may also have board-facing label overrides.
- If no override is set, the app should fall back to the true field name/default label.
- Manual board-field ordering should treat one shared board-field layer including:
  - real list columns
  - system board fields
  - reserved/calculated board fields

## Sorting

- Board-view header sorting is an ad-hoc display action, not a structural list change.
- Header sorting is a strict two-state toggle:
  - natural direction
  - inverted direction
- Grouped lists should sort within groups/buckets rather than flattening group structure.
- Empty values are treated as low values for sorting rather than always being forced to the bottom.

## Wizard

- The wizard screen designs are the source of truth when design and older text notes differ.
- The wizard supports:
  - first-run setup
  - quick-add to an existing board
  - create a new board
  - reset app to first-run state
- Wizard should be able to create lists and widgets even when the board cannot currently display all of them; unplaceable items should be created hidden and explained to the user.
- Wizard uses opinionated placement priorities rather than generic packing alone.
- The wizard is a fast setup workflow, not the main place for deep product education.

## Help And Tutorial

- The left-rail `Help` entry is the primary knowledge surface.
- Help combines:
  - Guided Tour
  - search
  - browsable help articles
- The Guided Tour should stay brief and focused on the main mental model.
- Detailed feature behavior belongs in Help articles, not an endlessly growing tour.
- Once a feature is considered stable enough to be done, its Help page should be added as part of finishing the work.

## Weather Widget

- Weather supports:
  - current location
  - custom location
- Custom location currently uses a search-driven flow.
- The intended future UX is a single searchable select/autocomplete field rather than a multi-step search + select interaction.

## UI And Workflow Rules

- The board should remain compact, operational, and readable.
- The same entity should behave the same whether opened from Admin Mode or Board Mode.
- List headers, widget headers, summary rows, and template-specific board presentations may be specialized, but underlying behavior should remain consistent.

## Engineering Architecture

- The preferred architecture is:
  - shared domain/app logic
  - template modules for specialized behavior/presentation
  - focused renderer modules by workflow responsibility
- The app is actively being decomposed away from a monolithic `App.tsx`.
- Already extracted:
  - Help modal and help content
  - tutorial content
  - widget subsystem
  - shared item editor
  - shared group editor
  - shared editor chrome
  - shared list/value helpers
  - template registry and template modules
  - list editor module and support files
  - shared modals and navigation context menus
  - widget editor module
  - board display module
  - layout engine module
  - project helper module
  - configuration wizard module
  - shared renderer app types
- Current rule:
  - split by coherent workflow ownership
  - avoid duplicate live wiring
  - keep business rules portable for future web/mobile work
- Current practical status:
  - extracted modules are now the active execution path for list editing, widget editing, board display, layout math, project-aware item editing, and the wizard
  - `App.tsx` is still the top-level orchestrator and still contains some legacy inline copies/helpers that should be cleaned up in follow-up passes
  - `App.tsx` is down to roughly `6.3k` lines and is materially smaller than the earlier `9k+` state

## Roadmap-Relevant Open Areas

- Continue decomposing and cleaning `App.tsx`, especially:
  - remove legacy inline copies now superseded by extracted modules
  - move residual board-display presentation/sorting helpers beside `board-display/`
  - move remaining project/gantt helpers fully beside `project/`
  - keep reducing orchestration-only code toward a thinner shell
- Add automated tests around repository behavior and layout placement.
- Add Stocks widget.
- Add Budget list template.
- Add Remaining Work calculated column for effort-based task lists.
- Continue Project refinements, especially milestone deliverable rollups and wizard integration.
- Continue Help-library growth as stable features accumulate.
