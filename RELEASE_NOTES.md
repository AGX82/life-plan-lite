# Life Plan Lite Release Notes

## v0.3.1 - Board interaction and theme switching

- Added live theme switching in admin, with `Midnight Clear`, `Liquid Gunmetal`, and `Black Glass Blue`.
- Extended board view with direct item interaction: click rows to edit, quick-add items from the `+` header action, and open list settings from the gear action.
- Made board-side item actions save directly back into the visible board flow, including save-and-publish behavior for quick edits and new items.
- Added board-side list settings modal for practical list behavior and field management without leaving display mode.
- Fixed modal overflow so long dialogs scroll cleanly inside the viewport.
- Removed redundant editor container styling across themes and improved theme consistency for controls and modal surfaces.

## v0.3.0 - Midnight Clear and board close actions

- Added board-row close controls with green complete and red cancel actions.
- Added configurable close confirmation behavior: with comments, without comments, or no confirmation.
- Stored closure metadata in the archive model and reserved the system field name `close_comm`.
- Added reserved-name validation for list column creation and updates.
- Saved `theme-midnight-clear` as the active visual direction.
- Shifted the UI toward colder blue-black transparent glass, including cleaner structural header bands and improved board readability.

## v0.2.0 - Liquid Gunmetal theme

- Saved `theme-liquid-gunmetal` as the active visual direction.
- Added dark gunmetal/crude-oil gradient styling across admin and display views.
- Refined liquid-glass panels with translucent fills, brighter borders, blur, and restrained six-pixel corners.
- Aligned display header summary fields with the edit button and changed summaries to a compact label-left/value-right layout.
- Themed scrollbars and in-app context menus.
- Preserved the earlier `Black Glass Blue` visual experiment in theme documentation.

## v0.1.0 - First usable baseline

- Local-first Electron app with admin and display modes.
- Multi-board management with one active displayed board.
- Configurable lists, fields, items, groups, deadlines, recurrence, currencies, hyperlinks, and summaries.
- Board layout editor with live 16 x 8 grid positioning and display-window sync.
- Display-board controls for target screen selection, show/hide board, and app exit.
- Deadline highlighting rules for overdue and upcoming items.
- Refined admin navigation and board content management interface.
