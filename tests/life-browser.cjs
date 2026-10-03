/* User-facing acceptance scenarios for the evolving local life simulation. */
'use strict';
const { assert, launch, session, advance, noErrors, shot, finishRealActivity, reporter, legacy, START } = require('./life-helpers.cjs');
const report = reporter();
let browser;

(async () => {
  browser = await launch();

  await report.test('migration', 'Historical pilot remains intact after new life defaults and reload', async () => {
    const s = await session(browser, { historical: true });
    try {
      const before = await s.p.evaluate(() => ({ profile: state.profile, real: state.real, demo: state.demo, loadIssue }));
      assert.equal(before.loadIssue, false);
      assert.equal(before.profile.name, legacy.profile.name);
      assert.equal(before.profile.photo, legacy.profile.photo);
      assert.deepEqual(before.profile.care, legacy.profile.care);
      assert.deepEqual(before.real.records, legacy.real.records);
      assert.deepEqual(before.demo.records, legacy.demo.records);
      assert.equal(before.real.active.timerEnd, legacy.real.active.timerEnd);
      assert.ok(before.real.life && before.real.economy, 'New local simulation state initialized');
      assert.ok(before.demo.life && before.demo.economy, 'Separate demo simulation initialized');
      await s.p.evaluate(() => { save(); closeModal(); });
      await s.p.reload({ waitUntil: 'load' });
      const after = await s.p.evaluate(() => ({ profile: state.profile, real: state.real, demo: state.demo, loadIssue }));
      assert.equal(after.loadIssue, false);
      assert.equal(after.profile.photo, before.profile.photo);
      assert.deepEqual(after.real.records, before.real.records);
      assert.deepEqual(after.demo.records, before.demo.records);
      assert.equal(after.real.active.timerEnd, before.real.active.timerEnd);
      await noErrors(s);
      return { realRecords: after.real.records.length, demoRecords: after.demo.records.length, photoPreserved: true, activeDeadline: after.real.active.timerEnd };
    } finally { await s.context.close(); }
  });

  await report.test('actors', 'NPC navigation has an independent token and cannot replace the avatar route', async () => {
    const s = await session(browser);
    try {
      const started = await s.p.evaluate(() => {
        visitScene('coast'); Companion.cancel(); world.opts.onUpdate = () => {};
        const npc = world.npcs[0];
        const points = world.getInteractions().flatMap(o => o.usePoints || []).filter(p => world.canStand(p.x, p.y));
        const npcTarget = points.find(p => Math.hypot(p.x - npc.x, p.y - npc.y) > 1 && Math.hypot(p.x - world.player.x, p.y - world.player.y) > 2);
        const playerTarget = points.find(p => Math.hypot(p.x - world.player.x, p.y - world.player.y) > 1 && Math.hypot(p.x - npcTarget.x, p.y - npcTarget.y) > 2);
        if (!npcTarget || !playerTarget) throw Error('Distinct reachable destinations required');
        window.qaActorMotion = world.navigateActor(npc.id, npcTarget.x, npcTarget.y, { source: 'simulation' });
        window.qaPlayerMotion = world.navigateTo(playerTarget.x, playerTarget.y, { source: 'manual' });
        return { npcId: npc.id, npcTarget, playerTarget, npcToken: qaActorMotion.id, playerToken: qaPlayerMotion.id, playerStart: { x: world.player.x, y: world.player.y }, npcStart: { x: npc.x, y: npc.y } };
      });
      assert.notEqual(started.npcToken, started.playerToken, 'Actor-specific movement tokens');
      await advance(s.p, 45000);
      const after = await s.p.evaluate(npcId => ({ npc: world.getActor(npcId), player: world.player, npcMotion: qaActorMotion, playerMotion: qaPlayerMotion, playerArrived: world.arrived(qaPlayerMotion.target), npcArrived: world.actorArrived(npcId, qaActorMotion.target) }), started.npcId);
      assert.equal(after.playerMotion.status, 'arrived', JSON.stringify(after));
      assert.equal(after.npcMotion.status, 'arrived', JSON.stringify(after));
      assert.equal(after.playerArrived, true);
      assert.equal(after.npcArrived, true);
      assert.ok(Math.hypot(after.player.x - started.playerStart.x, after.player.y - started.playerStart.y) > .5);
      assert.ok(Math.hypot(after.npc.x - started.npcStart.x, after.npc.y - started.npcStart.y) > .5);
      await noErrors(s); return { npc: started.npcId, npcToken: started.npcToken, playerToken: started.playerToken, status: ['arrived', 'arrived'] };
    } finally { await s.context.close(); }
  });

  await report.test('actors', 'Object reservations are exclusive and released on cancellation or scene change', async () => {
    const s = await session(browser);
    try {
      const locks = await s.p.evaluate(() => {
        visitScene('coast'); Companion.cancel(); world.opts.onUpdate = () => {};
        const object = world.getInteractions().find(o => o.kind === 'task');
        const npc = world.npcs[0];
        const first = world.reserveObject(object.id, npc.id);
        const competing = world.reserveObject(object.id, 'player');
        const taken = world.reservationSnapshot();
        world.releaseReservation(npc.id);
        const retry = world.reserveObject(object.id, 'player');
        world.cancelActor('player', 'qa-cancel');
        const afterCancel = world.reservationSnapshot();
        world.reserveObject(object.id, npc.id);
        world.setZone('home');
        return { first, competing, retry, taken, afterCancel, afterScene: world.reservationSnapshot() };
      });
      assert.equal(locks.first, true);
      assert.equal(locks.competing, false, 'Second actor cannot use an occupied object');
      assert.equal(locks.taken.length, 1);
      assert.equal(locks.retry, true);
      assert.deepEqual(locks.afterCancel, []);
      assert.deepEqual(locks.afterScene, []);
      await noErrors(s); return locks;
    } finally { await s.context.close(); }
  });


  await report.test('continuity', 'One care confirmation creates a related memory and rewards only once', async () => {
    const s = await session(browser);
    try {
      const before = await s.p.evaluate(() => ({ economy: structuredClone(run().economy), records: run().records.length }));
      await finishRealActivity(s.p, 'hobby');
      const first = await s.p.evaluate(() => ({ records: structuredClone(run().records), economy: structuredClone(run().economy), life: HabitaLife.snapshot(), task: Companion.snapshot().task }));
      assert.equal(first.records.length, before.records + 1);
      assert.ok(first.life.careEchoes.some(e => e.action === 'hobby' && e.recordId === first.records.at(-1).id));
      assert.ok(first.life.memories.some(m => m.kind === 'care' && /hobby|gusto|tiempo/i.test(m.text)));
      assert.ok(first.economy.balance > before.economy.balance, 'A real confirmation has a modest earned reward');
      const related = await s.p.evaluate(() => world.getTaskCandidates().filter(t => t.actions.includes('hobby')).map(t => ({ id: t.id, objectId: t.objectId })));
      assert.ok(related.some(t => t.id === first.task?.id && t.objectId === first.task?.objectId), 'Visible consequence relates to the confirmed activity');
      await s.p.evaluate(() => { finishAction(); finishAction(); });
      const again = await s.p.evaluate(() => ({ records: run().records, economy: run().economy, life: HabitaLife.snapshot() }));
      assert.equal(again.records.length, first.records.length);
      assert.equal(again.economy.balance, first.economy.balance);
      assert.equal(again.life.careEchoes.length, first.life.careEchoes.length);
      await advance(s.p, 40000);
      assert.equal(await s.p.evaluate(() => run().records.length), first.records.length, 'Fictional activity never adds real records');
      await s.p.reload();
      const restored = await s.p.evaluate(() => ({ records: run().records, life: HabitaLife.snapshot() }));
      assert.equal(restored.records.length, first.records.length);
      assert.ok(restored.life.memories.some(m => m.kind === 'care'));
      await noErrors(s); return { records: first.records.length, reward: first.economy.balance - before.economy.balance, firstTask: first.task?.id, echoes: first.life.careEchoes.length };
    } finally { await s.context.close(); }
  });

  for (const legacyMetadata of [false, true]) await report.test('correction', legacyMetadata
    ? 'Correcting a legacy care memory without metadata removes its echo without losing unrelated data'
    : 'Correcting a care record removes its related echo and memory and survives reload', async () => {
    let s = await session(browser, { historical: true });
    try {
      await s.p.evaluate(() => { closeModal(); navigate('world'); });
      await finishRealActivity(s.p, 'hobby');
      await finishRealActivity(s.p, 'self');
      let before = await s.p.evaluate(() => ({ profile: structuredClone(state.profile), real: structuredClone(state.real), demo: structuredClone(state.demo), loadIssue }));
      const removed = before.real.records.find(r => r.action === 'hobby');
      const retained = before.real.records.find(r => r.action === 'self');
      assert.ok(removed && retained, 'Both confirmations must have durable records');
      assert.equal(before.real.life.careEchoes.length, 2);
      const retainedMemory = before.real.life.memories.find(m => m.kind === 'care' && m.recordId === retained.id)
        || before.real.life.memories.filter(m => m.kind === 'care').at(-1);
      const removedName = await s.p.evaluate(action => ACTIONS[action].name, removed.action);
      assert.ok(retainedMemory, 'An unrelated care memory exists before correction');
      if (!legacyMetadata) assert.ok(before.real.life.memories.some(m => m.kind === 'care' && m.recordId === removed.id), 'New care memory links to the actual record');
      if (legacyMetadata) {
        const historicalSave = structuredClone(await s.p.evaluate(() => JSON.parse(localStorage.getItem(KEY))));
        for (const m of historicalSave.real.life.memories) if (m.kind === 'care') { delete m.recordId; delete m.action; }
        await s.context.close();
        s = await session(browser, { historical: true, save: historicalSave });
        await s.p.evaluate(() => { closeModal(); navigate('world'); });
        before = await s.p.evaluate(() => ({ profile: structuredClone(state.profile), real: structuredClone(state.real), demo: structuredClone(state.demo), loadIssue }));
        assert.equal(before.loadIssue, false, 'Optional care metadata must keep older evolved saves readable');
      }
      await s.p.evaluate(id => correctRecord(id), removed.id);
      await s.p.getByRole('button', { name: 'Eliminar y recalcular', exact: true }).click();
      const check = async () => {
        const now = await s.p.evaluate(() => ({ profile: state.profile, real: state.real, demo: state.demo, loadIssue }));
        assert.equal(now.loadIssue, false, 'Corrected state remains valid');
        assert.deepEqual(now.real.records, before.real.records.filter(r => r.id !== removed.id));
        assert.ok(now.real.records.some(r => r.id === retained.id), 'Unrelated activity remains');
        assert.equal(now.real.life.careEchoes.some(e => e.recordId === removed.id || e.action === removed.action), false, 'No false care echo remains');
        assert.equal(now.real.life.memories.some(m => m.kind === 'care' && (m.recordId === removed.id || m.text.includes('«' + removedName + '»'))), false, 'No care memory still claims the corrected action happened');
        assert.ok(now.real.life.memories.some(m => m.id === retainedMemory.id), 'Unrelated memory is retained');
        assert.ok(now.real.life.careEchoes.some(e => e.action === retained.action), 'Unrelated echo is retained');
        assert.deepEqual(now.real.life.projects, before.real.life.projects);
        assert.deepEqual(now.real.life.homeEffects, before.real.life.homeEffects);
        assert.deepEqual(now.real.economy, before.real.economy, 'Correction creates no debt, charge or new reward');
        assert.deepEqual(now.demo, before.demo, 'Correction cannot alter demo data');
        assert.deepEqual(now.profile, before.profile, 'Photo and user profile are preserved');
        return now;
      };
      await check();
      await s.p.reload({ waitUntil: 'load' });
      const after = await check();
      await noErrors(s);
      return { legacyMetadata, removed: removed.action, retained: retained.action, remainingEchoes: after.real.life.careEchoes.length, photoPreserved: after.profile.photo === legacy.profile.photo, balance: after.real.economy.balance };
    } finally { await s.context.close(); }
  });

  await report.test('continuity', 'A voluntary coast-to-home project leaves a remembered visible artifact', async () => {
    const s = await session(browser);
    try {
      const initial = await s.p.evaluate(() => HabitaLife.snapshot());
      assert.equal(initial.project.type, 'art');
      const projectId = initial.project.id;
      await s.p.evaluate(() => HabitaLife.openJournal());
      await s.p.locator('[data-action="continue-project"]').click();
      assert.equal(await s.p.evaluate(() => world.getZone()), 'coast');
      await advance(s.p, 90000);
      const coast = await s.p.evaluate(() => HabitaLife.snapshot());
      const coastProject = coast.projects.find(p => p.id === projectId);
      assert.ok(coastProject.stage >= 1, JSON.stringify(coast));
      assert.ok(coast.memories.some(m => m.kind === 'project-step' && /idea|inspiración|mar/i.test(m.text + m.title)));
      assert.equal(await s.p.evaluate(() => world.getZone()), 'coast', 'A project never moves the camera to another scene by itself');
      await s.p.evaluate(() => HabitaLife.openJournal());
      await s.p.locator('[data-action="continue-project"]').click();
      assert.equal(await s.p.evaluate(() => world.getZone()), 'home');
      await advance(s.p, 90000);
      const done = await s.p.evaluate(() => ({ life: HabitaLife.snapshot(), economy: run().economy, records: run().records }));
      const completed = done.life.projects.find(p => p.id === projectId);
      assert.equal(completed.status, 'completed', JSON.stringify(done.life));
      assert.equal(completed.stage, 3);
      assert.ok(completed.completedAt);
      assert.equal(done.life.effects.artwork, initial.effects.artwork + 1);
      assert.ok(done.life.memories.filter(m => m.kind === 'project-step').length >= 3);
      assert.ok(done.life.memories.some(m => m.kind === 'project-complete'));
      assert.equal(done.records.length, 0);
      await shot(s.p, 'completed-home-project');
      await s.p.evaluate(() => HabitaLife.openJournal());
      await s.p.locator(`[data-completed-project="${projectId}"]`).waitFor();
      await shot(s.p, 'completed-project-journal');
      await s.p.reload();
      const restored = await s.p.evaluate(() => ({ life: HabitaLife.snapshot(), economy: run().economy }));
      assert.equal(restored.life.projects.find(p => p.id === projectId).status, 'completed');
      assert.ok(restored.life.effects.artwork >= done.life.effects.artwork);
      assert.equal(restored.economy.balance, done.economy.balance, 'Reload cannot issue the project reward a second time');
      await noErrors(s); return { project: projectId, stages: completed.stage, artifact: restored.life.effects.artwork, memories: done.life.memories.length };
    } finally { await s.context.close(); }
  });

  await report.test('absence', 'Returning after a day reconstructs one bounded summary without losses or real records', async () => {
    const seed = await session(browser);
    let saved;
    try {
      saved = await seed.p.evaluate(() => JSON.parse(localStorage.getItem('habita-pilot-v2')));
    } finally { await seed.context.close(); }
    saved.real.life.lastSeenAt -= 24 * 60 * 60 * 1000;
    const s = await session(browser, { save: saved });
    try {
      const after = await s.p.evaluate(() => ({ life: HabitaLife.snapshot(), economy: run().economy, records: run().records }));
      assert.match(after.life.returnSummary, /reconstru/i);
      assert.match(after.life.returnSummary, /no.*continuamente.*cerrada/i);
      assert.equal(after.life.memories.filter(m => m.kind === 'return').length, 1);
      assert.equal(after.records.length, saved.real.records.length);
      assert.ok(after.economy.balance >= saved.real.economy.balance);
      assert.deepEqual(after.economy.owned, saved.real.economy.owned);
      assert.equal(after.life.effects.artwork, saved.real.life.homeEffects.artwork);
      assert.ok(after.life.simSeconds - saved.real.life.simSeconds < 1, 'Closed time does not execute an unbounded sequence of frames');
      await s.p.evaluate(() => HabitaLife.openJournal());
      await s.p.locator('[data-return-summary]').waitFor();
      await shot(s.p, 'return-summary');
      await s.p.reload();
      const again = await s.p.evaluate(() => ({ life: HabitaLife.snapshot(), economy: run().economy, records: run().records }));
      assert.equal(again.life.memories.filter(m => m.kind === 'return').length, 1);
      assert.equal(again.economy.balance, after.economy.balance);
      assert.equal(again.records.length, after.records.length);
      await noErrors(s); return { summary: after.life.returnSummary, newMemories: 1, balance: after.economy.balance };
    } finally { await s.context.close(); }
  });


  await report.test('layout-safety', 'Unsafe room layouts cannot overlap furniture, trap entry or split walkable space', async () => {
    const s = await session(browser);
    try {
      const result = await s.p.evaluate(() => {
        const base = HabitaScenes.getBase('home', world.state());
        const original = HabitaHomeLayout.fresh(base);
        const check = layout => {
          const r = HabitaHomeLayout.validateLayout(base, layout, world.state());
          return { ok: r.ok, codes: r.codes || [r.code], errors: r.errors };
        };
        const overlap = structuredClone(original);
        overlap.placements.find(p => p.instanceId === 'home-bed').x = 6;
        const entry = structuredClone(original), blockedBed = entry.placements.find(p => p.instanceId === 'home-bed');
        blockedBed.x = Math.floor(base.spawn.x); blockedBed.y = Math.floor(base.spawn.y);
        const door = structuredClone(original), doorBed = door.placements.find(p => p.instanceId === 'home-bed');
        doorBed.x = Math.floor(base.portals[0].x); doorBed.y = Math.floor(base.portals[0].y);
        const outside = structuredClone(original); outside.placements[0].x = base.width;
        const island = structuredClone(original);
        island.placements = island.placements.filter(p => p.instanceId !== 'home-cat');
        let x = 0;
        for (const id of ['home-bed', 'home-desk', 'home-sofa', 'home-table', 'home-books', 'home-plant']) {
          const p = island.placements.find(p => p.instanceId === id); p.x = x; p.y = 4;
          x += base.objects.find(o => o.id === id).w;
        }
        return { initial: check(original), overlap: check(overlap), entry: check(entry), door: check(door), outside: check(outside), island: check(island), saved: run().homeLayout };
      });
      assert.equal(result.initial.ok, true, JSON.stringify(result.initial));
      for (const kind of ['overlap', 'entry', 'door', 'outside', 'island']) assert.equal(result[kind].ok, false, `${kind}: ${JSON.stringify(result[kind])}`);
      assert.ok(result.overlap.codes.includes('overlap'));
      assert.ok(result.entry.codes.includes('spawn-blocked'));
      assert.ok(result.door.codes.includes('portal-blocked'));
      assert.ok(result.outside.codes.includes('outside'));
      assert.ok(result.island.codes.includes('isolated-floor'));
      assert.equal(result.saved, null, 'Rejected drafts cannot change the original saved room');
      await noErrors(s); return result;
    } finally { await s.context.close(); }
  });


  await report.test('sky', 'Six real-time phases have distinct artistic skies and a coherent displayed hour', async () => {
    const s = await session(browser, { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    try {
      const phases = [['dawn',2],['morning',8],['noon',13],['afternoon',16],['sunset',20],['night',22]];
      const samples = [];
      for (const [id, hour] of phases) {
        await s.p.clock.setSystemTime(new Date(Date.UTC(2026, 9, 2, hour + 3)));
        const sample = await s.p.evaluate(() => {
          updateRealClock(); world.render();
          const x = Math.floor(world.canvas.width / 2), y = Math.floor(world.canvas.height * .1);
          return { id: realClock().phase.id, hour: realClock().hour, displayed: document.querySelector('#realClock').textContent, color: [...world.ctx.getImageData(x, y, 1, 1).data], phase: document.body.dataset.dayPhase };
        });
        assert.equal(sample.id, id);
        assert.equal(sample.hour, hour);
        assert.equal(sample.phase, id);
        assert.match(sample.displayed, new RegExp(String(hour).padStart(2, '0') + ':00'));
        samples.push(sample);
        await shot(s.p, `sky-${id}-phone`);
      }
      assert.ok(new Set(samples.map(s => s.color.join(','))).size >= 5, 'Visual phase changes must affect the actual canvas');
      await noErrors(s); return { reducedMotion: true, phases: samples };
    } finally { await s.context.close(); }
  });


  await report.test('wardrobe', 'Layered appearance and saved looks are varied, reversible and persistent', async () => {
    const s = await session(browser, { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    try {
      const before = await s.p.evaluate(() => ({ avatar: state.profile.avatar, looks: state.profile.avatarLooks }));
      await s.p.evaluate(() => Wardrobe.open());
      const first = await s.p.locator('#avatarPreview').evaluate(c => c.toDataURL());
      await s.p.locator('#avatar-face').selectOption('angular');
      await s.p.locator('#avatar-eyes').selectOption('wide');
      await s.p.locator('#avatar-brows').selectOption('bold');
      await s.p.locator('#avatar-expression').selectOption('bright');
      const face = await s.p.locator('#avatarPreview').evaluate(c => c.toDataURL());
      assert.notEqual(face, first, 'Face features are drawn, not just stored');
      await s.p.locator('[data-wardrobe-tab="hair"]').click();
      await s.p.locator('#avatar-hairStyle').selectOption('afro');
      await s.p.locator('#avatar-accessory').selectOption('flower');
      await s.p.locator('[data-wardrobe-tab="clothes"]').click();
      await s.p.locator('#avatar-top').selectOption('cardigan');
      await s.p.locator('#avatar-bottom').selectOption('skirt');
      await s.p.locator('#avatar-shoes').selectOption('boots');
      const dressed = await s.p.locator('#avatarPreview').evaluate(c => c.toDataURL());
      assert.notEqual(dressed, face, 'Separate clothing layers change the illustration');
      await s.p.locator('[data-wardrobe-tab="extras"]').click();
      await s.p.locator('#wardrobe-look-name').fill('Paseo con flores');
      await s.p.locator('#wardrobe-save-look').click();
      assert.equal(await s.p.locator('[data-wardrobe-look]').count(), 1);
      assert.deepEqual(await s.p.evaluate(() => ({ avatar: state.profile.avatar, looks: state.profile.avatarLooks })), before, 'All editor changes are drafts');
      await shot(s.p, 'wardrobe-draft-phone');
      await s.p.locator('#wardrobe-cancel').click();
      assert.deepEqual(await s.p.evaluate(() => ({ avatar: state.profile.avatar, looks: state.profile.avatarLooks })), before);
      await s.p.evaluate(() => Wardrobe.open());
      await s.p.locator('#avatar-face').selectOption('round');
      await s.p.locator('#avatar-eyes').selectOption('almond');
      await s.p.locator('[data-wardrobe-tab="hair"]').click();
      await s.p.locator('#avatar-hairStyle').selectOption('locs');
      await s.p.locator('[data-wardrobe-tab="clothes"]').click();
      await s.p.locator('#avatar-top').selectOption('jacket');
      await s.p.locator('#avatar-bottom').selectOption('wide');
      await s.p.locator('#avatar-shoes').selectOption('sandals');
      await s.p.locator('[data-wardrobe-tab="extras"]').click();
      await s.p.locator('#wardrobe-look-name').fill('Mi look tranquilo');
      await s.p.locator('#wardrobe-save-look').click();
      await s.p.locator('#wardrobe-save').click();
      const saved = await s.p.evaluate(() => ({ avatar: state.profile.avatar, looks: state.profile.avatarLooks }));
      assert.equal(saved.avatar.face, 'round'); assert.equal(saved.avatar.eyes, 'almond');
      assert.equal(saved.avatar.hairStyle, 'locs'); assert.equal(saved.avatar.top, 'jacket');
      assert.equal(saved.avatar.bottom, 'wide'); assert.equal(saved.avatar.shoes, 'sandals');
      assert.equal(saved.looks[0].name, 'Mi look tranquilo');
      await s.p.evaluate(() => visitScene('coast')); await advance(s.p, 15000);
      assert.deepEqual(await s.p.evaluate(() => state.profile.avatar), saved.avatar, 'Movement and decisions preserve appearance');
      await s.p.reload();
      assert.deepEqual(await s.p.evaluate(() => ({ avatar: state.profile.avatar, looks: state.profile.avatarLooks })), saved);
      await s.p.evaluate(() => Wardrobe.open());
      await s.p.locator('[data-wardrobe-tab="extras"]').click();
      await s.p.locator('[data-wardrobe-look="0"]').click();
      assert.equal(await s.p.evaluate(() => Wardrobe.snapshot().avatar.top), 'jacket');
      await s.p.locator('#wardrobe-cancel').click();
      await noErrors(s); return { newLayers: ['face','eyes','hairStyle','top','bottom','shoes'], look: saved.looks[0].name, choices: saved.avatar };
    } finally { await s.context.close(); }
  });


  await report.test('room', 'Room move, rotate, undo, cancel and saved use points remain functional', async () => {
    const s = await session(browser, { viewport: { width: 375, height: 667 } });
    try {
      const original = await s.p.evaluate(() => structuredClone(run().homeLayout));
      await s.p.evaluate(() => RoomEditor.open());
      const initial = await s.p.evaluate(() => RoomEditor.snapshot().draft);
      await s.p.locator('[data-house-item="home-desk"]').click();
      await s.p.locator('[data-house-action="rotate"]').click();
      assert.equal(await s.p.evaluate(() => RoomEditor.snapshot().draft.placements.find(p => p.instanceId === 'home-desk').rotation), 1);
      await s.p.locator('[data-house-action="undo"]').click();
      assert.deepEqual(await s.p.evaluate(() => RoomEditor.snapshot().draft), initial);
      await s.p.locator('[data-house-item="home-bed"]').click();
      await s.p.locator('[data-house-cell="6,1"]').click();
      assert.equal(await s.p.locator('[data-house-action="save"]').isDisabled(), true, 'Overlap is explained and cannot be saved');
      assert.match(await s.p.locator('#houseValidation').innerText(), /mueble|espacio/i);
      assert.deepEqual(await s.p.evaluate(() => run().homeLayout), original);
      await s.p.locator('[data-house-action="cancel"]').click();
      assert.deepEqual(await s.p.evaluate(() => run().homeLayout), original);
      await s.p.evaluate(() => RoomEditor.open());
      await s.p.locator('[data-house-item="home-desk"]').click();
      await s.p.locator('[data-house-action="rotate"]').click();
      const destination = await s.p.evaluate(() => {
        const snap = RoomEditor.snapshot(), base = HabitaScenes.getBase('home', world.state());
        for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) {
          if (x === 6 && y === 1) continue;
          const layout = structuredClone(snap.draft), desk = layout.placements.find(p => p.instanceId === 'home-desk'); desk.x=x; desk.y=y;
          if (HabitaHomeLayout.validateLayout(base, layout, world.state(), { actors: [world.player, world.cat] }).ok) return { x, y };
        }
        return null;
      });
      assert.ok(destination, 'A valid alternative desk placement is available');
      await s.p.locator('#houseX').fill(String(destination.x + 1));
      await s.p.locator('#houseY').fill(String(destination.y + 1));
      await s.p.locator('[data-house-action="move"]').click();
      assert.equal(await s.p.locator('[data-house-action="save"]').isEnabled(), true);
      await shot(s.p, 'room-editor-valid-phone');
      await s.p.locator('[data-house-action="save"]').click();
      const saved = await s.p.evaluate(() => ({ layout: run().homeLayout, desk: world.getInteractions().find(o => o.id === 'home-desk') }));
      const placed = saved.layout.placements.find(p => p.instanceId === 'home-desk');
      assert.equal(placed.rotation, 1); assert.equal(placed.x, destination.x); assert.equal(placed.y, destination.y);
      assert.equal(saved.desk.w, 1); assert.equal(saved.desk.d, 2, 'Rotation changes actual collision geometry');
      await s.p.reload();
      assert.deepEqual(await s.p.evaluate(() => run().homeLayout), saved.layout);
      const interaction = await s.p.evaluate(() => {
        window.qaRoomInteractions = [];
        world.on('interaction', e => window.qaRoomInteractions.push({ id: e.object.id, distance: Math.min(...e.object.usePoints.map(p => Math.hypot(p.x-world.player.x,p.y-world.player.y))) }));
        const desk=world.getInteractions().find(o=>o.id==='home-desk'); world.interact(desk); return desk;
      });
      await advance(s.p, 22000);
      const events = await s.p.evaluate(() => qaRoomInteractions);
      assert.ok(events.some(e => e.id === interaction.id && e.distance <= .46), JSON.stringify(events));
      assert.equal(await s.p.evaluate(() => run().records.length), 0);
      await noErrors(s); return { destination, rotation: 1, savedRevision: saved.layout.revision, interactions: events };
    } finally { await s.context.close(); }
  });


  await report.test('market', 'A brainrot costume previews, buys once, equips and survives reload', async () => {
    const s = await session(browser, { viewport: { width: 390, height: 844 } });
    try {
      const before = await s.p.evaluate(() => ({ avatar: structuredClone(state.profile.avatar), economy: structuredClone(run().economy) }));
      await s.p.locator('#walletBtn').click();
      await s.p.locator('[data-action="preview"][data-item="costume-shark"]').click();
      await s.p.locator('#marketAvatarPreview').waitFor();
      assert.deepEqual(await s.p.evaluate(() => state.profile.avatar), before.avatar);
      assert.equal(await s.p.evaluate(() => run().economy.balance), before.economy.balance);
      await shot(s.p, 'market-costume-preview-phone');
      await s.p.locator('[data-action="back"]').click();
      assert.equal(await s.p.evaluate(() => HabitaEconomy.owns('costume-shark')), false);
      await s.p.locator('[data-action="preview"][data-item="costume-shark"]').click();
      await s.p.locator('[data-action="buy"][data-item="costume-shark"]').dblclick();
      const purchased = await s.p.evaluate(() => ({ economy: run().economy, avatar: state.profile.avatar, price: HabitaCatalog.get('costume-shark').price }));
      assert.equal(purchased.economy.balance, before.economy.balance - purchased.price);
      assert.equal(purchased.economy.owned.filter(id => id === 'costume-shark').length, 1);
      assert.equal(purchased.economy.ledger.filter(e => e.kind === 'purchase' && e.itemId === 'costume-shark').length, 1);
      assert.deepEqual(purchased.avatar, before.avatar, 'Buying does not automatically change clothing');
      const duplicate = await s.p.evaluate(() => HabitaEconomy.buy('costume-shark'));
      assert.equal(duplicate.reason, 'owned');
      assert.equal(await s.p.evaluate(() => run().economy.balance), purchased.economy.balance);
      await s.p.locator('[data-action="equip"][data-item="costume-shark"]').click();
      assert.equal(await s.p.evaluate(() => state.profile.avatar.costume), 'costume-shark');
      await s.p.evaluate(() => Wardrobe.open());
      for (const pose of ['walk','wave','read','sit']) {
        await s.p.locator('#wardrobe-animation').selectOption(pose);
        await advance(s.p, 250);
        assert.equal(await s.p.evaluate(() => Wardrobe.snapshot().avatar.costume), 'costume-shark');
      }
      await shot(s.p, 'wardrobe-purchased-costume-phone');
      await s.p.locator('#wardrobe-cancel').click();
      for (const id of ['home','coast','plaza']) {
        await s.p.evaluate(scene => visitScene(scene), id); await advance(s.p, 1200); await shot(s.p, `costume-${id}-phone`);
      }
      const beforeReload = await s.p.evaluate(() => structuredClone(run().economy));
      await s.p.evaluate(() => { visitScene('coast'); visitScene('coast'); });
      assert.equal(await s.p.evaluate(() => run().economy.balance), beforeReload.balance, 'Revisiting a discovered scene does not mint more coins');
      await s.p.reload();
      const restored = await s.p.evaluate(() => ({ costume: state.profile.avatar.costume, economy: run().economy, records: run().records }));
      assert.equal(restored.costume, 'costume-shark');
      assert.equal(restored.economy.balance, beforeReload.balance, 'Reload preserves purchases and discovery rewards');
      assert.ok(restored.economy.ledger.filter(e => e.kind === 'discovery').length >= 2);
      assert.ok(restored.economy.owned.includes('costume-shark'));
      assert.equal(restored.records.length, 0);
      await noErrors(s); return { price: purchased.price, onePurchase: true, owned: true, costume: restored.costume, scenes: ['home','coast','plaza'] };
    } finally { await s.context.close(); }
  });

  await report.test('market', 'Insufficient funds, rewards and inventory remain isolated between real and demo', async () => {
    const s = await session(browser);
    try {
      await s.p.evaluate(() => Market.open());
      for (const id of ['costume-shark','furniture-easel']) {
        await s.p.locator(`[data-action="preview"][data-item="${id}"]`).click();
        await s.p.locator(`[data-action="buy"][data-item="${id}"]`).click();
        await s.p.locator('[data-action="back"]').click();
      }
      const before = await s.p.evaluate(() => ({ economy: structuredClone(run().economy), records: run().records.length }));
      await s.p.locator('[data-action="preview"][data-item="costume-croc-plane"]').click();
      assert.equal(await s.p.locator('[data-action="buy"]').isDisabled(), true);
      const failed = await s.p.evaluate(() => HabitaEconomy.buy('costume-croc-plane'));
      assert.equal(failed.reason, 'insufficient');
      assert.deepEqual(await s.p.evaluate(() => run().economy), before.economy);
      await s.p.evaluate(() => { closeModal(); switchMode(); });
      const demo = await s.p.evaluate(() => ({ economy: run().economy, records: run().records, equip: HabitaEconomy.equip('costume-shark') }));
      assert.equal(demo.equip.reason, 'unowned');
      assert.equal(demo.economy.owned.includes('costume-shark'), false);
      assert.equal(demo.economy.owned.includes('furniture-easel'), false);
      assert.equal(demo.records.length, 0);
      await s.p.evaluate(() => switchMode());
      assert.deepEqual(await s.p.evaluate(() => run().economy), before.economy);
      assert.equal(await s.p.evaluate(() => run().records.length), before.records);
      await noErrors(s); return { insufficient: failed.reason, realBalance: before.economy.balance, demoInventorySeparate: true };
    } finally { await s.context.close(); }
  });

  await report.test('furniture', 'A purchased easel is placed, used after arrival and remains after reload', async () => {
    const s = await session(browser, { viewport: { width: 390, height: 844 } });
    try {
      await s.p.evaluate(() => Market.open('furniture'));
      await s.p.locator('[data-action="preview"][data-item="furniture-easel"]').click();
      await s.p.locator('[data-action="buy"][data-item="furniture-easel"]').click();
      await s.p.locator('[data-action="place"]').click();
      await s.p.locator('[data-house-item="owned-furniture-easel"]').click();
      const destination = await s.p.evaluate(() => {
        const snap = RoomEditor.snapshot(), base = HabitaScenes.getBase('home', world.state());
        for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) {
          const layout = structuredClone(snap.draft); layout.placements.push({ instanceId: 'owned-furniture-easel', itemId: 'furniture-easel', x, y, rotation: 0 });
          if (HabitaHomeLayout.validateLayout(base, layout, world.state(), { actors: [world.player,world.cat] }).ok) return {x,y};
        }
        return null;
      });
      assert.ok(destination);
      await s.p.locator(`[data-house-cell="${destination.x},${destination.y}"]`).click();
      await s.p.locator('[data-house-action="save"]').click();
      const saved = await s.p.evaluate(() => ({ layout: run().homeLayout, economy: run().economy, candidate: world.getTaskCandidates().find(t => t.objectId === 'owned-furniture-easel') }));
      assert.ok(saved.candidate);
      assert.equal(saved.candidate.animation, 'draw');
      await s.p.reload();
      assert.deepEqual(await s.p.evaluate(() => run().homeLayout), saved.layout);
      assert.deepEqual(await s.p.evaluate(() => run().economy), saved.economy);
      await s.p.evaluate(() => {
        window.qaEaselInteractions = [];
        world.on('interaction', e => qaEaselInteractions.push({id:e.object.id,distance:Math.min(...e.object.usePoints.map(q=>Math.hypot(q.x-world.player.x,q.y-world.player.y)))}));
        world.interact(world.getInteractions().find(o=>o.id==='owned-furniture-easel'));
      });
      await advance(s.p, 26000);
      const observed = await s.p.evaluate(() => ({ events: qaEaselInteractions, companion: Companion.snapshot(), records: run().records }));
      assert.ok(observed.events.some(e=>e.id==='owned-furniture-easel'&&e.distance<=.46), JSON.stringify(observed));
      assert.ok(observed.companion.completed>=1, 'The new object enables a completed fictional action');
      assert.equal(observed.records.length,0);
      await shot(s.p,'purchased-easel-home-phone');
      await noErrors(s); return {destination,action:saved.candidate.id,arrived:observed.events,completed:observed.companion.completed};
    } finally { await s.context.close(); }
  });


  await report.test('neighbors', 'Neighbors initiate encounters, use objects after arrival and retain memories', async () => {
    const s = await session(browser);
    try {
      await s.p.evaluate(() => visitScene('coast'));
      const observations = [], invalid = [];
      for (let i=0;i<30;i++) {
        await advance(s.p,3000);
        const sample=await s.p.evaluate(()=>{
          const life=HabitaLife.snapshot();
          return {life,records:run().records.length,npcs:world.npcs.map(n=>({id:n.id,x:n.x,y:n.y,walkable:world.canStand(n.x,n.y),task:n.activeTask})),locks:world.reservationSnapshot()};
        });
        observations.push({encounter:sample.life.encounter?.phase,npcEncounter:sample.life.npcEncounter?.phase,plans:sample.life.npcPlans.length});
        for(const n of sample.npcs)if(!n.walkable)invalid.push({second:(i+1)*3,actor:n.id,kind:'blocked-cell'});
        for(const plan of sample.life.npcPlans)if(plan.phase==='doing'){
          const n=sample.npcs.find(n=>n.id===plan.id);
          if(Math.hypot(n.x-plan.target.x,n.y-plan.target.y)>.46)invalid.push({second:(i+1)*3,actor:n.id,kind:'distant-use'});
        }
        assert.equal(sample.records,0);
      }
      const remembered=await s.p.evaluate(()=>HabitaLife.snapshot());
      assert.deepEqual(invalid,[]);
      assert.ok(remembered.memories.some(m=>m.kind==='neighbour-encounter'),'Two neighbors meet without instructions');
      assert.ok(remembered.memories.some(m=>m.kind==='encounter'),'A neighbor initiates a meeting with the avatar');
      assert.ok(Object.values(remembered.neighbours).filter(n=>n.meetings>0&&Object.keys(n.known).length>0).length>=2);
      const relationId=Object.keys(remembered.relationships)[0];
      assert.ok(relationId);
      assert.ok(remembered.relationships[relationId].encounters>=1);
      await s.p.evaluate(id=>HabitaLife.inspectActor(id),relationId);
      assert.match(await s.p.locator('#modal').innerText(),/recuerda|hablaron/i);
      await shot(s.p,'remembered-neighbor');
      await s.p.reload();
      const after=await s.p.evaluate(()=>HabitaLife.snapshot());
      assert.deepEqual(after.relationships,remembered.relationships);
      for(const [id,n]of Object.entries(remembered.neighbours))assert.deepEqual(after.neighbours[id].known,n.known);
      await noErrors(s);return {relations:Object.keys(after.relationships),npcMemories:remembered.memories.filter(m=>/encounter/.test(m.kind)).length,observedPhases:observations};
    }finally{await s.context.close();}
  });

  await report.test('journey', 'One complete user journey evolves from identity and care to a furnished home and remembered next day', async () => {
    const s=await session(browser,{viewport:{width:390,height:844},reducedMotion:'reduce'});
    let saved,checkpoint;
    try{
      await s.p.evaluate(()=>openSettings());
      await s.p.locator('#name').fill('Camila');
      await s.p.locator('#avatar-face').selectOption('round');
      await s.p.locator('[data-wardrobe-tab="hair"]').click();
      await s.p.locator('#avatar-hairStyle').selectOption('bun');
      await s.p.locator('#wardrobe-save').click();
      await s.p.locator('#homeAction').click();
      await s.p.getByRole('button',{name:/^Empezar ·/}).click();
      const action=await s.p.evaluate(()=>run().active.action);
      await s.p.getByRole('button',{name:'Ya lo hice',exact:true}).click();
      await advance(s.p,25000);
      const response=await s.p.evaluate(()=>({records:run().records,life:HabitaLife.snapshot(),companion:Companion.snapshot()}));
      assert.equal(response.records.length,1);assert.equal(response.records[0].action,action);
      assert.ok(response.life.careEchoes.some(e=>e.action===action));assert.ok(response.companion.completed>=1);
      await s.p.locator('#walletBtn').click();
      await s.p.locator('[data-action="preview"][data-item="furniture-easel"]').click();
      await s.p.locator('[data-action="buy"]').click();
      await s.p.locator('[data-action="place"]').click();
      await s.p.locator('[data-house-item="owned-furniture-easel"]').click();
      const destination=await s.p.evaluate(()=>{
        const layout=RoomEditor.snapshot().draft,base=HabitaScenes.getBase('home',world.state());
        for(let y=0;y<base.height;y++)for(let x=0;x<base.width;x++){
          const draft=structuredClone(layout);draft.placements.push({instanceId:'owned-furniture-easel',itemId:'furniture-easel',x,y,rotation:0});
          if(HabitaHomeLayout.validateLayout(base,draft,world.state(),{actors:[world.player,world.cat]}).ok)return{x,y};
        }return null;
      });
      assert.ok(destination);
      await s.p.locator(`[data-house-cell="${destination.x},${destination.y}"]`).click();
      await s.p.locator('[data-house-action="save"]').click();
      await s.p.evaluate(()=>{
        window.qaJourneyUse=[];world.on('interaction',e=>qaJourneyUse.push(e.object.id));
        world.interact(world.getInteractions().find(o=>o.id==='owned-furniture-easel'));
      });
      await advance(s.p,25000);
      assert.ok((await s.p.evaluate(()=>qaJourneyUse)).includes('owned-furniture-easel'));
      await s.p.locator('[data-scene="coast"]').click();
      await advance(s.p,90000);
      checkpoint=await s.p.evaluate(()=>({profile:structuredClone(state.profile),life:HabitaLife.snapshot(),economy:structuredClone(run().economy),layout:structuredClone(run().homeLayout),records:structuredClone(run().records),date:HabitaTest.clock().date}));
      assert.ok(checkpoint.life.memories.some(m=>m.kind==='encounter'));
      assert.equal(checkpoint.records.length,1);
      await shot(s.p,'journey-coast-phone');
      saved=await s.p.evaluate(()=>JSON.parse(localStorage.getItem('habita-pilot-v2')));
      await noErrors(s);
    }finally{await s.context.close();}
    const tomorrow=await session(browser,{save:saved,viewport:{width:390,height:844},time:new Date(START.getTime()+86400000)});
    try{
      const after=await tomorrow.p.evaluate(()=>({profile:state.profile,life:HabitaLife.snapshot(),economy:run().economy,layout:run().homeLayout,records:run().records,date:HabitaTest.clock().date}));
      assert.equal(after.profile.name,'Camila');assert.equal(after.profile.avatar.hairStyle,'bun');
      assert.deepEqual(after.records,checkpoint.records);assert.deepEqual(after.layout,checkpoint.layout);
      assert.deepEqual(after.economy.owned,checkpoint.economy.owned);assert.equal(after.economy.balance,checkpoint.economy.balance);
      assert.deepEqual(after.life.relationships,checkpoint.life.relationships);assert.notEqual(after.date,checkpoint.date);
      assert.match(after.life.returnSummary,/reconstru/i);
      await tomorrow.p.locator('#lifeTeaser').click();
      await tomorrow.p.locator('[data-return-summary]').waitFor();
      await shot(tomorrow.p,'journey-next-day-phone');
      await noErrors(tomorrow);return{person:'Camila',action:checkpoint.records[0].action,owned:'furniture-easel',realRecords:after.records.length,neighbors:Object.keys(after.life.relationships),dates:[checkpoint.date,after.date],returnSummary:true};
    }finally{await tomorrow.context.close();}
  });


  await browser.close();
  report.finish();
})().catch(async e => { console.error(e); await browser?.close(); process.exitCode = 1; });
