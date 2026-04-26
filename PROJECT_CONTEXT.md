# Life Plan Lite Project Context

This is the living project context for Life Plan Lite. Use it to record product decisions, behavior rules, requirement changes, rationale, and development choices that should guide future work.

Last updated: 2026-04-26

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

- Supported field types include text, integer, decimal, currency, boolean, date, choice, hyperlink, and deadline behavior.
- Deadline is implemented as special date behavior on a list.
- Date fields can display date, date+time, or time-only.
- Time-only date fields can support item-level recurrence.
- Recurrence supports none, daily, weekly, biweekly, and selected weekdays.
- Currency fields support practical common currencies including RON, EUR, USD, GBP, CNY, JPY, CAD, AUD, CHF, and PLN.
- Hyperlink fields open through the default browser and should only allow safe external protocols.
- List templates currently include custom, to-do, shopping list, wishlist, health, trips/events, and birthday calendar.
- `custom` is the canonical default template. Legacy `standard` list rows should migrate to `custom`.
- Birthday Calendar keeps its core fields protected while allowing extra fields around them.
- Shopping List `Cost` is a computed template column and should not be edited like normal user-entered fields.

## Summary Decisions

- Board summary slots are now five slots, indexed 0 through 4.
- Columns have separate list-summary and board-summary eligibility.
- Each list may expose up to two list summary fields.
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
- Fixed several mutations so inactive-board editing remains anchored on the affected board snapshot.
- Updated README language from four summary slots to five board summary slots.
- Verified with `npm run typecheck` and `npm run build`.
- Committed stabilization checkpoint as `6ba9222 Stabilize board templates and summaries`.

## Development Practice Decisions

- Record future behavior, requirement, and rationale decisions in this file as they are made.
- Keep local scratch/mock-up files out of Git unless they are intentionally promoted into app assets or docs.
- Commit stable checkpoints after meaningful, verified changes.
- Avoid unrelated refactors while stabilizing feature work.
- Prefer focused repository-level fixes over UI-only workarounds when a behavior is part of the domain model.

## Open Next Areas

- Add or refine final functionality before declaring `v0.10`.
- Add automated tests around repository behavior and layout placement.
- Continue refining admin density, readability, and workflow efficiency.
- Improve layout interactions with swapping/repacking where it adds real usability.
- Revisit user management when the app needs real users beyond the current `admin` placeholder.
