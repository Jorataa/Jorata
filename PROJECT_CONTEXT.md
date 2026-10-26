# Current recovery context — 2026-10-26

The current product brief is **a premium pixel-inspired gaming platform with personal notes**. The implementation is in `jorata-game/` (React, TypeScript, Vite; per-game engines remain isolated). Main destinations: Home, Games, Notes, Settings. Games: Mosslight, Surgery, Ringcraft Boxing, Rooftop Escape, Endless Drive. No messaging or account UI is included in the gaming build.

Read `JORATA_AUDIT.md`, `recovery/RECOVERY_REPORT.md`, and `recovery/asset-inventory.json` for preservation scope, branch decisions, current verification and limitations. Original workspaces and source branches remain intact. The root Next.js application below is historical productivity work retained for recovery; it is not the gaming entrypoint. Do not merge it into the gaming UI by inference.

Run the gaming product with `cd jorata-game`, `npm ci`, `npm run dev`. Do not deploy or merge this recovery branch into main without review of the verified result.

---

# Jorata Project Context

Saved from `C:\Users\jovan\Downloads\Jorata Project Context.pdf` and current workspace inspection on 2026-05-30. Code snapshot refreshed 2026-06-12 after the multi-map & sticky completion pass (see `PRODUCT_AUDIT.md`).

This document is the practical project memory for future coding agents working on Jorata. Keep it beginner-friendly, current-stage focused, and useful for deciding what to build next.

See also: `PRODUCT_STRATEGY.md` (philosophical and strategic compass — read before proposing features) and `PRODUCT_AUDIT.md` (historical record of what shipped and the agreed backlog).

## Product Vision

Jorata is a Personal Operating System for Thinking and Execution.

The product goal is not to create another simple todo app. Jorata should become a centralized personal productivity platform where users can think, plan, execute, track progress, and grow.

Long-term product loop:

```text
Think -> Plan -> Execute -> Measure -> Improve
```

Jorata should eventually combine:

- Mind Mapping
- Task Management
- KPI Tracking
- Daily Reflection
- Knowledge Management
- Personal Growth Tracking
- AI Assistance

Product inspiration:

- Notion
- Obsidian
- ClickUp
- Mind mapping software

The focus is personal productivity and execution.

## Founder Context

The founder is an Indonesian student learning software development while building this project.

Current learning areas:

- Next.js
- TypeScript
- Tailwind CSS
- Git
- VS Code
- Terminal
- Software architecture

Working style:

- Explain why a change is useful.
- Explain what will happen after the change.
- Explain risks when they matter.
- Then implement.
- Avoid overwhelming the founder with enterprise-level complexity.
- Help the founder understand architecture, not just receive generated code.

## Current Stack

Current:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- React Flow

Planned:

- Prisma
- PostgreSQL

Future:

- AI integration
- Authentication
- PDF export
- Cloud storage

## Current Project Stage

The project has moved from basic prototyping into the **Growth Engineering Phase**.

Already done:
- Next.js 16 / React 19 architecture established.
- **Command Center Dashboard:** Refactored from a feature-dump to a high-clarity workspace.
- **Real Activity Engine:** Live tracking of tasks, mind maps, and reflections (Zustand + local persistence).
- **Today's Focus Widget:** Smart priority-ordered task execution on the dashboard.
- **Mind Map Preview:** Optimized visual thinking snapshot for performance.
- **Local Persistence:** All core modules (Tasks, Mind Maps, KPI, Activity) save locally.

Current focus:
- Refining the "Mental Clarity" loops.
- Improving information hierarchy and emotional UX.
- Preparing for the KPI Module deep-dive.

## Current Priorities (Highest → Lowest)

1. Dashboard Refinement
2. Tasks Module
3. Mind Map Persistence
4. Mind Map Improvements
5. KPI Module
6. PDF Export
7. Authentication
8. AI Features

Practical guidance:

- Focus first on making the dashboard and core workflows usable.
- Add persistence before making mind maps more advanced.
- Treat authentication and AI as later-stage features, not MVP work.

## Current Code Snapshot

Root app:

- `src/app/page.tsx` redirects to `/dashboard`; routes exist for `/dashboard`, `/mindmap`, `/tasks`, `/kpi`, `/settings`.
- `src/app/layout.tsx` loads Inter via `next/font` and wraps pages in `components/layout/LayoutShell` (sidebar + topbar + command palette + quick capture + focus HUD).
- `src/app/globals.css` holds Tailwind 4 theme variables, scrollbar utilities, and the single source of truth for React Flow edge/control styling (via `--xy-*` variables).

Layout shell (`src/components/layout/`):

- `Sidebar.tsx` — collapsible nav (persisted), mobile drawer, plus the **Mind Maps manager** (list, create, inline rename via double-click, two-click delete).
- `Topbar.tsx` — breadcrumb (`Workspace › Mind Maps › {active map}` on the canvas), date, command palette trigger (Ctrl+K).
- `QuickActions.tsx` — single Quick Capture FAB (hidden on `/mindmap`).
- `FocusHUD.tsx` — full-screen Deep Work focus overlay with timer.

Features (each under `src/features/<name>/`):

- `mindmap/` — the core canvas. Full-bleed React Flow workspace; zustand store with localStorage persistence (`stores/use-mindmap-store.ts`); **multiple maps** (workspace record + `activeMapId`, legacy single-map data auto-migrates; switch via the canvas `MapSwitcher` chip, the sidebar list, or Ctrl+K); **sticky notes** (`S` key with cascade placement, right-click → "Sticky note here", four paper colors, multi-line + autogrow editing, sticky-mode details panel); keyboard-first (Tab child, Enter rename, Delete remove, Ctrl+Z/Ctrl+Shift+Z undo/redo, F fit, Shift+T tidy, I details, double-click to create, right-click pane/node menus); per-tab undo history with drag batching (cleared on map switch); details panel opens on demand; node↔task linking with status sync. Cross-surface node jumps use the store's transient `pendingFocusNodeId` request, consumed and centered by the canvas.
- `tasks/` — full CRUD with priority/energy/category, filters, persisted.
- `kpi/` — KPI tracking with history, persisted.
- `dashboard/` — command-center modules (header/anchor, weekly pulse, continuity bridge, today's focus, KPI quick access, activity, inbox capture, mind map preview). A fresh workspace renders a Getting Started hero instead; analytics sections appear only once tasks/KPIs exist.
- `command/` — Ctrl+K palette (search across tasks/KPIs/maps and **ideas in every map** — cross-map hits are labeled `· Map title` and selecting one switches maps and centers the node; quick actions; real arrow-key navigation) and Ctrl+J quick capture overlay.
- `wisdom/`, `analytics/`, `search/` — supporting modules.

State (`src/stores/`): zustand v5 + persist for mindmap, tasks, kpi, focus, activity, inbox, wisdom, ui, toast. **zustand v5 rule: any selector returning a fresh object/array must use `useShallow`** — a violation here once broke the whole app (see audit). Tabs stay in sync via `src/lib/cross-tab-sync.ts` (storage events → `persist.rehydrate()`), initialized in `LayoutShell`.

Settings (`src/app/settings/page.tsx`): shortcut reference, JSON export/import of the whole workspace, clear-all-data with two-step confirm. Storage keys: `jmind:mindmap`, `jmind:tasks`, `jmind:kpis`, `jmind:focus`, `jmind:activity`, `jmind:inbox`, `jmind:wisdom`, `jmind:ui`.

## Current Technical Debt

Known issues:

- No testing setup (sanitizers, undo history, and the workspace validator/migration are the best first targets).
- Mobile touch interactions on the canvas are untuned (no long-press menu; map switcher hidden below `md` — the sidebar drawer is the mobile path).
- Dashboard with lots of data is still dense; consider collapsible sections.
- Undoing "Convert to Task" doesn't delete the created task; deleting a map has confirm-but-no-undo (cross-store/cross-map undo out of scope).
- No database integration yet (by design at this stage).

How to handle this:

- Fix technical debt only when it supports the current feature work.
- Avoid large refactors unless the founder confirms the direction first.
- Prefer small, understandable improvements over broad rewrites.

Dev workflow warnings (Windows / Next 16 / Turbopack):

- Do not run `npm run build` while the dev server is running — they share `.next` and the dev session corrupts.
- If the dev server serves stale CSS/JS after edits, stop it, delete `.next`, and restart.

## MVP Roadmap

Version 0.1 goal: usable productivity dashboard.

Dashboard:

- Sidebar
- Navbar
- Welcome card or welcome section
- Quick stats
- Daily wisdom

Tasks:

- Add task
- View task
- Complete task

Do not include yet:

- Authentication
- Database
- AI
- Team collaboration

Version 0.2: Mind Maps.

- Create nodes
- Create connections
- Drag nodes
- Save map

Version 0.3: KPI Tracking.

- Create KPI
- Set targets
- Track progress
- View simple charts

Version 0.4: PDF Export.

- Export tasks
- Export KPI reports
- Export mind maps

Version 0.5: Authentication.

- Possible stack: Clerk or NextAuth
- Not decided yet

Version 1.0: Personal Operating System.

- Dashboard
- Tasks
- Mind Maps
- KPI Tracking
- Daily Wisdom
- Reporting

## Definition Of Success For v0.1

A user can:

- Open the dashboard
- Create tasks
- Complete tasks
- Create a simple mind map
- Save and load mind maps

without needing an account.

This means v0.1 should feel useful locally before adding authentication, AI, or complex backend architecture.

## Out Of Scope For MVP

The following are intentionally postponed:

- AI Assistant
- Multi-user collaboration
- Real-time synchronization
- Mobile applications
- Complex analytics
- Advanced permissions

## Feature Visions

Dashboard should eventually include:

- Welcome section with greeting, current date, and motivational quote
- Quick stats such as tasks completed, tasks pending, weekly progress, and KPI status
- Today's tasks
- KPI snapshot
- Daily wisdom, such as a Bible verse or inspirational quote

Mind Maps should eventually support:

- Create nodes
- Create links
- Color categories
- Save maps
- Export maps
- Convert nodes into tasks

Tasks should eventually support:

- Create
- Edit
- Delete
- Complete
- Priorities
- Categories
- Due dates
- Recurring tasks

KPIs are personal performance indicators.

Examples:

- Health: running distance
- Study: hours studied
- Business: revenue
- Faith: daily reading

KPI capabilities:

- Set targets
- Track progress
- Visualize progress

AI assistant is future scope, not MVP priority.

Potential AI capabilities:

- Summarize mind maps
- Generate task plans
- Weekly reviews
- Goal analysis

## Coding Standards

- Use TypeScript.
- Use functional React components.
- Keep components small.
- Prefer reusable UI components when useful.
- Keep files readable.
- Avoid giant files.

Good direction:

```text
components/dashboard/welcome-card.tsx
```

Avoid:

```text
components/dashboard-everything.tsx
```

## UI Philosophy

Design goals:

- Clean
- Modern
- Minimal
- Focused

Visual inspiration:

- Linear
- Notion
- Vercel Dashboard
- Arc Browser aesthetics

Avoid:

- Excessive gradients
- Excessive animations
- Cluttered layouts

## Working Rules For Future Changes

- Preserve simplicity unless there is a clear reason to add structure.
- Keep the founder in the learning loop.
- Before large refactors, explain the plan and ask for confirmation.
- Do not silently restructure large parts of the project.
- Prioritize MVP dashboard, tasks, and basic mind map functionality before AI or backend complexity.
- Preserve the product vision, roadmap, and current code snapshot when updating this document.
- Optimize this document for future AI agents joining the project.
