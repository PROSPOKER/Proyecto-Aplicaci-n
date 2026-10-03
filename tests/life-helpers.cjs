'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const URL = process.env.HABITA_TEST_URL || 'http://127.0.0.1:8877';
const ARTIFACTS = process.env.HABITA_TEST_ARTIFACTS || '/tmp/habita-life-qa';
const START = new Date('2026-10-02T15:00:00Z');
const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/v2-before-refactor.json'), 'utf8'));
fs.mkdirSync(ARTIFACTS, { recursive: true });

async function launch() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
}
async function session(browser, { historical = false, save = null, viewport = { width: 1280, height: 800 }, reducedMotion = 'no-preference', clock = true, time = START } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion, timezoneId: 'UTC' });
  const data = save || structuredClone(legacy);
  if (!historical && !save) {
    data.profile.name = 'Alex'; data.profile.photo = null;
    data.profile.care.configured = true;
    data.profile.care.slots.forEach(slot => { slot.enabled = false; });
    data.onboard = true;
    for (const mode of ['real', 'demo']) {
      const r = data[mode];
      for (const k of ['records', 'choices', 'events', 'future', 'memories', 'seen']) r[k] = [];
      r.active = null; r.day = 0; r.barriers = {}; r.reminders = {}; r.reminderAcks = {};
      Object.keys(r.flags).forEach(k => { r.flags[k] = false; });
    }
  }
  await context.addInitScript(value => { if (!localStorage.getItem('habita-pilot-v2')) localStorage.setItem('habita-pilot-v2', JSON.stringify(value)); }, data);
  await context.addInitScript(() => {
    let seed = 124713;
    Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', error => errors.push(error.message));
  if (clock) { await p.clock.install({ time }); await p.clock.pauseAt(time); }
  await p.goto(URL, { waitUntil: 'load' });
  assert.ok(await p.evaluate(() => typeof world !== 'undefined' && !!world), `Application boot: ${errors.join('; ')}`);
  if (!historical) await p.evaluate(() => { closeModal(); navigate('world'); });
  return { p, context, errors };
}
async function advance(p, milliseconds) { await p.clock.runFor(milliseconds); }
async function noErrors(s) { assert.deepEqual(s.errors, [], 'No uncaught browser errors'); }
async function shot(p, name) { await p.screenshot({ path: path.join(ARTIFACTS, name + '.png'), animations: 'disabled' }); }
async function finishRealActivity(p, action = 'hobby') {
  // The historical app exposes the commitment API; confirmation is exercised through the real button.
  await p.evaluate(id => {
    if (!Object.hasOwn(ACTIONS, id)) throw Error('Unknown test activity');
    run().active = { id: 'qa-life-activity', action: id, duration: ACTIONS[id].min, situation: 'care', title: ACTIONS[id].name, day: day(), date: stamp() };
    run().choices.push({ action: id, situation: 'care', status: 'accepted', day: day() });
    save(); syncHome();
  }, action);
  await p.getByRole('button', { name: 'Ya lo hice', exact: true }).click();
}
function reporter() {
  const results = [];
  const filter = process.env.HABITA_TEST_GROUP || '';
  const name = process.env.HABITA_TEST_NAME || '';
  return {
    results,
    async test(group, label, fn) {
      if (filter && !filter.split(',').includes(group)) return;
      if (name && !new RegExp(name, 'i').test(label)) return;
      const started = Date.now();
      try { const detail = await fn(); results.push({ group, name: label, passed: true, milliseconds: Date.now() - started, detail }); console.log(`PASS ${group}: ${label}`); }
      catch (e) { results.push({ group, name: label, passed: false, milliseconds: Date.now() - started, error: e.stack }); console.error(`FAIL ${group}: ${label}\n${e.stack}`); }
    },
    finish() {
      fs.writeFileSync(path.join(ARTIFACTS, 'results.json'), JSON.stringify(results, null, 2) + '\n');
      const failed = results.filter(r => !r.passed);
      console.log(`${results.length - failed.length}/${results.length} passed. Artifacts: ${ARTIFACTS}`);
      if (failed.length) process.exitCode = 1;
    }
  };
}
module.exports = { assert, fs, path, URL, ARTIFACTS, START, legacy, launch, session, advance, noErrors, shot, finishRealActivity, reporter };
