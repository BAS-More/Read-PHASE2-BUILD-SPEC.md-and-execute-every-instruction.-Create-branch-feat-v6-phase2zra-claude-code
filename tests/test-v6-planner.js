'use strict';
/**
 * tests/test-v6-planner.js — Tests for EZRA v6 Holistic Planning Engine
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const planner = require(path.join(__dirname, '..', 'hooks', 'ezra-planner.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error('  FAIL: ' + name + ' — ' + e.message);
  }
}

function makeTmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-planner-'));
  return d;
}

function cleanup(d) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
}

// ─── Constants ──────────────────────────────────────────────────

test('PLAN_STAGES has 7 entries', () => {
  assert.strictEqual(planner.PLAN_STAGES.length, 7);
});

test('PLAN_STAGES includes holistic_plan', () => {
  assert(planner.PLAN_STAGES.includes('holistic_plan'));
});

test('PLAN_STAGES includes checkpoint', () => {
  assert(planner.PLAN_STAGES.includes('checkpoint'));
});

test('TASK_STATUSES has 6 entries', () => {
  assert.strictEqual(planner.TASK_STATUSES.length, 6);
});

test('TASK_STATUSES includes all expected', () => {
  for (const s of ['pending', 'assigned', 'in_progress', 'completed', 'failed', 'blocked']) {
    assert(planner.TASK_STATUSES.includes(s), 'missing: ' + s);
  }
});

test('RISK_LEVELS has 4 entries', () => {
  assert.strictEqual(planner.RISK_LEVELS.length, 4);
});

test('PLANS_DIR is .ezra/plans', () => {
  assert.strictEqual(planner.PLANS_DIR, '.ezra/plans');
});

// ─── YAML helpers ───────────────────────────────────────────────

test('readYaml returns empty object for missing file', () => {
  const result = planner.readYaml('/nonexistent/path/file.yaml');
  assert.deepStrictEqual(result, {});
});

test('writeYaml and readYaml roundtrip', () => {
  const tmp = makeTmp();
  try {
    const file = path.join(tmp, 'test.yaml');
    planner.writeYaml(file, { name: 'test', count: 42, active: true });
    const result = planner.readYaml(file);
    assert.strictEqual(result.name, 'test');
    assert.strictEqual(result.count, 42);
    assert.strictEqual(result.active, true);
  } finally {
    cleanup(tmp);
  }
});

// ─── createPlan ─────────────────────────────────────────────────

test('createPlan requires object', () => {
  const tmp = makeTmp();
  try {
    const result = planner.createPlan(tmp, null);
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

test('createPlan requires name and description', () => {
  const tmp = makeTmp();
  try {
    const result = planner.createPlan(tmp, { name: 'test' });
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

test('createPlan succeeds with valid spec', () => {
  const tmp = makeTmp();
  try {
    const spec = { name: 'My Plan', description: 'A test plan', features: ['auth', 'ui', 'api'] };
    const result = planner.createPlan(tmp, spec);
    assert.strictEqual(result.success, true);
    assert(result.planId);
    assert.strictEqual(result.features, 3);
    assert.strictEqual(result.stage, 'holistic_plan');
  } finally {
    cleanup(tmp);
  }
});

test('createPlan sets risk_level based on risks count', () => {
  const tmp = makeTmp();
  try {
    const spec = { name: 'Risky', description: 'Test', risks: ['a', 'b', 'c', 'd'] };
    planner.createPlan(tmp, spec);
    const plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.risk_level, 'high');
  } finally {
    cleanup(tmp);
  }
});

test('createPlan medium risk with few risks', () => {
  const tmp = makeTmp();
  try {
    const spec = { name: 'Med', description: 'Test', risks: ['one'] };
    planner.createPlan(tmp, spec);
    const plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.risk_level, 'medium');
  } finally {
    cleanup(tmp);
  }
});

test('createPlan low risk with no risks', () => {
  const tmp = makeTmp();
  try {
    const spec = { name: 'Safe', description: 'Test', features: ['f1'] };
    planner.createPlan(tmp, spec);
    const plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.risk_level, 'low');
  } finally {
    cleanup(tmp);
  }
});

test('createPlan creates master-plan.yaml on disk', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'Test', description: 'Test' });
    assert(fs.existsSync(path.join(tmp, '.ezra', 'plans', 'master-plan.yaml')));
  } finally {
    cleanup(tmp);
  }
});

// ─── loadPlan ───────────────────────────────────────────────────

test('loadPlan returns null when no plan exists', () => {
  const tmp = makeTmp();
  try {
    assert.strictEqual(planner.loadPlan(tmp), null);
  } finally {
    cleanup(tmp);
  }
});

test('loadPlan returns plan data', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'Load Test', description: 'Test' });
    const plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.name, 'Load Test');
    assert.strictEqual(plan.stage, 'holistic_plan');
  } finally {
    cleanup(tmp);
  }
});

// ─── decomposeTasks ─────────────────────────────────────────────

test('decomposeTasks fails without plan', () => {
  const tmp = makeTmp();
  try {
    const result = planner.decomposeTasks(tmp, [{ name: 'task1' }]);
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

test('decomposeTasks fails with empty array', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'Test', description: 'Test' });
    const result = planner.decomposeTasks(tmp, []);
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

test('decomposeTasks succeeds', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    const tasks = [
      { name: 'setup', file: 'setup.js', priority: 'high' },
      { name: 'build', file: 'build.js', depends_on: 'setup' },
    ];
    const result = planner.decomposeTasks(tmp, tasks);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.taskCount, 2);
    assert.strictEqual(result.stage, 'task_decomposition');
  } finally {
    cleanup(tmp);
  }
});

test('decomposeTasks creates task-queue.yaml', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.decomposeTasks(tmp, [{ name: 't1' }]);
    assert(fs.existsSync(path.join(tmp, '.ezra', 'plans', 'task-queue.yaml')));
  } finally {
    cleanup(tmp);
  }
});

test('decomposeTasks updates plan stage', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.decomposeTasks(tmp, [{ name: 't1' }]);
    const plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.stage, 'task_decomposition');
  } finally {
    cleanup(tmp);
  }
});

// ─── assignTask ─────────────────────────────────────────────────

test('assignTask fails without queue', () => {
  const tmp = makeTmp();
  try {
    const result = planner.assignTask(tmp, 0, 'agent-1');
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

test('assignTask fails for invalid index', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.decomposeTasks(tmp, [{ name: 't1' }]);
    const result = planner.assignTask(tmp, 99, 'agent-1');
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

test('assignTask succeeds for pending task', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.decomposeTasks(tmp, [{ name: 't1' }, { name: 't2' }]);
    const result = planner.assignTask(tmp, 0, 'code-agent');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.assignedTo, 'code-agent');
  } finally {
    cleanup(tmp);
  }
});

test('assignTask cannot assign non-pending task', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.decomposeTasks(tmp, [{ name: 't1' }]);
    planner.assignTask(tmp, 0, 'agent-1');
    const result = planner.assignTask(tmp, 0, 'agent-2');
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

// ─── getTaskQueue ───────────────────────────────────────────────

test('getTaskQueue returns null when no queue', () => {
  const tmp = makeTmp();
  try {
    assert.strictEqual(planner.getTaskQueue(tmp), null);
  } finally {
    cleanup(tmp);
  }
});

test('getTaskQueue returns queue data', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.decomposeTasks(tmp, [{ name: 't1' }, { name: 't2' }]);
    const queue = planner.getTaskQueue(tmp);
    assert.strictEqual(parseInt(queue.total_tasks, 10), 2);
    assert.strictEqual(queue.task_0_name, 't1');
    assert.strictEqual(queue.task_1_name, 't2');
  } finally {
    cleanup(tmp);
  }
});

// ─── advanceTask ────────────────────────────────────────────────

test('advanceTask rejects invalid status', () => {
  const tmp = makeTmp();
  try {
    const result = planner.advanceTask(tmp, 0, 'invalid_status');
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

test('advanceTask fails without queue', () => {
  const tmp = makeTmp();
  try {
    const result = planner.advanceTask(tmp, 0, 'completed');
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

test('advanceTask succeeds', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.decomposeTasks(tmp, [{ name: 't1' }]);
    planner.assignTask(tmp, 0, 'agent');
    const result = planner.advanceTask(tmp, 0, 'in_progress');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.oldStatus, 'assigned');
    assert.strictEqual(result.newStatus, 'in_progress');
  } finally {
    cleanup(tmp);
  }
});

test('advanceTask to completed increments counters', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D', features: ['f1'] });
    planner.decomposeTasks(tmp, [{ name: 't1' }]);
    planner.advanceTask(tmp, 0, 'completed');
    const queue = planner.getTaskQueue(tmp);
    assert.strictEqual(parseInt(queue.completed_tasks, 10), 1);
    const plan = planner.loadPlan(tmp);
    assert.strictEqual(parseInt(plan.completed_features, 10), 1);
  } finally {
    cleanup(tmp);
  }
});

// ─── runGapCheck ────────────────────────────────────────────────

test('runGapCheck fails without plan', () => {
  const tmp = makeTmp();
  try {
    const result = planner.runGapCheck(tmp);
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

test('runGapCheck fails without queue', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    const result = planner.runGapCheck(tmp);
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

test('runGapCheck succeeds with no issues', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D', features: ['f1'] });
    planner.decomposeTasks(tmp, [{ name: 't1' }]);
    planner.advanceTask(tmp, 0, 'completed');
    const result = planner.runGapCheck(tmp);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.report.drift, 'none');
    assert.strictEqual(result.report.completion_pct, 100);
  } finally {
    cleanup(tmp);
  }
});

test('runGapCheck detects drift from failed tasks', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.decomposeTasks(tmp, [{ name: 't1' }, { name: 't2' }]);
    planner.advanceTask(tmp, 0, 'failed');
    const result = planner.runGapCheck(tmp);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.report.drift, 'detected');
    assert.strictEqual(result.report.issue_count, 1);
  } finally {
    cleanup(tmp);
  }
});

test('runGapCheck saves report to gap-reports dir', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.decomposeTasks(tmp, [{ name: 't1' }]);
    planner.runGapCheck(tmp);
    const gapDir = path.join(tmp, '.ezra', 'plans', 'gap-reports');
    const files = fs.readdirSync(gapDir);
    assert(files.length >= 1, 'expected at least 1 gap report');
  } finally {
    cleanup(tmp);
  }
});

// ─── createCheckpoint ───────────────────────────────────────────

test('createCheckpoint fails without plan', () => {
  const tmp = makeTmp();
  try {
    const result = planner.createCheckpoint(tmp, 'test');
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

test('createCheckpoint succeeds', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    const result = planner.createCheckpoint(tmp, 'milestone-1');
    assert.strictEqual(result.success, true);
    assert(result.file.startsWith('checkpoint-'));
    assert.strictEqual(result.checkpoint.label, 'milestone-1');
  } finally {
    cleanup(tmp);
  }
});

test('createCheckpoint saves to disk', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.createCheckpoint(tmp, 'test');
    const cpDir = path.join(tmp, '.ezra', 'plans', 'checkpoints');
    const files = fs.readdirSync(cpDir);
    assert(files.length >= 1);
  } finally {
    cleanup(tmp);
  }
});

test('createCheckpoint updates plan stage to checkpoint', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.createCheckpoint(tmp, 'cp');
    const plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.stage, 'checkpoint');
  } finally {
    cleanup(tmp);
  }
});

// ─── getPlanStatus ──────────────────────────────────────────────

test('getPlanStatus returns exists:false when no plan', () => {
  const tmp = makeTmp();
  try {
    const result = planner.getPlanStatus(tmp);
    assert.strictEqual(result.exists, false);
  } finally {
    cleanup(tmp);
  }
});

test('getPlanStatus returns full info', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'Status', description: 'Test', features: ['a', 'b'] });
    planner.decomposeTasks(tmp, [{ name: 't1' }, { name: 't2' }]);
    planner.createCheckpoint(tmp, 'cp1');
    const status = planner.getPlanStatus(tmp);
    assert.strictEqual(status.exists, true);
    assert.strictEqual(status.name, 'Status');
    assert.strictEqual(status.total_tasks, 2);
    assert.strictEqual(status.checkpoints, 1);
  } finally {
    cleanup(tmp);
  }
});

// ─── listCheckpoints ────────────────────────────────────────────

test('listCheckpoints returns empty array when none', () => {
  const tmp = makeTmp();
  try {
    assert.deepStrictEqual(planner.listCheckpoints(tmp), []);
  } finally {
    cleanup(tmp);
  }
});

test('listCheckpoints returns checkpoint data', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.createCheckpoint(tmp, 'cp1');
    planner.createCheckpoint(tmp, 'cp2');
    const cps = planner.listCheckpoints(tmp);
    assert.strictEqual(cps.length, 2);
  } finally {
    cleanup(tmp);
  }
});

// ─── listGapReports ─────────────────────────────────────────────

test('listGapReports returns empty array when none', () => {
  const tmp = makeTmp();
  try {
    assert.deepStrictEqual(planner.listGapReports(tmp), []);
  } finally {
    cleanup(tmp);
  }
});

test('listGapReports returns report data', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    planner.decomposeTasks(tmp, [{ name: 't1' }]);
    planner.runGapCheck(tmp);
    const reports = planner.listGapReports(tmp);
    assert(reports.length >= 1);
  } finally {
    cleanup(tmp);
  }
});

// ─── deletePlan ─────────────────────────────────────────────────

test('deletePlan removes plan data', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'P', description: 'D' });
    assert(fs.existsSync(path.join(tmp, '.ezra', 'plans')));
    planner.deletePlan(tmp);
    assert(!fs.existsSync(path.join(tmp, '.ezra', 'plans')));
  } finally {
    cleanup(tmp);
  }
});

test('deletePlan fails when no plan dir', () => {
  const tmp = makeTmp();
  try {
    const result = planner.deletePlan(tmp);
    assert.strictEqual(result.success, false);
  } finally {
    cleanup(tmp);
  }
});

// ─── describePlan ───────────────────────────────────────────────

test('describePlan returns message when no plan', () => {
  const tmp = makeTmp();
  try {
    const desc = planner.describePlan(tmp);
    assert(desc.includes('No plan found'));
  } finally {
    cleanup(tmp);
  }
});

test('describePlan returns formatted plan', () => {
  const tmp = makeTmp();
  try {
    planner.createPlan(tmp, { name: 'My Project', description: 'Test', features: ['auth', 'ui'] });
    planner.decomposeTasks(tmp, [{ name: 'setup' }, { name: 'build' }]);
    const desc = planner.describePlan(tmp);
    assert(desc.includes('My Project'));
    assert(desc.includes('setup'));
    assert(desc.includes('build'));
  } finally {
    cleanup(tmp);
  }
});

// ─── Full pipeline ──────────────────────────────────────────────

test('full 7-stage pipeline', () => {
  const tmp = makeTmp();
  try {
    // Stage 1: holistic plan
    planner.createPlan(tmp, { name: 'Full', description: 'E2E', features: ['f1', 'f2'] });
    let plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.stage, 'holistic_plan');

    // Stage 2: task decomposition
    planner.decomposeTasks(tmp, [{ name: 't1', file: 'a.js' }, { name: 't2', file: 'b.js' }]);
    plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.stage, 'task_decomposition');

    // Stage 3: assignment
    planner.assignTask(tmp, 0, 'agent-1');
    plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.stage, 'assignment');

    // Stage 4: execution (simulated by advancing to in_progress)
    planner.advanceTask(tmp, 0, 'in_progress');

    // Stage 5: verification (simulated by completing)
    planner.advanceTask(tmp, 0, 'completed');
    plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.stage, 'verification');

    // Stage 6: gap check
    planner.runGapCheck(tmp);
    plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.stage, 'gap_check');

    // Stage 7: checkpoint
    planner.createCheckpoint(tmp, 'done');
    plan = planner.loadPlan(tmp);
    assert.strictEqual(plan.stage, 'checkpoint');
  } finally {
    cleanup(tmp);
  }
});

// ─── Edge cases ─────────────────────────────────────────────────

test('createPlan with empty features array', () => {
  const tmp = makeTmp();
  try {
    const result = planner.createPlan(tmp, { name: 'Empty', description: 'No features', features: [] });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.features, 0);
  } finally {
    cleanup(tmp);
  }
});

test('generateId returns unique strings', () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) ids.add(planner.generateId());
  assert.strictEqual(ids.size, 100);
});

test('getPlansDir creates directory', () => {
  const tmp = makeTmp();
  try {
    const d = planner.getPlansDir(tmp);
    assert(fs.existsSync(d));
  } finally {
    cleanup(tmp);
  }
});

test('getCheckpointsDir creates directory', () => {
  const tmp = makeTmp();
  try {
    const d = planner.getCheckpointsDir(tmp);
    assert(fs.existsSync(d));
  } finally {
    cleanup(tmp);
  }
});

test('getGapReportsDir creates directory', () => {
  const tmp = makeTmp();
  try {
    const d = planner.getGapReportsDir(tmp);
    assert(fs.existsSync(d));
  } finally {
    cleanup(tmp);
  }
});

// ─── Settings accessor ──────────────────────────────────────────

test('settings: getPlanning accessor exists', () => {
  const settings = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));
  assert(typeof settings.getPlanning === 'function', 'getPlanning should be a function');
});

test('settings: planning defaults present', () => {
  const settings = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));
  const defaults = settings.getDefault();
  assert(defaults.planning, 'planning section should exist in defaults');
  assert.strictEqual(defaults.planning.enabled, true);
  assert.strictEqual(defaults.planning.max_tasks_before_gap_check, 5);
  assert.strictEqual(defaults.planning.checkpoint_on_milestone, true);
  assert.strictEqual(defaults.planning.auto_assign, true);
});

// ─── Report ─────────────────────────────────────────────────────

console.log('');
console.log('PASSED: ' + passed + '  FAILED: ' + failed);
if (failed > 0) process.exit(1);
