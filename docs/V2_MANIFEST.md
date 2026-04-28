# Life Plan Lite v2.0.0 Manifest

Status: planning draft  
Target role of this release: final local-first desktop generation before cloud transition work becomes the main product track.

## 1. Release Intent

`v2.0.0` should not just add features. It should complete the desktop product in a way that makes later online/cloud evolution practical instead of painful.

That means `v2.0.0` has two jobs:

1. Deliver the next major user-facing capability jump.
2. Lock in the data model, workflow boundaries, and architectural seams needed for multi-user and cloud evolution.

## 2. Product Goals For v2.0.0

- Make the board feel like a mature daily operating surface, not just a configurable screen.
- Expand list and widget capabilities in ways that still fit the board paradigm.
- Improve planning intelligence around tasks, effort, deadlines, and money.
- Support multiple users conceptually, even if collaboration remains local/desktop in this version.
- Introduce the technical foundations required for a future hosted/cloud architecture.

## 3. Proposed Feature Scope

## 3.1 New Widgets

### Calendar Widget
- Purpose:
  Surface upcoming dates, events, deadlines, and birthdays in a compact timeline/calendar view.
- Suggested MVP-for-v2 shape:
  - month strip or agenda mode
  - source filters by list type and/or selected lists
  - visual distinction between deadlines, birthdays, trips/events, and appointments
  - click-through from widget to underlying list item
- Why it matters:
  It complements the board as a true planning dashboard and becomes even more valuable once multiple views and cloud sync exist.

### Additional Widget Faces / Display Modes
- Clock:
  More digital and analogue variants.
- Weather:
  Compact, detailed, and more presentation-friendly modes.
- World Clock:
  More styles and denser layouts.
- Word of the Day:
  More display treatments.
- Countdown:
  More visual styles and milestone emphasis.
- Why it matters:
  This improves board personalization without changing core data architecture.

## 3.2 New List Type: Project

### Project List With Gantt Mode
- Purpose:
  Represent structured multi-step work with sequencing, dates, dependencies, and progress in a way richer than a plain To Do list.
- Core capabilities:
  - task rows with start, end, effort, owner, status, % done
  - dependency support reused from current item dependency model
  - timeline/Gantt visualization
  - optional grouping by phase/milestone/workstream
  - board summary compatibility
- Why it matters:
  This is the strongest bridge from personal planning into more advanced planning and future team use.

## 3.3 Smarter Task Progress And Effort

- Visual indicators on `% Done`
- Remaining effort calculation
- Deadline-aware effort status
- Effort distribution recommendations using:
  - total effort recorded
  - workday duration assumptions
  - inefficiency/buffer assumptions
  - target deadline
- Possible derived outputs:
  - effort remaining
  - recommended hours/day
  - risk flag if plan is unrealistic
  - suggested start-now / warning indicators
- Why it matters:
  This turns the app from a passive board into a light planning assistant.

## 3.4 Budget Management List

- Scope:
  - income
  - one-off expenses
  - recurring costs
  - recurring revenue
  - balances and projections
- Strongly recommended sub-features:
  - currency support using the current money model
  - recurrence support for recurring entries
  - monthly rollups
  - planned vs actual fields
  - linkage to Wishlist affordability/projection logic
- Why it matters:
  Financial planning is one of the natural adjacent domains already hinted at by Shopping and Wishlist.

## 3.5 Board View And Rendering Improvements

- Better rendering across different display sizes and aspect ratios
- Stronger rules to reduce or avoid horizontal scroll in board lists
- Adaptive column prioritization for board display
- Smarter compact display of long text/value-heavy lists
- Why it matters:
  This is essential before cloud/web delivery, because browser-based use will face much wider viewport variation than the current desktop-only setup.

## 3.6 Users And Login

- Local user accounts and authentication
- Ownership metadata on boards, lists, items, comments, archives, and settings
- Per-user preferences where relevant
- Foundations for future roles:
  - owner
  - editor
  - viewer
  - approver
- Why it matters:
  This is the single most important product prerequisite for the cloud transition.

## 3.7 Multiple Views Of The Same Board

- The same board data/structure should support multiple presentation views
- Views may vary by:
  - which lists are shown
  - which columns are shown
  - sorting/filtering
  - board summaries shown
  - widget visibility/layout
- Important rule:
  Views do not duplicate the underlying board data model.
- Why it matters:
  This is a major usability feature locally and a major architectural concept for cloud use later.

## 4. What v2.0.0 Must Add For Cloud Readiness

This is the most important section for transition planning.

## 4.1 Identity And Ownership

Must exist by `v2.0.0`:
- real user entity, not only implicit local admin
- ownership fields on every domain object that matters
- created-by / updated-by / closed-by metadata
- user preferences separated from shared board state

Without this, cloud migration becomes a data rewrite instead of a deployment change.

## 4.2 Stable Domain Contracts

Must exist by `v2.0.0`:
- clean domain-level types for Board, View, List, Group, Item, Archive, Widget, Summary, User
- clear separation between:
  - persisted domain data
  - UI-only state
  - transient layout/editor state
- documented invariants for:
  - active vs loaded board
  - draft vs published item state
  - archive immutability
  - dependency references
  - board-view overlays

Without this, an API layer will inherit frontend assumptions and become brittle.

## 4.3 Service Boundary / API-Ready Architecture

Must exist by `v2.0.0`:
- app logic no longer tightly coupled to Electron IPC handlers as the primary domain boundary
- introduce a service layer that can be called by:
  - current Electron IPC
  - future HTTP/GraphQL API
  - future background sync worker
- standard command/query patterns for domain operations

Practical meaning:
- today: renderer -> preload -> IPC -> service -> repository
- later: web client -> API -> same service rules -> repository

## 4.4 Data Sync Readiness

Must exist by `v2.0.0`:
- UUID-based IDs everywhere, consistently
- `createdAt`, `updatedAt`, and preferably `version` or `revision` metadata
- soft-delete / archive semantics clearly defined
- deterministic serialization of list fields and widget config
- conflict-sensitive entities identified in advance

Strongly recommended:
- change log or mutation journal
- per-entity revision counter or optimistic concurrency token

Without this, offline-first sync later will be extremely hard.

## 4.5 Authentication And Authorization Model

Must exist by `v2.0.0` conceptually, even if still local:
- login flow
- session model
- board ownership and access model
- future role placeholders

Need not be fully cloud-grade yet, but the product semantics must be present.

## 4.6 Board Views As First-Class Objects

Must exist by `v2.0.0`:
- board views modeled as explicit entities/configurations
- a board separated from its alternate display/filter/view presets

This matters because cloud sharing will often happen at the view level, not only at raw board level.

## 4.7 Import / Export / Backup Discipline

Must exist by `v2.0.0`:
- reliable export/import story
- explicit database migration tooling/discipline
- schema-versioned backup format
- migration-aware restore path

Why:
  Before cloud, the desktop line should already know how to serialize its real data model cleanly.

## 4.8 Security / Privacy Preparation

Must exist by `v2.0.0`:
- password handling strategy for local users
- separation of secrets from domain data
- explicit policy for what can be local-only vs shareable later
- safe handling of external data sources in widgets

## 4.9 Testing And Migration Discipline

Must exist by `v2.0.0`:
- migration tests for schema evolution
- high-value domain tests for publication, archiving, summaries, dependencies, and board views
- fixture coverage for template-based lists

Without stronger test coverage, cloud transition risk will rise sharply.

## 5. Recommended v2.0.0 Scope Structure

To keep `v2.0.0` realistic, split the scope into three buckets.

### A. Mandatory For v2.0.0
- users and login
- board views as first-class concept
- service-layer / API-ready architecture refactor
- sync-ready metadata and revision model
- rendering improvements across screen ratios
- at least one major new list type: Project with Gantt mode

### B. Strongly Recommended For v2.0.0
- calendar widget
- smarter effort/progress calculations
- budget management list
- expanded widget visual modes

### C. Nice-To-Have If Capacity Allows
- birthday tutorial enhancement for “generate buy present task”
- richer visual micro-interactions
- deeper recommendation engine for workload planning

## 6. Suggested v2.0.0 Definition Of Done

`v2.0.0` should be considered complete when:

- the desktop app is still fully local-first and reliable
- local users/login exist
- boards support multiple views cleanly
- Project/Gantt exists in a stable usable form
- the domain/service architecture can be reused by a future cloud backend
- migrations, IDs, timestamps, revisions, and ownership metadata are consistent
- rendering is robust across practical display ratios
- data export/backup is trustworthy

If those are true, the product is genuinely ready to become cloud-capable in the next generation.
