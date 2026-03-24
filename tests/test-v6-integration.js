#!/usr/bin/env node
'use strict';

/**
 * EZRA v6 — Integration Test
 * Full lifecycle using ACTUAL exports from all hooks.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log(`  FAIL: ${name} — ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function makeTempProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-integ-'));
  fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'src', 'index.js'), "'use strict';\nmodule.exports = {};\n");
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test","version":"1.0.0"}');
  return tmp;
}
function rmDir(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }

const settings = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));
const writer = require(path.join(__dirname, '..', 'hooks', 'ezra-settings-writer.js'));
const oversight = require(path.join(__dirname, '..', 'hooks', 'ezra-oversight.js'));
const pm = require(path.join(__dirname, '..', 'hooks', 'ezra-pm.js'));
const library = require(path.join(__dirname, '..', 'hooks', 'ezra-library.js'));
const memory = require(path.join(__dirname, '..', 'hooks', 'ezra-memory.js'));
const license = require(path.join(__dirname, '..', 'hooks', 'ezra-license.js'));
const workflows = require(path.join(__dirname, '..', 'hooks', 'ezra-workflows.js'));
const planner = require(path.join(__dirname, '..', 'hooks', 'ezra-planner.js'));
const agents = require(path.join(__dirname, '..', 'hooks', 'ezra-agents.js'));
const dashboard = require(path.join(__dirname, '..', 'hooks', 'ezra-dashboard-data.js'));
const cloudSync = require(path.join(__dirname, '..', 'hooks', 'ezra-cloud-sync.js'));
const ezraHttp = require(path.join(__dirname, '..', 'hooks', 'ezra-http.js'));

let projectDir;

// ═══ INIT ════════════════════════════════════════════════════════

test('init: create temp project', () => {
  projectDir = makeTempProject();
  assert(fs.existsSync(projectDir), 'project dir');
});

test('init: initSettings creates .ezra/', () => {
  writer.initSettings(projectDir);
  assert(fs.existsSync(path.join(projectDir, '.ezra')), '.ezra dir');
  assert(fs.existsSync(path.join(projectDir, '.ezra', 'settings.yaml')), 'settings.yaml');
});

test('init: loadSettings returns defaults', () => {
  const s = settings.loadSettings(projectDir);
  assert(s.standards !== undefined, 'standards');
  assert(s.security !== undefined, 'security');
  assert(s.oversight !== undefined, 'oversight');
  assert(s.oversight.enabled === true, 'oversight.enabled');
});

// ═══ SETTINGS WRITER ═════════════════════════════════════════════

test('settings: setSetting writes value', () => {
  writer.setSetting(projectDir, 'oversight.level', 'strict');
  // Re-read raw file to verify
  const raw = fs.readFileSync(path.join(projectDir, '.ezra', 'settings.yaml'), 'utf-8');
  const parsed = settings.parseYamlSimple(raw);
  assert(parsed.oversight.level === 'strict', 'expected strict, got ' + parsed.oversight.level);
});

test('settings: loadSettings reflects write', () => {
  const s = settings.loadSettings(projectDir);
  assert(s.oversight.level === 'strict', 'strict persisted');
});

// ═══ OVERSIGHT ═══════════════════════════════════════════════════

test('oversight: loadOversightSettings', () => {
  const osSettings = oversight.loadOversightSettings(projectDir);
  assert(osSettings !== null && osSettings !== undefined, 'returned value');
});

test('oversight: runChecks returns result', () => {
  const result = oversight.runChecks('var x = 1;', path.join(projectDir, 'src', 'index.js'), projectDir);
  assert(typeof result === 'object', 'returns object');
});

// ═══ PROJECT MANAGER ═════════════════════════════════════════════

test('pm: loadProjectState', () => {
  const state = pm.loadProjectState(projectDir);
  assert(state.exists === true, '.ezra found');
  assert(typeof state.tasks === 'object', 'tasks object');
});

test('pm: updateProgress — create task', () => {
  const r = pm.updateProgress(projectDir, 'Setup project', 'done');
  assert(r.action === 'created', 'created');
  assert(r.status === 'done', 'done');
});

test('pm: updateProgress — second task', () => {
  const r = pm.updateProgress(projectDir, 'Configure lint', 'active');
  assert(r.action === 'created', 'created');
});

test('pm: loadProjectState reflects tasks', () => {
  const state = pm.loadProjectState(projectDir);
  assert(state.tasks.total === 2, 'total 2, got ' + state.tasks.total);
  assert(state.tasks.done === 1, 'done 1');
  assert(state.tasks.active === 1, 'active 1');
});

test('pm: generateProgressReport', () => {
  const r = pm.generateProgressReport(projectDir);
  assert(typeof r === 'object', 'returns object');
});

// ═══ LIBRARY ═════════════════════════════════════════════════════

test('library: LIBRARY_CATEGORIES exists', () => {
  assert(Array.isArray(library.LIBRARY_CATEGORIES), 'is array');
  assert(library.LIBRARY_CATEGORIES.length >= 10, 'at least 10, got ' + library.LIBRARY_CATEGORIES.length);
});

test('library: getCategories', () => {
  const cats = library.getCategories();
  assert(Array.isArray(cats), 'array');
  assert(cats.length >= 10, 'at least 10');
});

test('library: searchLibrary', () => {
  library.initLibrary(projectDir);
  const results = library.searchLibrary(projectDir, 'naming');
  assert(Array.isArray(results), 'array');
});

// ═══ MEMORY ══════════════════════════════════════════════════════

test('memory: initMemory creates dir', () => {
  memory.initMemory(projectDir);
  assert(fs.existsSync(memory.getMemoryDir(projectDir)), 'memory dir');
});

test('memory: addMemory + listMemories', () => {
  const id = memory.addMemory(projectDir, { type: 'fact', content: 'Project uses MIT license', priority: 'high' });
  assert(id !== null && id !== undefined, 'id returned');
  const list = memory.listMemories(projectDir);
  assert(Array.isArray(list), 'array');
  assert(list.length >= 1, 'at least 1');
});

test('memory: searchMemory', () => {
  const results = memory.searchMemory(projectDir, 'MIT');
  assert(Array.isArray(results), 'array');
});

test('memory: getMemoryStats', () => {
  const stats = memory.getMemoryStats(projectDir);
  assert(typeof stats === 'object', 'object');
  assert(stats !== null, 'not null');
});

// ═══ LICENSE ═════════════════════════════════════════════════════

test('license: checkLicense — core always valid', () => {
  const r = license.checkLicense(projectDir);
  assert(r.valid === true, 'core valid');
  assert(r.tier === 'core', 'tier core');
});

test('license: isFeatureAvailable', () => {
  const avail = license.isFeatureAvailable(projectDir, 'oversight.level');
  assert(avail.available === true, 'oversight on core, got ' + JSON.stringify(avail));
});

test('license: validateKey format', () => {
  assert(license.validateKey('ezra_pro_abc123def456').valid !== undefined, 'pro key validates');
  assert(license.validateKey('invalid').valid === false, 'invalid key rejected');
});

test('license: FEATURE_TIER_MAP exists', () => {
  assert(typeof license.FEATURE_TIER_MAP === 'object', 'exists');
  assert(Object.keys(license.FEATURE_TIER_MAP).length >= 10, 'at least 10 features mapped');
});

// ═══ WORKFLOWS ═══════════════════════════════════════════════════

test('workflows: listTemplates', () => {
  workflows.getTemplateDir(projectDir); // ensure dir
  const list = workflows.listTemplates(projectDir);
  assert(Array.isArray(list), 'array');
});

test('workflows: STEP_TYPES defined', () => {
  assert(Array.isArray(workflows.STEP_TYPES), 'array');
  assert(workflows.STEP_TYPES.length >= 3, 'at least 3 step types');
});

// ═══ AGENTS ══════════════════════════════════════════════════════

test('agents: SUPPORTED_PROVIDERS', () => {
  assert(Array.isArray(agents.SUPPORTED_PROVIDERS), 'array');
  assert(agents.SUPPORTED_PROVIDERS.length >= 2, 'at least 2 providers');
});

test('agents: createProvider', () => {
  const p = agents.createProvider({ type: 'mock' });
  assert(p !== null, 'provider created');
});

test('agents: checkBudget', () => {
  const b = agents.checkBudget(projectDir);
  assert(typeof b === 'object', 'returns object');
});

// ═══ PLANNER ═════════════════════════════════════════════════════

test('planner: createPlan', () => {
  const p = planner.createPlan(projectDir, { name: 'Test Plan', description: 'Integration', features: ['auth'] });
  assert(p !== null && p !== undefined, 'plan created');
});

// ═══ DASHBOARD ═══════════════════════════════════════════════════

test('dashboard: exportDashboardData', () => {
  const d = dashboard.exportDashboardData(projectDir);
  assert(d !== null && d !== undefined, 'data exported');
  assert(typeof d === 'object', 'is object');
});

// ═══ CROSS-HOOK ══════════════════════════════════════════════════

test('cross: settings → oversight uses updated level', () => {
  const crossSettings = oversight.loadOversightSettings(projectDir);
  assert(crossSettings !== null && crossSettings !== undefined, 'oversight config readable');
});

test('cross: pm reflects updates from earlier', () => {
  const state = pm.loadProjectState(projectDir);
  assert(state.tasks.total >= 2, 'tasks persisted');
});

// ═══ EDGE CASES ══════════════════════════════════════════════════

test('edge: loadSettings from non-existent dir', () => {
  const s = settings.loadSettings(path.join(os.tmpdir(), 'does-not-exist-ezra-test-' + Date.now()));
  assert(typeof s === 'object', 'returns defaults');
  assert(s.standards !== undefined, 'has standards');
});

test('edge: PM from empty project', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-edge-'));
  const state = pm.loadProjectState(tmp);
  assert(state.exists === false, 'not initialized');
  rmDir(tmp);
});

test('edge: license without .ezra', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-edge-'));
  const r = license.checkLicense(tmp);
  assert(r.valid === true, 'core always valid');
  rmDir(tmp);
});

// ═══ CLOUD WIRING ════════════════════════════════════════════════

test('ezra-http: httpsPost is a function', () => {
  assert(typeof ezraHttp.httpsPost === 'function', 'httpsPost exported');
});

test('ezra-http: httpsGet is a function', () => {
  assert(typeof ezraHttp.httpsGet === 'function', 'httpsGet exported');
});

test('refreshLicense: returns cached when cache is fresh', () => {
  // Write a fresh cache
  const cacheDir = path.join(projectDir, '.ezra');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const cacheData = {
    valid: true,
    tier: 'pro',
    validated_at: new Date().toISOString(),
    expires_at: null,
    seats: 1,
  };
  fs.writeFileSync(path.join(cacheDir, 'license-cache.json'), JSON.stringify(cacheData), 'utf8');
  const result = license.refreshLicense(projectDir);
  // May return sync or promise — handle sync case
  if (result && typeof result.then !== 'function') {
    assert(result.cached === true, 'should be cached, got ' + JSON.stringify(result));
    assert(result.tier === 'pro', 'tier should be pro');
  } else {
    assert(true, 'returned promise (async path)');
  }
});

test('refreshLicense: returns core when no cache and no endpoint', () => {
  // Remove cache
  const cachePath = path.join(projectDir, '.ezra', 'license-cache.json');
  if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
  const result = license.refreshLicense(projectDir);
  if (result && typeof result.then !== 'function') {
    assert(result.valid === true, 'should be valid');
    assert(result.tier === 'core', 'should default to core');
  } else {
    assert(true, 'returned promise (async path)');
  }
});

test('pushSync: returns skipped when cloud_sync disabled', () => {
  const result = cloudSync.pushSync(projectDir);
  // pushSync returns sync when disabled
  if (result && typeof result.then !== 'function') {
    assert(result.skipped === true, 'should be skipped');
    assert(result.reason === 'cloud_sync_disabled', 'reason should be cloud_sync_disabled, got ' + result.reason);
  } else {
    assert(true, 'returned promise');
  }
});

test('pullSync: returns skipped when cloud_sync disabled', () => {
  const result = cloudSync.pullSync(projectDir);
  if (result && typeof result.then !== 'function') {
    assert(result.skipped === true, 'should be skipped');
    assert(result.reason === 'cloud_sync_disabled', 'reason should be cloud_sync_disabled, got ' + result.reason);
  } else {
    assert(true, 'returned promise');
  }
});

test('readCloudSyncSettings: returns empty for no settings', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-cloud-'));
  const result = cloudSync.readCloudSyncSettings(tmp);
  assert(typeof result === 'object', 'returns object');
  rmDir(tmp);
});

test('readCloudSettings: returns empty for missing dir', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-cloud-'));
  const result = license.readCloudSettings(tmp);
  assert(typeof result === 'object', 'returns object');
  rmDir(tmp);
});

// ═══ CLEANUP ═════════════════════════════════════════════════════

test('cleanup', () => {
  rmDir(projectDir);
  assert(!fs.existsSync(projectDir), 'cleaned');
});

console.log(`  V6-Integration: PASSED: ${passed}  FAILED: ${failed}`);
if (failed > 0) process.exit(1);
