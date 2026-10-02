# Habita browser validation

Run a static server from the checkout (`python3 -m http.server 8765`) and run:

```sh
node tests/browser.cjs
```

The suite uses Playwright with `/usr/bin/chromium`; it does not add runtime dependencies to Habita. Configure `CHROMIUM_PATH` and `HABITA_TEST_URL` when using another installation. It writes JSON results and screenshots to `/tmp/habita-qa` by default (`HABITA_TEST_ARTIFACTS` can change this).

Select independent groups with `HABITA_TEST_GROUP=stability,data,activities,audio,trust,time node tests/browser.cjs`. Other groups: `autonomy`, `interactions`, `accessibility`, `layout`, `personalization`, `environment`, `onboarding`, `performance`. `HABITA_TEST_NAME` accepts a case-insensitive regular expression for targeted regressions.

## What is exercised

- Reachable free use points, compact scene bounds, routes and exact arrival.
- Ninety seconds of browser animation frames for each compact scene, with repeated observations of completed tasks, player position, solids and real-record counts.
- Empty paths, temporary navigation stalls, bounded recovery, keyboard priority and resumption.
- Furniture arrival before interaction, portal opt-in, scene resets and modal pause/resume.
- A historical version-2 save generated from commit `3ba5924`, containing a valid JPEG reference, real/demo records and an active timer deadline.
- Reminder → start → timer expiration → one-tap confirmation, with duplicate prevention and no automatic completion.
- Audio activation/mute, reduced motion, explicit scientific/character/scan limits, timezone validation and midnight boundaries.
- User-controlled avatar preview/cancel/save/reload, interests, outdoor inhabitants, mobile and desktop layouts.
- Uncaught JavaScript errors throughout each scenario.

`tests/make-legacy-fixture.cjs` regenerates the historical fixture using the original domain and care defaults from Git; it does not check out old files or mutate the running application.

## Reproduced baseline

Before integration, the coordinator reproduced zero home object interactions, exterior autonomy that did not start another task during 30 seconds, and an empty path incorrectly allowing a distant task to enter its doing phase. The original exterior NPC did not move. These are recorded in `DEVELOPMENT.md`.

## Verified result · 2026-10-02 · v0.7

**30 unique checks passed, no uncaught JavaScript errors.** Results were collected by development stage, followed by targeted regressions for final presentation and reward behavior. This is local validation; it does not establish public deployment status.

| Area | Checks | Observed result |
|---|---:|---|
| Movement/stability | 3 | All use points reachable; empty paths cannot start distant tasks; temporary blockage records one bounded failure and subsequently completes five tasks |
| Autonomous behavior | 3 | Five tasks completed in each of home, coast and plaza during 90 seconds of full browser frames; zero real records, distant interactions or positions inside solids |
| Interactions | 6 | Keyboard priority/resumption, object arrival, portal opt-in, modal pause, panel pause and real canvas pointer click pass |
| Personalization | 1 | Preview changes visually, cancel preserves profile, saved appearance/interests survive reload and autonomous actions |
| Environment | 1 | Both inhabitants move in each exterior and remain in reachable space |
| First-use setup | 1 | New mobile user selects name, goals, time and schedule; onboarding does not reappear on reload |
| Persistence | 3 | Historical v2 data/photo/timer survive; real/demo remain separate; unreadable original is preserved/exportable until valid import is confirmed |
| Activities/rewards | 3 | Timer never records automatically; duplicate confirmation records once; first exercise response is related; finite native CSS reward animation becomes visible |
| Audio | 1 | Opt-in activation and actual AudioContext mute pass |
| Time | 1 | Santiago midnight, Madrid adjustment, invalid zone rejection, saved preference and reminder acknowledgement pass |
| Trust | 1 | Health limits, finite/no-consciousness behavior and photograph/scan limits are explicit; source links use HTTPS |
| Layout | 4 | Controls reachable at 375×667, 390×844 and 1280×800; primary target 44 px and text contrast approximately 4.82:1; complete reward text clears the avatar head beside the window on both phone sizes |
| Reduced motion | 1 | Multiple useful autonomous tasks complete while reduced motion is enabled |
| Render responsiveness | 1 | Three scenes sampled with native RAF: median approximately 16.7 ms, p95 ≤16.8 ms in this headless Linux run |

The 90-second checks sample each second and execute all intervening animation frames. The full task catalog contains 18 home, 10 coast and 12 plaza tasks. Each compact exterior has two inhabitants. The final screenshots were visually reviewed: character/actions remain visible, mobile room no longer sits behind the clock/navigation, and activity/reward controls are clear.

Local artifacts for this run:

- Consolidated outcomes: `/tmp/habita-qa-results.json`.
- Full movement/scene scenarios: `/tmp/habita-qa-world/results.json`.
- Final phone/desktop layouts and reward image: `/tmp/habita-qa-final-layout/`.
- Native frame sampling and final home/coast/plaza desktop images: `/tmp/habita-qa-performance/`.
- Reduced motion, panel pause and real pointer interaction: `/tmp/habita-qa-additional/results.json`.
- Exercise confirmation: `/tmp/habita-qa-exercise/results.json`.
- Final compact reward regression and phone/desktop screenshots: `/tmp/habita-qa-reward-window/`. The window check walks the character to its use point, checks all four lines of reward copy for clipping, and compares its screen rectangle with the projected avatar head.

Use `node tests/aggregate-results.cjs <older-results.json> <newer-results.json> ...` to consolidate staged runs. Later outcomes replace earlier results for the same check. Temporary artifacts are outside the repository; rerunning the suite recreates them.

## Scope and limits

Virtual time executes actual browser animation-frame callbacks. Timer/deadline checks skip redundant frames; separate autonomy tests execute every frame. Navigation-stall testing temporarily suppresses `world.move` inside an isolated browser context and restores it before recovery verification. It does not alter application source files. CSS animations use a native timeline separate from the installed JavaScript clock: screenshots finish finite CSS animations, and a separate unmocked browser check verifies the reward becomes visible normally.

This suite uses headless Chromium on Linux. It does not substitute for Safari/iOS testing, real device frame-rate profiling, clinical validation or external source verification. Evidence links are checked for presence and HTTPS, not for the scientific applicability of their contents. Public deployment checks belong to the coordinator and must be reported separately from local browser checks.
