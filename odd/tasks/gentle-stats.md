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
- [x] T2 Stats view (`lib/stats-view.ts`): tabs, heatmap, range/scope toggles, q/esc close, pointer footer; unit tests. Route: delegated. Risk: medium (writer self-verification). Commit: the `feat(stats): add stats overlay view` commit (hash recorded in T3).
  - Evidence: RED `tests/stats-view.test.ts` failed (module missing); GREEN 9/9 (collector + view 20/20); `pnpm typecheck` no regressions. Widths 48/100/120 asserted cell-exact.
  - Notes: heatmap shades are glyph density (`· ░ ▒ ▓ █`) in theme roles `borderMuted`/`accent`, so every Gentle theme recolors it; clickable header tabs, `[× Close]`, and footer hints follow the `UsageView` span pattern with `paintHoverable`. Below ~56 columns the range/scope label is dropped from the tabs row.
- [ ] T3 Command wiring (`extensions/gentle-stats.ts` + package registration): `/gentle:stats`, optional shortcut with env `off`, overlay pattern from `openOverlay`, docs; tests. Route: delegated.

## Acceptance criteria
- `/gentle:stats` opens full-screen panel; `q`/`esc` closes with repaint.
- Numbers match a fixture set exactly in tests.
- Empty/malformed session dirs render an empty-state without throwing.

## Checks
- `node --experimental-strip-types --test tests/stats-collector.test.ts tests/stats-view.test.ts tests/gentle-stats.test.ts`
- Full suite `node --experimental-strip-types --test tests/*.test.ts` at closure; typecheck if configured.

## Progress
- Exploration done (handoff: data in session JSONL; `/gentle:agents` overlay pattern at `extensions/gentle-agents.ts:917-964`).

## Next step
T1.
