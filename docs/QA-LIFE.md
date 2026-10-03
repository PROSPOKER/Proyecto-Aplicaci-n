# Habita · life simulation acceptance

This document complements `QA.md`. It covers the new life simulation and keeps the historical version-2 pilot as a persistence regression. Tests run in Chromium against the static checkout, with deterministic time where useful and actual browser interactions for purchases/editors.

## Reproduced baseline · v0.7

A real browser reports `HabitaTest.version === '0.7'`. It has a working appearance editor, autonomous object tasks and a real-activity loop. It does not expose a shop or house editor; the saved profile has no wardrobe, inventory or placed-furniture configuration; the run has no multi-step projects, relationship history or economic transactions. Autonomous task history is bounded task IDs rather than a persistent project with a visible outcome.

The current world must remain available while these features are added. Fictional activity must never create a real care record. Tests never reset or mutate an actual user's browser; each scenario uses an isolated context with fixture data.

Baseline regression command:

```sh
HABITA_TEST_URL=http://127.0.0.1:8877 HABITA_TEST_GROUP=data,activities,personalization HABITA_TEST_ARTIFACTS=/tmp/habita-life-baseline node tests/browser.cjs
```

Result: **7/7 passed** (historical photo/timer, real/demo isolation, corrupt-save recovery, reminder and one-tap completion, exercise response, visible reward, reversible avatar editor).

## Stage acceptance

| Stage | End-to-end scenario | Required observable result |
|---|---|---|
| A · Everyday continuity | Complete one real activity; observe the character; reload | Exactly one real record; a related intention and visible fictional consequence; project/memory survives reload |
| A · Plans | Observe autonomous behavior with no instruction | Multiple-step progress is visible; completion changes an artifact or remembered outcome rather than only an animation counter |
| B · Character | Preview distinct face/clothing/body choices, cancel, save, reload | Cancel has no profile side effect; saved layers remain visibly different and survive movement/scene changes/reload |
| B · Home | Place/move/rotate a functional item; cancel; save; use it | Cancel restores layout; invalid overlap/blocked access is rejected; saved item opens an actual action and remains after reload |
| C · Economy | Preview, buy, double-tap, equip, reload | One purchase/charge; owned item persists; insufficient funds cannot grant item; purchases do not require a real activity |
| C · Economy | Change real/demo mode | Economic and project state are isolated consistently with care records |
| D · Neighbors | Observe a spontaneous encounter; revisit later | Neighbor starts/participates in an encounter; history/relationship changes; later behavior refers to remembered context |
| D · Absence | Advance time across midnight and return | One bounded plausible summary; no debt, asset loss or fictional real record; a second reload does not repeat rewards |

## Cross-cutting checks

- Historical v2 name, photo, schedules, records, active timer and unlocks survive migration and reload.
- New save validation accepts a valid evolved save and rejects malformed economy/layout without silently discarding original data.
- Avatar/manual travel takes priority, then autonomous planning resumes.
- Multiple actors never use one occupied object simultaneously; cancellation/scene changes release reservations.
- Travel arrives beside an object before its effects are applied; furniture never traps the player or removes every usable route.
- Home, coast and plaza load without uncaught browser errors.
- Shop/editor/project controls work on small phone viewports, by keyboard and with reduced motion.
- Timers remain optional; expiration does not auto-complete a real activity; repeated completion clicks produce one record.
- Scientific sources and simulation/photograph limitations remain explicit.
- Opt-in audio and silence remain available.
- One coherent timezone governs the day, records and reminders.
- There are no external-AI calls, invented consciousness claims or claims of continuous execution with the app closed.

## Reporting

Each suite result records the scenario, measured outcome and failure details. Screenshots and JSON go under `/tmp/habita-life-qa` by default. Code uploaded, deployment completed and public version checked are separate coordinator statuses. Local browser checks cannot establish GitHub Pages deployment.

## Integrated v0.8 results · 2026-10-03

The new acceptance cases were checked in stages against the shared static checkout. The final server is `http://127.0.0.1:8880`. Later results replace earlier failures for the same scenario; the original failure records remain available under their artifact directories. No actual user's storage is modified.

**54 unique browser checks passed: 30 historical regressions and 24 life/experience checks.** No scenario reported an uncaught JavaScript error. The final historical suite ran completely against the integrated v0.8 checkout; staged life tests were consolidated using the latest outcome for each scenario.

| Area | Checks | Observed result |
|---|---:|---|
| Historical migration | 1 | Name, historical photo, real/demo records and active deadline remain intact; both simulations initialize independently |
| Continuity and projects | 2 | One care confirmation adds one real record and one reward; a three-step coast-to-home art project creates a visible artwork and persistent memories |
| Record correction | 2 | Deleting a care record removes its linked echo/memory; older memories without metadata are matched only by an unambiguous echo; unrelated records/memories, project, effects, demo, photo and balance survive reload |
| Absence | 1 | Returning after 24 hours adds one bounded summary without losses, duplicate rewards or fictional real records |
| Independent actors | 2 | NPC navigation cannot replace the avatar route; object reservations are exclusive and released on cancellation/scene changes |
| Home safety | 1 | Overlap, blocked entry/portal, unreachable objects, outside placement and disconnected walkable islands prevent save |
| Avatar layers | 1 | Face, eyes, hair, top, bottom and shoes change visibly; preview/cancel/save/look/reload remain reversible and persistent |
| Room editing | 1 | Move/rotate/undo/cancel/save pass; the saved desk interaction begins at an actual use point after reload |
| Economy | 2 | Costume preview, one charge/purchase, explicit equip and reload pass; insufficient funds reject purchase and real/demo accounts stay separate |
| Purchased furniture | 1 | Purchased easel is placed, used only after arrival and retained on reload |
| Neighbors | 1 | Independent object routines, NPC-to-NPC encounters, player conversations and remembered context are observed |
| Full user journey | 1 | Identity → care → reward → buy → place → encounter → next day succeeds with one real activity and persistent furniture/history |
| Artistic sky | 1 | All six real-time phases produce distinct rendered skies and agree with the displayed local hour |
| Responsive controls | 3 | Home, shop, wardrobe and room controls remain reachable at 375×667, 390×844 and 1280×800 |
| Keyboard | 2 | Wardrobe has one active tab stop; ArrowRight/Home/End navigate tabs; Enter can preview/buy without closing the modal or implicitly equipping; a later explicit equip returns to the world and pointer backdrop close still works |
| Reduced motion | 1 | Decorative animations are disabled while five useful tasks finish during 90 seconds |
| Extended live simulation | 1 | Fifteen minutes, 180 samples and 48 avatar completions; all NPCs move and remember routines/meetings; no tested arrival, obstacle or reservation invariant fails |

The shop regression reproduced a real double-click bug: a buy button was immediately replaced by an equip button at the same location. The final UI keeps a disabled purchase confirmation at that location and renders equip in a separate row. The original double-click assertion remains in the suite and passes after the fix; the test was not weakened.

Keyboard testing also reproduced a global dialog issue: an Enter-generated control click carried zero pointer coordinates and was interpreted as an outside click. The dialog now checks that the click actually targets the dialog backdrop and has pointer detail before comparing coordinates. A durable browser regression covers Enter preview/purchase/receipt/equip plus a genuine backdrop pointer click.

## Historical regression on the integrated checkout

```sh
HABITA_TEST_URL=http://127.0.0.1:8880 HABITA_TEST_ARTIFACTS=/tmp/habita-v08-regression-final node tests/browser.cjs
```

Result: **30/30 passed**, including first-use setup, reachable objects, invalidated/blocked routes, keyboard/manual priority, portal and modal/panel pause behavior, actual canvas clicks, historical photo/deadline, unreadable-save export/import, real/demo isolation, activity deadline/confirmation/deduplication, exercise response, native reward visibility, reversible identity, timezone/day boundaries, audio activation/mute, scientific and simulation limits, exterior NPC movement and phone/desktop controls.

All three scenes were sampled with native requestAnimationFrame timing: median about 16.7 ms and p95 at or below 16.8 ms in this headless Linux run. This is a local measurement, not a device frame-rate guarantee. Ninety-second autonomous checks completed five home tasks, five coast tasks and four plaza tasks with no distant effects, obstacle occupancy or generated real records. Primary activity text contrast was 4.82:1; the 44 px primary button and reward text were reachable and unclipped on both phone sizes.

Final staged evidence, in replacement order:

- `/tmp/habita-life-actors/results.json`
- `/tmp/habita-life-continuity/results.json`
- `/tmp/habita-life-editors/results.json`
- `/tmp/habita-life-regression/results.json` (migration and room corrections)
- `/tmp/habita-life-market/results.json` (furniture and insufficient-funds checks)
- `/tmp/habita-root-life-review/results.json` (latest project/migration/sky review)
- `/tmp/habita-life-ux/results.json`
- `/tmp/habita-life-journey/results.json`
- `/tmp/habita-life-ux-long/results.json`
- `/tmp/habita-v08-ux-layout-final/results.json` (rendered initial screenshots)
- `/tmp/habita-shop-guard/results.json` (final market regression)
- `/tmp/habita-v08-correction-final/results.json` (new and historical care links)
- `/tmp/habita-v08-keyboard-final/results.json` (final dialog/market keyboard regression)
- `/tmp/habita-v08-regression-final/results.json` (complete original suite)

Consolidated report: `/tmp/habita-v08-consolidated.json` (**54 passed, zero failed**). An additional independent shop run in `/tmp/habita-shop-guard-extra-results.json` passed four checks for real touchscreen 390×844/320×568, repeated Enter, desktop double-click, insufficient funds, reload and backdrop behavior; those supplemental ad hoc checks are not counted in the 54 durable-suite scenarios.

`QA-LIFE-UX.md` records the experience review and screenshot method. Source upload, Pages deployment and public-site verification are coordinator outcomes; these local tests do not establish any of them.

## Verification status

- [x] Chromium/Playwright available and final static server reachable on 8880.
- [x] Baseline missing capabilities reproduced before parallel application edits.
- [x] Stage A continuity and planning verified.
- [x] Stage B editors and usable furniture verified.
- [x] Stage C economy and persistence verified after double-click correction.
- [x] Stage D neighbors and absence verified.
- [x] Corrected real activities update their linked simulation history and keep unrelated data.
- [x] Mobile/desktop experience review and six artistic sky phases reviewed.
- [x] Complete historical integration regression finished: 30/30 passed.
