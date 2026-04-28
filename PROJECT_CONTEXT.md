# Life Plan Lite Project Context

This is the living project context for Life Plan Lite. Use it to record product decisions, behavior rules, requirement changes, rationale, and development choices that should guide future work.

Last updated: 2026-04-28

## Product Intent

Life Plan Lite is a local-first Electron desktop application for managing personal planning boards in Admin Mode and keeping a selected board persistently visible in Display Mode.

The app should feel like a practical personal operating board: compact, readable from a distance, quick to edit, and stable enough to trust with daily planning data.

## Core Principles

- Local-first persistence is the default. Data lives locally through the app database.
- Admin Mode and Display Mode are separate workflows.
- Admin Mode may load and edit inactive boards. Mutations should return the affected board snapshot, not silently jump back to the active board.
- Only one board is active/displayed at a time.
- New boards are not made active automatically.
- User-facing destructive actions should be confirmed.
- Display board readability and compactness matter more than decorative flourish.
- Deadline colors are semantic and reserved for urgency, not general decoration.
- UI should stay dense, restrained, and operational rather than marketing-like.
- Existing repo patterns should be preferred over new abstractions unless an abstraction clearly reduces complexity.
- Build/typecheck should pass before declaring a change stable.

## Data And Board Model Decisions

- Boards contain lists, widgets, board summary slots, metadata, and active/display state.
- Lists contain fields, optional groups, items, layout geometry, display visibility, sorting, deadline settings, and template metadata.
- Groups are first-class entities, not only item metadata.
- Items can move between groups within the same list. Cross-list item moves remain out of scope because list schemas may differ.
- Draft/published item state is preserved so Admin Mode edits can be staged before publishing to Display Mode.
- Created-by remains the simple `admin` value until real user management exists.
- Archives preserve closed/cancelled items with close action and comment context.

## Layout Decisions

- Display board uses a 16:9 board model.
- The top band is one unit high and carries board identity plus summary slots.
- Content grid is 16 x 8.
- Displayed lists have grid geometry `x`, `y`, `w`, `h`.
- Minimum displayed list size is 4 x 2.
- Widgets have type-specific normalized geometry.
- Layout updates should prevent overlaps.
- New displayed lists/widgets should auto-place where possible.
- Geometry changes should propagate live to the display board.

## Field And Template Decisions

- Supported field types include text, integer, decimal, currency, duration, boolean, date, choice, hyperlink, and deadline behavior.
- Deadline is implemented as special date behavior on a list.
- Date fields can display date, date+time, or time-only.
- Time-only date fields can support item-level recurrence.
- Recurrence supports none, daily, weekly, interval weeks, monthly, interval months, and selected weekdays.
- Currency fields support practical common currencies including RON, EUR, USD, GBP, CNY, JPY, CAD, AUD, CHF, and PLN.
- Hyperlink fields open through the default browser and should only allow safe external protocols.
- List templates currently include custom, to-do, shopping list, wishlist, health, trips/events, and birthday calendar.
- `custom` is the canonical default template. Legacy `standard` list rows should migrate to `custom`.
- Birthday Calendar keeps its core fields protected while allowing extra fields around them.
- Shopping List `Cost` is a computed template column and should not be edited like normal user-entered fields.

## Summary Decisions

- Board summary slots are now five slots, indexed 0 through 4.
- Columns have separate list-summary and board-summary eligibility.
- Each list may expose up to three list summary fields.
- Each list may expose up to five board summary fields.
- Supported board aggregation methods include `sum`, `count`, `active_count`, `completed_count`, `sum_active`, and `next_due`.
- Date/deadline board summaries infer `next_due`.
- Numeric and currency summaries infer `sum`.
- Text/title-like summaries infer item count.
- Board metadata and board summary slot edits should save atomically through one backend transaction.

## Recent Stabilization Decisions

Date: 2026-04-26

- `Presentation1.pptx` is a local mock-up playground file and should not be tracked.
- Added an exact `.gitignore` entry for `Presentation1.pptx`.
- Fixed schema and migration support for `next_due` summary slots.
- Made `updateBoard` optionally save summary slots in the same transaction as board metadata.
- Kept `updateSummarySlots` available for direct summary-only saves.
- Board Summary edits should keep the user on the Board Summary tab after saving.
- Board summary slots are now eight slots, indexed 0 through 7.
- Empty board summary slots should remain configurable in the editor but should not display on the board.
- Board system summary labels such as `Open Tasks`, `Board Items`, `Total Board Entries`, `Total Purchases`, `Total Effort on Tasks`, `Overdue Items`, `Overdue Tasks`, and `Archived Items` are reserved for their explicit Board source options.
- User-defined board summary slots should not infer system behavior from a typed label.
- Custom lists have a non-behavior-changing `List Behaviour` classification: Task List, Purchases, Calendar, or Other.
- Standard templates imply their behavior for board summaries: To Do is tasks; Shopping List and Wishlist are purchases; Health, Trips & Events, and Birthday Calendar are calendar.
- `Open Tasks` counts active items from To Do lists and custom lists marked as Task List.
- `Board Items` counts items currently displayed on the board, respecting visible lists and current Birthday Calendar filtering.
- `Total Board Entries` counts all active non-archived items defined in the board, including items not currently displayed.
- `Total Purchases` sums purchase totals by currency and returns separate totals when currencies differ.
- `Total Effort on Tasks` sums Effort duration across task-type lists and includes explicit day/hour/minute labels.
- `Overdue Items` counts overdue items from task, purchase, and calendar-type lists; `Overdue Tasks` counts only task-type lists.
- `Archived Items` counts archived items for the board.
- Fixed several mutations so inactive-board editing remains anchored on the affected board snapshot.
- Updated README language from four summary slots to five board summary slots.
- Verified with `npm run typecheck` and `npm run build`.
- Committed stabilization checkpoint as `6ba9222 Stabilize board templates and summaries`.

## List Editing UX Decisions

Date: 2026-04-26

- List-level actions must be available from every list editing tab.
- `Save List` and `Delete List` belong in the list editor header, on the same row as the tabs and aligned to the right.
- Inline field Save buttons are quick shortcuts for one-row edits.
- Global `Save List` supersedes inline saves and must commit all pending list edits made since the last save, including field visibility/configuration changes made in List Structure.
- System column visibility toggles in the list editor are local edits until `Save List` is used.
- Deadline display format is user-configurable. Users may choose Date or Date + Time for the deadline field.
- Time-only deadline fields are not part of the intended deadline behavior.
- Date-only deadlines are valid. When deadline calculations need a time, a date-only deadline resolves to `00:00` on that date.

## To Do And Summary Refinement Decisions

Date: 2026-04-26

- To Do task title fields should be list-summary and board-summary eligible so task counts can be explicit and configurable.
- `Task Name` is a count-summary field name. `Task` remains supported for existing lists.
- To Do lists need three list-level summary signals by default: task count, deadline status, and effort.
- The list-summary field cap is therefore three fields per list.
- Effort is a duration, not a decimal/int quantity.
- Duration values are stored internally as minutes.
- Duration entry should support `hh:mm` style input.
- Duration display supports two modes:
  - `days_hours`: compact `dd:hh:mm` when duration is at least 24 hours, otherwise `h:mm`.
  - `hours`: total `h:mm`, useful for users who prefer seeing `100:00`.
- List summaries should visibly render on displayed list headers instead of existing only as configuration.

## Board Content Tree UX Decisions

Date: 2026-04-26

- The Board Content Management tree should keep section creation actions attached to their sections.
- `New List` belongs in the Lists section header, aligned right from the section label.
- `New Widget` belongs in the Widgets section header, aligned right from the section label.
- The explicit `Edit Board` action is redundant because selecting/clicking the board already opens board editing.
- Section headers may use very subtle top/bottom separators and a faint shade to clarify hierarchy without making the pane decorative.

## List Tab Action Placement Decisions

Date: 2026-04-26

- Actions should live in the tab where their target object is managed.
- `Add Item` and `Add Group` belong in the List Contents tab, above the items table header.
- `Add Column` belongs in the List Structure tab, above the column table header.
- In List Structure, the add-column row and column table header stay fixed; only the list of existing fields scrolls.
- Trying to add a column without a name should focus the column-name field and show the informational notice `Please enter column name`.
- New columns support an `Add on top` option. When selected, the new field is inserted at the top regardless of the current field ordering mode.
- `Add on top` is a persistent per-board preference. When the user toggles it, that state becomes the board default for future column additions across lists and app restarts until changed again.
- Lists have a field ordering mode used by the List Structure tab and board display: Default, Manual, By Name, By Field Type, By Required, and By Visibility.
- Manual field ordering uses one-based row position controls and a push-down reorder model.
- Non-manual field ordering rewrites persisted column order from the selected rule; new columns without `Add on top` are placed according to that rule.
- List Properties should keep list-level properties and list transfer controls, not item/group/column creation.
- Item creation/editing dialogs should render in front of the full app window and open centered both horizontally and vertically.
- List editor grid state must stay synchronized with board-layout changes so a later Save List does not restore stale minimum dimensions.

## Template Finalization Decisions

Date: 2026-04-26

- Template defaults should apply both to newly created lists and, where feasible, to existing template-based lists through migration.
- To Do defaults: sort by Priority highest rank first, prefer a 6x4 board footprint, hide Item ID, Dependencies, People, and Location, and show `% Done`.
- `% Done` remains stored as an integer for now, but it is displayed as a percentage value.
- To Do summary defaults are Task count, Deadline, and Effort. Other template summaries are disabled by default unless explicitly configured later.
- Shopping List uses its deadline column as `Needed By`; the list editor explains this label mapping near the deadline setting.
- Shopping List defaults: sort by Needed By oldest first, prefer 4x4, and hide Item ID, Dependencies, and Link.
- Shopping List `Cost` is a computed currency field derived from `Pieces * Price / pc`; its currency is inherited from `Price / pc` and is not independently editable while the app does not perform currency conversion.
- Wishlist defaults: sort by Wishmeter highest rank first, prefer 6x4, hide Item ID, Dependencies, and Description, include Price as a currency field, and use the five-level Wishmeter scale in this highest-to-lowest order: `It's so fluffy I'm gonna die!`, `My precious!`, `Shut up and take my money!`, `Gotta get me one of those!`, `Asking for a friend...`.
- Health defaults: deadline disabled, sort by Appointment Date oldest first, prefer 5x4, hide Item ID and Dependencies, and rename Frequency to Mentions.
- Health recurrence options include Every x weeks, Monthly, and Every x months. Interval recurrence stores a numeric interval.
- Trips & Events defaults: sort by Start oldest first, hide Item ID, Dependencies, Topic / Theme, and Location, and make Type a non-ranked Choice field.
- Birthday Calendar defaults: hide Item ID, Dependencies, and Location, prefer 6x4, add a Next 30 days board-view option, and treat birthdays as perpetual month/day occurrences.
- Birthday Calendar sort is locked to the Birthday field. Sorting must compare the next month/day occurrence, ignoring the stored year, so the board remains ordered as a perpetual calendar.
- Protected Birthday Calendar core fields cannot be structurally changed or deleted, but users may still change safe configuration such as summary eligibility and board visibility.
- Item Save is the user-facing commit action for item edits; explicit item publishing is not part of the current workflow.

## Configuration Wizard Decisions

Date: 2026-04-27

- The wizard screen mockups take priority over the earlier written wizard notes when there are wording, layout, or field mismatches.
- The wizard follows a clean, low-density flow with one or two decisions per page and a persistent `Skip Configuration Wizard` action in the footer until completion.
- App settings now track `wizardCompleted`; when false in admin mode, the wizard opens automatically as the startup configuration flow.
- The left rail includes an `LPL Wizard` button above the board visibility control so users can run the wizard later to create another board.
- First-run wizard completion reuses and clears the initial seeded `Life Plan Lite` board instead of leaving demo data behind.
- After first run, the wizard starts with a mode choice: quick-add lists to an existing board, create a new board without changing existing data, or reset the app to first-run state.
- Quick-add mode starts at template selection and appends configured lists/widgets to the selected existing board without changing which board is active.
- New-board mode starts at board naming with copy tailored for an app that is already in use.
- Reset mode starts at board naming, then clears boards, lists, items, widgets, archives, users, display config, and app settings only when the wizard is finished/applied.
- The wizard creates no database records until Finish, unless the user closes the wizard and explicitly chooses to apply the current setup.
- Closing the wizard offers three choices: continue the wizard, close without applying, or apply the current setup. Closing without applying discards wizard inputs; on first run it leaves an empty first-run board, while later use preserves existing boards/data unchanged.
- Reset-to-first-run is a destructive action and must require an explicit confirmation before boards, lists, items, widgets, archive entries, and app settings are cleared.
- Once a reset is confirmed and executed, the app should already be empty even if the wizard is later closed without applying a new setup.
- Wizard-created boards use standard list templates, existing validation, standard summary slots, and the same update APIs as normal app editing.
- Wizard list placement uses each template's preferred size cascade and finds the first available board area; lists that cannot be placed are created but not displayed.
- If Shopping List store choices are configured in the wizard, the created Shopping List `Store` field is converted to a non-ranked choice field using one store per line.
- Birthday Calendar wizard interval maps to the existing birthday board-view setting.
- Wizard Shopping List store choices and widget rows must be empty by default in clean builds; screenshot sample data is only illustrative.
- Wizard widgets can be added, removed, and independently marked shown/hidden before Finish.
- Wizard layout planning treats visible lists and widgets as one combined board layout before applying changes, instead of placing widgets into leftover space after lists.
- Wizard final layout validation must include newly created hidden lists/widgets that are about to be shown; batch placement cannot validate only currently visible board elements.
- If wizard creation of a brand new board fails partway through, the partially created board should be cleaned up instead of being left behind as an inactive orphan.
- Adding another list from page 3 inserts the new entry directly under the last list of that same type, not at the bottom of the full list.
- Page 4 store-choice radio controls should render as normal small radio buttons, not as large boxed inputs.
- World Clock widgets can contain 2 to 16 clocks. Width is one board unit per clock and height is fixed at two units.
- Wizard-created World Clock widgets default to two clocks so their size matches the layout assumptions and the intended first-run experience.
- World Clock time zones should be type-searchable from supported system time zones when available.
- World Clock visual style expansion is deferred until the user provides design directions.
- After initial board creation, the app should offer a guided in-app tutorial that explains the main workspace, not just setup choices.
- The tutorial should be reopenable from the left rail and should emphasize the practical workflow: board selection, board tree, edit-panel scope, display targeting, and especially Live Layout as an active resize/reposition/swap tool.
- Wizard board creation should use opinionated placement priorities instead of purely generic packing: To Do lists attempt to anchor top-left, visible widgets reserve and fill the top-right four-column strip, templates with explicit target sizes are placed before flexible templates, and non-fixed-size lists should derive width from their relative visible-column count.
- When wizard placement runs out of board space, the wizard should still create the requested lists/widgets, switch the unplaceable ones to hidden, and explain exactly which elements were created but are not currently displayed so the user can resolve layout later in Live Layout.
- The guided tutorial should include a step for each list editor tab after the general edit-panel explanation, because list tabs define real workflow stages and are worth teaching explicitly.
- Tutorial movement should feel fluid: the spotlight should animate between targets and the explanation card should fade in after the spotlight completes its move.
- Tutorial pacing should stay relaxed rather than snappy; spotlight motion and card fade timing should err slightly slower if needed for readability.
- For list-tab tutorial steps, the spotlight should frame the active tab content, not just the tab label, so the user can connect the explanation with the visible controls.
- The tutorial should darken the surrounding workspace enough to create focus, but not so much that the broader interface context disappears. Users should still be able to form mental anchors against the rest of the screen.
- Tutorial transitions should follow a calm sequence: fade out the current explanation card, move/resize the spotlight, then fade in the next explanation card.
- Consecutive list-tab tutorial steps should behave like content swaps inside the same frame: keep the spotlight and card placement stable, and change the explanation without an obvious jump.
- The tutorial should explicitly signal the handoff from admin/editor mode to the live board view. Before the board-level callouts begin, show the full board unobstructed with a centered overlay that explains the board is the primary day-to-day workspace, while the editor remains for one-time setup and occasional structural changes.
- Wizard pages after the first should provide a Back action in the footer, aligned to the left side of the active content area, while Skip/Next remain on the right.
- In reset mode, the first wizard page after the destructive reset is confirmed should expose a direct `Close Wizard` action in the footer so the user can immediately leave the app empty without extra modal steps.
- When closing the wizard after a confirmed reset, admin mode should force a fresh board reload before dismissing the wizard so stale pre-reset content cannot linger on screen.
- Reset-to-first-run still preserves one empty base board (`Life Plan Lite`) instead of leaving the app with zero boards. This is intentional and counts as the expected empty state.
- The tutorial should use a synthetic in-memory walkthrough board/session rather than a persisted hidden demo board. This keeps the walkthrough stable even when user data is sparse, avoids dummy content leaking into real app state, and sidesteps crash-recovery cleanup rules around hidden tutorial boards.

## Packaging Decisions

Date: 2026-04-27

- Distribution builds must be clean by default: no development database, seed database, screenshot sample data, store examples, or widget examples are packaged.
- The repository may retain local seed-data utilities for development, but the `dist:win` package configuration must not include `resources/seed-data`.
- A clean first run creates only an empty `Life Plan Lite` board and opens the wizard in Admin Mode.
- The Windows executable uses `build/icon.ico`, generated from the app logo PNG while preserving the logo aspect ratio inside a square icon.
- Development and production data must be isolated on the same machine.
- `npm run dev` and other unpackaged development runs use `%APPDATA%\\life-plan-lite-dev`.
- The electron-builder portable executable uses a `portable-data` folder beside the `.exe` when the portable runtime exposes `PORTABLE_EXECUTABLE_DIR`.
- Before clean packaging/testing that might affect local app data, back up the current user database/config so the dev environment can be restored.
- Weather widgets rely on Electron geolocation permission handling and should explicitly request/allow geolocation at the session level instead of failing silently.

## Release Decisions

Date: 2026-04-27

- `v1.0.0` is the first major release of Life Plan Lite and is considered safe for real use from the portable Windows executable.
- The release-safe production artifact is the electron-builder portable wrapper executable, not the unpacked `win-unpacked` app binary.
- After tagging a stable release, ongoing work continues on a development version string rather than the next final semantic version.
- Post-`v1.0.0` development starts from `1.1.0-dev`.
- `v1.0.1` is a hotfix patch release for `v1.0.0` focused on first-run wizard stability and layout correctness.
- Hotfix releases should be published with explicit patch notes that call out the user-facing regressions they fix, especially when the affected flow is startup/onboarding.
- After `v1.0.1` is tagged and published, ongoing work resumes from `1.1.0-dev`.
- During active post-release stabilization, the development version should advance with meaningful behavior or critical-fix checkpoints so local builds and packaged test executables are easy to distinguish.
- `v1.2.0` is the first minor release after the initial stabilization cycle. It promotes the configuration wizard, tutorial, reset flow, and wizard-driven layout behavior to the stable line.
- After `v1.2.0`, ongoing development should stay on a `1.2.x-dev` line until the scope of upcoming work clearly justifies the next minor release as `1.3.0`.
- The current post-`v1.2.0` development line continues from `1.2.1-dev`.
- `v1.3.0` is the next stable minor release and promotes the refined guided tutorial experience, the synthetic walkthrough board, and the polished admin-to-board onboarding flow to the public line.
- After `v1.3.0`, ongoing development continues from `1.3.1-dev` until the next stable release is intentionally cut.

## Development Practice Decisions

- Record future behavior, requirement, and rationale decisions in this file as they are made.
- Keep local scratch/mock-up files out of Git unless they are intentionally promoted into app assets or docs.
- Commit stable checkpoints after meaningful, verified changes.
- Avoid unrelated refactors while stabilizing feature work.
- Prefer focused repository-level fixes over UI-only workarounds when a behavior is part of the domain model.

## Open Next Areas

- Run one final clean-package smoke test before declaring `v1.0.0`.
- Add automated tests around repository behavior and layout placement.
- Continue refining admin density, readability, and workflow efficiency.
- Improve layout interactions with swapping/repacking where it adds real usability.
- Revisit user management when the app needs real users beyond the current `admin` placeholder.
