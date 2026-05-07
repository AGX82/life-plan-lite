# Life Plan Lite Project Context

This is the living project context for Life Plan Lite. Use it to record product decisions, behavior rules, requirement changes, rationale, and development choices that should guide future work.

Last updated: 2026-05-07

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

## Post-v1.3.1 Polish Decisions

Date: 2026-04-28

- Packaged weather behavior should not depend on renderer-side third-party fetches alone. Weather fallback location lookup and weather API retrieval should use Electron's desktop-side bridge so production builds remain reliable even when packaged renderer networking behaves differently from dev.
- Board top-summary slots should size primarily to their actual content instead of expanding like equal-width pills.
- Top-summary labels should stay white and slightly more readable; summary values carry the semantic accent color.
- Board-level cost/purchase summaries should render in the alert color family, while counts and most other indicators stay in the positive color family unless explicitly reclassified later.
- Total Purchases board summaries should display rounded whole-number totals without decimals, grouped by currency code.
- Widget headers should match list-header height and typography so mixed list/widget boards feel visually aligned.
- World Clock tiles should follow the same family language as the main clock widget: location label outside the tile in green, weekday inside the tile in muted text, GMT offset retained inside the tile, and the date shown below.
- Clock, Countdown, and World Clock are moving onto a shared digital widget design system rather than being styled independently. Clock now supports two explicit display styles, while Countdown and World Clock each use one canonical style for now.

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
- `v1.3.1` is a hotfix release for the `v1.3.x` line focused on packaged weather reliability and board summary readability.
- After `v1.3.1`, ongoing development resumes from `1.3.2-dev`.
- `v1.4.0` is the next stable minor release and promotes the Help surface, Wishlist recommendation engine, board-view sorting, custom-location weather, and the first high-level Project template to the stable line.
- After `v1.4.0`, ongoing development should continue from `1.4.1-dev`.

## Forward Planning Decisions

Date: 2026-04-28

- `v2.0.0` is planned as the last major local-first desktop generation before the product's cloud transition becomes the main focus.
- `v2.0.0` must therefore do two jobs at once: add the next major capability set for users and establish the product/platform prerequisites for online evolution.
- Candidate user-facing scope for `v2.0.0` currently includes:
  - calendar widget
  - expanded widget visual modes
  - Project list with Gantt mode
  - richer task progress and effort intelligence
  - budget management list
  - rendering optimization across display ratios
  - users/login
  - multiple views of the same board
- The cloud-readiness work for `v2.0.0` is not optional platform polish; it is part of the release definition itself.
- In particular, `v2.0.0` should establish:
  - real user identity and ownership
  - API-ready service boundaries
  - sync-friendly metadata and revision/version discipline
  - board views as first-class entities
  - stronger backup/export/migration discipline
  - higher-confidence tests around migrations and domain rules

## Backlog Intake Decisions

Date: 2026-04-28

- Production-only regressions or environment mismatches, such as Weather working in dev but failing in the packaged app, should be treated as near-term stabilization work rather than deferred long-term roadmap items.
- Navigation tree default behavior should favor a calm startup state: lists collapsed on app launch, session-local expansion preserved while the app remains open, and expansion state reset on restart.
- Word of the Day widget should move to a square aspect model with a minimum board size of 2x2.
- Widget editing should consistently expose a layout/view selector for every widget type. If a widget currently has only one available presentation, the selector should still exist and show a single default option.
- Board summary visual treatment should be tightened: minimum width per summary field, horizontal growth when content requires it, smaller type than the current board body emphasis, and non-white emphasis styling so summaries read like signals rather than oversized labels.
- List Contents should keep the header fixed while rows scroll beneath it; content should never visually scroll over the header.
- Database migration, export, and import are explicit backlog items and are strategically aligned with the pre-cloud transition work rather than being optional utilities.

## Post-v1.3 Polish Decisions

Date: 2026-04-28

- The navigation tree should start with lists collapsed on application launch. Expansions made during the session may remain while the app is open, but startup should reset to the calmer collapsed state.
- Word of the Day widgets use a square aspect model with a minimum size of 2x2 board units.
- Widget editors should always expose a display-style selector. If a widget currently supports only one presentation mode, the selector should still be present and show a single default option.
- Widget setup flows should not offer multiple visual mode choices unless those modes are actually supported in the current product line.
- Board summary slots in the display header should use a tighter visual treatment than the main board body and should size from a readable minimum width instead of forcing all slots into equal-width white blocks.
- Weather widget production fallback should prefer resilient approximate-location lookup paths so packaged builds are not overly dependent on one browser-side location service succeeding.

## Development Practice Decisions

- Record future behavior, requirement, and rationale decisions in this file as they are made.
- Keep local scratch/mock-up files out of Git unless they are intentionally promoted into app assets or docs.
- Commit stable checkpoints after meaningful, verified changes.
- Avoid unrelated refactors while stabilizing feature work.
- When new feature ideas are proposed, evaluate them not only on desirability but also on release fit, sequencing, architectural timing, and adjacency to related planned capabilities.
- Product guidance should explicitly advise whether a new idea is best pursued now or deferred to a later release because of dependency grouping, implementation efficiency, architectural readiness, or the risk of building something that would likely be reworked once later roadmap items arrive.
- Prefer focused repository-level fixes over UI-only workarounds when a behavior is part of the domain model.

## Board Interaction Decisions

Date: 2026-05-06

- In board view, clicking a visible list column header should apply an ad-hoc sort for that specific list on the display surface without changing the list's saved structural sort configuration.
- Board header sorting should be a strict two-state toggle: default/natural direction on the first click and inverted direction on the second click.
- Ad-hoc board sorting should preserve group structure. Items should sort within their current group/root bucket rather than flattening the list across groups.
- Empty values should be treated as low values during ad-hoc board sorting rather than always being forced to the bottom. For example, empty text sorts before `A`, empty numeric/currency/duration behaves like `0`, and empty ranked-choice values sort below the lowest defined rank.

## Weather Widget Decisions

Date: 2026-05-06

- Weather widgets should support both `Current location` and `Custom location` modes so multiple weather widgets can coexist on the same board with different targets.
- Custom weather location selection should be driven by live location search rather than a fixed internal dropdown list.
- The current multi-step custom-location workflow is acceptable as an intermediate implementation, but the intended UX is a single searchable select/autocomplete field rather than separate search-input and result-selection controls.

## Wishlist Recommendation Decisions

Date: 2026-05-06

- The `Wishlist` list type should distinguish between emotional desire and practical purchase urgency by keeping `Wishmeter` and `Priority` as separate ranked fields.
- `Wishmeter` represents how much the user wants an item; `Priority` represents how justified it is to buy the item next.
- `Recommended Buy Score` should be a calculated, budget-agnostic field in the first implementation phase.
- The score should be calculated from `Wishmeter`, `Priority`, and `Price`, with each value normalized relative to the other items in the same wishlist rather than against absolute thresholds.
- Price influence should be modeled as relative affordability within the current wishlist, so cheaper items in that list score better than more expensive ones.
- The first implementation should use built-in weighting profiles rather than free-form user-defined sliders.
- The default profile for Wishlist should prioritize desire first: `Wishmeter 50%`, `Priority 30%`, `Price 20%`.
- The `Balanced` profile should use `Wishmeter 35%`, `Priority 35%`, `Price 30%`.
- The `Priority First` profile should use `Wishmeter 25%`, `Priority 55%`, `Price 20%`.
- The `Value First` profile should strongly favor affordability: `Wishmeter 10%`, `Priority 35%`, `Price 55%`.
- In the `Value First` profile, `Wishmeter` should behave mainly as a tie-breaker or low-impact emotional adjustment rather than a primary driver.
- A later `budget-aware` recommendation mode may be added once Budget capabilities exist, but it should be a separate model from the initial budget-agnostic recommendation score.
- Missing `Wishmeter`, `Priority`, or `Price` data should not block score calculation in the first implementation. Missing inputs should be treated as neutral rather than best or worst values.
- Wishlist items whose `Buy Score` is calculated with one or more missing inputs should be visually muted or otherwise distinguished, with a hover explanation clarifying which field is missing and that the missing field did not influence the score.
- The user-facing calculated fields should be named `Buy Score` and `Advised Buy Order`.
- `Buy Score` should be displayed in the item details header rather than as a standard board column by default.
- `Buy Score` should be stored as data in the database/domain model even though it is not shown as a normal board column in the first implementation.
- `Buy Score` should be displayed as a percentage in the item details header rather than as a raw decimal or `x/1` value.
- `Advised Buy Order` should be a non-editable calculated field derived from `Buy Score`.
- `Advised Buy Order` should be available as a displayable field in the board view, but it should not be forced on by default.
- The board should stay lean: users primarily need the resulting order on the board, while the synthetic score is informational and belongs in the item details surface.
- Tie-breaking for equal wishlist recommendation scores should resolve in this order: higher `Priority`, higher `Wishmeter`, lower `Price`, then item name A-Z.
- The tutorial should include a dedicated explanation of how the Wishlist template works, including the distinction between `Wishmeter`, `Priority`, `Buy Score`, and `Advised Buy Order`.
- The onboarding tutorial should explain Wishlist as part of the list-template walkthrough using synthetic example data, including the distinction between desire (`Wishmeter`), practical urgency (`Priority`), total purchase burden (`Pieces` + `Total Cost`), and the resulting `Buy Score` / `Advised Buy Order`.
- The left-rail `Tutorial` entry should evolve into `Help`, which opens a help surface rather than immediately launching the guided walkthrough.
- Help should become the home for detailed, searchable reference content, while the guided tutorial should stay brief and focused on the main mental map of the workspace.
- The Help surface should include three core capabilities: start the Guided Tour, search help topics, and browse structured help articles by topic.
- Help content should be organized as discrete topic pages for key elements of the app rather than one long undifferentiated manual.
- Help should include dedicated pages for the app menu, wizard, application settings, admin workspace structure, groups, live layout, list tabs, list structure, deadline logic, system fields / reserved names, item actions, summaries, widgets, board view, and each predefined list template.
- After a functionality is considered stable enough to count as finished, its Help page should be added as part of completing that work rather than deferred indefinitely.
- High-value behavioral topics for Help at the current product stage include widget-specific pages, board summary logic, birthday behavior, shopping-list logic, custom-list behavior, and Wishlist recommendation profiles.
- Ranked-field normalization for Wishlist recommendation should be based on the relative position of the selected option within the current ranked scale, not on hardcoded assumptions about there being exactly five levels.
- Price normalization for Wishlist recommendation should use a relative affordability model within the current wishlist, with log-normalization to soften extreme price gaps.
- A Wishlist row should represent one purchase decision, not necessarily one physical unit.
- Wishlist should therefore support `Pieces` plus calculated `Total Cost`, and affordability in `Buy Score` should be based on total purchase cost rather than unit price.
- Missing `Pieces` in Wishlist should be treated as an implicit quantity of `1` so older lists and simple one-off purchases remain natural.
- Missing `Price`, `Priority`, or `Wishmeter` values should be treated as neutral (`0.5`) rather than blocking calculation or being interpreted as best/worst values.
- The first implemented Wishlist recommendation profiles are:
  - `Default`: Wish `50%`, Priority `30%`, Price `20%`
  - `Balanced`: Wish `35%`, Priority `35%`, Price `30%`
  - `Priority First`: Wish `25%`, Priority `55%`, Price `20%`
  - `Value First`: Wish `10%`, Priority `35%`, Price `55%`
- The `Project` list should stay intentionally high-level and should not drift into a full project-management tool.
- Project structure now needs real item hierarchy (`parentItemId`) instead of only groups. Groups remain bucket/phase containers, while nested items represent task -> sub-task -> work-package structure.
- The Project template should have a minimum board width of 10 grid units.
- First-pass Project fields are `Type`, `Responsible`, `Planned Start`, `Planned End`, `Actual Start`, `Actual End`, `Effort`, and `Output / Deliverable`.
- First-pass Project item types are `Task`, `Milestone`, `Project Start`, and `Project End`.
- Parent/child date consistency matters for Project items. If a child date falls outside the chosen parent range, the user should be prompted to either extend the parent range or confine the child inside it.
- The first Project board rendering pass should live inside the normal list shell with a synthetic `Gantt` display column rather than as a separate standalone board surface. This keeps the project overview aligned with the existing board interaction model while we refine proportions.
- Milestone-style Project items (`Milestone`, `Project Start`, `Project End`) should use `Planned Date` and `Actual Date` in the editing UI instead of separate start/end inputs.
- Project board ordering should place milestone-like items immediately after the last dependency block inside the same sibling bucket whenever dependencies are defined.
- `Project Start` and `Project End` are one-off boundary items for the overall project timeline and should not be treated as ordinary task dates.
- Task dates that fall outside the current Project Start / Project End boundaries should trigger a confirmation prompt so the user can either extend the project boundary items or confine the task dates.
- If the user enables planned/actual start/end columns on the Project board, they should remain visible alongside the Gantt rather than being hidden by it.
- `Project Start` and `Project End` should influence the Gantt timeline range, but they should not be rendered as visible task rows on the board.
- Milestones should never keep a planned date earlier than the latest planned completion date of the tasks or task subtrees they depend on; if needed, the milestone planned date should be auto-updated and the user informed.
- Milestone-style items should never visually read as subordinate children of one task. They are shared checkpoints and should render as sibling/root-level checkpoints even when they depend on nested task blocks.
- Milestone dependency context should be shown explicitly using dependency-name chips rather than a vague `linked` badge.
- Milestone-style items hide the `Parent Task` selector and should persist with `parentItemId = null`.
- Project Gantt should keep the full relevant timeline in view and resize bars to fit; timeline boundary items should never collapse the visible range to only the final dates.
- `Project Start` / `Project End` remain hidden boundary entities for timeline control. A later refinement may surface them in the project header or Gantt chrome, but not as ordinary rows.
- Milestone deliverable rollup from dependency outputs is still planned and not yet implemented.
- Project wizard integration remains planned and should happen only after the Project template behavior is stable enough to encode clean defaults.

## Help And Documentation Decisions

Date: 2026-05-07

- The left-rail `Help` entry is the primary knowledge surface for the product.
- Help should combine three capabilities: start the Guided Tour, search help topics, and browse topic articles.
- The Guided Tour should stay brief and focused on the main mental model of the workspace; detailed feature behavior belongs in Help articles.
- Help articles should exist for each key element of the app, including app menu actions, application settings, admin workspace structure, groups, live layout, widgets, summaries, deadlines, system fields, item actions, and predefined templates.
- Once a new feature is considered stable enough to be "done," a Help page for that feature should be added as part of finishing the work.
- Help content should continue expanding over time; widget-specific behavior, board summary logic, template logic, and other feature-specific semantics are part of the expected documentation surface rather than optional extras.

## Engineering Health Decisions

Date: 2026-05-07

- The Babel deoptimization warning on `src/renderer/src/App.tsx` is an engineering-health signal, not an immediate runtime bug, but it should be treated as a prompt to modularize renderer code before feature growth makes the main file fragile.
- Help article data, Help UI, and tutorial step data are now valid extraction targets from `App.tsx` and should continue to move into focused renderer modules.
- Follow-on extraction targets include Project-specific renderer/helpers, board rendering helpers, and item modal/editor logic.

## Open Next Areas

- Add automated tests around repository behavior and layout placement.
- Continue refining admin density, readability, and workflow efficiency.
- Improve layout interactions with swapping/repacking where it adds real usability.
- Revisit user management when the app needs real users beyond the current `admin` placeholder.
- Add the Stocks widget.
- Add the Budget list template and, later, budget-aware Wishlist recommendation mode.
- Add the Remaining Work calculated column for effort-based task lists, followed by richer workload recommendations later.
- Continue Project-list refinement, especially milestone deliverable rollups and eventual wizard support.
- Continue Help-library coverage growth as stable features accumulate.
