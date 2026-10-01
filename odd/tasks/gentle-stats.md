# Feature: /gentle:stats panel

Locator: `odd/tasks/gentle-stats.md` (worktree `../gentle-pi-stats`, branch `feat/gentle-stats` from `origin/main` 408ac8e4)
Engram mirror: `odd/gentle-stats/tasks` (project `gentle-pi`)

## Objective
Add a `/gentle:stats` command that opens a full-screen panel (same pattern as `/gentle:agents`) showing historical usage stats in Gentle Shell style, inspired by Claude Code `/usage` + `/stats`, using only data Pi already persists.

## Problem / Why
Users have no local view of their Pi usage history (tokens, cost, models, activity). Runtime metrics are ephemeral by design; the session JSONL files already hold everything needed.

## Scope
- Aggregation from `~/.pi/agent/sessions/**/<ISO>_<uuid>.jsonl` (top-level session files via `listSessionFiles`).
- Panel tabs: Overview (heatmap, totals, streaks, favorite model, fun comparison), Models (per-model tokens/cost/share), Session (current session cost, wall duration, tokens, lines +/-).
- Range toggle: all time / last 7 days / last 30 days. Scope toggle: all projects / current project (`cwd`).
- Gentle palette (theme tokens), not Claude Code's orange.

## Non-goals / constraints
- No account-level limit % (that is `/gentle:usage`).
- No API-duration metric (not persisted; show wall time only).
- No new persistence; read-only scan, tolerant to malformed lines.
- `/gentle:usage` name is taken; command is `gentle:stats`.
- Subagent nested sessions are not summed in v1 (disclosed in panel footnote).

## Delivery
Strategy: `single-pr` (user-approved size exception). Forecast ~1100 authored lines.

## Tasks
- [x] T1 Stats collector (`lib/stats-collector.ts`): parse JSONL → totals, per-model, per-day, sessions, active days, longest session, longest/current streak, most active day, range+scope filters; unit tests with fixtures. Route: delegated (writer; preparation trigger). Risk: medium (writer self-verification). Commit: `24f7b61d` feat(stats): add session usage collector.
  - Evidence: RED `tests/stats-collector.test.ts` failed (module missing); GREEN 11/11 pass; `pnpm typecheck` no regressions. Real-data probe (read-only): 151 sessions, cold load 1.96 s, warm 3 ms (mtime/size cache).
  - Notes: lines +/- come from `SessionChanges` for the live session only (historical patch regeneration would be too costly); session wall time = header timestamp → last assistant message; current streak survives an idle today.
- [x] T2 Stats view (`lib/stats-view.ts`): tabs, heatmap, range/scope toggles, q/esc close, pointer footer; unit tests. Route: delegated. Risk: medium (writer self-verification). Commit: `7ae923bc` feat(stats): add stats overlay view.
  - Evidence: RED `tests/stats-view.test.ts` failed (module missing); GREEN 9/9 (collector + view 20/20); `pnpm typecheck` no regressions. Widths 48/100/120 asserted cell-exact.
  - Notes: heatmap shades are glyph density (`· ░ ▒ ▓ █`) in theme roles `borderMuted`/`accent`, so every Gentle theme recolors it; clickable header tabs, `[× Close]`, and footer hints follow the `UsageView` span pattern with `paintHoverable`. Below ~56 columns the range/scope label is dropped from the tabs row.
- [x] T3 Command wiring (`extensions/gentle-stats.ts` + package registration): `/gentle:stats`, optional shortcut with env `off`, overlay pattern from `openOverlay`, docs; tests. Route: delegated. Risk: medium (writer self-verification). Commit: the `feat(stats): add /gentle:stats command` commit (hash recorded in the closing docs commit).
  - Evidence: RED `tests/gentle-stats.test.ts` failed (module missing); GREEN 6/6; focused stats checks 26/26; `pnpm typecheck` no regressions.
  - Notes: `package.json` needs no change (`pi.extensions` already loads `./extensions`). No default shortcut; `GENTLE_PI_STATS_VIEW_KEY` binds one. Sessions root is `join(getAgentDir(), "sessions")`, the same as Pi's internal `getSessionsDir()`. Docs: `docs/gentle-shell.md` (Gentle Stats section) and the README "Also in the box" table. Not done (outside the authorized surfaces): command-palette catalog entry (`lib/command-palette-catalog.ts`) and the command table in `docs/readme-reference.md`.

## Acceptance criteria
- `/gentle:stats` opens full-screen panel; `q`/`esc` closes with repaint.
- Numbers match a fixture set exactly in tests.
- Empty/malformed session dirs render an empty-state without throwing.

## Checks
- `node --experimental-strip-types --test tests/stats-collector.test.ts tests/stats-view.test.ts tests/gentle-stats.test.ts`
- Full suite `node --experimental-strip-types --test tests/*.test.ts` at closure; typecheck if configured.

## Progress
- Exploration done (handoff: data in session JSONL; `/gentle:agents` overlay pattern at `extensions/gentle-agents.ts:917-964`).
- T1–T3 implemented and committed on `feat/gentle-stats`.
- Full suite at closure (`node --experimental-strip-types --test tests/*.test.ts`): 4498 tests, 4346 pass, 118 fail, 34 skipped. Every failure is in files this feature does not touch and is environmental on the base: `gentle-shell.test.ts` (75) and `vim-editor-adapter.test.ts` (34) report "Unsupported Pi editor layout/version" with Pi 0.99.2 installed; `package-manifest.test.ts` (2), `gentle-shell-bin`/`gentle-shell-launcher` (1 each) still expect the 0.99.1 pin that base commit `e8094f3c` moved to `>=0.99.2`; `gentle-ai.test.ts` (5) are child-safety/Herdr permission lifecycle assertions. Docs assertions in `package-manifest.test.ts` pass.

## Next step
Parent review; then decide on the command-palette entry and `docs/readme-reference.md` row (outside this task's surfaces), push, and PR.
