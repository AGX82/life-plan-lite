# Life Plan Lite Development Log

## v0.1.0 Baseline

Date: 2026-04-23

This log captures the major implementation decisions and milestones that led to the first usable baseline.

## Initial Build

- Created an Electron desktop app structure with React renderer.
- Added Admin Mode and Display Mode routes.
- Added a local persistence layer using SQLite-oriented storage.
- Seeded an initial board with sample lists, fields, items, dependencies, and archive behavior.
- Implemented draft/published item state.

## Display and Window Management

- Added an admin option to exit/close the app.
- Added show/hide board behavior so the display can be hidden without closing the app.
- Added connected-display selection for the full-screen board.
- Fixed multi-monitor behavior so the display edit button focuses the existing admin interface instead of opening a duplicate admin panel on the target display.
- Cleaned up Electron cache warning behavior where possible.

## Admin Editing Improvements

- Added editable board/list/item properties.
- Fixed edit-panel usability issues caused by fields being hidden under lower sections.
- Reduced empty spacing and made the admin interface more compact.
- Added contextual actions in the navigation tree.
- Added add board, add list, and add item flows.
- Ensured newly created entities load into the edit panel and close the context menu.
- Fixed text input editing issues for list and item fields.

## Board and List Management

- Added multi-board support.
- Added active board selection with confirmation.
- Prevented newly added boards from becoming active by default.
- Added list move/copy behavior between boards.
- Fixed board-level add-list behavior.
- Added board metadata fields such as description and owner.
- Ensured the active board is visually prioritized.

## Layout System

- Reworked the display board into a 16:9 model with a one-unit top band and a 16 x 8 content grid.
- Reduced the admin display preview into a smaller live layout widget.
- Added grid overlay and drag/resize layout management.
- Added live propagation of list geometry changes to the display board.
- Added edge and corner resizing behavior.
- Prevented overlapping list layout placement.
- Added automatic placement for newly displayed lists.
- Set baseline minimum list size to 4 x 2 grid units.

## Field and Data Model Expansion

- Added type-aware sorting for text, numeric, currency, boolean, date, and deadline fields.
- Added deadline as a special list behavior with generated deadline status.
- Added deadline mandatory/optional support.
- Added deadline color highlighting.
- Added multiple-choice field support.
- Added hyperlink field support and default-browser opening.
- Added date display modes: date, date and time, and time only.
- Added item-level recurrence for time-only date fields.
- Added currency selection for currency fields.
- Added created timestamp and created-by system attributes.

## Grouping

- Chose first-class database entities for groups instead of treating groups only as item metadata.
- Made groups optional, allowing root-level items.
- Allowed items to move between groups within the same list.
- Kept cross-list item moves out of baseline because list schemas may differ.
- Added group editing controls.
- Added group column visibility and summary configuration.
- Updated display board lists to show grouped items hierarchically.

## Display Board Refinement

- Removed redundant status column from the board display.
- Added show/hide controls for display columns.
- Added system-field visibility controls, including ID and dependency visibility.
- Increased display list title prominence.
- Removed list IDs from display headers.
- Made list item rows smaller and more compact.
- Reworked the urgency highlighting rule:
  - Overdue: bold red.
  - 12 hours or less: red.
  - 24 hours or less: orange.
  - 48 hours or less: yellow.
  - 5 days or less: green.
  - Over 5 days or no deadline: neutral.

## Admin Interface Refinement

- Renamed the navigation section to `Board Content Management`.
- Widened and cleaned up the navigation pane.
- Displayed loaded board and active board state.
- Changed lists in the navigation pane into visually distinct expandable sections.
- Moved board list controls to the top-left rail.
- Added a strong small-caps app title.
- Replaced yellow accent usage with teal except for deadline urgency colors.
- Made typography lighter and more elegant while preserving strong emphasis where needed.
- Aligned the board list with the visual start of the navigation pane.

## Baseline and GitHub

- Marked the project as `v0.1.0`.
- Added release notes for the first usable baseline.
- Created a timestamped local source backup.
- Initialized Git locally.
- Created baseline commit `8e7a822 Baseline v0.1.0`.
- Renamed the default branch to `main`.
- Added local tag `v0.1.0`.
- Pushed `main` and `v0.1.0` to GitHub at `https://github.com/AGX82/life-plan-lite`.

## Known Next Areas

- Add automated tests around repository behavior and layout placement.
- Add packaged installer/release workflow.
- Improve layout interactions with swapping/repacking when geometry allows.
- Continue decluttering the admin interface.
- Add predefined list and field templates.
- Add future user management and replace the temporary `admin` created-by value.
