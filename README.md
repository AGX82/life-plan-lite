# Life Plan Lite

Local-first desktop board application based on the attached BRD.

## First MVP Slice

- Electron desktop shell with separate Admin and Display routes.
- React renderer with board-shaped grid display and admin controls.
- SQLite-oriented local persistence using Node's built-in `node:sqlite` API.
- Seeded default board, lists, typed columns, draft/published item state, dependencies, archive records, and four bottom summary slots.

## Commands

```powershell
npm install
npm run dev
npm run typecheck
```

The app stores local data in Electron's `userData` directory.
