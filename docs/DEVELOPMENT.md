# Habita: work agreement and acceptance criteria

Baseline: `3ba5924` (v0.6). Keep old saves and real/demo isolation. No reset of user data.

## Reproduced baseline
- Browser: home `localPOIs()` returns zero objects.
- Browser: after entering outdoor and waiting 30 seconds, companion task serial does not increase.
- Isolated controller check: empty path at distance 1.24 is incorrectly treated as arrival.
- Existing exterior NPC has a fixed location. Existing sea foam and gulls do animate.
- Original engine extracted without behavior changes into `world.js` before parallel work.

## Exclusive ownership
- Movement agent: `world.js` only.
- Visual agent: `ambience.js`, visual assets, and `world-style.css` only.
- Autonomy agent: `companion.js` only (keep audio, notification and timer APIs intact).
- QA agent: `tests/` and `docs/QA.md` only; no app mutations.
- Coordinator: `index.html`, `care.js`, `domain.js`, `app.js`, saved schema, integration, this file, commits/publication.
No agent edits a file outside their assigned scope. No agents commit or push. Coordinator integrates and commits only after checks.

## Shared contracts
Plain classic browser scripts, no dependencies or build required. Load: domain.js -> world.js -> care.js -> ambience.js -> companion.js -> app.js.

`HabitaScenes.get(id, state)` -> scene or null. Canonical scene IDs: home, coast, plaza. Keep `outdoor` as the legacy 42x42 map and existing interiors recoverable.
Scene fields:
- id, name, width, height, spawn:{x,y,dir}, camera:{x,y}, zoom (optional).
- solids:[{x,y,w,d}]. Cells intersecting solids are blocked.
- objects:[{id,name,x,y,usePoints:[{x,y}],tasks:[{id,label,animation,prop,actions:[action IDs],minSeconds,maxSeconds}]}]. x/y is the drawn object; usePoints are accessible cells beside it. Use scene-unique IDs.
- portals:[{id,name,x,y,to}]. No automatic transition until user interacts.
- npcs:[{id,x,y,waypoints:[{x,y}],shirt?,hair?,skin?}]. Use reachable free points. Engine owns NPC position updates; renderer reads `world.npcs`.

Renderer exports `HabitaScenes.render(world)` (true if handled), `drawPerson(world,x,y,anim,npc=false)` (true if handled), `drawCat(world)` (true if handled), `getAtmosphere()` -> {sky:[color,color],tint}.
Keep globals realClock(date), updateRealClock(), showDayRhythm() compatible. No prototype patches from renderer.
Renderer draws `world.activeTask` props if present: {id, objectId, animation, prop, phase, progress}. Use world.state().profile for appearance; no dependency on global Companion. world primitive drawing helpers remain available.
Avatar profile schema: profile.avatar = {hairStyle:'short'|'bob'|'curls'|'long'|'braids'|'bald', outfit:'casual'|'coastal'|'creative'|'active', accessory:'none'|'glasses'|'headphones'|'cap', silhouette:'slim'|'regular'|'broad'}. Existing shirt/skin/hair colors remain. profile.interests = selected IDs reading/art/nature/music/movement/cooking/projects. User-controlled and reversible.

Engine compatibility: keep go(), findPath(), walkable(), react(), setZone(), getZone(), getPOIs(), localPOIs(), travel(), pause(), listen(), recenter(), zoom(), project(), unproject(), drawing helpers.
New engine APIs:
- getScene(), getInteractions() (objects kind:'task' and portals kind:'portal'), getTaskCandidates() -> flattened tasks containing objectId, sceneId, name, usePoints.
- navigateTo(x,y,{source:'autonomy'|'manual'|'interaction'}) -> movement token {id,status,target:{x,y},source}; world.motion tracks current token. statuses moving/arrived/failed/cancelled. go(x,y) returns bool compatibility.
- arrived(target,tolerance=.45), cancelMovement(reason), setTaskVisual(task|null), setActivityAnimation(animation,seconds).
- on(type,fn) -> unsubscribe. Events: scenechange {from,to}, manualinput, interaction {object}. Existing opts callbacks retained.
- opts.onUpdate(dt,now) is called after engine simulation. Coordinator forwards to Companion.update(dt). No prototype patches from autonomy.
- world.npcs contains live x/y etc, and world.activeTask contains task visual metadata.
Input to furniture/objects must reach a free use point before interaction fires. Portals require user action. Treat reduced motion independently of character route logic.

Companion compatibility: retain QuietSound, timerTick, companionHome, initCompanion, pendingCareNotice and all activity/notice helpers used by app. Add Companion.sceneChanged(), manualInput(), interact(object), snapshot(); keep begin(action), reset(), choose(), update(), cancel() and history. Reset task on scene changes; validate proximity and motion result, detect stalls, bounded retries. Autonomous updates in home/coast/plaza when page===world and not paused. Manual input temporarily takes priority then resumes.
Use task candidates from current scene; never record a real activity through fictional tasks. Derived user affinities use goals, interests, done/deferred records and hour. Optional run.companionMemory={recent:[bounded task IDs],total:number} is validated by coordinator. Autonomous state exposed through snapshot() for meaningful tests.

## Shared stages
1. Reliability: data-preserving extraction, movement, path recovery, pause/manual/scene coordination; run browser checks before proceeding.
2. World design: compact home/coast/plaza, Viña landmarks, inclusive avatar, NPCs, animated objects and user interactions.
3. Contextual autonomy: actual movement/use/recovery in all compact scenes, history/preferences, clear activity loop, mobile layout and publication check.

## Acceptance
- Old v2 saves and photos survive; timer deadline and real/demo separation preserved.
- Observe 90 simulated browser seconds: multiple autonomous tasks complete without user instructions in home and exterior.
- Free use-point arrival checked before task execution; obstacles not crossed; unreachable/stalled path recovers.
- Manual movement, object click, portal and modal pause/resume do not leave hanging tasks.
- Three compact scenes distinguish Viña visually, NPCs move, ocean/plants animate.
- Avatar options preview, save, cancel and reload; no inferred identity or automatic outfit changes.
- Reminder -> start -> timer -> one-tap done, no duplicate or automatic real records.
- One coherent zone for clock, records and reminders, configurable with Santiago default.
- Audio opt-in and mute; reduced motion; keyboard; no JS errors; useful performance/mobile checks.
- Visible build ID and cache version; distinguish code pushed/deployed/publicly verified.

## Integration progress
- [x] Browser baseline captured and failing behaviors reproduced.
- [x] Engine, domain and UI extracted without replacing the pilot.
- [x] Exclusive ownership and contracts assigned to four subagents.
- [x] New save fields validated; old saves remain accepted.
- [x] Root smoke: startup, customization save/reload, zero real records created by fictional activity.
- [x] Stability/browser acceptance complete: free use points, keyboard, bounded recovery, scene and modal coordination.
- [x] Visual scenes and avatar review complete, including compact feedback that leaves the character visible at the window.
- [x] 90-second autonomy and interaction checks complete in all three scenes, with no fictional real records.
- [x] Mobile/desktop, audio, clock, reminders and persistence final verification complete.
- [x] Visible release ID v0.7 and cache references 20261002-07 set.
- [ ] Source uploaded to main.
- [ ] Pages deployment completion confirmed.
- [ ] Public v0.7 checked from its URL.

## Verified milestones

- Stability: engine unit checks cover 44 object/portal routes, 24 deferred interactions and 90 routes from variable positions. Chromium verifies mobile/desktop clicks, free-use-point arrival, portal transitions and pause/recovery. Original saves remain accepted.
- Visual world: home, coast and plaza render without JS errors; original neighborhood retained. Final review includes small-phone camera fit, readable text and avatar preview.
- Contextual autonomy: independent browser observation completes multiple tasks in 90 simulated seconds per scene. Manual input takes priority; object use follows travel; fictional tasks never create care records. Rewards start a related available task and limit the sequence to available variety.
- Coordinator adds corrupt-save preservation, one clock zone across reminders/records, and panel/modal/tab pause coordination.

These are local integration checkpoints. The release is committed and published only when their combined final browser checks pass. Source push, Pages deployment and public version verification are separate release statuses.
