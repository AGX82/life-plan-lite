# Life Plan Lite Product Roadmap

Status: indicative roadmap  
Purpose: map likely product evolution from the current stable desktop line toward cloud and later shared/team use.

## Roadmap Principles

- Keep the desktop line useful and stable while preparing the model for cloud.
- Avoid major rewrites by introducing cloud-ready seams before the cloud release.
- Treat views, users, and service boundaries as strategic platform work, not only feature work.
- Preserve the product identity: a persistent, structured, visible planning board.

## Current Position

- `v1.3.0` is the latest stable release.
- The product now has:
  - stable board/list/widget foundations
  - a strong setup wizard
  - a reusable tutorial
  - mature baseline list templates
  - local-first persistence and display separation

This is a solid desktop base, but not yet cloud-ready.

## Proposed Release Path

## v1.3.x - Stabilization And Design Prep

Focus:
- small fixes
- polish
- UX refinements
- manifesting `v2.0.0`
- no major platform rework unless it unblocks `v2.0.0`

Outcome:
- stable desktop line
- agreed `v2.0.0` scope

## v2.0.0 - Final Local-First Desktop Generation

Focus:
- new major end-user features
- users/login
- multiple board views
- Project list + Gantt mode
- budget planning
- better effort intelligence
- rendering improvements
- architectural readiness for cloud

Outcome:
- complete, serious desktop product
- no architectural dead ends before cloud

## v2.1.x / v2.2.x - Cloud Preparation Releases

Focus:
- hardening the internals introduced in `v2.0.0`
- service extraction
- sync/mutation model
- import/export discipline
- API contract definition
- stronger testing and migrations

Possible scope:
- local API/service abstraction
- change journal
- revision tokens
- board/view sharing semantics finalized

Outcome:
- technically ready to branch toward cloud without destabilizing the desktop line

## v3.0.0 - First Cloud / Hybrid Release

Focus:
- hosted backend
- authenticated user accounts
- sync between desktop instances
- remote access to boards
- possibly browser-based admin access

Suggested scope:
- sign-in
- cloud sync for boards, lists, items, widgets, views
- local cache with offline mode
- conflict handling basics

Outcome:
- product is no longer only local desktop

## v3.1.x / v3.2.x - Shared And Team Foundations

Focus:
- shared boards
- ownership and visibility controls
- lightweight collaboration

Possible scope:
- invite/share boards
- viewer/editor roles
- shared views
- comments/activity history

Outcome:
- true multi-user utility begins

## v4.0.0 - Team Planning Platform

Focus:
- approvals
- structured collaboration
- richer project planning
- cross-user and cross-board coordination

Possible scope:
- approval workflows
- team dashboards
- dependency graph views
- workload balancing across people
- notifications/reminders

Outcome:
- product evolves from personal planning board into collaborative planning platform

## v5.0.0 And Beyond - Platform Expansion

Possible directions:
- mobile companion
- public/reference lists
- template marketplace
- advanced analytics
- AI planning assistance
- integrations with calendars, mail, task systems, finance feeds

These should come only after the cloud model is stable.

## Capability Sequencing Recommendation

The most important sequencing rule is:

1. First add features that deepen the planning model.
2. Then harden identity, views, and service boundaries.
3. Then introduce cloud.
4. Then introduce collaboration.
5. Then expand ecosystem and intelligence.

If we reverse that order, we risk building cloud plumbing around an immature local model.

## Suggested Near-Term Planning Split

### Track A - User Value
- Project/Gantt
- calendar widget
- budget list
- effort intelligence
- better rendering

### Track B - Platform Readiness
- users/login
- board views
- service layer refactor
- revision/change model
- db migration / export / import / backup discipline
- migration/test discipline

`v2.0.0` should contain both tracks, not just Track A.
