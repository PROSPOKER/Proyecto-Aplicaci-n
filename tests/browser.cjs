/* Browser acceptance tests. Run against a static server; no app/build dependencies. */
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const URL = process.env.HABITA_TEST_URL || 'http://127.0.0.1:8765';
const ARTIFACTS = process.env.HABITA_TEST_ARTIFACTS || '/tmp/habita-qa';
const FILTER = process.env.HABITA_TEST_GROUP || '';
const NAME_FILTER = process.env.HABITA_TEST_NAME || '';
const START = new Date('2026-10-02T15:00:00Z');
const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/v2-before-refactor.json')));
fs.mkdirSync(ARTIFACTS, { recursive: true });
const results = [];
let browser;

async function session({ save = null, rawSave = null, viewport = { width: 1280, height: 800 }, reducedMotion = 'no-preference', clock = true, freshInstall = false } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion, timezoneId: 'UTC' });
  const initialSave = save || JSON.parse(JSON.stringify(legacy));
  if (!save) {
    initialSave.profile.name = 'Alex'; initialSave.profile.photo = null;
    for (const mode of ['real', 'demo']) {
      const r = initialSave[mode];
      for (const field of ['records', 'choices', 'events', 'future', 'memories', 'seen']) r[field] = [];
      r.active = null; r.day = 0; r.barriers = {}; r.reminders = {}; r.reminderAcks = {};
      Object.keys(r.flags).forEach(k => { r.flags[k] = false; });
    }
  }
  if (!freshInstall) await context.addInitScript(({ data, raw }) => {
    if (!localStorage.getItem('habita-pilot-v2')) localStorage.setItem('habita-pilot-v2', raw === null ? JSON.stringify(data) : raw);
  }, { data: initialSave, raw: rawSave });
  await context.addInitScript(() => {
    let seed = 192837;
    Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  if (clock) {
    await p.clock.install({ time: START });
    await p.clock.pauseAt(START);
  }
  await p.goto(URL, { waitUntil: 'load' });
  assert.ok(await p.evaluate(() => typeof world !== 'undefined' && !!world), `World boot failed: ${errors.join('; ')}`);
  if (!save && !freshInstall && rawSave === null) await p.evaluate(() => {
    state.onboard = true;
    state.profile.care.configured = true;
    state.profile.care.slots.forEach(slot => { slot.enabled = false; });
    run().active = null;
    pendingCareNotice = null;
    closeModal();
    save();
    navigate('world');
  });
  return { p, context, errors };
}

async function advance(p, ms) { await p.clock.runFor(ms); }
async function snapshot(p) { return p.evaluate(() => Companion.snapshot()); }
async function checkErrors(s) { assert.deepEqual(s.errors, [], 'No uncaught JavaScript errors'); }
function luminance(rgb) {
  return rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}
function contrast(foreground, background) {
  const f = luminance(foreground.match(/[\d.]+/g).slice(0, 3).map(Number));
  const b = luminance(background.match(/[\d.]+/g).slice(0, 3).map(Number));
  return (Math.max(f, b) + .05) / (Math.min(f, b) + .05);
}
async function test(group, name, fn) {
  if (FILTER && !FILTER.split(',').includes(group)) return;
  if (NAME_FILTER && !new RegExp(NAME_FILTER, 'i').test(name)) return;
  const start = Date.now();
  try { const detail = await fn(); results.push({ group, name, passed: true, milliseconds: Date.now() - start, detail }); console.log(`PASS ${group}: ${name}`); }
  catch (e) { results.push({ group, name, passed: false, milliseconds: Date.now() - start, error: e.stack }); console.error(`FAIL ${group}: ${name}\n${e.stack}`); }
}

async function observeScene(sceneId, reducedMotion = 'no-preference') {
  const s = await session({ reducedMotion });
  try {
    await s.p.evaluate(id => visitScene(id), sceneId);
    const before = await snapshot(s.p);
    const positions = [];
    const invalid = [];
    const phases = new Set();
    for (let i = 0; i < 90; i++) {
      await advance(s.p, 1000);
      const sample = await s.p.evaluate(() => {
        const snap = Companion.snapshot();
        const target = snap.target || snap.task?.target;
        return { snap, player: { x: world.player.x, y: world.player.y }, walkable: world.walkable(world.player.x, world.player.y), distance: target ? Math.hypot(world.player.x - target.x, world.player.y - target.y) : null, records: run().records.length };
      });
      phases.add(sample.snap.phase);
      positions.push(sample.player);
      if (!sample.walkable || (sample.snap.phase === 'doing' && sample.distance > .46) || sample.records !== 0) invalid.push({ second: i + 1, ...sample });
    }
    const after = await snapshot(s.p);
    assert.ok(after.completed - before.completed >= 2, `90s must complete multiple tasks: ${JSON.stringify({ before, after })}`);
    assert.ok(after.serial - before.serial >= 2, 'Multiple independent choices');
    assert.equal(invalid.length, 0, JSON.stringify(invalid));
    assert.ok(positions.some(q => Math.hypot(q.x - positions[0].x, q.y - positions[0].y) > .5), 'Visible displacement');
    await s.p.screenshot({ path: path.join(ARTIFACTS, `${sceneId}-${reducedMotion}.png`) });
    await checkErrors(s);
    return { completed: after.completed - before.completed, choices: after.serial - before.serial, phases: [...phases], history: after.recent };
  } finally { await s.context.close(); }
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });

  await test('stability', 'Scene objects and use points are reachable', async () => {
    const s = await session();
    try {
      const details = await s.p.evaluate(() => ['home', 'coast', 'plaza'].map(id => {
        world.setZone(id);
        const bad = [];
        for (const o of world.getInteractions()) for (const p of o.usePoints || []) if (!world.walkable(p.x, p.y) || world.findPath(Math.floor(world.player.x), Math.floor(world.player.y), Math.floor(p.x), Math.floor(p.y)) === null) bad.push({ object: o.id, point: p });
        return { id, objects: world.getInteractions().length, tasks: world.getTaskCandidates().length, bad, size: { width: world.getScene().width, height: world.getScene().height } };
      }));
      for (const d of details) { assert.ok(d.objects >= 3, `${d.id}: objects`); assert.ok(d.tasks >= 3, `${d.id}: tasks`); assert.deepEqual(d.bad, [], `${d.id}: inaccessible object point`); assert.ok(d.size.width < 20 && d.size.height < 20, `${d.id}: compact scene`); }
      await checkErrors(s); return details;
    } finally { await s.context.close(); }
  });

  for (const scene of ['home', 'coast', 'plaza']) await test('autonomy', `${scene}: 90 seconds without instructions`, () => observeScene(scene));
  await test('accessibility', 'Reduced motion preserves useful autonomy', () => observeScene('home', 'reduce'));

  await test('onboarding', 'New user selects goals, time and schedule before entering home', async () => {
    const s = await session({ freshInstall: true, viewport: { width: 390, height: 844 } });
    try {
      await advance(s.p, 1000);
      assert.equal(await s.p.locator('#modal').evaluate(el => el.open), true);
      await s.p.locator('#welcomeName').fill('Mi personaje');
      await s.p.getByRole('button', { name: 'Configurar mi plan', exact: true }).click({ force: true });
      await s.p.locator('#careGoals [data-goal="focus"]').click({ force: true });
      await s.p.locator('#careMinutes').selectOption('5');
      await s.p.locator('#slotTime0').fill('10:00');
      await s.p.getByRole('button', { name: 'Comenzar mi plan', exact: true }).click({ force: true });
      const saved = await s.p.evaluate(() => ({ onboard: state.onboard, profile: state.profile, scene: world.getZone(), modal: $('#modal').open }));
      assert.equal(saved.onboard, true); assert.equal(saved.profile.name, 'Mi personaje');
      assert.deepEqual(saved.profile.care.goals, ['sleep', 'focus']); assert.equal(saved.profile.minutes, 5);
      assert.equal(saved.profile.care.slots[0].time, '10:00'); assert.equal(saved.scene, 'home'); assert.equal(saved.modal, false);
      await s.p.reload(); await advance(s.p, 1500);
      assert.equal(await s.p.locator('#modal').evaluate(el => el.open), false, 'No onboarding again after saved setup');
      await checkErrors(s); return { goals: saved.profile.care.goals, name: saved.profile.name, scene: saved.scene };
    } finally { await s.context.close(); }
  });

  await test('stability', 'Empty path cannot become a remote interaction', async () => {
    const s = await session();
    try {
      await s.p.evaluate(() => { Companion.reset(); Companion.next(); });
      const before = await snapshot(s.p);
      const initialDistance = await s.p.evaluate(() => Math.hypot(world.player.x - Companion.target.x, world.player.y - Companion.target.y));
      assert.equal(before.phase, 'travel', 'Inject an empty path during an actual trip');
      assert.ok(initialDistance > .46, 'Regression scenario must begin away from the object');
      await s.p.evaluate(() => { world.path = []; });
      await advance(s.p, 250);
      const result = await s.p.evaluate(() => {
        const snap = Companion.snapshot(), target = snap.target || snap.task?.target;
        return { snap, distance: target ? Math.hypot(world.player.x - target.x, world.player.y - target.y) : null };
      });
      assert.ok(result.snap.phase !== 'doing' || result.distance <= .46, JSON.stringify({ before, result }));
      await advance(s.p, 90000);
      const after = await snapshot(s.p);
      assert.ok(after.completed > before.completed, 'Recover from invalidated path and finish useful work');
      await checkErrors(s); return { initial: before.phase, invalidation: result.snap.phase, recovered: after.completed - before.completed };
    } finally { await s.context.close(); }
  });

  await test('stability', 'Temporary navigation blockage recovers with bounded retries', async () => {
    const s = await session();
    try {
      await s.p.evaluate(() => {
        window.qaOriginalMove = world.move;
        world.move = () => { world.moving = false; };
        Companion.reset(); Companion.idle = 0;
        const candidate = world.getTaskCandidates().find(t => t.usePoints.every(p => Math.hypot(p.x - world.player.x, p.y - world.player.y) > .6));
        if (!candidate) throw Error('No remote task to exercise a blockage');
        const task = { ...candidate, key: candidate.sceneId + '/' + candidate.objectId + '/' + candidate.id, duration: 10, serial: ++Companion.serial };
        Companion.startTask(task);
      });
      await advance(s.p, 10000);
      const blocked = await snapshot(s.p);
      assert.notEqual(blocked.phase, 'doing', 'Cannot start a remote task while movement is blocked');
      assert.ok(blocked.retries > 0 || blocked.failures > 0 || blocked.serial > 1, `Needs replan/retry: ${JSON.stringify(blocked)}`);
      await s.p.evaluate(() => { world.move = window.qaOriginalMove; delete window.qaOriginalMove; });
      await advance(s.p, 90000);
      const recovered = await snapshot(s.p);
      assert.ok(recovered.completed >= 2, JSON.stringify(recovered));
      await checkErrors(s); return { blocked, recovered };
    } finally { await s.context.close(); }
  });

  await test('interactions', 'Manual keyboard movement wins, then autonomy resumes', async () => {
    const s = await session();
    try {
      await advance(s.p, 3000);
      await s.p.locator('#world').focus();
      const before = await s.p.evaluate(() => ({ x: world.player.x, y: world.player.y }));
      await s.p.keyboard.down('ArrowDown'); await advance(s.p, 700); await s.p.keyboard.up('ArrowDown');
      const manual = await s.p.evaluate(() => ({ player: { x: world.player.x, y: world.player.y }, snap: Companion.snapshot(), keys: [...world.keys] }));
      assert.ok(Math.hypot(manual.player.x - before.x, manual.player.y - before.y) > .1, JSON.stringify(manual));
      assert.ok(manual.snap.manualCooldown > 0, 'Manual takeover remains active');
      assert.deepEqual(manual.keys, []);
      await advance(s.p, 90000);
      const after = await snapshot(s.p);
      assert.ok(after.completed >= 2, 'Autonomy resumes after manual input');
      await checkErrors(s); return { manual, after };
    } finally { await s.context.close(); }
  });

  await test('interactions', 'Object interaction waits for arrival and creates no real activity', async () => {
    const s = await session();
    try {
      const target = await s.p.evaluate(() => {
        const object = world.getInteractions().find(o => o.kind === 'task' && o.tasks.length);
        window.qaInteractions = [];
        world.on('interaction', e => window.qaInteractions.push({ id: e.object.id, player: { x: world.player.x, y: world.player.y }, points: e.object.usePoints }));
        world.travel(object.id);
        return object;
      });
      await advance(s.p, 12000);
      const outcome = await s.p.evaluate(() => ({ events: window.qaInteractions, records: run().records.length, snap: Companion.snapshot() }));
      assert.equal(outcome.events.filter(e => e.id === target.id).length, 1, JSON.stringify(outcome));
      const event = outcome.events.find(e => e.id === target.id);
      assert.ok(event.points.some(p => Math.hypot(event.player.x - p.x, event.player.y - p.y) <= .46), JSON.stringify(event));
      assert.equal(outcome.records, 0);
      assert.ok(outcome.snap.task?.objectId === target.id || outcome.snap.completed > 0, 'Object starts a visible fictional task');
      await checkErrors(s); return outcome;
    } finally { await s.context.close(); }
  });

  await test('interactions', 'Portal requires explicit interaction and scene change resets tasks', async () => {
    const s = await session();
    try {
      const portal = await s.p.evaluate(() => {
        const p = world.getInteractions().find(o => o.kind === 'portal');
        world.player.x = p.usePoints?.[0]?.x ?? p.x;
        world.player.y = p.usePoints?.[0]?.y ?? p.y;
        return p;
      });
      await advance(s.p, 300);
      assert.equal(await s.p.evaluate(() => world.getZone()), 'home', 'Proximity alone never travels');
      await s.p.evaluate(id => world.travel(id), portal.id);
      await advance(s.p, 1500);
      const result = await s.p.evaluate(() => ({ zone: world.getZone(), snap: Companion.snapshot() }));
      assert.equal(result.zone, portal.to);
      assert.equal(result.snap.sceneId, portal.to);
      assert.ok(!result.snap.task || result.snap.task.key.startsWith(portal.to + '/'));
      await advance(s.p, 90000);
      assert.ok((await snapshot(s.p)).completed >= 2);
      await checkErrors(s); return result;
    } finally { await s.context.close(); }
  });

  await test('interactions', 'Modal pause freezes task and resumes after closing', async () => {
    const s = await session();
    try {
      await advance(s.p, 8000);
      await s.p.evaluate(() => openCompanionAbout());
      const before = await s.p.evaluate(() => ({ snap: Companion.snapshot(), player: { x: world.player.x, y: world.player.y } }));
      await advance(s.p, 20000);
      const paused = await s.p.evaluate(() => ({ snap: Companion.snapshot(), player: { x: world.player.x, y: world.player.y } }));
      assert.deepEqual(paused.player, before.player, 'Paused world must not move');
      assert.equal(paused.snap.completed, before.snap.completed);
      assert.equal(paused.snap.remaining, before.snap.remaining);
      await s.p.getByRole('button', { name: 'Cerrar', exact: true }).click({ force: true });
      await advance(s.p, 90000);
      assert.ok((await snapshot(s.p)).completed > before.snap.completed);
      await checkErrors(s); return { pausedPhase: paused.snap.phase, completedBefore: before.snap.completed };
    } finally { await s.context.close(); }
  });

  await test('interactions', 'Decision/profile panels stop keyboard movement and resume on return', async () => {
    const s = await session();
    try {
      await advance(s.p, 5000);
      for (const panel of ['decisions', 'me']) {
        await s.p.evaluate(id => navigate(id), panel);
        const before = await s.p.evaluate(() => ({ x: world.player.x, y: world.player.y, completed: Companion.snapshot().completed, paused: world.paused }));
        assert.equal(before.paused, true);
        await s.p.keyboard.down('ArrowDown'); await advance(s.p, 1500); await s.p.keyboard.up('ArrowDown');
        const after = await s.p.evaluate(() => ({ x: world.player.x, y: world.player.y, completed: Companion.snapshot().completed }));
        assert.deepEqual(after, { x: before.x, y: before.y, completed: before.completed }, `${panel}: paused simulation`);
        await s.p.evaluate(() => navigate('world'));
        assert.equal(await s.p.evaluate(() => world.paused), false);
      }
      await advance(s.p, 90000);
      assert.ok((await snapshot(s.p)).completed >= 2);
      await checkErrors(s); return { pausedPanels: ['decisions', 'me'], resumed: true };
    } finally { await s.context.close(); }
  });

  await test('interactions', 'Actual canvas pointer click selects furniture and reaches it once', async () => {
    const s = await session();
    try {
      await advance(s.p, 200);
      const target = await s.p.evaluate(() => {
        window.qaPointerInteractions = [];
        world.on('interaction', e => window.qaPointerInteractions.push({ id: e.object.id, player: { x: world.player.x, y: world.player.y }, points: e.object.usePoints }));
        for (const object of world.getInteractions().filter(o => o.kind === 'task')) {
          const center = world.project(object.x + (object.w || .6) / 2, object.y + (object.d || .6) / 2, 18);
          const x = (center.x - world.camera.x) * world.zoomLevel + world.w / 2;
          const y = (center.y - world.camera.y) * world.zoomLevel + world.anchorY();
          const hit = document.elementFromPoint(x, y);
          const chosen = world.hitInteraction({ x, y }, world.unproject(x, y));
          const avatar = world.project(world.player.x, world.player.y, 23);
          const ax = (avatar.x - world.camera.x) * world.zoomLevel + world.w / 2;
          const ay = (avatar.y - world.camera.y) * world.zoomLevel + world.anchorY();
          if (hit === world.canvas && chosen?.id === object.id && Math.hypot(x - ax, y - ay) > 22) return { id: object.id, x, y };
        }
        return null;
      });
      assert.ok(target, 'At least one visible interactive object can be clicked');
      await s.p.mouse.click(target.x, target.y);
      await advance(s.p, 12000);
      const events = await s.p.evaluate(() => window.qaPointerInteractions);
      assert.equal(events.filter(e => e.id === target.id).length, 1, JSON.stringify(events));
      const arrived = events.find(e => e.id === target.id);
      assert.ok(arrived.points.some(q => Math.hypot(q.x - arrived.player.x, q.y - arrived.player.y) <= .46));
      assert.equal(await s.p.evaluate(() => run().records.length), 0);
      await checkErrors(s); return { target, events };
    } finally { await s.context.close(); }
  });

  await test('data', 'Pre-refactor v2 save, photograph and active deadline survive reload', async () => {
    const s = await session({ save: legacy });
    try {
      const loaded = await s.p.evaluate(() => ({ profile: state.profile, real: state.real, demo: state.demo, loadIssue, timer: $('#careTimerValue').textContent }));
      assert.equal(loaded.loadIssue, false);
      assert.equal(loaded.profile.photo, legacy.profile.photo);
      assert.equal(loaded.profile.name, legacy.profile.name);
      assert.deepEqual(loaded.real.records, legacy.real.records);
      assert.deepEqual(loaded.demo.records, legacy.demo.records);
      assert.equal(loaded.real.active.timerEnd, legacy.real.active.timerEnd);
      await s.p.evaluate(() => openRoom());
      assert.equal(await s.p.locator('#modal img').evaluate(async img => { await img.decode(); return img.naturalWidth; }), 1, 'Historical photograph remains decodable');
      await s.p.evaluate(() => closeModal());
      await s.p.clock.fastForward(60000);
      await s.p.reload({ waitUntil: 'load' });
      const after = await s.p.evaluate(() => ({ active: run().active, records: state.real.records, photo: state.profile.photo, timer: $('#careTimerValue').textContent }));
      assert.equal(after.active.timerEnd, legacy.real.active.timerEnd);
      assert.equal(after.photo, legacy.profile.photo);
      assert.deepEqual(after.records, legacy.real.records);
      assert.equal(after.timer, '2:00');
      await checkErrors(s); return { timerBefore: loaded.timer, timerAfter: after.timer, realRecords: after.records.length };
    } finally { await s.context.close(); }
  });

  await test('activities', 'Reminder → start → optional timer → one-tap done without duplicates', async () => {
    const s = await session();
    try {
      await s.p.evaluate(() => showActivityNotice({ name: 'Mañana', time: '12:00', index: 0 }));
      await s.p.locator('.noticeMain').click({ force: true });
      await s.p.getByRole('button', { name: /^Empezar ·/ }).click({ force: true });
      const active = await s.p.evaluate(() => ({ active: run().active, records: run().records.length, acks: run().reminderAcks }));
      assert.ok(active.active.timerEnd > START.getTime()); assert.equal(active.records, 0);
      // Expiration checks the durable deadline, not hundreds of redundant frames.
      await s.p.clock.fastForward(active.active.duration * 60000 + 1500);
      const expired = await s.p.evaluate(() => ({ active: run().active, records: run().records.length, timer: $('#careTimerValue').textContent }));
      assert.ok(expired.active, 'Timer expiration must not complete a real activity'); assert.equal(expired.records, 0); assert.equal(expired.timer, '0:00');
      await s.p.getByRole('button', { name: 'Ya lo hice', exact: true }).click({ force: true });
      await s.p.evaluate(() => { finishAction(); finishAction(); });
      const done = await s.p.evaluate(action => ({ active: run().active, real: state.real.records, demo: state.demo.records, reward: $('#careReward').textContent, task: Companion.snapshot().task, related: world.getTaskCandidates().filter(t => t.actions.includes(action)).map(t => ({ id: t.id, objectId: t.objectId })) }), active.active.action);
      assert.equal(done.active, null); assert.equal(done.real.length, 1); assert.equal(done.demo.length, 0);
      assert.match(done.reward, /registros|registro/i); assert.match(done.reward, /no medidas de salud/i);
      if (done.related.length) assert.ok(done.related.some(t => t.id === done.task?.id && t.objectId === done.task?.objectId), `Reward should start a related visible task: ${JSON.stringify(done)}`);
      await s.p.reload(); assert.equal(await s.p.evaluate(() => state.real.records.length), 1);
      await checkErrors(s); return { action: active.active.action, duration: active.active.duration, expired: expired.timer, recorded: done.real.length };
    } finally { await s.context.close(); }
  });

  await test('activities', 'Exercise confirmation starts a related task and records exactly once', async () => {
    const s = await session();
    try {
      const available = await s.p.evaluate(() => {
        run().active = { id: 'qa-exercise', action: 'exercise', duration: ACTIONS.exercise.min, situation: 'care', title: ACTIONS.exercise.name, day: day(), date: stamp() };
        run().choices.push({ action: 'exercise', situation: 'care', status: 'accepted', day: day() });
        save(); syncHome();
        return world.getTaskCandidates().filter(t => t.actions.includes('exercise')).map(t => ({ id: t.id, objectId: t.objectId }));
      });
      assert.ok(available.length > 0);
      await s.p.getByRole('button', { name: 'Ya lo hice', exact: true }).click({ force: true });
      const first = await snapshot(s.p);
      assert.ok(available.some(t => t.id === first.task?.id && t.objectId === first.task?.objectId), JSON.stringify({ first, available }));
      await s.p.evaluate(() => { finishAction(); finishAction(); });
      await advance(s.p, 35000);
      const result = await s.p.evaluate(() => ({ records: run().records, snapshot: Companion.snapshot(), queue: Companion.queue }));
      assert.equal(result.records.length, 1); assert.equal(result.records[0].action, 'exercise');
      assert.ok(result.snapshot.completed >= 1);
      assert.equal(result.queue.length, 0, 'A single related candidate does not generate a repetitive queue');
      await checkErrors(s); return { firstTask: first.task, records: result.records.length, completed: result.snapshot.completed };
    } finally { await s.context.close(); }
  });

  await test('activities', 'Reward animation becomes visible on the real browser timeline', async () => {
    const s = await session({ clock: false, viewport: { width: 375, height: 667 } });
    try {
      await s.p.locator('#homeAction').click({ force: true });
      await s.p.getByRole('button', { name: /^Empezar ·/ }).click({ force: true });
      await s.p.getByRole('button', { name: 'Ya lo hice', exact: true }).click({ force: true });
      const visual = await s.p.locator('#careReward').evaluate(async el => {
        await Promise.all(el.getAnimations().map(animation => animation.finished));
        const style = getComputedStyle(el);
        return { display: style.display, opacity: Number(style.opacity), text: el.innerText };
      });
      assert.notEqual(visual.display, 'none'); assert.ok(visual.opacity > .9); assert.match(visual.text, /paso registrado/i);
      await s.p.screenshot({ path: path.join(ARTIFACTS, 'reward-real-timeline-375x667.png') });
      await checkErrors(s); return visual;
    } finally { await s.context.close(); }
  });

  await test('layout', 'Compact reward keeps complete text and clears the avatar head at the window', async () => {
    const evidence = [];
    for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
      const s = await session({ viewport });
      try {
        const point = await s.p.evaluate(() => {
          run().active = { id: 'qa-window-reward', action: 'rest', duration: 3, situation: 'care', title: ACTIONS.rest.name, day: day(), date: stamp() };
          finishAction();
          Companion.manualInput();
          const point = world.getInteractions().find(o => o.id === 'home-window').usePoints[0];
          world.navigateTo(point.x, point.y, { source: 'manual' });
          return point;
        });
        await advance(s.p, 3000);
        assert.equal(await s.p.evaluate(p => world.arrived(p, .45), point), true, 'Character reaches the window by walking');
        const measured = await s.p.evaluate(() => {
          world.setActivityAnimation('look', 6);
          world.setTaskVisual({ id: 'window', objectId: 'home-window', animation: 'look', prop: 'spark', phase: 'doing', progress: .5 });
          showCareReward('rest');
          const reward = $('#careReward'), rect = reward.getBoundingClientRect();
          const p = world.project(world.player.x, world.player.y);
          const center = { x: (p.x - world.camera.x) * world.zoomLevel + world.w / 2, y: (p.y - world.camera.y) * world.zoomLevel + world.anchorY() };
          const head = { left: center.x - 14 * world.zoomLevel, right: center.x + 14 * world.zoomLevel, top: center.y - 61 * world.zoomLevel, bottom: center.y - 34 * world.zoomLevel };
          return { reward: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, head, text: reward.innerText, overflow: reward.scrollHeight > reward.clientHeight, zoom: world.zoomLevel };
        });
        assert.equal(measured.overflow, false, 'Every reward line fits');
        assert.match(measured.text, /Un paso que cuenta\./); assert.match(measured.text, /Descanso · \+1 registro/);
        assert.match(measured.text, /1 paso registrado hoy/); assert.match(measured.text, /Registros de actividad, no medidas de salud\./);
        const intersects = measured.reward.left < measured.head.right && measured.reward.right > measured.head.left && measured.reward.top < measured.head.bottom && measured.reward.bottom > measured.head.top;
        assert.equal(intersects, false, `Reward covers avatar head: ${JSON.stringify(measured)}`);
        assert.ok(measured.head.top - measured.reward.bottom >= 8, `Keep breathing room above the head: ${JSON.stringify(measured)}`);
        await s.p.screenshot({ path: path.join(ARTIFACTS, `reward-window-${viewport.width}x${viewport.height}.png`), animations: 'disabled' });
        await checkErrors(s); evidence.push({ viewport, ...measured, clearPixels: measured.head.top - measured.reward.bottom });
      } finally { await s.context.close(); }
    }
    return evidence;
  });

  await test('data', 'Real and demo histories remain isolated', async () => {
    const s = await session({ save: { ...legacy, real: { ...legacy.real, active: null } } });
    try {
      await s.p.evaluate(() => { switchMode(); openActivityNotice(); });
      await s.p.getByRole('button', { name: /^Empezar ·/ }).click({ force: true });
      await s.p.getByRole('button', { name: 'Ya lo hice', exact: true }).click({ force: true });
      const result = await s.p.evaluate(() => ({ mode, real: state.real.records, demo: state.demo.records }));
      assert.equal(result.mode, 'demo'); assert.deepEqual(result.real, legacy.real.records); assert.equal(result.demo.length, legacy.demo.records.length + 1);
      await checkErrors(s); return { real: result.real.length, demo: result.demo.length };
    } finally { await s.context.close(); }
  });

  await test('data', 'Unreadable save stays intact; export original and valid import recover safely', async () => {
    const original = '{"version":2,"profile":{';
    const s = await session({ rawSave: original });
    try {
      await advance(s.p, 1000);
      assert.equal(await s.p.evaluate(() => loadIssue), true);
      assert.match(await s.p.locator('#modal').innerText(), /no se sobrescribirá/i);
      await s.p.evaluate(() => { closeModal(); save(); world.discover('qa-place'); });
      await advance(s.p, 10000);
      assert.equal(await s.p.evaluate(() => localStorage.getItem(KEY)), original);
      const downloading = s.p.waitForEvent('download');
      await s.p.evaluate(() => exportSave());
      const downloaded = await downloading;
      assert.equal(fs.readFileSync(await downloaded.path(), 'utf8'), original, 'Export preserves the exact unreadable original');
      await s.p.locator('#importFile').setInputFiles(path.join(__dirname, 'fixtures/v2-before-refactor.json'));
      await advance(s.p, 500);
      assert.equal(await s.p.evaluate(() => loadIssue), true, 'Selecting a file alone must not replace the original');
      assert.equal(await s.p.evaluate(() => localStorage.getItem(KEY)), original);
      await s.p.getByRole('button', { name: 'Importar esta copia', exact: true }).click({ force: true });
      const result = await s.p.evaluate(() => ({ loadIssue, profile: state.profile.name, records: state.real.records, stored: JSON.parse(localStorage.getItem(KEY)) }));
      assert.equal(result.loadIssue, false); assert.equal(result.profile, legacy.profile.name);
      assert.deepEqual(result.records, legacy.real.records); assert.equal(result.stored.profile.photo, legacy.profile.photo);
      await s.p.reload(); assert.equal(await s.p.evaluate(() => loadIssue), false);
      await checkErrors(s); return { originalExported: true, importConfirmed: true, restoredRecords: result.records.length };
    } finally { await s.context.close(); }
  });

  await test('audio', 'Music is opt-in and mute updates actual AudioContext', async () => {
    const s = await session({ clock: false });
    try {
      assert.equal(await s.p.evaluate(() => QuietSound.on), false);
      assert.equal(await s.p.locator('#soundControl').getAttribute('aria-pressed'), 'false');
      await s.p.locator('#soundControl').click({ force: true });
      assert.equal(await s.p.evaluate(() => QuietSound.on), true);
      assert.equal(await s.p.evaluate(() => QuietSound.ctx.state), 'running');
      await s.p.locator('#soundControl').click({ force: true });
      assert.equal(await s.p.evaluate(() => QuietSound.on), false);
      assert.equal(await s.p.evaluate(() => QuietSound.ctx.state), 'suspended');
      await checkErrors(s); return { enabledThenMuted: true };
    } finally { await s.context.close(); }
  });

  await test('personalization', 'Avatar preview is reversible; saved choices and interests survive reload', async () => {
    const s = await session();
    try {
      const previous = await s.p.evaluate(() => state.profile.avatar);
      const modern = await s.p.evaluate(() => typeof Wardrobe !== 'undefined');
      const setField = async (key, value) => {
        if (modern) { const tab = { hairStyle: 'hair', accessory: 'hair', outfit: 'clothes', silhouette: 'face' }[key]; await s.p.locator(`[data-wardrobe-tab="${tab}"]`).click(); }
        await s.p.locator('#avatar-' + key).selectOption(value);
      };
      await s.p.evaluate(() => openSettings());
      const previousImage = await s.p.locator('#avatarPreview').evaluate(c => c.toDataURL());
      await setField('hairStyle', 'curls');
      await setField('outfit', 'creative');
      await setField('accessory', 'glasses');
      await setField('silhouette', 'broad');
      const previewImage = await s.p.locator('#avatarPreview').evaluate(c => c.toDataURL());
      assert.notEqual(previewImage, previousImage, 'Preview must reflect appearance choices');
      assert.deepEqual(await s.p.evaluate(() => state.profile.avatar), previous, 'Preview does not mutate saved profile');
      await s.p.getByRole('button', { name: modern ? 'Cancelar cambios' : 'Conservar mi aspecto anterior', exact: true }).click({ force: true });
      assert.deepEqual(await s.p.evaluate(() => state.profile.avatar), previous);
      await s.p.evaluate(() => openSettings());
      await setField('hairStyle', 'braids');
      await setField('outfit', 'coastal');
      await setField('accessory', 'headphones');
      await setField('silhouette', 'slim');
      if (modern) await s.p.locator('[data-wardrobe-tab="extras"]').click();
      await s.p.locator('#profileInterests [data-interest="reading"]').click({ force: true });
      await s.p.locator('#profileInterests [data-interest="nature"]').click({ force: true });
      await s.p.getByRole('button', { name: 'Guardar mi personaje' }).click({ force: true });
      const saved = await s.p.evaluate(() => ({ avatar: state.profile.avatar, interests: state.profile.interests }));
      for (const [key, value] of Object.entries({ hairStyle: 'braids', outfit: 'coastal', accessory: 'headphones', silhouette: 'slim' })) assert.equal(saved.avatar[key], value);
      assert.deepEqual(saved.interests.sort(), ['nature', 'reading']);
      await advance(s.p, 90000);
      assert.deepEqual(await s.p.evaluate(() => state.profile.avatar), saved.avatar, 'Autonomy cannot change user identity');
      await s.p.reload();
      assert.deepEqual(await s.p.evaluate(() => state.profile.avatar), saved.avatar);
      assert.deepEqual((await s.p.evaluate(() => state.profile.interests)).sort(), ['nature', 'reading']);
      await checkErrors(s); return saved;
    } finally { await s.context.close(); }
  });

  await test('time', 'Santiago midnight, alternate zone, reminder dates and invalid-zone validation', async () => {
    const s = await session();
    try {
      const boundaries = await s.p.evaluate(() => ({
        before: habitaTime(new Date('2026-10-03T02:59:00Z')),
        after: habitaTime(new Date('2026-10-03T03:00:00Z')),
        key: reminderKey({ index: 0 })
      }));
      assert.equal(boundaries.before.date, '2026-10-02'); assert.equal(boundaries.before.hour, 23);
      assert.equal(boundaries.after.date, '2026-10-03'); assert.equal(boundaries.after.hour, 0);
      await s.p.evaluate(() => openCareSetup());
      await s.p.locator('#careZone').fill('Europe/Madrid');
      await s.p.getByRole('button', { name: 'Guardar mi plan', exact: true }).click({ force: true });
      const alternate = await s.p.evaluate(() => ({ profile: state.profile.timeZone, time: habitaTime(new Date('2026-10-03T03:00:00Z')), phase: realClock(new Date('2026-10-03T03:00:00Z')) }));
      assert.equal(alternate.profile, 'Europe/Madrid'); assert.equal(alternate.time.hour, 5); assert.equal(alternate.phase.hour, 5);
      await s.p.evaluate(() => openCareSetup());
      await s.p.locator('#careZone').fill('A/Bogus_zone');
      await s.p.getByRole('button', { name: 'Guardar mi plan', exact: true }).click({ force: true });
      assert.equal(await s.p.evaluate(() => state.profile.timeZone), 'Europe/Madrid');
      assert.equal(await s.p.locator('#modal').evaluate(el => el.open), true);
      await s.p.evaluate(() => closeModal());
      await s.p.reload(); assert.equal(await s.p.evaluate(() => state.profile.timeZone), 'Europe/Madrid');
      const duplicates = await s.p.evaluate(() => {
        mode = 'real';
        const current = habitaTime();
        state.profile.care.slots[0] = { name: 'Mañana', time: String(current.hour).padStart(2, '0') + ':' + String(current.minute).padStart(2, '0'), enabled: true };
        checkCareReminder(); const first = pendingCareNotice?.key;
        dismissActivityNotice(); checkCareReminder(); const second = pendingCareNotice?.key;
        return { first, second, acks: run().reminderAcks };
      });
      assert.ok(duplicates.first); assert.equal(duplicates.second, undefined);
      await checkErrors(s); return { boundaries, alternate, duplicates };
    } finally { await s.context.close(); }
  });

  await test('environment', 'Exterior NPCs traverse reachable routes', async () => {
    const s = await session();
    try {
      const evidence = [];
      for (const id of ['coast', 'plaza']) {
        await s.p.evaluate(scene => visitScene(scene), id);
        const before = await s.p.evaluate(() => world.npcs.map(n => ({ id: n.id, x: n.x, y: n.y })));
        await advance(s.p, 30000);
        const after = await s.p.evaluate(() => world.npcs.map(n => ({ id: n.id, x: n.x, y: n.y, walkable: world.walkable(n.x, n.y) })));
        assert.ok(before.length >= 2, `${id}: at least two inhabitants`);
        assert.ok(after.some(n => { const b = before.find(q => q.id === n.id); return b && Math.hypot(n.x - b.x, n.y - b.y) > .5; }), `${id}: NPC displacement`);
        assert.ok(after.every(n => n.walkable), `${id}: no NPC inside solid`);
        evidence.push({ scene: id, before, after });
      }
      await checkErrors(s); return evidence;
    } finally { await s.context.close(); }
  });

  await test('performance', 'All compact scenes remain responsive in headless Chromium', async () => {
    const s = await session({ clock: false });
    try {
      const frames = [];
      for (const scene of ['home', 'coast', 'plaza']) {
        await s.p.evaluate(id => visitScene(id), scene);
        const metrics = await s.p.evaluate(() => new Promise(resolve => {
          const samples = []; let previous = performance.now();
          function tick(now) {
            samples.push(now - previous); previous = now;
            if (samples.length < 72) return requestAnimationFrame(tick);
            const sorted = samples.slice(1).sort((a, b) => a - b);
            resolve({ medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor(sorted.length * .95)], maxMs: sorted.at(-1) });
          }
          requestAnimationFrame(tick);
        }));
        assert.ok(metrics.p95Ms < 150, `${scene}: sustained render stalls ${JSON.stringify(metrics)}`);
        await s.p.screenshot({ path: path.join(ARTIFACTS, `final-${scene}-desktop.png`) });
        frames.push({ scene, ...metrics });
      }
      await checkErrors(s); return { environment: 'Linux headless Chromium; not a device FPS guarantee', frames };
    } finally { await s.context.close(); }
  });

  await test('trust', 'Evidence and companion limits are explicit and sources use HTTPS', async () => {
    const s = await session();
    try {
      await s.p.evaluate(() => openEvidence());
      const science = await s.p.locator('#modal').innerText();
      assert.match(science, /no garantiza mejoras/i); assert.match(science, /no ha sido evaluada/i);
      const sources = await s.p.locator('#modal a').evaluateAll(nodes => nodes.map(n => n.href));
      assert.ok(sources.length > 0 && sources.every(h => h.startsWith('https://')));
      await s.p.evaluate(() => openCompanionAbout());
      assert.match(await s.p.locator('#modal').innerText(), /no.*conciencia/i);
      await s.p.evaluate(() => openRoom());
      assert.match(await s.p.locator('#modal').innerText(), /no escanea/i);
      await checkErrors(s); return { sourceURLs: sources };
    } finally { await s.context.close(); }
  });

  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) await test('layout', `Visible controls and screenshots ${viewport.width}×${viewport.height}`, async () => {
    const s = await session({ viewport });
    try {
      await advance(s.p, 1200);
      const visible = await s.p.evaluate(() => {
        const ids = ['homeAction', 'soundControl', 'realClock', 'tab-world', 'tab-decisions', 'tab-me'];
        return ids.map(id => {
          const el = document.getElementById(id), r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { id, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, onscreen: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, reachable: !!hit && (el === hit || el.contains(hit)) };
        });
      });
      for (const c of visible) { assert.ok(c.onscreen, JSON.stringify(c)); assert.ok(c.reachable, JSON.stringify(c)); }
      const primary = await s.p.locator('#homeAction').evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor, height: el.getBoundingClientRect().height }));
      assert.ok(primary.height >= 44, `Main touch target at least 44px: ${primary.height}`);
      assert.ok(contrast(primary.color, primary.background) >= 4.5, `Primary text contrast ${contrast(primary.color, primary.background)}`);
      await s.p.screenshot({ path: path.join(ARTIFACTS, `home-${viewport.width}x${viewport.height}.png`) });
      await s.p.locator('#homeAction').click({ force: true });
      await s.p.getByRole('button', { name: /^Empezar ·/ }).click({ force: true });
      await s.p.screenshot({ path: path.join(ARTIFACTS, `active-${viewport.width}x${viewport.height}.png`) });
      await s.p.getByRole('button', { name: 'Ya lo hice', exact: true }).click({ force: true });
      await advance(s.p, 800);
      assert.equal(await s.p.locator('#careReward').evaluate(el => getComputedStyle(el).display !== 'none'), true, 'Reward indicator is presented');
      // CSS animation timelines are native, separate from the installed JS clock.
      await s.p.screenshot({ path: path.join(ARTIFACTS, `reward-${viewport.width}x${viewport.height}.png`), animations: 'disabled' });
      await checkErrors(s); return { controls: visible, primary, contrast: contrast(primary.color, primary.background) };
    } finally { await s.context.close(); }
  });

  await browser.close();
  fs.writeFileSync(path.join(ARTIFACTS, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  const failures = results.filter(r => !r.passed);
  console.log(`${results.length - failures.length}/${results.length} passed. Artifacts: ${ARTIFACTS}`);
  if (failures.length) process.exitCode = 1;
})().catch(async e => { console.error(e); await browser?.close(); process.exitCode = 1; });
