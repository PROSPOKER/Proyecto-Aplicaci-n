# Habita v0.8 · browser experience review

Review date: 2026-10-03. Local Chromium against the static checkout; no installation is needed by the application's user. This supplements `QA-LIFE.md` and does not establish public deployment status.

## Verified experience

| Journey or surface | Browser evidence | Result |
|---|---|---|
| First view | 375×667, 390×844 and 1280×800 | Wallet, activity, project, schedule, scene navigation and bottom tabs are inside the viewport and accept pointer input; no document overflow |
| Artistic day | Six deterministic hours with reduced motion | Displayed hour, phase and sky agree; morning, noon, afternoon, sunset, night and early morning are visibly distinct |
| Identity | Layered appearance plus keyboard tab navigation | Preview remains local until save; cancel preserves the entire profile; saved look and appearance survive reload; arrow keys, Home and End move tab focus |
| Home editing | Draft preview, move, rotate, undo, store, cancel and save | Furniture remains usable after placement/reload; invalid drafts explain overlap or missing access and cannot be saved |
| Precise furniture placement | Phone room editor | Coordinate inputs are 48 px high and provide an alternative to the smaller floor cells; move/save/cancel controls are reachable after normal modal scrolling |
| Market | Preview with visible price and resulting balance | Buying stores the item for a separate equip/place choice; double-click, touchscreen and repeated Enter cannot charge twice or implicitly equip; funds and inventory are separate between real and demo modes |
| Dialog keyboard | Enter preview → purchase → receipt → equip | Keyboard-generated clicks stay inside the dialog; receipt remains open, repeated Enter is inert and a later explicit equip returns to the world; actual pointer backdrop click still closes |
| Record correction | New record link and historical memory without metadata | The linked echo/memory is removed after confirmation and reload; unrelated history, project, effects, demo, photo and balance remain intact |
| Continuity | Care → project → furniture → encounter → next day | One real care record; owned easel remains placed; a neighbor is remembered; next-day summary describes reconstruction instead of continuous closed-app execution |
| Reduced motion | Ninety seconds of full browser frames | Decorative reward animation and status transitions are removed; five autonomous tasks still complete |
| Live world | Fifteen minutes, 180 observations | 48 avatar tasks finish across coast/plaza/coast; every NPC moves and completes a routine or meeting in each five-minute window; no actor enters an obstacle, remote task begins early or object reservation stalls beyond the tested limit |

The small-screen first view keeps the room and avatar above the care card. The sky provides the time-of-day cue without hiding controls or replacing the activity. The market asks for a purchase with its cost visible, and the home editor displays its validation before saving. The project journal explains stages, voluntary scene visits, remembered neighbors and the scope of an absence summary.

## Evidence and screenshot method

- Latest home/editor/market screenshots and control geometry: `/tmp/habita-v08-ux-layout-final/`.
- Six rendered phase screenshots and completed project: `/tmp/habita-root-life-review/`.
- Saved wardrobe and room-edit interactions: `/tmp/habita-life-editors/` and `/tmp/habita-life-regression/`.
- Full user journey and next-day journal: `/tmp/habita-life-journey/`.
- Keyboard/reduced-motion results: `/tmp/habita-life-ux/results.json`.
- Final Enter/dialog regression: `/tmp/habita-v08-keyboard-final/results.json`.
- Final complete original regression and rendered phone/desktop images: `/tmp/habita-v08-regression-final/`.
- Long-run screenshots and 180 raw observations: `/tmp/habita-life-ux-long/`.

The UI harness advances 200 ms of actual renderer frames before initial screenshots. Earlier initial UX images captured with the JavaScript clock paused before its first animation frame are geometry evidence only; the latest screenshot directory replaces those visual images. This test change does not alter the application or relax an assertion.

## Scope

The review covers Chromium on Linux, pointer interactions, keyboard controls and the stated viewport sizes. It does not establish Safari/iOS behavior, screen-reader usability, device frame rates or clinical benefits. The app's evidence links and health/simulation/photograph limitations are checked separately by the historical regression suite. Fictional character needs and memories do not measure the user's health or imply consciousness.
