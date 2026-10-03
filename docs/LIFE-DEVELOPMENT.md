# Habita v0.8: everyday life work agreement

Baseline: `f5e99a2` / v0.7. User authorizes the uploaded life prompt and artistic skies. Preserve the pilot, existing saves/photos, care loop and real/demo isolation. Local simulation, no paid AI or real-money payments.

## Reproduced before parallel coding

Seven baseline browser scenarios pass (old data/photo/timer, import recovery, real/demo isolation, activity confirmation, related reward, visible feedback, avatar). Current save has no economy, editable layout, projects or relationships. NPCs walk predefined routes; the main controller only remembers recent task IDs. Static server: port 8877.

## Exclusive ownership

- Coordinator: index.html, app.js, domain.js, care.js, integration, schema, README and this document; commits/publication.
- Engine parent: world.js and room-editor.js. Its child: home-layout.js only.
- Visual parent: ambience.js and world-style.css. Its child: appearance.js and wardrobe.js only.
- Simulation parent: simulation.js and companion.js. Economy child, when capacity allows: economy.js and market.js only.
- QA: tests/ and docs/QA-LIFE.md only.

No simultaneous edits of any file. Agents do not commit or push. Mutations begin only after these contracts are assigned. A child inherits exclusive filenames explicitly; no recursive expansion into another owner's files.

Final review follow-up: qa_finish owns tests and QA documents, shop_guard owns market.js/economy.js, and integration_review temporarily owned simulation.js for care-record correction. The coordinator retains app.js and publication. Original component owners finished and released their files before these assignments.

## Load and persistence

Classic scripts; no build. Load domain, world, care, economy, home-layout, appearance, ambience, simulation, companion, wardrobe, market, room-editor, app.

Keep localStorage `habita-pilot-v2` and version 2. New optional fields default safely:

- profile.avatar: preserve old four fields; Appearance adds face, eyes, brows, expression, top, bottom, shoes, bottomColor, shoeColor, eyeColor, costume. New hair/accessory choices are exported in Appearance.options. Costume item IDs are validated and current-run ownership is checked when equipping/rendering.
- profile.avatarLooks: at most six saved {name,avatar,skin,hair,shirt} looks. Appearance.validateAvatar/validateLooks accepts old saves and returns canonical data.
- run.economy: null on old saves; HabitaEconomy.fresh/validate/ensure owns its strict bounded schema. Balance, owned item ID strings, ledger/reward deduplication and daily caps. Separate real and demo accounts; no real money.
- run.homeLayout: null for original furniture; otherwise {version:1,revision,placements:[{instanceId,itemId,x,y,rotation}]}. One item per SKU, rotation 0..3. Base movable items use IDs base-home-bed/desk/plant/books/sofa/table/cat; instance IDs retain home-* interaction IDs. Omitted movable base items are stored. Window/rug/portal remain fixed.
- run.life: null on old saves; HabitaLife.fresh/validate/ensure owns strict bounded schema. {version,simSeconds,lastSeenAt,needs:{energy,comfort,curiosity,social},projects:[{id,type,title,stage,status,createdAt,completedAt?,detail}],memories:[{id,at,kind,title,text,sceneId,npcId?,recordId?}],relationships:{npcId:{name,affinity,encounters,lastAt,lastTopic}},homeEffects:{artwork,plantGrowth,meals},careEchoes:[{action,at,recordId?}],returnSummary,neighbours:{npcId:{needs,goal,recent,meetings,lastAt,known}}}. Memories max60, projects max12, echoes max12. Each neighbor remembers other neighbors separately from the user's relationship history.

Coordinator validates new fields after profile and run economy. Incompatible original saves remain protected from overwrite. opts.getState returns flags/profile/mood/friend/life/economy/homeLayout.

## Shared interfaces

World retains avatar APIs and adds getActor(id='player'), navigateActor(id,x,y,{source}), actorArrived(id,target,tolerance), cancelActor(id,reason), setActorAnimation(id,anim,seconds), setActorTask(id,task), releaseActorControl(id), reserveObject(objectId,actorId), releaseReservation(actorId), reservationSnapshot(). Tokens contain entityId. Each NPC has its own route/token/animation, n.anim/n.activeTask/n.bubble={text,until:world.time+seconds}. Scene changes free reservations. NPC selection emits characterselect and invokes opts.onCharacter(id).

HabitaHomeLayout.normalize(raw) validates saved shape and returns a canonical layout. HabitaHomeLayout.validate/validateLayout return validation results for a scene/draft, not saved state. HabitaHomeLayout.apply(base,state) composes a new home scene without mutating base; an unusable historical arrangement has a repairable fallback. The editor checks bounds/overlap, spawn/portal access, connected free space, use points and current actors before accepting a draft. HabitaScenes.getBase provides bedroom/studio before layout; get applies layout. RoomEditor.open supports draft, move/rotate/store/restore/undo/cancel/save; saving is blocked until valid and calls refreshScene, recenter and coordinator UI updates.

HabitaCatalog.items is an array: {id,kind:'outfit'|'furniture',name,price,description,appearance?,furniture?}. furniture={type,w,d,color?,tasks:[existing task schema]}. Renderer supports existing types plus chair/lamp/rug. Costume IDs: costume-shark, costume-cappuccino, costume-croc-plane. Additional premium everyday outfits use outfit-* IDs. New furniture uses furniture-*.

HabitaEconomy owns/buy/equip/rewardCare(record)/rewardProject(id)/rewardDiscovery(scene) ensures atomic, deduplicated transactions. Initial balance 180, baseline furniture owned/free, catalog data controls prices/caps. Market.open and preview/confirm/equip controls use data-item and data-action. Appearance preview may show unowned items without equipping them.

HabitaLife init(world)/update(dt)/priority(candidates)/completed(task)/onCare(action,recordId)/describe/snapshot/openJournal/inspectActor coordinates persistent plans and NPC encounters. Companion forwards updates, priorities and completions without creating real records. Coordinator calls onCare and economy reward only after a genuine confirmed care record. Project priority never forces camera/scene transitions; UI offers a voluntary visit. Absence reconciliation is bounded and explained; closed app executes no frames.

HabitaLife.correctCare(recordId,action) removes linked echoes and care memories when the user corrects a real record. The coordinator persists the result with the record deletion. Older memories without recordId are removed only when a timestamp/action link is unambiguous; ambiguous history is retained with an explicit correction note. Corrections preserve unrelated projects, effects, purchases and other accounts.

Appearance draws all avatar/NPC layers and previews; Wardrobe.open owns transactional editor and saved looks. Renderer reads life/homeEffects and NPC state only; it never modifies economy or simulation. HabitaScenes.drawBackdrop(world) draws artistic six-phase sky in screen coordinates before the world camera transform. Respect reduced motion and coherent clock.

## Stages and acceptance

- [x] A0 baseline, contracts and exclusive owners.
- [x] A1 persistent projects, motives and visible consequences; real care remains manual.
- [x] B1 varied reversible avatar editor and compatible animated costumes.
- [x] B2 room draft/store/rotation/undo; valid connected routes and reload persistence.
- [x] C1 shop/preview/confirm/equip, bounded rewards, insufficient funds and duplicate prevention.
- [x] D1 NPC needs/plans, exclusive reservations, autonomous encounters and remembered conversations.
- [x] Cross-cutting old saves/photo/timer, absence/day boundaries, real/demo, keyboard/reduced motion/audio and mobile/desktop.
- [x] Artistic sky reviewed in all six periods, with foreground readable.
- [x] Coordinator reviewed full create→care→consequence→purchase→place→encounter→return journey.
- [ ] Source uploaded; deployment and public URL status recorded independently.

Each owner reports changes, checks and remaining dependencies. Final source commits only after the integrated browser journeys pass. Public verification remains distinct from Git push.
