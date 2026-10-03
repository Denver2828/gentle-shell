# fix #1681: stop rebuilding the footer model on every fullscreen frame

## Objective

In fullscreen with the sidebar on, a settled frame must not walk the whole session to
compute the footer digest. Session-derived values are recomputed only when the session or
model actually changes.

## Problem

Measured on `ac671593` with Pi 1.0.0 (gentle-aporte commit `b967db8b`,
`docs/measurements/gentle-shell-fullscreen-perf.md`):

- `lib/shell-sidebar-layout.ts:216` evaluates every rail digest on every frame.
- The footer rail (`extensions/gentle-shell.ts:1829`) and the header rail (`:1838`) both call
  `footerModel()`, which calls `buildShellBarModel()` (`:255`).
- That runs `sessionCost()` (`:246`, copies every entry through `getEntries()`) and
  `ctx.getContextUsage()` (`:262`, which projects the session in Pi).
- At 5000 messages: the digest takes about 2.0 ms of a 3.2 ms settled frame; about 90% of it is
  `getContextUsage`.

## Approach

Memoize the two session walks behind a cheap revision key:
`sessionManager.getLeafId()`, `sessionManager.getEntryCount()`, and the model identity and
context window. Pi sessions are append-only (`getEntries` doc comment), so appends change the
count and branch switches change the leaf.

- `getEntryCount()` landed in Pi on 2026-09-29, and the peer range still admits `>=0.99.1`.
  Feature-detect it; when it is missing, fall back to today's uncached behavior.
- Keep `buildShellBarModel`'s exported signature and output identical.

## Non-goals

- No change to Pi.
- No change to the sidebar layout's flat cost or to the digest/memo mechanism in
  `lib/shell-sidebar-layout.ts`.
- No behavior or visual change to the footer, header, or bottom bar.

## Tasks

- [x] T1 — RED: a test proving that, for an unchanged session and model, repeated footer
      model builds call `getContextUsage` and walk entries only once. It must also prove the
      values refresh after an append, a leaf change, and a model change, and that the fallback
      works without `getEntryCount`. Route: delegated writer.
- [x] T2 — GREEN: implement the memo in `extensions/gentle-shell.ts`. Run the focused tests,
      then the full `pnpm test`. Route: same delegated writer.
- [ ] T3 — Re-measure with the gentle-aporte bench (Bench A and B) against the patched tree,
      and record before/after. Route: same delegated writer.

## Acceptance criteria

- RED observed before the implementation, GREEN after.
- Full `pnpm test` result reported verbatim, including failures and skips.
- Settled-frame digest cost no longer grows with N for an unchanged session.

## Delivery

- Branch `fix/1681-shared-footer-digest` from `ac671593`.
- Forecast: under 200 authored lines.
- Push, fork, claim comment, and PR are user decisions.

## Progress

- 2026-10-02: document created; clone at `C:\A_Desarrollos\Proyectos\gentle-shell-1681`.
- 2026-10-02: T1 RED observed (`tests/shell-footer-model-cache.test.ts`: the unchanged-session
  test failed with 6 `getContextUsage` calls instead of 1). T2 GREEN: `sessionDerived()` in
  `extensions/gentle-shell.ts` memoizes usage and cost per session manager behind
  `(leafId, entryCount, provider, id, contextWindow)`; 5/5 focused tests pass. Full `pnpm test`:
  unit-tests FAIL (4645 tests, 230 fail, 1 cancelled, 87 skipped; every failure is in a file that
  does not import the patched module, or is identical on the unpatched base), provider-contract
  PASS, runtime-harness PASS.

## Next step

T3 bench numbers go back to the parent for the record; push, fork and PR stay user decisions.
