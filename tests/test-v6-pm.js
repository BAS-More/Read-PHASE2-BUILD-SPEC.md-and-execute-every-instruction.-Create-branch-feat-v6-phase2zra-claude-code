#!/usr/bin/env node
'use strict';

/**
 * EZRA V6 Project Manager Tests
 *
 * Comprehensive tests for:
 * - PM_DEFAULTS validation
 * - loadProjectState
 * - checkMilestones
 * - detectStalls
 * - calculateHealthTrend
 * - checkEscalation
 * - generateProgressReport
 * - generateDailyReport
 * - updateProgress
 * - Hook protocol (stdin → stdout → exit 0)
 * - Progress hook module (processEvent, hookOutput, etc.)
 * - Edge cases & settings integration
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

// ═══════════════════════════════════════════════════════════════════
// PM_DEFAULTS Tests
// ═══════════════════════════════════════════════════════════════════

test('PM_DEFAULTS is object', () => {
  assert(typeof pm.PM_DEFAULTS === 'object', 'not object');
  assert(!Array.isArray(pm.PM_DEFAULTS), 'is array');
});

test('PM_DEFAULTS.enabled is true', () => {
  assert(pm.PM_DEFAULTS.enabled === true, 'not true');
});

test('PM_DEFAULTS.mode is hybrid', () => {
  assert(pm.PM_DEFAULTS.mode === 'hybrid', `got ${pm.PM_DEFAULTS.mode}`);
});

test('PM_DEFAULTS.routine_checks is rule-based', () => {
  assert(pm.PM_DEFAULTS.routine_checks === 'rule-based', `got ${pm.PM_DEFAULTS.routine_checks}`);
});

test('PM_DEFAULTS.complex_decisions is ai', () => {
  assert(pm.PM_DEFAULTS.complex_decisions === 'ai', `got ${pm.PM_DEFAULTS.complex_decisions}`);
});

test('PM_DEFAULTS.ai_provider is claude', () => {
  assert(pm.PM_DEFAULTS.ai_provider === 'claude', `got ${pm.PM_DEFAULTS.ai_provider}`);
});

test('PM_DEFAULTS.check_interval is every_5_tasks', () => {
  assert(pm.PM_DEFAULTS.check_interval === 'every_5_tasks', `got ${pm.PM_DEFAULTS.check_interval}`);
});

test('PM_DEFAULTS.escalation_threshold is 3', () => {
  assert(pm.PM_DEFAULTS.escalation_threshold === 3, `got ${pm.PM_DEFAULTS.escalation_threshold}`);
});

test('PM_DEFAULTS.stall_detection is 30', () => {
  assert(pm.PM_DEFAULTS.stall_detection === 30, `got ${pm.PM_DEFAULTS.stall_detection}`);
});

test('PM_DEFAULTS.daily_report is true', () => {
  assert(pm.PM_DEFAULTS.daily_report === true, `got ${pm.PM_DEFAULTS.daily_report}`);
});

test('PM_DEFAULTS.weekly_report is true', () => {
  assert(pm.PM_DEFAULTS.weekly_report === true, `got ${pm.PM_DEFAULTS.weekly_report}`);
});

test('PM_DEFAULTS.milestones is empty array', () => {
  assert(Array.isArray(pm.PM_DEFAULTS.milestones), 'not array');
  assert(pm.PM_DEFAULTS.milestones.length === 0, 'not empty');
});

test('PM_DEFAULTS has exactly 11 keys', () => {
  const keys = Object.keys(pm.PM_DEFAULTS);
  assert(keys.length === 11, `Expected 11 keys, got ${keys.length}: ${keys.join(', ')}`);
});

// ═══════════════════════════════════════════════════════════════════
// loadProjectState Tests
// ═══════════════════════════════════════════════════════════════════

test('loadProjectState: no .ezra dir', () => {
  const tmp = makeTempDir();
  try {
    const state = pm.loadProjectState(tmp);
    assert(state.exists === false, 'should not exist');
    assert(state.project === null, 'project not null');
    assert(state.tasks.total === 0, 'tasks not 0');
  } finally { rmDir(tmp); }
});

test('loadProjectState: empty .ezra dir', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    const state = pm.loadProjectState(tmp);
    assert(state.exists === true, 'should exist');
    assert(state.health_score === null, 'health not null');
  } finally { rmDir(tmp); }
});

test('loadProjectState: reads governance.yaml', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'governance.yaml'),
    'project: TestProject\nphase: alpha\n', 'utf8');
  try {
    const state = pm.loadProjectState(tmp);
    assert(state.project === 'TestProject', `got ${state.project}`);
    assert(state.phase === 'alpha', `got ${state.phase}`);
  } finally { rmDir(tmp); }
});

test('loadProjectState: reads scan files', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'scans'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'),
    'health_score: 85\n', 'utf8');
  try {
    const state = pm.loadProjectState(tmp);
    assert(state.health_score === 85, `got ${state.health_score}`);
    assert(state.last_scan === '2024-01-01', `got ${state.last_scan}`);
  } finally { rmDir(tmp); }
});

test('loadProjectState: reads decisions', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'decisions'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'decisions', 'dec-1.yaml'),
    'status: approved\n', 'utf8');
  fs.writeFileSync(path.join(tmp, '.ezra', 'decisions', 'dec-2.yaml'),
    'status: pending\n', 'utf8');
  try {
    const state = pm.loadProjectState(tmp);
    assert(state.decisions.total === 2, `got ${state.decisions.total}`);
    assert(state.decisions.approved === 1, `got ${state.decisions.approved}`);
    assert(state.decisions.pending === 1, `got ${state.decisions.pending}`);
  } finally { rmDir(tmp); }
});

test('loadProjectState: reads tasks', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
    'tasks:\n  - id: task-1\n    status: done\n  - id: task-2\n    status: active\n  - id: task-3\n    status: pending\n', 'utf8');
  try {
    const state = pm.loadProjectState(tmp);
    assert(state.tasks.total === 3, `got ${state.tasks.total}`);
    assert(state.tasks.done === 1, `got ${state.tasks.done}`);
    assert(state.tasks.active === 1, `got ${state.tasks.active}`);
    assert(state.tasks.pending === 1, `got ${state.tasks.pending}`);
  } finally { rmDir(tmp); }
});

test('loadProjectState: reads milestones', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
    'milestones:\n  - name: M1\n    completed: true\n  - name: M2\n    status: pending\n', 'utf8');
  try {
    const state = pm.loadProjectState(tmp);
    assert(state.milestones.total === 2, `got ${state.milestones.total}`);
    assert(state.milestones.completed === 1, `got ${state.milestones.completed}`);
    assert(state.milestones.pending === 1, `got ${state.milestones.pending}`);
  } finally { rmDir(tmp); }
});

test('loadProjectState: has settings', () => {
  const tmp = makeTempDir();
  try {
    const state = pm.loadProjectState(tmp);
    assert(state.settings !== null, 'no settings');
    assert(typeof state.settings === 'object', 'settings not object');
    assert(state.settings.enabled !== undefined, 'no enabled key');
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// checkMilestones Tests
// ═══════════════════════════════════════════════════════════════════

test('checkMilestones: no milestones file', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    const result = pm.checkMilestones(tmp);
    assert(result.milestones.length === 0, 'not empty');
    assert(result.summary === 'No milestones defined', `got ${result.summary}`);
  } finally { rmDir(tmp); }
});

test('checkMilestones: empty milestones', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
    'milestones:\n', 'utf8');
  try {
    const result = pm.checkMilestones(tmp);
    assert(result.summary === 'No milestones defined', `got ${result.summary}`);
  } finally { rmDir(tmp); }
});

test('checkMilestones: health_score criterion met', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  ensureDir(path.join(tmp, '.ezra', 'scans'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'),
    'health_score: 85\n', 'utf8');
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
    'milestones:\n  - name: Alpha\n    criteria: [health_score >= 80]\n', 'utf8');
  try {
    const result = pm.checkMilestones(tmp);
    assert(result.milestones.length === 1, `got ${result.milestones.length}`);
    assert(result.milestones[0].overall === true, 'not met');
    assert(result.milestones[0].percentage === 100, `got ${result.milestones[0].percentage}`);
  } finally { rmDir(tmp); }
});

test('checkMilestones: health_score criterion not met', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  ensureDir(path.join(tmp, '.ezra', 'scans'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'),
    'health_score: 50\n', 'utf8');
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
    'milestones:\n  - name: Alpha\n    criteria: [health_score >= 80]\n', 'utf8');
  try {
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].overall === false, 'should not be met');
  } finally { rmDir(tmp); }
});

test('checkMilestones: all_p1_tasks_done', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
    'tasks:\n  - id: t1\n    priority: p1\n    status: done\n  - id: t2\n    priority: p1\n    status: done\n', 'utf8');
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
    'milestones:\n  - name: Beta\n    criteria: [all_p1_tasks_done]\n', 'utf8');
  try {
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].overall === true, 'should be met');
  } finally { rmDir(tmp); }
});

test('checkMilestones: zero_critical_gaps met', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  ensureDir(path.join(tmp, '.ezra', 'decisions'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'decisions', 'dec-1.yaml'),
    'severity: low\nstatus: pending\n', 'utf8');
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
    'milestones:\n  - name: GA\n    criteria: [zero_critical_gaps]\n', 'utf8');
  try {
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].overall === true, 'should be met');
  } finally { rmDir(tmp); }
});

test('checkMilestones: zero_critical_gaps not met', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  ensureDir(path.join(tmp, '.ezra', 'decisions'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'decisions', 'dec-1.yaml'),
    'severity: critical\nstatus: pending\n', 'utf8');
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
    'milestones:\n  - name: GA\n    criteria: [zero_critical_gaps]\n', 'utf8');
  try {
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].overall === false, 'should not be met');
  } finally { rmDir(tmp); }
});

test('checkMilestones: summary format', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
    'milestones:\n  - name: M1\n    criteria: [health_score >= 0]\n  - name: M2\n    criteria: [health_score >= 999]\n', 'utf8');
  try {
    const result = pm.checkMilestones(tmp);
    assert(result.summary.includes('/2'), `got ${result.summary}`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// detectStalls Tests
// ═══════════════════════════════════════════════════════════════════

test('detectStalls: no tasks', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    const result = pm.detectStalls(tmp);
    assert(result.stalled === false, 'should not be stalled');
    assert(result.message === 'No tasks tracked', `got ${result.message}`);
  } finally { rmDir(tmp); }
});

test('detectStalls: recent activity', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
    `tasks:\n  - id: t1\n    status: active\n    updated: ${now}\n`, 'utf8');
  try {
    const result = pm.detectStalls(tmp, 30);
    assert(result.stalled === false, 'should not be stalled');
    assert(result.minutesSinceActivity < 5, `got ${result.minutesSinceActivity} minutes`);
  } finally { rmDir(tmp); }
});

test('detectStalls: old activity triggers stall', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  const old = new Date(Date.now() - 120 * 60000).toISOString(); // 2 hours ago
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
    `tasks:\n  - id: t1\n    status: active\n    updated: ${old}\n`, 'utf8');
  try {
    const result = pm.detectStalls(tmp, 30);
    assert(result.stalled === true, 'should be stalled');
    assert(result.minutesSinceActivity >= 60, `got ${result.minutesSinceActivity} minutes`);
    assert(result.stalledTask !== null, 'no stalled task');
  } finally { rmDir(tmp); }
});

test('detectStalls: no timestamps', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
    'tasks:\n  - id: t1\n    status: active\n', 'utf8');
  try {
    const result = pm.detectStalls(tmp);
    assert(result.stalled === false, 'should not stall');
    assert(result.message === 'No timestamps on tasks', `got ${result.message}`);
  } finally { rmDir(tmp); }
});

test('detectStalls: custom threshold', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  const tenMinAgo = new Date(Date.now() - 10 * 60000).toISOString();
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
    `tasks:\n  - id: t1\n    status: active\n    updated: ${tenMinAgo}\n`, 'utf8');
  try {
    const result = pm.detectStalls(tmp, 5);
    assert(result.stalled === true, 'should be stalled with 5min threshold');
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// calculateHealthTrend Tests
// ═══════════════════════════════════════════════════════════════════

test('calculateHealthTrend: no scans dir', () => {
  const tmp = makeTempDir();
  try {
    const result = pm.calculateHealthTrend(tmp);
    assert(result.trend === 'stable', `got ${result.trend}`);
    assert(result.scores.length === 0, 'not empty');
  } finally { rmDir(tmp); }
});

test('calculateHealthTrend: single scan', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'scans'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'),
    'health_score: 80\n', 'utf8');
  try {
    const result = pm.calculateHealthTrend(tmp);
    assert(result.current === 80, `got ${result.current}`);
    assert(result.delta === 0, `delta ${result.delta}`);
    assert(result.trend === 'stable', `got ${result.trend}`);
  } finally { rmDir(tmp); }
});

test('calculateHealthTrend: improving', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'scans'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'),
    'health_score: 60\n', 'utf8');
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-02.yaml'),
    'health_score: 80\n', 'utf8');
  try {
    const result = pm.calculateHealthTrend(tmp);
    assert(result.trend === 'improving', `got ${result.trend}`);
    assert(result.delta === 20, `delta ${result.delta}`);
    assert(result.previous === 60, `prev ${result.previous}`);
    assert(result.current === 80, `cur ${result.current}`);
  } finally { rmDir(tmp); }
});

test('calculateHealthTrend: declining', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'scans'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'),
    'health_score: 90\n', 'utf8');
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-02.yaml'),
    'health_score: 70\n', 'utf8');
  try {
    const result = pm.calculateHealthTrend(tmp);
    assert(result.trend === 'declining', `got ${result.trend}`);
    assert(result.delta === -20, `delta ${result.delta}`);
  } finally { rmDir(tmp); }
});

test('calculateHealthTrend: stable (small change)', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'scans'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'),
    'health_score: 80\n', 'utf8');
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-02.yaml'),
    'health_score: 81\n', 'utf8');
  try {
    const result = pm.calculateHealthTrend(tmp);
    assert(result.trend === 'stable', `got ${result.trend}`);
    assert(result.delta === 1, `delta ${result.delta}`);
  } finally { rmDir(tmp); }
});

test('calculateHealthTrend: respects lastN limit', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'scans'));
  for (let i = 1; i <= 20; i++) {
    const d = String(i).padStart(2, '0');
    fs.writeFileSync(path.join(tmp, '.ezra', 'scans', `2024-01-${d}.yaml`),
      `health_score: ${50 + i}\n`, 'utf8');
  }
  try {
    const result = pm.calculateHealthTrend(tmp, 5);
    assert(result.scores.length === 5, `got ${result.scores.length} scores`);
    assert(result.current === 70, `got ${result.current}`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// checkEscalation Tests
// ═══════════════════════════════════════════════════════════════════

test('checkEscalation: below threshold', () => {
  const tmp = makeTempDir();
  try {
    const result = pm.checkEscalation(tmp, 1);
    assert(result.escalate === false, 'should not escalate');
    assert(result.count === 1, `got ${result.count}`);
  } finally { rmDir(tmp); }
});

test('checkEscalation: at threshold', () => {
  const tmp = makeTempDir();
  try {
    const result = pm.checkEscalation(tmp, 3);
    assert(result.escalate === true, 'should escalate');
    assert(result.reason !== null, 'no reason');
  } finally { rmDir(tmp); }
});

test('checkEscalation: above threshold', () => {
  const tmp = makeTempDir();
  try {
    const result = pm.checkEscalation(tmp, 5);
    assert(result.escalate === true, 'should escalate');
    assert(result.count === 5, `got ${result.count}`);
  } finally { rmDir(tmp); }
});

test('checkEscalation: zero failures', () => {
  const tmp = makeTempDir();
  try {
    const result = pm.checkEscalation(tmp, 0);
    assert(result.escalate === false, 'should not escalate');
  } finally { rmDir(tmp); }
});

test('checkEscalation: has threshold from defaults', () => {
  const tmp = makeTempDir();
  try {
    const result = pm.checkEscalation(tmp, 0);
    assert(result.threshold === 3, `got ${result.threshold}`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// generateProgressReport Tests
// ═══════════════════════════════════════════════════════════════════

test('generateProgressReport: returns structured report', () => {
  const tmp = makeTempDir();
  try {
    const report = pm.generateProgressReport(tmp);
    assert(report.generated !== undefined, 'no generated');
    assert(report.completion !== undefined, 'no completion');
    assert(report.health !== undefined, 'no health');
    assert(report.tasks !== undefined, 'no tasks');
    assert(report.milestones !== undefined, 'no milestones');
    assert(report.stalls !== undefined, 'no stalls');
    assert(report.decisions !== undefined, 'no decisions');
  } finally { rmDir(tmp); }
});

test('generateProgressReport: calculates completion', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
    'tasks:\n  - id: t1\n    status: done\n  - id: t2\n    status: done\n  - id: t3\n    status: pending\n  - id: t4\n    status: active\n', 'utf8');
  try {
    const report = pm.generateProgressReport(tmp);
    assert(report.completion === 50, `got ${report.completion}`);
  } finally { rmDir(tmp); }
});

test('generateProgressReport: includes all sections', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'governance.yaml'),
    'project: TestProj\nphase: beta\n', 'utf8');
  try {
    const report = pm.generateProgressReport(tmp);
    assert(report.project === 'TestProj', `got ${report.project}`);
    assert(report.phase === 'beta', `got ${report.phase}`);
    assert(report.settings !== undefined, 'no settings');
  } finally { rmDir(tmp); }
});

test('generateProgressReport: 0% when no tasks', () => {
  const tmp = makeTempDir();
  try {
    const report = pm.generateProgressReport(tmp);
    assert(report.completion === 0, `got ${report.completion}`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// generateDailyReport Tests
// ═══════════════════════════════════════════════════════════════════

test('generateDailyReport: creates report file', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    const report = pm.generateDailyReport(tmp);
    const reportsDir = path.join(tmp, '.ezra', 'progress', 'reports');
    assert(fs.existsSync(reportsDir), 'reports dir not created');
    assert(report.date !== undefined, 'no date');
    const files = fs.readdirSync(reportsDir).filter(f => f.startsWith('daily-'));
    assert(files.length === 1, `expected 1 file, got ${files.length}`);
  } finally { rmDir(tmp); }
});

test('generateDailyReport: has required fields', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    const report = pm.generateDailyReport(tmp);
    assert(report.date !== undefined, 'no date');
    assert(report.generated !== undefined, 'no generated');
    assert(report.completion !== undefined, 'no completion');
    assert(report.milestones_summary !== undefined, 'no milestones_summary');
  } finally { rmDir(tmp); }
});

test('generateDailyReport: counts tasks done today', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
    `tasks:\n  - id: t1\n    status: done\n    updated: ${today}T10:00:00.000Z\n  - id: t2\n    status: done\n    updated: 2020-01-01T10:00:00.000Z\n`, 'utf8');
  try {
    const report = pm.generateDailyReport(tmp);
    assert(report.tasks_done_today === 1, `got ${report.tasks_done_today}`);
    assert(report.tasks_completed === 2, `got ${report.tasks_completed}`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// updateProgress Tests
// ═══════════════════════════════════════════════════════════════════

test('updateProgress: creates new task', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    const result = pm.updateProgress(tmp, 'Build feature X', 'active');
    assert(result.action === 'created', `got ${result.action}`);
    assert(result.status === 'active', `got ${result.status}`);
    assert(result.description === 'Build feature X', `got ${result.description}`);
    // Verify file was written
    const tasksPath = path.join(tmp, '.ezra', 'progress', 'tasks.yaml');
    assert(fs.existsSync(tasksPath), 'tasks.yaml not created');
  } finally { rmDir(tmp); }
});

test('updateProgress: updates existing task', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
    'tasks:\n  - id: task-1\n    description: Build feature X\n    status: pending\n    priority: p2\n    created: 2024-01-01T00:00:00.000Z\n    updated: 2024-01-01T00:00:00.000Z\n', 'utf8');
  try {
    const result = pm.updateProgress(tmp, 'Build feature X', 'done');
    assert(result.action === 'updated', `got ${result.action}`);
    assert(result.status === 'done', `got ${result.status}`);
  } finally { rmDir(tmp); }
});

test('updateProgress: default status is pending', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    const result = pm.updateProgress(tmp, 'New task');
    assert(result.status === 'pending', `got ${result.status}`);
  } finally { rmDir(tmp); }
});

test('updateProgress: multiple tasks', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    pm.updateProgress(tmp, 'Task A', 'active');
    pm.updateProgress(tmp, 'Task B', 'pending');
    pm.updateProgress(tmp, 'Task C', 'done');
    const tasksPath = path.join(tmp, '.ezra', 'progress', 'tasks.yaml');
    const content = fs.readFileSync(tasksPath, 'utf8');
    assert(content.includes('Task A'), 'no Task A');
    assert(content.includes('Task B'), 'no Task B');
    assert(content.includes('Task C'), 'no Task C');
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// Hook Protocol Tests (ezra-pm.js)
// ═══════════════════════════════════════════════════════════════════

test('PM hook: valid JSON input produces output', () => {
  const hookPath = path.resolve(__dirname, '..', 'hooks', 'ezra-pm.js');
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    const input = JSON.stringify({ cwd: tmp });
    const result = execSync(`echo ${JSON.stringify(input)} | node "${hookPath}"`, {
      encoding: 'utf8',
      timeout: 10000,
      shell: true,
    }).trim();
    const parsed = JSON.parse(result);
    assert(typeof parsed === 'object', 'not object');
    assert(parsed.completion !== undefined, 'no completion');
  } finally { rmDir(tmp); }
});

test('PM hook: empty JSON input exits 0', () => {
  const hookPath = path.resolve(__dirname, '..', 'hooks', 'ezra-pm.js');
  try {
    const result = execSync(`echo "{}" | node "${hookPath}"`, {
      encoding: 'utf8',
      timeout: 10000,
      shell: true,
    }).trim();
    const parsed = JSON.parse(result);
    assert(typeof parsed === 'object', 'not object');
  } catch (err) {
    assert(false, `hook exited non-zero: ${err.message}`);
  }
});

test('PM hook: invalid JSON exits 0', () => {
  const hookPath = path.resolve(__dirname, '..', 'hooks', 'ezra-pm.js');
  try {
    const result = execSync(`echo not_json | node "${hookPath}"`, {
      encoding: 'utf8',
      timeout: 10000,
      shell: true,
    }).trim();
    // Hook should exit 0 and produce valid JSON output
    const parsed = JSON.parse(result);
    assert(typeof parsed === 'object', `expected object, got: ${typeof parsed}`);
  } catch (err) {
    assert(false, `hook should exit 0: ${err.message}`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Progress Hook Module Tests
// ═══════════════════════════════════════════════════════════════════

test('progressHook: exports processEvent', () => {
  assert(typeof progressHook.processEvent === 'function', 'not function');
});

test('progressHook: exports hookOutput', () => {
  assert(typeof progressHook.hookOutput === 'function', 'not function');
});

test('progressHook: exports parseCheckInterval', () => {
  assert(typeof progressHook.parseCheckInterval === 'function', 'not function');
});

test('progressHook: exports getActivityCount', () => {
  assert(typeof progressHook.getActivityCount === 'function', 'not function');
});

test('progressHook: exports logActivity', () => {
  assert(typeof progressHook.logActivity === 'function', 'not function');
});

test('progressHook: hookOutput format', () => {
  const output = progressHook.hookOutput();
  assert(output.hookSpecificOutput !== undefined, 'no hookSpecificOutput');
  assert(output.hookSpecificOutput.hookEventName === 'PostToolUse', 'wrong event name');
  assert(output.hookSpecificOutput.permissionDecision === 'allow', 'not allow');
});

test('progressHook: hookOutput with extra', () => {
  const output = progressHook.hookOutput({ foo: 'bar' });
  assert(output.hookSpecificOutput.progress.foo === 'bar', 'extra not included');
});

test('progressHook: parseCheckInterval with number', () => {
  assert(progressHook.parseCheckInterval(10) === 10, 'number failed');
});

test('progressHook: parseCheckInterval with string', () => {
  assert(progressHook.parseCheckInterval('every_5_tasks') === 5, 'string failed');
  assert(progressHook.parseCheckInterval('every_10_tasks') === 10, '10 failed');
});

test('progressHook: parseCheckInterval default', () => {
  assert(progressHook.parseCheckInterval('unknown') === 5, 'default failed');
});

test('progressHook: processEvent no .ezra dir', () => {
  const tmp = makeTempDir();
  try {
    const result = progressHook.processEvent({ cwd: tmp, tool_input: { file_path: 'test.js' } });
    assert(result.hookSpecificOutput.permissionDecision === 'allow', 'not allow');
  } finally { rmDir(tmp); }
});

test('progressHook: processEvent with .ezra dir logs activity', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    const result = progressHook.processEvent({
      cwd: tmp,
      tool_input: { file_path: 'src/index.ts' },
      tool_name: 'Write',
    });
    assert(result.hookSpecificOutput.permissionDecision === 'allow', 'not allow');
    const activityPath = path.join(tmp, '.ezra', 'progress', 'activity.log');
    assert(fs.existsSync(activityPath), 'activity.log not created');
    const content = fs.readFileSync(activityPath, 'utf8');
    assert(content.includes('src/index.ts'), 'file not logged');
    assert(content.includes('Write'), 'tool not logged');
  } finally { rmDir(tmp); }
});

test('progressHook: processEvent no file_path', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    const result = progressHook.processEvent({ cwd: tmp, tool_input: {} });
    assert(result.hookSpecificOutput.permissionDecision === 'allow', 'not allow');
  } finally { rmDir(tmp); }
});

test('progressHook: getActivityCount empty', () => {
  assert(progressHook.getActivityCount('/nonexistent/path') === 0, 'not 0');
});

test('progressHook: getActivityCount with content', () => {
  const tmp = makeTempDir();
  const logPath = path.join(tmp, 'activity.log');
  fs.writeFileSync(logPath, 'line1\nline2\nline3\n', 'utf8');
  try {
    assert(progressHook.getActivityCount(logPath) === 3, 'not 3');
  } finally { rmDir(tmp); }
});

test('progressHook: logActivity creates file', () => {
  const tmp = makeTempDir();
  const logPath = path.join(tmp, 'sub', 'activity.log');
  try {
    progressHook.logActivity(logPath, 'test.js', 'Write');
    assert(fs.existsSync(logPath), 'file not created');
    const content = fs.readFileSync(logPath, 'utf8');
    assert(content.includes('test.js'), 'file not logged');
    assert(content.includes('Write'), 'tool not logged');
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// Hook Protocol Tests (ezra-progress-hook.js)
// ═══════════════════════════════════════════════════════════════════

test('Progress hook: stdin produces PostToolUse output', () => {
  const hookPath = path.resolve(__dirname, '..', 'hooks', 'ezra-progress-hook.js');
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  try {
    const input = JSON.stringify({ cwd: tmp, tool_input: { file_path: 'test.js' }, tool_name: 'Write' });
    const result = execSync(`echo ${JSON.stringify(input)} | node "${hookPath}"`, {
      encoding: 'utf8',
      timeout: 10000,
      shell: true,
    }).trim();
    const parsed = JSON.parse(result);
    assert(parsed.hookSpecificOutput.hookEventName === 'PostToolUse', 'wrong event name');
    assert(parsed.hookSpecificOutput.permissionDecision === 'allow', 'not allow');
  } finally { rmDir(tmp); }
});

test('Progress hook: invalid JSON exits 0', () => {
  const hookPath = path.resolve(__dirname, '..', 'hooks', 'ezra-progress-hook.js');
  try {
    const result = execSync(`echo not_json | node "${hookPath}"`, {
      encoding: 'utf8',
      timeout: 10000,
      shell: true,
    }).trim();
    const parsed = JSON.parse(result);
    assert(parsed.hookSpecificOutput.permissionDecision === 'allow', 'should allow');
  } catch (err) {
    assert(false, `hook should exit 0: ${err.message}`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Settings Integration Tests
// ═══════════════════════════════════════════════════════════════════

test('Settings: DEFAULTS has project_manager', () => {
  assert(settings.DEFAULTS.project_manager !== undefined, 'no project_manager');
  assert(typeof settings.DEFAULTS.project_manager === 'object', 'not object');
});

test('Settings: project_manager defaults match PM_DEFAULTS', () => {
  const settingsPM = settings.DEFAULTS.project_manager;
  assert(settingsPM.enabled === pm.PM_DEFAULTS.enabled, 'enabled mismatch');
  assert(settingsPM.mode === pm.PM_DEFAULTS.mode, 'mode mismatch');
  assert(settingsPM.escalation_threshold === pm.PM_DEFAULTS.escalation_threshold, 'threshold mismatch');
  assert(settingsPM.stall_detection === pm.PM_DEFAULTS.stall_detection, 'stall mismatch');
});

test('Settings: getProjectManager function exists', () => {
  assert(typeof settings.getProjectManager === 'function', 'not function');
});

test('Settings: getProjectManager returns defaults', () => {
  const tmp = makeTempDir();
  try {
    const result = settings.getProjectManager(tmp);
    assert(result.enabled === true, 'enabled not true');
    assert(result.mode === 'hybrid', `got ${result.mode}`);
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// Module Exports Tests
// ═══════════════════════════════════════════════════════════════════

test('PM module exports 9 items', () => {
  const exports = Object.keys(pm);
  assert(exports.length === 9, `Expected 9 exports, got ${exports.length}: ${exports.join(', ')}`);
});

test('PM module exports all required functions', () => {
  const required = [
    'loadProjectState', 'checkMilestones', 'detectStalls',
    'generateProgressReport', 'calculateHealthTrend', 'checkEscalation',
    'generateDailyReport', 'updateProgress', 'PM_DEFAULTS',
  ];
  for (const name of required) {
    assert(pm[name] !== undefined, `Missing export: ${name}`);
  }
});

test('Progress hook module exports 5 items', () => {
  const exports = Object.keys(progressHook);
  assert(exports.length === 5, `Expected 5 exports, got ${exports.length}: ${exports.join(', ')}`);
});

// ═══════════════════════════════════════════════════════════════════
// Edge Case Tests
// ═══════════════════════════════════════════════════════════════════

test('loadProjectState: corrupt governance.yaml', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'governance.yaml'), ':::invalid yaml:::', 'utf8');
  try {
    const state = pm.loadProjectState(tmp);
    assert(state.exists === true, 'should exist');
    assert(state.project === null, 'should be null');
  } finally { rmDir(tmp); }
});

test('loadProjectState: empty tasks.yaml', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'), '', 'utf8');
  try {
    const state = pm.loadProjectState(tmp);
    assert(state.tasks.total === 0, `got ${state.tasks.total}`);
  } finally { rmDir(tmp); }
});

test('checkMilestones: unknown criterion', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'milestones.yaml'),
    'milestones:\n  - name: Test\n    criteria: [unknown_criterion]\n', 'utf8');
  try {
    const result = pm.checkMilestones(tmp);
    assert(result.milestones[0].overall === false, 'unknown should not be met');
  } finally { rmDir(tmp); }
});

test('detectStalls: picks most recent timestamp', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 120 * 60000).toISOString();
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
    `tasks:\n  - id: t1\n    status: done\n    updated: ${old}\n  - id: t2\n    status: active\n    updated: ${now}\n`, 'utf8');
  try {
    const result = pm.detectStalls(tmp, 30);
    assert(result.stalled === false, 'should use most recent time');
    assert(result.minutesSinceActivity < 5, `got ${result.minutesSinceActivity}`);
  } finally { rmDir(tmp); }
});

test('calculateHealthTrend: handles score field name variations', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'scans'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'),
    'score: 75\n', 'utf8');
  try {
    const result = pm.calculateHealthTrend(tmp);
    assert(result.current === 75, `got ${result.current}`);
  } finally { rmDir(tmp); }
});

test('generateProgressReport: health includes trend', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'scans'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-01.yaml'),
    'health_score: 60\n', 'utf8');
  fs.writeFileSync(path.join(tmp, '.ezra', 'scans', '2024-01-02.yaml'),
    'health_score: 80\n', 'utf8');
  try {
    const report = pm.generateProgressReport(tmp);
    assert(report.health.trend === 'improving', `got ${report.health.trend}`);
    assert(report.health.delta === 20, `got ${report.health.delta}`);
    assert(report.health.score === 80, `got ${report.health.score}`);
  } finally { rmDir(tmp); }
});

test('updateProgress: preserves existing tasks', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'),
    'tasks:\n  - id: task-1\n    description: Existing\n    status: done\n    priority: p1\n    created: 2024-01-01T00:00:00.000Z\n    updated: 2024-01-01T00:00:00.000Z\n', 'utf8');
  try {
    pm.updateProgress(tmp, 'New task', 'active');
    const content = fs.readFileSync(path.join(tmp, '.ezra', 'progress', 'tasks.yaml'), 'utf8');
    assert(content.includes('Existing'), 'existing lost');
    assert(content.includes('New task'), 'new not added');
  } finally { rmDir(tmp); }
});

test('checkEscalation: reads history', () => {
  const tmp = makeTempDir();
  ensureDir(path.join(tmp, '.ezra', 'progress'));
  fs.writeFileSync(path.join(tmp, '.ezra', 'progress', 'escalations.yaml'),
    'escalations:\n  - date: 2024-01-01\n    reason: test\n', 'utf8');
  try {
    const result = pm.checkEscalation(tmp, 0);
    assert(Array.isArray(result.history), 'no history');
  } finally { rmDir(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// Report
// ═══════════════════════════════════════════════════════════════════

console.log(`  V6-PM: PASSED: ${passed}  FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
