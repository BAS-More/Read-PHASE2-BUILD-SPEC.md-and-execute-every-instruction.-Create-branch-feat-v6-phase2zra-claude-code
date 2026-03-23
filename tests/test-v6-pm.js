#!/usr/bin/env node
'use strict';

/**
 * EZRA V6 Project Manager Tests
 *
 * Comprehensive tests for:
 * - PM_DEFAULTS validation
 * - loadProjectState with mock .ezra/ directory
 * - checkMilestones with various criteria
 * - detectStalls with fresh/stale timestamps
 * - calculateHealthTrend with mock scan files
 * - checkEscalation with various failure counts
 * - generateProgressReport returns complete structure
 * - generateDailyReport produces valid output
 * - updateProgress creates/updates task entries
 * - Hook protocol: stdin JSON → stdout JSON → exit 0
 * - Progress hook: tracks file changes, triggers checks at interval
 * - Edge cases: empty .ezra/, missing files, corrupted yaml
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const pm = require(path.resolve(__dirname, '..', 'hooks', 'ezra-pm.js'));
const progressHook = require(path.resolve(__dirname, '..', 'hooks', 'ezra-progress-hook.js'));
const settings = require(path.resolve(__dirname, '..', 'hooks', 'ezra-settings.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL: ${name} — ${err.message}`); }
}

function assert(condition, msg) { if (!condition) throw new Error(msg); }

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-v6-pm-test-'));
}

function rmDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

// ═══════════════════════════════════════════════════════════════════
// 1. PM_DEFAULTS Validation
// ═══════════════════════════════════════════════════════════════════

test('PM_DEFAULTS: is an object', () => {
  assert(typeof pm.PM_DEFAULTS === 'object' && pm.PM_DEFAULTS !== null, 'not an object');
});

test('PM_DEFAULTS: enabled is true', () => {
  assert(pm.PM_DEFAULTS.enabled === true, `enabled is ${pm.PM_DEFAULTS.enabled}`);
});

test('PM_DEFAULTS: mode is hybrid', () => {
  assert(pm.PM_DEFAULTS.mode === 'hybrid', `mode is ${pm.PM_DEFAULTS.mode}`);
});

test('PM_DEFAULTS: routine_checks is rule-based', () => {
  assert(pm.PM_DEFAULTS.routine_checks === 'rule-based', `routine_checks is ${pm.PM_DEFAULTS.routine_checks}`);
});

test('PM_DEFAULTS: complex_decisions is ai', () => {
  assert(pm.PM_DEFAULTS.complex_decisions === 'ai', `complex_decisions is ${pm.PM_DEFAULTS.complex_decisions}`);
});

test('PM_DEFAULTS: ai_provider is claude', () => {
  assert(pm.PM_DEFAULTS.ai_provider === 'claude', `ai_provider is ${pm.PM_DEFAULTS.ai_provider}`);
});

test('PM_DEFAULTS: check_interval is every_5_tasks', () => {
  assert(pm.PM_DEFAULTS.check_interval === 'every_5_tasks', `check_interval is ${pm.PM_DEFAULTS.check_interval}`);
});

test('PM_DEFAULTS: escalation_threshold is 3', () => {
  assert(pm.PM_DEFAULTS.escalation_threshold === 3, `threshold is ${pm.PM_DEFAULTS.escalation_threshold}`);
});

test('PM_DEFAULTS: stall_detection is 30', () => {
  assert(pm.PM_DEFAULTS.stall_detection === 30, `stall_detection is ${pm.PM_DEFAULTS.stall_detection}`);
});

test('PM_DEFAULTS: daily_report is true', () => {
  assert(pm.PM_DEFAULTS.daily_report === true, `daily_report is ${pm.PM_DEFAULTS.daily_report}`);
});

test('PM_DEFAULTS: weekly_report is true', () => {
  assert(pm.PM_DEFAULTS.weekly_report === true, `weekly_report is ${pm.PM_DEFAULTS.weekly_report}`);
});

test('PM_DEFAULTS: milestones is empty array', () => {
  assert(Array.isArray(pm.PM_DEFAULTS.milestones), 'milestones not array');
  assert(pm.PM_DEFAULTS.milestones.length === 0, 'milestones not empty');
});

test('PM_DEFAULTS: has all 12 expected keys', () => {
  const keys = Object.keys(pm.PM_DEFAULTS);
  const expected = ['enabled', 'mode', 'routine_checks', 'complex_decisions', 'ai_provider',
    'check_interval', 'escalation_threshold', 'stall_detection', 'daily_report', 'weekly_report', 'milestones'];
  for (const k of expected) {
    assert(keys.includes(k), `Missing key: ${k}`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 2. loadProjectState
// ═══════════════════════════════════════════════════════════════════

test('loadProjectState: returns object with exists=false when no .ezra/', () => {
  const tmp = makeTempDir();
  try {
    const state = pm.loadProjectState(tmp);
    assert(state.exists === false, 'exists should be false');
    assert(state.project === null, 'project should be null');
    assert(state.health_score === null, 'health_score should be null');
  } finally { rmDir(tmp); }
});

test('loadProjectState: returns object with exists=true when .ezra/ exists', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const state = pm.loadProjectState(tmp);
    assert(state.exists === true, 'exists should be true');
  } finally { rmDir(tmp); }
});

test('loadProjectState: reads governance.yaml', () => {
  const tmp = makeTempDir();
  try {
    writeFile(path.join(tmp, '.ezra', 'governance.yaml'), 'project: TestProject\nphase: development\n');
    const state = pm.loadProjectState(tmp);
    assert(state.project === 'TestProject', `project is "${state.project}"`);
    assert(state.phase === 'development', `phase is "${state.phase}"`);
  } finally { rmDir(tmp); }
});

test('loadProjectState: reads latest scan', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'), 'health_score: 85\n');
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-02.yaml'), 'health_score: 90\n');
    const state = pm.loadProjectState(tmp);
    assert(state.health_score === 90, `health_score is ${state.health_score}`);
    assert(state.last_scan === '2024-01-02', `last_scan is ${state.last_scan}`);
  } finally { rmDir(tmp); }
});

test('loadProjectState: counts decisions by status', () => {
  const tmp = makeTempDir();
  try {
    const decDir = path.join(tmp, '.ezra', 'decisions');
    writeFile(path.join(decDir, 'dec-001.yaml'), 'status: approved\n');
    writeFile(path.join(decDir, 'dec-002.yaml'), 'status: pending\n');
    writeFile(path.join(decDir, 'dec-003.yaml'), 'status: rejected\n');
    const state = pm.loadProjectState(tmp);
    assert(state.decisions.total === 3, `total is ${state.decisions.total}`);
    assert(state.decisions.approved === 1, `approved is ${state.decisions.approved}`);
    assert(state.decisions.pending === 1, `pending is ${state.decisions.pending}`);
    assert(state.decisions.rejected === 1, `rejected is ${state.decisions.rejected}`);
  } finally { rmDir(tmp); }
});

test('loadProjectState: counts tasks by status', () => {
  const tmp = makeTempDir();
  try {
    writeFile(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
      'tasks:\n  - id: task-1\n    status: done\n  - id: task-2\n    status: active\n  - id: task-3\n    status: pending\n  - id: task-4\n    status: blocked\n');
    const state = pm.loadProjectState(tmp);
    assert(state.tasks.total === 4, `total is ${state.tasks.total}`);
    assert(state.tasks.done === 1, `done is ${state.tasks.done}`);
    assert(state.tasks.active === 1, `active is ${state.tasks.active}`);
    assert(state.tasks.pending === 1, `pending is ${state.tasks.pending}`);
    assert(state.tasks.blocked === 1, `blocked is ${state.tasks.blocked}`);
  } finally { rmDir(tmp); }
});

test('loadProjectState: counts milestones', () => {
  const tmp = makeTempDir();
  try {
    writeFile(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
      'milestones:\n  - name: M1\n    completed: true\n  - name: M2\n    completed: false\n');
    const state = pm.loadProjectState(tmp);
    assert(state.milestones.total === 2, `total is ${state.milestones.total}`);
    assert(state.milestones.completed === 1, `completed is ${state.milestones.completed}`);
    assert(state.milestones.pending === 1, `pending is ${state.milestones.pending}`);
  } finally { rmDir(tmp); }
});

test('loadProjectState: has settings property', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const state = pm.loadProjectState(tmp);
    assert(state.settings !== null && typeof state.settings === 'object', 'settings missing');
    assert(state.settings.enabled === true, 'settings.enabled not true');
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// 3. checkMilestones
// ═══════════════════════════════════════════════════════════════════

test('checkMilestones: returns empty when no milestones', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = pm.checkMilestones(tmp);
    assert(Array.isArray(result.milestones), 'milestones not array');
    assert(result.milestones.length === 0, 'should be empty');
    assert(result.summary === 'No milestones defined', `summary is "${result.summary}"`);
  } finally { rmDir(tmp); }
});

test('checkMilestones: evaluates health_score criterion — met', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'), 'health_score: 90\n');
    writeFile(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
      'milestones:\n  - name: Alpha\n    criteria:\n      - health_score >= 80\n');
    const result = pm.checkMilestones(tmp);
    assert(result.milestones.length === 1, 'should have 1 milestone');
    assert(result.milestones[0].overall === true, 'should be met');
    assert(result.milestones[0].percentage === 100, `percentage is ${result.milestones[0].percentage}`);
  } finally { rmDir(tmp); }
});

test('checkMilestones: evaluates health_score criterion — not met', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'), 'health_score: 50\n');
    writeFile(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
      'milestones:\n  - name: Alpha\n    criteria:\n      - health_score >= 80\n');
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].overall === false, 'should not be met');
    assert(result.milestones[0].percentage === 0, `percentage is ${result.milestones[0].percentage}`);
  } finally { rmDir(tmp); }
});

test('checkMilestones: evaluates zero_critical_gaps — no gaps', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'decisions'));
    writeFile(path.join(tmp, '.ezra', 'decisions', 'dec-001.yaml'), 'severity: low\nstatus: approved\n');
    writeFile(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
      'milestones:\n  - name: Clean\n    criteria:\n      - zero_critical_gaps\n');
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].overall === true, 'should be met (no critical gaps)');
  } finally { rmDir(tmp); }
});

test('checkMilestones: evaluates zero_critical_gaps — has gaps', () => {
  const tmp = makeTempDir();
  try {
    writeFile(path.join(tmp, '.ezra', 'decisions', 'dec-001.yaml'), 'severity: critical\nstatus: pending\n');
    writeFile(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
      'milestones:\n  - name: Clean\n    criteria:\n      - zero_critical_gaps\n');
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].overall === false, 'should not be met (has critical gaps)');
  } finally { rmDir(tmp); }
});

test('checkMilestones: evaluates all_p1_tasks_done — all done', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    writeFile(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
      'tasks:\n  - id: t1\n    priority: p1\n    status: done\n  - id: t2\n    priority: p1\n    status: done\n');
    writeFile(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
      'milestones:\n  - name: P1Done\n    criteria:\n      - all_p1_tasks_done\n');
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].overall === true, 'should be met');
  } finally { rmDir(tmp); }
});

test('checkMilestones: evaluates all_p1_tasks_done — not all done', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    writeFile(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
      'tasks:\n  - id: t1\n    priority: p1\n    status: done\n  - id: t2\n    priority: p1\n    status: active\n');
    writeFile(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
      'milestones:\n  - name: P1Done\n    criteria:\n      - all_p1_tasks_done\n');
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].overall === false, 'should not be met');
  } finally { rmDir(tmp); }
});

test('checkMilestones: multiple criteria — partial', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'), 'health_score: 90\n');
    writeFile(path.join(tmp, '.ezra', 'decisions', 'dec-001.yaml'), 'severity: critical\nstatus: pending\n');
    writeFile(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
      'milestones:\n  - name: Multi\n    criteria:\n      - health_score >= 80\n      - zero_critical_gaps\n');
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].overall === false, 'overall should be false');
    assert(result.milestones[0].percentage === 50, `percentage is ${result.milestones[0].percentage}`);
    assert(result.milestones[0].met[0] === true, 'health criterion should be met');
    assert(result.milestones[0].met[1] === false, 'gaps criterion should not be met');
  } finally { rmDir(tmp); }
});

test('checkMilestones: summary shows counts', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'), 'health_score: 90\n');
    writeFile(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
      'milestones:\n  - name: M1\n    criteria:\n      - health_score >= 80\n  - name: M2\n    criteria:\n      - health_score >= 95\n');
    const result = pm.checkMilestones(tmp);
    assert(result.summary === '1/2 milestones completed', `summary is "${result.summary}"`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// 4. detectStalls
// ═══════════════════════════════════════════════════════════════════

test('detectStalls: no tasks returns not stalled', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = pm.detectStalls(tmp);
    assert(result.stalled === false, 'should not be stalled');
    assert(result.message === 'No tasks tracked', `message is "${result.message}"`);
  } finally { rmDir(tmp); }
});

test('detectStalls: recent task not stalled', () => {
  const tmp = makeTempDir();
  try {
    const now = new Date().toISOString();
    writeFile(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
      `tasks:\n  - id: t1\n    status: active\n    updated: ${now}\n`);
    const result = pm.detectStalls(tmp, 30);
    assert(result.stalled === false, 'should not be stalled');
    assert(result.minutesSinceActivity <= 1, `minutes is ${result.minutesSinceActivity}`);
  } finally { rmDir(tmp); }
});

test('detectStalls: old task is stalled', () => {
  const tmp = makeTempDir();
  try {
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 60 min ago
    writeFile(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
      `tasks:\n  - id: t1\n    description: old task\n    status: active\n    updated: ${old}\n`);
    const result = pm.detectStalls(tmp, 30);
    assert(result.stalled === true, 'should be stalled');
    assert(result.stalledTask === 'old task', `stalledTask is "${result.stalledTask}"`);
    assert(result.minutesSinceActivity >= 59, `minutes is ${result.minutesSinceActivity}`);
  } finally { rmDir(tmp); }
});

test('detectStalls: uses custom threshold', () => {
  const tmp = makeTempDir();
  try {
    const recent = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    writeFile(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
      `tasks:\n  - id: t1\n    status: active\n    updated: ${recent}\n`);
    const result5 = pm.detectStalls(tmp, 5);
    assert(result5.stalled === true, 'should be stalled with 5min threshold');
    const result60 = pm.detectStalls(tmp, 60);
    assert(result60.stalled === false, 'should not be stalled with 60min threshold');
  } finally { rmDir(tmp); }
});

test('detectStalls: tasks without timestamps', () => {
  const tmp = makeTempDir();
  try {
    writeFile(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
      'tasks:\n  - id: t1\n    status: active\n');
    const result = pm.detectStalls(tmp);
    assert(result.stalled === false, 'should not be stalled');
    assert(result.message === 'No timestamps on tasks', `message is "${result.message}"`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// 5. calculateHealthTrend
// ═══════════════════════════════════════════════════════════════════

test('calculateHealthTrend: no scans returns stable', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = pm.calculateHealthTrend(tmp);
    assert(result.trend === 'stable', `trend is "${result.trend}"`);
    assert(result.scores.length === 0, 'scores should be empty');
    assert(result.current === null, 'current should be null');
  } finally { rmDir(tmp); }
});

test('calculateHealthTrend: single scan', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'), 'health_score: 80\n');
    const result = pm.calculateHealthTrend(tmp);
    assert(result.scores.length === 1, 'should have 1 score');
    assert(result.current === 80, `current is ${result.current}`);
    assert(result.delta === 0, `delta is ${result.delta}`);
    assert(result.trend === 'stable', `trend is "${result.trend}"`);
  } finally { rmDir(tmp); }
});

test('calculateHealthTrend: improving trend', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'), 'health_score: 70\n');
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-02.yaml'), 'health_score: 80\n');
    const result = pm.calculateHealthTrend(tmp);
    assert(result.trend === 'improving', `trend is "${result.trend}"`);
    assert(result.delta === 10, `delta is ${result.delta}`);
    assert(result.current === 80, `current is ${result.current}`);
    assert(result.previous === 70, `previous is ${result.previous}`);
  } finally { rmDir(tmp); }
});

test('calculateHealthTrend: declining trend', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'), 'health_score: 90\n');
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-02.yaml'), 'health_score: 75\n');
    const result = pm.calculateHealthTrend(tmp);
    assert(result.trend === 'declining', `trend is "${result.trend}"`);
    assert(result.delta === -15, `delta is ${result.delta}`);
  } finally { rmDir(tmp); }
});

test('calculateHealthTrend: stable within tolerance', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'), 'health_score: 80\n');
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-02.yaml'), 'health_score: 81\n');
    const result = pm.calculateHealthTrend(tmp);
    assert(result.trend === 'stable', `trend is "${result.trend}" (delta ${result.delta} should be stable)`);
  } finally { rmDir(tmp); }
});

test('calculateHealthTrend: respects lastN parameter', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    for (let i = 1; i <= 20; i++) {
      const d = String(i).padStart(2, '0');
      writeFile(path.join(tmp, '.ezra', 'scans', `2024-01-${d}.yaml`), `health_score: ${60 + i}\n`);
    }
    const result = pm.calculateHealthTrend(tmp, 5);
    assert(result.scores.length === 5, `scores length is ${result.scores.length}`);
    assert(result.current === 80, `current is ${result.current}`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// 6. checkEscalation
// ═══════════════════════════════════════════════════════════════════

test('checkEscalation: no failures — no escalation', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = pm.checkEscalation(tmp, 0);
    assert(result.escalate === false, 'should not escalate');
    assert(result.count === 0, `count is ${result.count}`);
    assert(result.reason === null, 'reason should be null');
  } finally { rmDir(tmp); }
});

test('checkEscalation: below threshold — no escalation', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = pm.checkEscalation(tmp, 2);
    assert(result.escalate === false, 'should not escalate');
    assert(result.threshold === 3, `threshold is ${result.threshold}`);
  } finally { rmDir(tmp); }
});

test('checkEscalation: at threshold — escalate', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = pm.checkEscalation(tmp, 3);
    assert(result.escalate === true, 'should escalate');
    assert(result.count === 3, `count is ${result.count}`);
    assert(typeof result.reason === 'string', 'reason should be a string');
    assert(result.reason.includes('3'), 'reason should include count');
  } finally { rmDir(tmp); }
});

test('checkEscalation: above threshold — escalate', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = pm.checkEscalation(tmp, 5);
    assert(result.escalate === true, 'should escalate');
  } finally { rmDir(tmp); }
});

test('checkEscalation: returns history array', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = pm.checkEscalation(tmp, 1);
    assert(Array.isArray(result.history), 'history should be array');
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// 7. generateProgressReport
// ═══════════════════════════════════════════════════════════════════

test('generateProgressReport: returns complete structure', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    writeFile(path.join(tmp, '.ezra', 'governance.yaml'), 'project: TestProject\nphase: beta\n');
    const report = pm.generateProgressReport(tmp);
    assert(report.generated !== undefined, 'missing generated');
    assert(report.project === 'TestProject', `project is "${report.project}"`);
    assert(report.phase === 'beta', `phase is "${report.phase}"`);
    assert(typeof report.completion === 'number', 'completion not number');
    assert(report.health !== undefined, 'missing health');
    assert(report.tasks !== undefined, 'missing tasks');
    assert(report.milestones !== undefined, 'missing milestones');
    assert(report.stalls !== undefined, 'missing stalls');
    assert(report.decisions !== undefined, 'missing decisions');
    assert(report.settings !== undefined, 'missing settings');
  } finally { rmDir(tmp); }
});

test('generateProgressReport: calculates completion percentage', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    writeFile(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
      'tasks:\n  - id: t1\n    status: done\n  - id: t2\n    status: done\n  - id: t3\n    status: active\n  - id: t4\n    status: pending\n');
    const report = pm.generateProgressReport(tmp);
    assert(report.completion === 50, `completion is ${report.completion}`);
  } finally { rmDir(tmp); }
});

test('generateProgressReport: completion 0 when no tasks', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const report = pm.generateProgressReport(tmp);
    assert(report.completion === 0, `completion is ${report.completion}`);
  } finally { rmDir(tmp); }
});

test('generateProgressReport: includes health trend', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'), 'health_score: 70\n');
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-02.yaml'), 'health_score: 85\n');
    const report = pm.generateProgressReport(tmp);
    assert(report.health.score === 85, `score is ${report.health.score}`);
    assert(report.health.trend === 'improving', `trend is ${report.health.trend}`);
    assert(report.health.delta === 15, `delta is ${report.health.delta}`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// 8. generateDailyReport
// ═══════════════════════════════════════════════════════════════════

test('generateDailyReport: produces valid output', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    writeFile(path.join(tmp, '.ezra', 'governance.yaml'), 'project: DailyTest\nphase: alpha\n');
    const daily = pm.generateDailyReport(tmp);
    assert(daily.date !== undefined, 'missing date');
    assert(daily.generated !== undefined, 'missing generated');
    assert(daily.project === 'DailyTest', `project is "${daily.project}"`);
    assert(daily.phase === 'alpha', `phase is "${daily.phase}"`);
    assert(typeof daily.completion === 'number', 'completion not number');
  } finally { rmDir(tmp); }
});

test('generateDailyReport: writes report file', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const daily = pm.generateDailyReport(tmp);
    const reportPath = path.join(tmp, '.ezra', 'progress', 'reports', `daily-${daily.date}.yaml`);
    assert(fs.existsSync(reportPath), 'report file not created');
    const content = fs.readFileSync(reportPath, 'utf8');
    assert(content.includes('date:'), 'report missing date field');
  } finally { rmDir(tmp); }
});

test('generateDailyReport: counts tasks done today', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const today = new Date().toISOString().slice(0, 10);
    writeFile(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
      `tasks:\n  - id: t1\n    status: done\n    updated: ${today}T10:00:00.000Z\n  - id: t2\n    status: done\n    updated: 2023-01-01T10:00:00.000Z\n`);
    const daily = pm.generateDailyReport(tmp);
    assert(daily.tasks_done_today === 1, `tasks_done_today is ${daily.tasks_done_today}`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// 9. updateProgress
// ═══════════════════════════════════════════════════════════════════

test('updateProgress: creates new task', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = pm.updateProgress(tmp, 'Build feature X', 'pending');
    assert(result.action === 'created', `action is "${result.action}"`);
    assert(result.description === 'Build feature X', `desc is "${result.description}"`);
    assert(result.status === 'pending', `status is "${result.status}"`);
    // Verify file was written
    const tasksPath = path.join(tmp, '.ezra', 'progress', 'tasks.yaml');
    assert(fs.existsSync(tasksPath), 'tasks.yaml not created');
    const content = fs.readFileSync(tasksPath, 'utf8');
    assert(content.includes('Build feature X'), 'task not in file');
  } finally { rmDir(tmp); }
});

test('updateProgress: updates existing task', () => {
  const tmp = makeTempDir();
  try {
    writeFile(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
      'tasks:\n  - id: task-1\n    description: Build feature X\n    status: pending\n    priority: p2\n    created: 2024-01-01T00:00:00.000Z\n    updated: 2024-01-01T00:00:00.000Z\n');
    const result = pm.updateProgress(tmp, 'Build feature X', 'done');
    assert(result.action === 'updated', `action is "${result.action}"`);
    assert(result.status === 'done', `status is "${result.status}"`);
    // Verify in file
    const content = fs.readFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'), 'utf8');
    assert(content.includes('status: done'), 'status not updated in file');
  } finally { rmDir(tmp); }
});

test('updateProgress: adds multiple tasks', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    pm.updateProgress(tmp, 'Task A', 'pending');
    pm.updateProgress(tmp, 'Task B', 'active');
    pm.updateProgress(tmp, 'Task C', 'done');
    const content = fs.readFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'), 'utf8');
    assert(content.includes('Task A'), 'missing Task A');
    assert(content.includes('Task B'), 'missing Task B');
    assert(content.includes('Task C'), 'missing Task C');
  } finally { rmDir(tmp); }
});

test('updateProgress: default status is pending', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = pm.updateProgress(tmp, 'Default task');
    assert(result.status === 'pending', `status is "${result.status}"`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// 10. Hook Protocol
// ═══════════════════════════════════════════════════════════════════

test('ezra-pm.js: hook protocol outputs JSON via stdin', () => {
  const hookPath = path.resolve(__dirname, '..', 'hooks', 'ezra-pm.js');
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    writeFile(path.join(tmp, '.ezra', 'governance.yaml'), 'project: HookTest\n');
    const input = JSON.stringify({ cwd: tmp });
    const output = execSync(`echo ${JSON.stringify(input)} | node "${hookPath}"`, {
      encoding: 'utf8',
      timeout: 10000,
      shell: true,
    });
    const parsed = JSON.parse(output.trim());
    assert(parsed.project === 'HookTest', `project is "${parsed.project}"`);
    assert(parsed.generated !== undefined, 'missing generated');
  } finally { rmDir(tmp); }
});

test('ezra-pm.js: hook exits 0 on invalid input', () => {
  const hookPath = path.resolve(__dirname, '..', 'hooks', 'ezra-pm.js');
  try {
    const output = execSync(`echo "not-json" | node "${hookPath}"`, {
      encoding: 'utf8',
      timeout: 10000,
      shell: true,
    });
    assert(output.trim() === '{}', `output is "${output.trim()}"`);
  } catch (err) {
    // Should not throw — exit 0 expected
    assert(false, `Hook threw: ${err.message}`);
  }
});

test('ezra-progress-hook.js: hook protocol outputs correct structure', () => {
  const hookPath = path.resolve(__dirname, '..', 'hooks', 'ezra-progress-hook.js');
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const input = JSON.stringify({
      cwd: tmp,
      tool_name: 'Write',
      tool_input: { file_path: '/test/file.js' },
    });
    const output = execSync(`echo ${JSON.stringify(input)} | node "${hookPath}"`, {
      encoding: 'utf8',
      timeout: 10000,
      shell: true,
    });
    const parsed = JSON.parse(output.trim());
    assert(parsed.hookSpecificOutput !== undefined, 'missing hookSpecificOutput');
    assert(parsed.hookSpecificOutput.hookEventName === 'PostToolUse', `event is "${parsed.hookSpecificOutput.hookEventName}"`);
    assert(parsed.hookSpecificOutput.permissionDecision === 'allow', `decision is "${parsed.hookSpecificOutput.permissionDecision}"`);
  } finally { rmDir(tmp); }
});

test('ezra-progress-hook.js: hook exits 0 on invalid input', () => {
  const hookPath = path.resolve(__dirname, '..', 'hooks', 'ezra-progress-hook.js');
  try {
    const output = execSync(`echo "not-json" | node "${hookPath}"`, {
      encoding: 'utf8',
      timeout: 10000,
      shell: true,
    });
    const parsed = JSON.parse(output.trim());
    assert(parsed.hookSpecificOutput.permissionDecision === 'allow', 'should allow on error');
  } catch (err) {
    assert(false, `Hook threw: ${err.message}`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 11. Progress Hook Module
// ═══════════════════════════════════════════════════════════════════

test('progressHook: hookOutput returns correct structure', () => {
  const result = progressHook.hookOutput();
  assert(result.hookSpecificOutput.hookEventName === 'PostToolUse', 'wrong event name');
  assert(result.hookSpecificOutput.permissionDecision === 'allow', 'wrong decision');
});

test('progressHook: hookOutput with extra data', () => {
  const result = progressHook.hookOutput({ tracked: true });
  assert(result.hookSpecificOutput.progress.tracked === true, 'extra data not included');
});

test('progressHook: parseCheckInterval with string', () => {
  assert(progressHook.parseCheckInterval('every_5_tasks') === 5, 'every_5_tasks failed');
  assert(progressHook.parseCheckInterval('every_10_tasks') === 10, 'every_10_tasks failed');
  assert(progressHook.parseCheckInterval('every_1_tasks') === 1, 'every_1_tasks failed');
});

test('progressHook: parseCheckInterval with number', () => {
  assert(progressHook.parseCheckInterval(7) === 7, 'number 7 failed');
  assert(progressHook.parseCheckInterval(1) === 1, 'number 1 failed');
});

test('progressHook: parseCheckInterval with unknown string defaults to 5', () => {
  assert(progressHook.parseCheckInterval('unknown') === 5, 'unknown should default to 5');
});

test('progressHook: logActivity creates file and appends', () => {
  const tmp = makeTempDir();
  try {
    const logPath = path.join(tmp, 'activity.log');
    progressHook.logActivity(logPath, '/test/file.js', 'Write');
    assert(fs.existsSync(logPath), 'log file not created');
    const content = fs.readFileSync(logPath, 'utf8');
    assert(content.includes('/test/file.js'), 'file path not logged');
    assert(content.includes('Write'), 'tool name not logged');
    // Append another
    progressHook.logActivity(logPath, '/test/file2.js', 'Edit');
    const content2 = fs.readFileSync(logPath, 'utf8');
    assert(content2.includes('/test/file2.js'), 'second entry not logged');
  } finally { rmDir(tmp); }
});

test('progressHook: getActivityCount returns line count', () => {
  const tmp = makeTempDir();
  try {
    const logPath = path.join(tmp, 'activity.log');
    assert(progressHook.getActivityCount(logPath) === 0, 'should be 0 for non-existent');
    fs.writeFileSync(logPath, 'line1\nline2\nline3\n', 'utf8');
    assert(progressHook.getActivityCount(logPath) === 3, `count is ${progressHook.getActivityCount(logPath)}`);
  } finally { rmDir(tmp); }
});

test('progressHook: processEvent returns hookOutput for no .ezra/', () => {
  const tmp = makeTempDir();
  try {
    const result = progressHook.processEvent({ cwd: tmp, tool_input: { file_path: '/test.js' } });
    assert(result.hookSpecificOutput.permissionDecision === 'allow', 'should allow');
  } finally { rmDir(tmp); }
});

test('progressHook: processEvent tracks file change', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = progressHook.processEvent({
      cwd: tmp,
      tool_name: 'Write',
      tool_input: { file_path: '/src/index.js' },
    });
    assert(result.hookSpecificOutput.permissionDecision === 'allow', 'should allow');
    assert(result.hookSpecificOutput.progress.tracked === true, 'should be tracked');
    // Check activity log was created
    const logPath = path.join(tmp, '.ezra', 'progress', 'activity.log');
    assert(fs.existsSync(logPath), 'activity log not created');
  } finally { rmDir(tmp); }
});

test('progressHook: processEvent handles missing file_path', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const result = progressHook.processEvent({ cwd: tmp, tool_input: {} });
    assert(result.hookSpecificOutput.permissionDecision === 'allow', 'should allow');
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// 12. Edge Cases
// ═══════════════════════════════════════════════════════════════════

test('Edge: loadProjectState with empty .ezra/ directory', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const state = pm.loadProjectState(tmp);
    assert(state.exists === true, 'should exist');
    assert(state.project === null, 'project should be null');
    assert(state.health_score === null, 'health_score should be null');
    assert(state.tasks.total === 0, 'no tasks');
    assert(state.milestones.total === 0, 'no milestones');
  } finally { rmDir(tmp); }
});

test('Edge: checkMilestones with empty milestones file', () => {
  const tmp = makeTempDir();
  try {
    writeFile(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'), '');
    const result = pm.checkMilestones(tmp);
    assert(result.milestones.length === 0, 'should be empty');
  } finally { rmDir(tmp); }
});

test('Edge: calculateHealthTrend with non-yaml files in scans/', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra', 'scans'));
    writeFile(path.join(tmp, '.ezra', 'scans', 'readme.txt'), 'not yaml');
    writeFile(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'), 'health_score: 85\n');
    const result = pm.calculateHealthTrend(tmp);
    assert(result.scores.length === 1, `scores length is ${result.scores.length}`);
    assert(result.current === 85, `current is ${result.current}`);
  } finally { rmDir(tmp); }
});

test('Edge: detectStalls with corrupted tasks.yaml', () => {
  const tmp = makeTempDir();
  try {
    writeFile(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'), '{{invalid yaml');
    const result = pm.detectStalls(tmp);
    assert(result.stalled === false, 'should not crash');
  } finally { rmDir(tmp); }
});

test('Edge: updateProgress creates .ezra/progress/ if missing', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    pm.updateProgress(tmp, 'New task', 'pending');
    assert(fs.existsSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml')), 'should create dir and file');
  } finally { rmDir(tmp); }
});

test('Edge: generateDailyReport creates reports/ if missing', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    const daily = pm.generateDailyReport(tmp);
    const reportsDir = path.join(tmp, '.ezra', 'progress', 'reports');
    assert(fs.existsSync(reportsDir), 'reports dir should be created');
  } finally { rmDir(tmp); }
});

test('Edge: loadProjectState with governance using name field', () => {
  const tmp = makeTempDir();
  try {
    writeFile(path.join(tmp, '.ezra', 'governance.yaml'), 'name: AltProject\n');
    const state = pm.loadProjectState(tmp);
    assert(state.project === 'AltProject', `project is "${state.project}"`);
  } finally { rmDir(tmp); }
});

test('Edge: checkMilestones with unknown criterion', () => {
  const tmp = makeTempDir();
  try {
    ensureDir(path.join(tmp, '.ezra'));
    writeFile(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
      'milestones:\n  - name: Unknown\n    criteria:\n      - some_weird_criterion\n');
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].met[0] === false, 'unknown criterion should be not met');
    assert(result.milestones[0].overall === false, 'overall should be false');
  } finally { rmDir(tmp); }
});

// Settings integration tests

test('Settings: DEFAULTS has project_manager section', () => {
  assert(settings.DEFAULTS.project_manager !== undefined, 'project_manager missing from DEFAULTS');
  assert(settings.DEFAULTS.project_manager.enabled === true, 'enabled not true');
  assert(settings.DEFAULTS.project_manager.mode === 'hybrid', `mode is "${settings.DEFAULTS.project_manager.mode}"`);
  assert(settings.DEFAULTS.project_manager.escalation_threshold === 3, 'threshold wrong');
  assert(settings.DEFAULTS.project_manager.stall_detection === 30, 'stall_detection wrong');
});

test('Settings: getProjectManager accessor exists and works', () => {
  assert(typeof settings.getProjectManager === 'function', 'getProjectManager not a function');
  const tmp = makeTempDir();
  try {
    const pmSettings = settings.getProjectManager(tmp);
    assert(pmSettings.enabled === true, 'enabled not true');
    assert(pmSettings.mode === 'hybrid', `mode is "${pmSettings.mode}"`);
    assert(pmSettings.check_interval === 'every_5_tasks', `check_interval is "${pmSettings.check_interval}"`);
  } finally { rmDir(tmp); }
});

test('Settings: getProjectManager merges user settings', () => {
  const tmp = makeTempDir();
  try {
    writeFile(path.join(tmp, '.ezra', 'settings.yaml'),
      'project_manager:\n  stall_detection: 60\n  escalation_threshold: 5\n');
    const pmSettings = settings.getProjectManager(tmp);
    assert(pmSettings.stall_detection === 60, `stall_detection is ${pmSettings.stall_detection}`);
    assert(pmSettings.escalation_threshold === 5, `threshold is ${pmSettings.escalation_threshold}`);
    assert(pmSettings.enabled === true, 'enabled should still be true (from defaults)');
  } finally { rmDir(tmp); }
});

// Module exports tests

test('ezra-pm.js: has all 9 expected exports', () => {
  const expectedExports = [
    'loadProjectState', 'checkMilestones', 'detectStalls',
    'generateProgressReport', 'calculateHealthTrend', 'checkEscalation',
    'generateDailyReport', 'updateProgress', 'PM_DEFAULTS',
  ];
  for (const exp of expectedExports) {
    assert(pm[exp] !== undefined, `Missing export: ${exp}`);
  }
});

test('ezra-progress-hook.js: has expected exports', () => {
  const expectedExports = ['processEvent', 'hookOutput', 'parseCheckInterval', 'getActivityCount', 'logActivity'];
  for (const exp of expectedExports) {
    assert(progressHook[exp] !== undefined, `Missing export: ${exp}`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════

console.log(`\n  V6-PM: PASSED: ${passed}  FAILED: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
