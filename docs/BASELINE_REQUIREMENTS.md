# Life Plan Lite Baseline Requirements

Baseline version: `v0.1.0`

This document summarizes the agreed baseline requirements implemented for the first usable version of Life Plan Lite. The original business requirements document is stored in the repository as `20260423_LPL_BR.docx`.

## Product Goal

Life Plan Lite is a local-first desktop board application for keeping personal planning information persistently visible on a selected display while managing the content from an admin interface.

## Core Application Model

- The application runs as an Electron desktop app.
- The app supports Admin Mode and Display Mode.
- The user can manage multiple boards.
- Only one board can be active/displayed at a time.
- The active board is shown on the selected display.
- Boards, lists, groups, list fields, and items are persisted locally.
- Data is stored locally through SQLite-oriented persistence.

## Board Management

- Create new boards without automatically making them active.
- Select which board is loaded in admin mode.
- Make a loaded board active after confirmation.
- Keep the active board visually prioritized in the navigation.
- Edit board metadata including name, description, owner, and active status.
- Display active-board status in the admin navigation pane.

## Display Management

- Select the target display from connected monitors.
- Show the board on the selected display.
- Hide the board without closing the app.
- Exit/close the app from admin mode.
- If multiple displays are connected, using the display edit button should focus the existing admin window instead of opening a second admin panel on the display screen.

## Board Layout

- The display board uses a 16:9 aspect ratio.
- The top band is one unit high and contains board header and summary information.
- The content grid is 16 x 8 units.
- Lists shown on the board have grid geometry: X, Y, W, H.
- Minimum displayed list size is 4 x 2 grid units.
- List geometry can be changed through a visual grid editor.
- Geometry changes propagate live to the display board.
- New displayed lists should be placed automatically in the first available valid slot where possible.
- The layout system should prevent overlapping lists.

## List Management

- Create, rename, edit, move, duplicate, and delete lists.
- Move or copy lists between boards.
- Choose whether a list is shown on the display board.
- Define list fields/columns with supported data types.
- Configure field visibility for the display board.
- Keep system fields available in admin mode while allowing them to be hidden from the display board.
- Hide redundant status fields from the display board.

## Field Types

Supported baseline field types:

- Text
- Integer
- Decimal
- Currency
- Boolean
- Date
- Deadline
- Multiple choice
- Hyperlink

Currency fields support a selected currency, including common currencies such as RON, EUR, USD, GBP, CNY, JPY, CAD, AUD, and related practical options.

Hyperlink fields open links through the default browser.

## Date, Deadline, and Recurrence

- Date fields can display date, date and time, or time only.
- Deadline is a special date behavior enabled per list.
- Lists can mark deadline as mandatory or optional.
- Deadline status is automatically generated and not directly edited by the user.
- If no deadline is set, the status reads as no deadline set.
- Time-only date fields can define recurrence at item level.
- Item-level recurrence supports patterns such as daily, weekly, every two weeks, and selected weekdays.

Deadline highlighting rules:

- Overdue: bold red font.
- 12 hours or less: red font.
- 24 hours or less: orange font.
- 48 hours or less: yellow font.
- 5 days or less: green font.
- Over 5 days or no deadline: white/neutral font.

## Item Management

- Create, edit, and delete items.
- Mark items as completed/done.
- Publish draft item changes to the display board.
- Track created timestamp and created-by information.
- Use simple `admin` ownership for created-by until user management exists.
- Item fields are generated dynamically based on the list definition.
- Dependencies can be tracked and optionally displayed.

## Groups

- Groups are first-class entities.
- Groups are optional; items can exist at list root level.
- Items can be nested under groups.
- Moving items between groups within the same list is allowed.
- Moving items between lists is not part of the baseline because lists may have different schemas.
- Groups can show or hide their ID and relevant columns.
- Groups can summarize child item fields.
- Supported summary methods include Sum, Max, Avg, and item count.
- Displayed lists should show grouped items hierarchically rather than only as a group column.

## Sorting

Lists can sort by configured fields using type-aware directions:

- Text: A to Z / Z to A.
- Integer and decimal: highest / lowest.
- Currency: most expensive / cheapest.
- Boolean: true/yes on top or false/no on top.
- Date: oldest to newest or newest to oldest.
- Deadline: closest/farthest urgency-oriented sorting.

## Admin Interface

- Admin mode focuses on board content and display management.
- The main navigation pane is titled `Board Content Management`.
- Navigation displays loaded board state and active board state.
- Lists are shown as visually distinct expandable/collapsible sections.
- Items are visually smaller than list headers to communicate hierarchy.
- The interface uses lighter typography overall, with a strong small-caps app title.
- Primary accent color is teal, with deadline colors reserved for urgency.
- The publish button is labeled `Publish All Board Changes` and indicates whether there are unpublished changes.

## Display Board Interface

- List titles are visually prominent.
- List IDs are hidden from display headers.
- Item IDs can be shown or hidden through field visibility controls.
- Displayed columns are controlled by field show/hide settings.
- Rows are compact to maximize readable board content.
- Grouped items are displayed hierarchically.

## Baseline Non-Goals

- Multi-user authentication is not implemented yet.
- Cloud sync is not implemented yet.
- Packaged installer generation is not implemented yet.
- Automated tests are not yet part of the baseline.
- Advanced layout swapping/collision rearrangement is planned but not part of `v0.1.0`.
