'use strict';

/**
 * EZRA v6 Dashboard Data + Cloud Sync Tests
 * Tests for hooks/ezra-dashboard-data.js and hooks/ezra-cloud-sync.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ─── Test Framework ──────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.log('  FAIL: ' + name);
    console.log('    ' + e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b) {
  if (a !== b) throw new Error('Expected ' + JSON.stringify(b) + ' but got ' + JSON.stringify(a));
}

// ─── Helpers ─────────────────────────────────────────────────────

function makeTempDir() {
  const dir = path.join(os.tmpdir(), 'ezra-test-dashboard-' + crypto.randomBytes(4).toString('hex'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanTempDir(dir) {
  if (!dir || !dir.includes('ezra-test-dashboard')) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function setupEzraDir(dir) {
  const ezraDir = path.join(dir, '.ezra');
  fs.mkdirSync(path.join(ezraDir, 'decisions'), { recursive: true });
  fs.mkdirSync(path.join(ezraDir, 'versions'), { recursive: true });
  fs.mkdirSync(path.join(ezraDir, 'scans'), { recursive: true });
  fs.mkdirSync(path.join(ezraDir, 'docs'), { recursive: true });

  // Write current.yaml
  fs.writeFileSync(path.join(ezraDir, 'versions', 'current.yaml'), 'health_score: 85\nversion: 2.1.0\n', 'utf8');

  // Write some decisions
  fs.writeFileSync(path.join(ezraDir, 'decisions', 'ADR-001.yaml'), 'id: ADR-001\ntitle: Use Fastify\nstatus: ACTIVE\n', 'utf8');
  fs.writeFileSync(path.join(ezraDir, 'decisions', 'ADR-002.yaml'), 'id: ADR-002\ntitle: Add Redis\nstatus: ACTIVE\n', 'utf8');

  // Write drift counter
  fs.writeFileSync(path.join(ezraDir, 'docs', '.drift-counter.json'), JSON.stringify({ count: 5 }), 'utf8');

  // Write a scan
  fs.writeFileSync(path.join(ezraDir, 'scans', '2025-01-15.yaml'), 'date: 2025-01-15\nscore: 85\n', 'utf8');

  // Write knowledge.yaml
  fs.writeFileSync(path.join(ezraDir, 'knowledge.yaml'), 'description: A quiz-to-build platform\n', 'utf8');

  // Write changelog
  fs.writeFileSync(path.join(ezraDir, 'versions', 'changelog.yaml'), 'entries:\n- CHG-001: Initial setup\n- CHG-002: Added auth\n', 'utf8');

  return ezraDir;
}

// ─── Load Modules ────────────────────────────────────────────────

const dashData = require('../hooks/ezra-dashboard-data.js');
const cloudSync = require('../hooks/ezra-cloud-sync.js');

// ═════════════════════════════════════════════════════════════════
// DASHBOARD DATA TESTS
// ═════════════════════════════════════════════════════════════════

// --- Module Exports ---

test('dashData: has all expected exports', () => {
  const required = [
    'readYaml', 'writeYaml', 'parseVal', 'padRight',
    'PORTFOLIO_FILE', 'getPortfolioPath', 'loadPortfolio', 'savePortfolio',
    'collectProjectHealth', 'generatePortfolioDashboard', 'formatPortfolioDashboard',
    'generateHandoff', 'formatHandoff', 'saveHandoff',
    'exportDashboardData', 'saveDashboardExport',
  ];
  for (const name of required) {
    assert(typeof dashData[name] !== 'undefined', 'Missing export: ' + name);
  }
});

test('dashData: exports count is 16', () => {
  assertEqual(Object.keys(dashData).length, 16);
});

// --- YAML Helpers ---

test('parseVal: handles booleans', () => {
  assertEqual(dashData.parseVal('true'), true);
  assertEqual(dashData.parseVal('false'), false);
});

test('parseVal: handles null', () => {
  assertEqual(dashData.parseVal('null'), null);
  assertEqual(dashData.parseVal('~'), null);
});

test('parseVal: handles numbers', () => {
  assertEqual(dashData.parseVal('42'), 42);
  assertEqual(dashData.parseVal('3.14'), 3.14);
});

test('parseVal: handles strings', () => {
  assertEqual(dashData.parseVal("'hello'"), 'hello');
  assertEqual(dashData.parseVal('"world"'), 'world');
});

test('parseVal: handles inline arrays', () => {
  const result = dashData.parseVal('[a, b, c]');
  assert(Array.isArray(result), 'Should be array');
  assertEqual(result.length, 3);
});

test('readYaml: returns empty for missing file', () => {
  const result = dashData.readYaml('/nonexistent/file.yaml');
  assertEqual(Object.keys(result).length, 0);
});

test('writeYaml + readYaml: round-trip', () => {
  const dir = makeTempDir();
  try {
    const filePath = path.join(dir, 'test.yaml');
    dashData.writeYaml(filePath, { name: 'test', score: 42, enabled: true });
    const result = dashData.readYaml(filePath);
    assertEqual(result.name, 'test');
    assertEqual(result.score, 42);
    assertEqual(result.enabled, true);
  } finally {
    cleanTempDir(dir);
  }
});

// --- padRight ---

test('padRight: pads correctly', () => {
  assertEqual(dashData.padRight('abc', 6), 'abc   ');
  assertEqual(dashData.padRight('abcdef', 6), 'abcdef');
  assertEqual(dashData.padRight('ab', 3), 'ab ');
});

// --- Portfolio ---

test('PORTFOLIO_FILE: has expected value', () => {
  assertEqual(dashData.PORTFOLIO_FILE, '.ezra-portfolio.yaml');
});

test('getPortfolioPath: returns path in home dir', () => {
  const p = dashData.getPortfolioPath();
  assert(p.includes(os.homedir()), 'Should be in home dir');
  assert(p.endsWith('.ezra-portfolio.yaml'), 'Should end with portfolio filename');
});

// --- collectProjectHealth ---

test('collectProjectHealth: handles uninitialized project', () => {
  const dir = makeTempDir();
  try {
    const health = dashData.collectProjectHealth(dir);
    assertEqual(health.initialized, false);
    assertEqual(health.health_score, null);
    assertEqual(health.decisions_count, 0);
    assertEqual(health.drift_level, null);
    assertEqual(health.last_scan, null);
  } finally {
    cleanTempDir(dir);
  }
});

test('collectProjectHealth: collects health from initialized project', () => {
  const dir = makeTempDir();
  try {
    setupEzraDir(dir);
    const health = dashData.collectProjectHealth(dir);
    assertEqual(health.initialized, true);
    assertEqual(health.health_score, 85);
    assertEqual(health.version, '2.1.0');
    assertEqual(health.decisions_count, 2);
    assertEqual(health.drift_level, 5);
    assertEqual(health.last_scan, '2025-01-15');
  } finally {
    cleanTempDir(dir);
  }
});

test('collectProjectHealth: handles missing sub-directories', () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, '.ezra'), { recursive: true });
    const health = dashData.collectProjectHealth(dir);
    assertEqual(health.initialized, true);
    assertEqual(health.health_score, null);
    assertEqual(health.decisions_count, 0);
  } finally {
    cleanTempDir(dir);
  }
});

// --- generatePortfolioDashboard ---

test('generatePortfolioDashboard: returns structure with no portfolio', () => {
  const result = dashData.generatePortfolioDashboard();
  assert(result.generated, 'Should have generated date');
  assert(Array.isArray(result.projects), 'Should have projects array');
  assert(Array.isArray(result.warnings), 'Should have warnings array');
});

// --- formatPortfolioDashboard ---

test('formatPortfolioDashboard: formats empty dashboard', () => {
  const dashboard = { projects: [], warnings: ['No projects'] };
  const formatted = dashData.formatPortfolioDashboard(dashboard);
  assert(formatted.includes('EZRA PORTFOLIO HEALTH'), 'Should have header');
  assert(formatted.includes('No projects configured'), 'Should show no projects message');
});

test('formatPortfolioDashboard: formats projects', () => {
  const dashboard = {
    projects: [{
      name: 'TestProject',
      health_score: 85,
      decisions_count: 3,
      drift_level: 2,
      last_scan: '2025-01-15',
    }],
    warnings: [],
  };
  const formatted = dashData.formatPortfolioDashboard(dashboard);
  assert(formatted.includes('TestProject'), 'Should contain project name');
  assert(formatted.includes('85/100'), 'Should contain health score');
});

// --- generateHandoff ---

test('generateHandoff: handles uninitialized project', () => {
  const dir = makeTempDir();
  try {
    const brief = dashData.generateHandoff(dir);
    assertEqual(brief.health, null);
    assert(brief.open_items.length > 0, 'Should have warning');
    assert(brief.open_items[0].includes('not initialized'), 'Should mention not initialized');
  } finally {
    cleanTempDir(dir);
  }
});

test('generateHandoff: collects full brief from initialized project', () => {
  const dir = makeTempDir();
  try {
    setupEzraDir(dir);
    const brief = dashData.generateHandoff(dir);
    assertEqual(brief.health, 85);
    assertEqual(brief.version, '2.1.0');
    assert(brief.architecture.length > 0, 'Should have architecture');
    assertEqual(brief.recent_decisions.length, 2);
    assert(brief.recent_changes.length > 0, 'Should have changes');
    assert(brief.recent_commits.length > 0, 'Should have commits');
  } finally {
    cleanTempDir(dir);
  }
});

test('generateHandoff: decisions are sorted by ID', () => {
  const dir = makeTempDir();
  try {
    setupEzraDir(dir);
    const brief = dashData.generateHandoff(dir);
    assertEqual(brief.recent_decisions.length, 2);
    // Sorted reverse, so ADR-002 first
    assertEqual(brief.recent_decisions[0].id, 'ADR-002');
    assertEqual(brief.recent_decisions[1].id, 'ADR-001');
  } finally {
    cleanTempDir(dir);
  }
});

// --- formatHandoff ---

test('formatHandoff: produces valid markdown', () => {
  const brief = {
    project: 'TestProject',
    date: '2025-01-15',
    health: 85,
    version: '2.1.0',
    architecture: 'A test project',
    recent_decisions: [{ id: 'ADR-001', title: 'Test', status: 'ACTIVE' }],
    recent_changes: ['CHG-001: Initial'],
    open_items: ['Drift: 5 edits'],
    recent_commits: ['abc123 fix: test'],
  };
  const formatted = dashData.formatHandoff(brief);
  assert(formatted.includes('EZRA HANDOFF BRIEF'), 'Should have header');
  assert(formatted.includes('TestProject'), 'Should have project name');
  assert(formatted.includes('85/100'), 'Should have health');
  assert(formatted.includes('ARCHITECTURE'), 'Should have architecture section');
  assert(formatted.includes('RECENT DECISIONS'), 'Should have decisions section');
  assert(formatted.includes('RECENT COMMITS'), 'Should have commits section');
});

// --- saveHandoff ---

test('saveHandoff: creates file in handoffs dir', () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, '.ezra'), { recursive: true });
    const brief = { project: 'Test', date: '2025-01-15', health: 90, version: '1.0', architecture: '', recent_decisions: [], recent_changes: [], open_items: [], recent_commits: [] };
    const filePath = dashData.saveHandoff(dir, brief);
    assert(fs.existsSync(filePath), 'File should exist');
    assert(filePath.includes('2025-01-15-handoff.md'), 'Should have correct filename');
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.includes('EZRA HANDOFF BRIEF'), 'Should have header');
  } finally {
    cleanTempDir(dir);
  }
});

// --- exportDashboardData ---

test('exportDashboardData: returns collected data', () => {
  const dir = makeTempDir();
  try {
    setupEzraDir(dir);
    const data = dashData.exportDashboardData(dir);
    assert(data.collected_at, 'Should have timestamp');
    assert(data.health, 'Should have health');
    assert(data.brief, 'Should have brief');
    assertEqual(data.health.health_score, 85);
  } finally {
    cleanTempDir(dir);
  }
});

// --- saveDashboardExport ---

test('saveDashboardExport: creates export file', () => {
  const dir = makeTempDir();
  try {
    setupEzraDir(dir);
    const data = dashData.exportDashboardData(dir);
    const filePath = dashData.saveDashboardExport(dir, data);
    assert(fs.existsSync(filePath), 'Export file should exist');
    assert(filePath.includes('-dashboard.yaml'), 'Should have correct extension');
  } finally {
    cleanTempDir(dir);
  }
});

// ═════════════════════════════════════════════════════════════════
// CLOUD SYNC TESTS
// ═════════════════════════════════════════════════════════════════

// --- Module Exports ---

test('cloudSync: has all expected exports', () => {
  const required = [
    'SYNC_DIR', 'MANIFEST_FILE', 'SYNC_STATE_FILE', 'SYNCABLE_PATHS',
    'readYaml', 'writeYaml', 'hashFile', 'hashDir',
    'generateManifest', 'countFilesInDir', 'getSyncDir',
    'loadSyncState', 'saveSyncState',
    'createBackup', 'copyDirRecursive', 'listBackups', 'restoreFromBackup',
    'diffManifests',
  ];
  for (const name of required) {
    assert(typeof cloudSync[name] !== 'undefined', 'Missing export: ' + name);
  }
});

test('cloudSync: exports count is 18', () => {
  assertEqual(Object.keys(cloudSync).length, 18);
});

// --- Constants ---

test('SYNC_DIR: correct value', () => {
  assertEqual(cloudSync.SYNC_DIR, '.ezra-sync');
});

test('SYNCABLE_PATHS: is non-empty array', () => {
  assert(Array.isArray(cloudSync.SYNCABLE_PATHS), 'Should be array');
  assert(cloudSync.SYNCABLE_PATHS.length > 0, 'Should not be empty');
  assert(cloudSync.SYNCABLE_PATHS.includes('governance.yaml'), 'Should include governance.yaml');
});

// --- Hashing ---

test('hashFile: returns null for missing file', () => {
  assertEqual(cloudSync.hashFile('/nonexistent/file'), null);
});

test('hashFile: returns consistent hash', () => {
  const dir = makeTempDir();
  try {
    const f = path.join(dir, 'test.txt');
    fs.writeFileSync(f, 'hello', 'utf8');
    const h1 = cloudSync.hashFile(f);
    const h2 = cloudSync.hashFile(f);
    assertEqual(h1, h2);
    assert(h1.length === 16, 'Hash should be 16 chars');
  } finally {
    cleanTempDir(dir);
  }
});

test('hashDir: returns null for missing dir', () => {
  assertEqual(cloudSync.hashDir('/nonexistent/dir'), null);
});

test('hashDir: returns consistent hash', () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'hello', 'utf8');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'world', 'utf8');
    const h1 = cloudSync.hashDir(dir);
    const h2 = cloudSync.hashDir(dir);
    assertEqual(h1, h2);
  } finally {
    cleanTempDir(dir);
  }
});

// --- Manifest ---

test('generateManifest: handles uninitialized project', () => {
  const dir = makeTempDir();
  try {
    const m = cloudSync.generateManifest(dir);
    assert(m.error, 'Should have error');
    assert(m.error.includes('not initialized'), 'Should mention not initialized');
  } finally {
    cleanTempDir(dir);
  }
});

test('generateManifest: generates entries for initialized project', () => {
  const dir = makeTempDir();
  try {
    setupEzraDir(dir);
    const m = cloudSync.generateManifest(dir);
    assert(!m.error, 'Should not have error');
    assert(m.entries.length > 0, 'Should have entries');
    assert(m.generated, 'Should have generated timestamp');
  } finally {
    cleanTempDir(dir);
  }
});

test('generateManifest: entry has required fields', () => {
  const dir = makeTempDir();
  try {
    setupEzraDir(dir);
    const m = cloudSync.generateManifest(dir);
    const entry = m.entries[0];
    assert(entry.path, 'Should have path');
    assert(entry.type, 'Should have type');
    assert(entry.hash, 'Should have hash');
    assert(entry.modified, 'Should have modified');
  } finally {
    cleanTempDir(dir);
  }
});

// --- countFilesInDir ---

test('countFilesInDir: counts files correctly', () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a', 'utf8');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b', 'utf8');
    fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'sub', 'c.txt'), 'c', 'utf8');
    assertEqual(cloudSync.countFilesInDir(dir), 3);
  } finally {
    cleanTempDir(dir);
  }
});

// --- Sync State ---

test('loadSyncState: returns empty for no state', () => {
  const dir = makeTempDir();
  try {
    const state = cloudSync.loadSyncState(dir);
    assertEqual(Object.keys(state).length, 0);
  } finally {
    cleanTempDir(dir);
  }
});

test('saveSyncState + loadSyncState: round-trip', () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, '.ezra'), { recursive: true });
    cloudSync.saveSyncState(dir, { last_backup: '2025-01-15', files: 10 });
    const state = cloudSync.loadSyncState(dir);
    assertEqual(state.last_backup, '2025-01-15');
    assertEqual(state.files, 10);
  } finally {
    cleanTempDir(dir);
  }
});

// --- Backup / Restore ---

test('createBackup: fails for uninitialized project', () => {
  const dir = makeTempDir();
  try {
    const result = cloudSync.createBackup(dir);
    assert(result.error, 'Should have error');
  } finally {
    cleanTempDir(dir);
  }
});

test('createBackup: creates backup for initialized project', () => {
  const dir = makeTempDir();
  try {
    setupEzraDir(dir);
    const result = cloudSync.createBackup(dir);
    assert(!result.error, 'Should not have error');
    assert(result.backup_dir, 'Should have backup dir');
    assert(result.files_copied > 0, 'Should copy files');
    assert(fs.existsSync(result.backup_dir), 'Backup dir should exist');
  } finally {
    cleanTempDir(dir);
  }
});

test('listBackups: returns empty for no backups', () => {
  const dir = makeTempDir();
  try {
    const backups = cloudSync.listBackups(dir);
    assertEqual(backups.length, 0);
  } finally {
    cleanTempDir(dir);
  }
});

test('listBackups: lists created backups', () => {
  const dir = makeTempDir();
  try {
    setupEzraDir(dir);
    cloudSync.createBackup(dir);
    const backups = cloudSync.listBackups(dir);
    assert(backups.length > 0, 'Should have backups');
    assert(backups[0].name, 'Should have name');
    assert(backups[0].path, 'Should have path');
  } finally {
    cleanTempDir(dir);
  }
});

test('restoreFromBackup: fails for missing backup', () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, '.ezra'), { recursive: true });
    const result = cloudSync.restoreFromBackup(dir, 'nonexistent');
    assert(result.error, 'Should have error');
  } finally {
    cleanTempDir(dir);
  }
});

test('restoreFromBackup: restores files', () => {
  const dir = makeTempDir();
  try {
    setupEzraDir(dir);
    const backup = cloudSync.createBackup(dir);

    // Delete a file
    const versionFile = path.join(dir, '.ezra', 'versions', 'current.yaml');
    fs.unlinkSync(versionFile);
    assert(!fs.existsSync(versionFile), 'File should be deleted');

    // Restore
    const result = cloudSync.restoreFromBackup(dir, backup.timestamp);
    assert(!result.error, 'Should not have error');
    assert(result.files_restored > 0, 'Should restore files');
    assert(fs.existsSync(versionFile), 'File should be restored');
  } finally {
    cleanTempDir(dir);
  }
});

// --- Diff ---

test('diffManifests: detects additions', () => {
  const m1 = { entries: [] };
  const m2 = { entries: [{ path: 'new.yaml', hash: 'abc' }] };
  const diffs = cloudSync.diffManifests(m1, m2);
  assertEqual(diffs.length, 1);
  assertEqual(diffs[0].change, 'added');
});

test('diffManifests: detects removals', () => {
  const m1 = { entries: [{ path: 'old.yaml', hash: 'abc' }] };
  const m2 = { entries: [] };
  const diffs = cloudSync.diffManifests(m1, m2);
  assertEqual(diffs.length, 1);
  assertEqual(diffs[0].change, 'removed');
});

test('diffManifests: detects modifications', () => {
  const m1 = { entries: [{ path: 'file.yaml', hash: 'abc' }] };
  const m2 = { entries: [{ path: 'file.yaml', hash: 'def' }] };
  const diffs = cloudSync.diffManifests(m1, m2);
  assertEqual(diffs.length, 1);
  assertEqual(diffs[0].change, 'modified');
});

test('diffManifests: returns empty for identical manifests', () => {
  const m1 = { entries: [{ path: 'file.yaml', hash: 'abc' }] };
  const m2 = { entries: [{ path: 'file.yaml', hash: 'abc' }] };
  const diffs = cloudSync.diffManifests(m1, m2);
  assertEqual(diffs.length, 0);
});

// --- copyDirRecursive ---

test('copyDirRecursive: copies directory tree', () => {
  const dir = makeTempDir();
  try {
    const src = path.join(dir, 'src');
    const dest = path.join(dir, 'dest');
    fs.mkdirSync(path.join(src, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(src, 'a.txt'), 'hello', 'utf8');
    fs.writeFileSync(path.join(src, 'sub', 'b.txt'), 'world', 'utf8');
    cloudSync.copyDirRecursive(src, dest);
    assert(fs.existsSync(path.join(dest, 'a.txt')), 'Should copy root file');
    assert(fs.existsSync(path.join(dest, 'sub', 'b.txt')), 'Should copy nested file');
    assertEqual(fs.readFileSync(path.join(dest, 'a.txt'), 'utf8'), 'hello');
  } finally {
    cleanTempDir(dir);
  }
});

// ═════════════════════════════════════════════════════════════════
// SETTINGS INTEGRATION
// ═════════════════════════════════════════════════════════════════

test('settings: DEFAULTS has dashboard section', () => {
  const settings = require('../hooks/ezra-settings.js');
  assert(settings.DEFAULTS.dashboard, 'Should have dashboard section');
  assertEqual(settings.DEFAULTS.dashboard.auto_export, false);
  assertEqual(settings.DEFAULTS.dashboard.export_format, 'yaml');
});

test('settings: DEFAULTS has cloud_sync section', () => {
  const settings = require('../hooks/ezra-settings.js');
  assert(settings.DEFAULTS.cloud_sync, 'Should have cloud_sync section');
  assertEqual(settings.DEFAULTS.cloud_sync.enabled, false);
  assertEqual(settings.DEFAULTS.cloud_sync.provider, 'local');
  assertEqual(settings.DEFAULTS.cloud_sync.backup_retention, 5);
});

test('settings: getDashboard accessor exists', () => {
  const settings = require('../hooks/ezra-settings.js');
  assertEqual(typeof settings.getDashboard, 'function');
});

test('settings: getCloudSync accessor exists', () => {
  const settings = require('../hooks/ezra-settings.js');
  assertEqual(typeof settings.getCloudSync, 'function');
});

// ═════════════════════════════════════════════════════════════════
// REPORT
// ═════════════════════════════════════════════════════════════════

console.log('  V6-Dashboard: PASSED: ' + passed + '  FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
