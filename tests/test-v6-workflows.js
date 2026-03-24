'use strict';

/**
 * EZRA v6 Workflow Templates Engine Tests
 * Tests for hooks/ezra-workflows.js
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
  const dir = path.join(os.tmpdir(), 'ezra-test-wf-' + crypto.randomBytes(4).toString('hex'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanTempDir(dir) {
  if (!dir || !dir.includes('ezra-test-wf')) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Load Module ─────────────────────────────────────────────────

const wf = require('../hooks/ezra-workflows.js');

// ═════════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════════

test('STEP_TYPES: has all expected types', () => {
  const expected = ['ezra', 'shell', 'manual', 'conditional', 'parallel', 'checkpoint', 'command', 'report', 'approval'];
  for (const t of expected) {
    assert(wf.STEP_TYPES.includes(t), 'Missing type: ' + t);
  }
  assertEqual(wf.STEP_TYPES.length, 9);
});

test('STEP_ON_FAILURE: has all expected values', () => {
  const expected = ['stop', 'skip', 'ask', 'retry'];
  for (const v of expected) {
    assert(wf.STEP_ON_FAILURE.includes(v), 'Missing: ' + v);
  }
  assertEqual(wf.STEP_ON_FAILURE.length, 4);
});

test('WORKFLOW_STATUSES: has expected statuses', () => {
  assert(wf.WORKFLOW_STATUSES.includes('draft'), 'Should have draft');
  assert(wf.WORKFLOW_STATUSES.includes('active'), 'Should have active');
  assert(wf.WORKFLOW_STATUSES.includes('completed'), 'Should have completed');
  assertEqual(wf.WORKFLOW_STATUSES.length, 6);
});

// ═════════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═════════════════════════════════════════════════════════════════

test('exports: has all expected exports', () => {
  const required = [
    'STEP_TYPES', 'STEP_ON_FAILURE', 'WORKFLOW_STATUSES',
    'TEMPLATE_DIR', 'PROCESS_DIR',
    'readYaml', 'writeYaml', 'parseVal', 'parseTemplate',
    'getTemplateDir', 'getProcessDir',
    'listTemplates', 'getTemplate', 'validateTemplate',
    'listProcesses', 'createProcess', 'deleteProcess',
    'createRun', 'updateRun', 'completeRun', 'listRuns',
    'resolveStepDependencies', 'evaluateCondition',
    'composeWorkflow', 'getWorkflowStats',
  ];
  for (const name of required) {
    assert(typeof wf[name] !== 'undefined', 'Missing export: ' + name);
  }
});

test('exports: count is 25', () => {
  assertEqual(Object.keys(wf).length, 25);
});

// ═════════════════════════════════════════════════════════════════
// YAML HELPERS
// ═════════════════════════════════════════════════════════════════

test('parseVal: handles all types', () => {
  assertEqual(wf.parseVal('true'), true);
  assertEqual(wf.parseVal('false'), false);
  assertEqual(wf.parseVal('null'), null);
  assertEqual(wf.parseVal('42'), 42);
  assertEqual(wf.parseVal('3.14'), 3.14);
  assertEqual(wf.parseVal("'hello'"), 'hello');
});

test('readYaml: returns empty for missing file', () => {
  const result = wf.readYaml(path.join(os.tmpdir(), 'ezra-nonexistent-' + Date.now() + '.yaml'));
  assertEqual(Object.keys(result).length, 0);
});

test('writeYaml + readYaml: round-trip', () => {
  const dir = makeTempDir();
  try {
    const f = path.join(dir, 'test.yaml');
    wf.writeYaml(f, { name: 'test', count: 5, flag: true });
    const result = wf.readYaml(f);
    assertEqual(result.name, 'test');
    assertEqual(result.count, 5);
    assertEqual(result.flag, true);
  } finally {
    cleanTempDir(dir);
  }
});

// ═════════════════════════════════════════════════════════════════
// TEMPLATE PARSING
// ═════════════════════════════════════════════════════════════════

test('parseTemplate: parses existing onboarding template', () => {
  const ezraRoot = path.resolve(__dirname, '..');
  const t = wf.parseTemplate(path.join(ezraRoot, 'templates', 'onboarding.yaml'));
  assert(t, 'Should parse template');
  assertEqual(t.name, 'onboarding');
  assert(t.steps.length > 0, 'Should have steps');
  assert(t.guard_rails, 'Should have guard_rails');
});

test('parseTemplate: returns null for missing file', () => {
  assertEqual(wf.parseTemplate('/nonexistent/template.yaml'), null);
});

test('parseTemplate: parses all existing templates', () => {
  const ezraRoot = path.resolve(__dirname, '..');
  const dir = path.join(ezraRoot, 'templates');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml'));
  for (const f of files) {
    const t = wf.parseTemplate(path.join(dir, f));
    assert(t, 'Should parse ' + f);
    assert(t.name, f + ' should have name');
    assert(t.steps.length > 0, f + ' should have steps');
  }
});

// ═════════════════════════════════════════════════════════════════
// TEMPLATE MANAGEMENT
// ═════════════════════════════════════════════════════════════════

test('listTemplates: lists existing templates', () => {
  const ezraRoot = path.resolve(__dirname, '..');
  const templates = wf.listTemplates(ezraRoot);
  assert(templates.length >= 5, 'Should have at least 5 templates');
  const names = templates.map(t => t.name);
  assert(names.includes('onboarding'), 'Should include onboarding');
  assert(names.includes('security-audit'), 'Should include security-audit');
});

test('listTemplates: returns empty for missing dir', () => {
  const templates = wf.listTemplates('/nonexistent');
  assertEqual(templates.length, 0);
});

test('getTemplate: retrieves existing template', () => {
  const ezraRoot = path.resolve(__dirname, '..');
  const t = wf.getTemplate(ezraRoot, 'onboarding');
  assert(t, 'Should find template');
  assertEqual(t.name, 'onboarding');
});

test('getTemplate: returns null for missing', () => {
  const t = wf.getTemplate('/nonexistent', 'nope');
  assertEqual(t, null);
});

// ═════════════════════════════════════════════════════════════════
// VALIDATION
// ═════════════════════════════════════════════════════════════════

test('validateTemplate: valid template returns empty errors', () => {
  const errors = wf.validateTemplate({
    name: 'test',
    steps: [
      { id: 1, name: 'Step 1', type: 'ezra', on_failure: 'stop' },
      { id: 2, name: 'Step 2', type: 'shell', on_failure: 'skip' },
    ],
  });
  assertEqual(errors.length, 0);
});

test('validateTemplate: detects missing name', () => {
  const errors = wf.validateTemplate({ steps: [{ id: 1, name: 'S1' }] });
  assert(errors.some(e => e.includes('Missing name')), 'Should detect missing name');
});

test('validateTemplate: detects no steps', () => {
  const errors = wf.validateTemplate({ name: 'test', steps: [] });
  assert(errors.some(e => e.includes('No steps')), 'Should detect no steps');
});

test('validateTemplate: detects duplicate step IDs', () => {
  const errors = wf.validateTemplate({
    name: 'test',
    steps: [{ id: 1, name: 'A' }, { id: 1, name: 'B' }],
  });
  assert(errors.some(e => e.includes('Duplicate')), 'Should detect duplicates');
});

test('validateTemplate: detects invalid step type', () => {
  const errors = wf.validateTemplate({
    name: 'test',
    steps: [{ id: 1, name: 'A', type: 'invalid_type' }],
  });
  assert(errors.some(e => e.includes('invalid type')), 'Should detect invalid type');
});

test('validateTemplate: detects invalid on_failure', () => {
  const errors = wf.validateTemplate({
    name: 'test',
    steps: [{ id: 1, name: 'A', on_failure: 'explode' }],
  });
  assert(errors.some(e => e.includes('invalid on_failure')), 'Should detect invalid on_failure');
});

test('validateTemplate: null template returns errors', () => {
  const errors = wf.validateTemplate(null);
  assert(errors.length > 0, 'Should have errors for null');
});

test('validateTemplate: all existing templates are valid', () => {
  const ezraRoot = path.resolve(__dirname, '..');
  const templates = wf.listTemplates(ezraRoot);
  for (const tInfo of templates) {
    const t = wf.getTemplate(ezraRoot, tInfo.name);
    const errors = wf.validateTemplate(t);
    assertEqual(errors.length, 0);
  }
});

// ═════════════════════════════════════════════════════════════════
// PROCESSES
// ═════════════════════════════════════════════════════════════════

test('listProcesses: returns empty for no processes', () => {
  const dir = makeTempDir();
  try {
    assertEqual(wf.listProcesses(dir).length, 0);
  } finally {
    cleanTempDir(dir);
  }
});

test('createProcess: creates process from template', () => {
  const dir = makeTempDir();
  try {
    const template = { name: 'test-tmpl', description: 'Test', steps: [{ id: 1 }], raw: 'name: test-tmpl' };
    const result = wf.createProcess(dir, 'my-process', template);
    assert(!result.error, 'Should not have error');
    assert(result.path, 'Should have path');
    assertEqual(result.name, 'my-process');
    
    const processes = wf.listProcesses(dir);
    assertEqual(processes.length, 1);
  } finally {
    cleanTempDir(dir);
  }
});

test('createProcess: rejects duplicate name', () => {
  const dir = makeTempDir();
  try {
    wf.createProcess(dir, 'dup', null);
    const result = wf.createProcess(dir, 'dup', null);
    assert(result.error, 'Should reject duplicate');
  } finally {
    cleanTempDir(dir);
  }
});

test('deleteProcess: removes process', () => {
  const dir = makeTempDir();
  try {
    wf.createProcess(dir, 'to-delete', null);
    assertEqual(wf.listProcesses(dir).length, 1);
    const result = wf.deleteProcess(dir, 'to-delete');
    assert(result.deleted, 'Should confirm deletion');
    assertEqual(wf.listProcesses(dir).length, 0);
  } finally {
    cleanTempDir(dir);
  }
});

test('deleteProcess: fails for missing process', () => {
  const dir = makeTempDir();
  try {
    const result = wf.deleteProcess(dir, 'nonexistent');
    assert(result.error, 'Should have error');
  } finally {
    cleanTempDir(dir);
  }
});

// ═════════════════════════════════════════════════════════════════
// EXECUTION TRACKING
// ═════════════════════════════════════════════════════════════════

test('createRun: creates run record', () => {
  const dir = makeTempDir();
  try {
    const result = wf.createRun(dir, 'my-workflow');
    assert(result.path, 'Should have path');
    assert(result.filename, 'Should have filename');
    assertEqual(result.run.status, 'running');
    assertEqual(result.run.process, 'my-workflow');
  } finally {
    cleanTempDir(dir);
  }
});

test('updateRun: updates run state', () => {
  const dir = makeTempDir();
  try {
    const run = wf.createRun(dir, 'test');
    const updated = wf.updateRun(run.path, { steps_completed: 3, current_step: 4 });
    assertEqual(updated.steps_completed, 3);
    assertEqual(updated.current_step, 4);
  } finally {
    cleanTempDir(dir);
  }
});

test('completeRun: marks run as completed', () => {
  const dir = makeTempDir();
  try {
    const run = wf.createRun(dir, 'test');
    const result = wf.completeRun(run.path, true);
    assertEqual(result.status, 'completed');
    assert(result.completed, 'Should have completed timestamp');
  } finally {
    cleanTempDir(dir);
  }
});

test('completeRun: marks run as failed', () => {
  const dir = makeTempDir();
  try {
    const run = wf.createRun(dir, 'test');
    const result = wf.completeRun(run.path, false);
    assertEqual(result.status, 'failed');
  } finally {
    cleanTempDir(dir);
  }
});

test('listRuns: returns empty for no runs', () => {
  const dir = makeTempDir();
  try {
    assertEqual(wf.listRuns(dir).length, 0);
  } finally {
    cleanTempDir(dir);
  }
});

test('listRuns: lists created runs', () => {
  const dir = makeTempDir();
  try {
    wf.createRun(dir, 'workflow-a');
    wf.createRun(dir, 'workflow-b');
    const runs = wf.listRuns(dir);
    assertEqual(runs.length, 2);
  } finally {
    cleanTempDir(dir);
  }
});

test('listRuns: filters by process name', () => {
  const dir = makeTempDir();
  try {
    wf.createRun(dir, 'workflow-a');
    wf.createRun(dir, 'workflow-b');
    const runs = wf.listRuns(dir, 'workflow-a');
    assertEqual(runs.length, 1);
  } finally {
    cleanTempDir(dir);
  }
});

// ═════════════════════════════════════════════════════════════════
// STEP DEPENDENCIES
// ═════════════════════════════════════════════════════════════════

test('resolveStepDependencies: resolves simple order', () => {
  const steps = [
    { id: 1, name: 'First' },
    { id: 2, name: 'Second', depends_on: 1 },
    { id: 3, name: 'Third', depends_on: 2 },
  ];
  const { resolved, unresolved } = wf.resolveStepDependencies(steps);
  assertEqual(resolved.length, 3);
  assertEqual(unresolved.length, 0);
  assertEqual(resolved[0].id, 1);
  assertEqual(resolved[1].id, 2);
  assertEqual(resolved[2].id, 3);
});

test('resolveStepDependencies: detects circular dependencies', () => {
  const steps = [
    { id: 1, name: 'A', depends_on: 2 },
    { id: 2, name: 'B', depends_on: 1 },
  ];
  const { resolved, unresolved } = wf.resolveStepDependencies(steps);
  assertEqual(unresolved.length, 2);
});

test('resolveStepDependencies: handles no dependencies', () => {
  const steps = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
  ];
  const { resolved } = wf.resolveStepDependencies(steps);
  assertEqual(resolved.length, 2);
});

// ═════════════════════════════════════════════════════════════════
// CONDITIONS
// ═════════════════════════════════════════════════════════════════

test('evaluateCondition: returns true for null condition', () => {
  assertEqual(wf.evaluateCondition(null, {}), true);
});

test('evaluateCondition: always/true conditions', () => {
  assertEqual(wf.evaluateCondition('always', {}), true);
  assertEqual(wf.evaluateCondition('true', {}), true);
});

test('evaluateCondition: never/false conditions', () => {
  assertEqual(wf.evaluateCondition('never', {}), false);
  assertEqual(wf.evaluateCondition('false', {}), false);
});

test('evaluateCondition: step status condition', () => {
  const ctx = { results: { 1: { status: 'completed' } } };
  assertEqual(wf.evaluateCondition('step.1.status == completed', ctx), true);
  assertEqual(wf.evaluateCondition('step.1.status == failed', ctx), false);
});

// ═════════════════════════════════════════════════════════════════
// COMPOSITION
// ═════════════════════════════════════════════════════════════════

test('composeWorkflow: composes two templates', () => {
  const t1 = { name: 'onboard', steps: [{ id: 1, name: 'Init' }, { id: 2, name: 'Scan' }] };
  const t2 = { name: 'audit', steps: [{ id: 1, name: 'Security' }] };
  const composed = wf.composeWorkflow([t1, t2]);
  assert(composed, 'Should produce composed workflow');
  assertEqual(composed.steps.length, 3);
  assertEqual(composed.steps[0].id, 1);
  assertEqual(composed.steps[1].id, 2);
  assertEqual(composed.steps[2].id, 3);
  assertEqual(composed.steps[2].source_template, 'audit');
});

test('composeWorkflow: returns null for empty array', () => {
  assertEqual(wf.composeWorkflow([]), null);
});

test('composeWorkflow: returns null for null', () => {
  assertEqual(wf.composeWorkflow(null), null);
});

// ═════════════════════════════════════════════════════════════════
// STATISTICS
// ═════════════════════════════════════════════════════════════════

test('getWorkflowStats: returns stats for project root', () => {
  const ezraRoot = path.resolve(__dirname, '..');
  const stats = wf.getWorkflowStats(ezraRoot);
  assert(stats.template_count >= 5, 'Should have templates');
  assertEqual(typeof stats.process_count, 'number');
  assertEqual(typeof stats.total_runs, 'number');
  assertEqual(typeof stats.success_rate, 'number');
});

test('getWorkflowStats: returns zeros for empty project', () => {
  const dir = makeTempDir();
  try {
    const stats = wf.getWorkflowStats(dir);
    assertEqual(stats.template_count, 0);
    assertEqual(stats.process_count, 0);
    assertEqual(stats.total_runs, 0);
    assertEqual(stats.success_rate, 0);
  } finally {
    cleanTempDir(dir);
  }
});

// ═════════════════════════════════════════════════════════════════
// REPORT
// ═════════════════════════════════════════════════════════════════

console.log('  V6-Workflows: PASSED: ' + passed + '  FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
