#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  SUPPORTED_PROVIDERS,
  ASSIGNMENT_STRATEGIES,
  SCORING_WEIGHTS,
  createProvider,
  loadAgentConfig,
  getAgentRoster,
  assignTask,
  recordTaskResult,
  getAgentPerformance,
  getAgentLeaderboard,
  checkBudget,
  writeYaml,
  readYaml,
} = require(path.join(__dirname, '..', 'hooks', 'ezra-agents.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error('  FAIL: ' + name + ' — ' + err.message); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function makeTempDir() {
  const dir = path.join(os.tmpdir(), 'ezra-agents-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function setupRoster(dir) {
  const agentsDir = path.join(dir, '.ezra', 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  writeYaml(path.join(agentsDir, 'roster.yaml'), {
    claude: { type: 'llm', model: 'claude-3.5-sonnet', status: 'ready' },
    codex: { type: 'llm', model: 'codex-latest', status: 'ready' },
    cursor: { type: 'ide-agent', model: 'cursor-ai', status: 'ready' },
  });
}

// === 1. SUPPORTED_PROVIDERS ===

test('SUPPORTED_PROVIDERS has 9 entries', () => {
  assert(SUPPORTED_PROVIDERS.length === 9, 'Expected 9, got ' + SUPPORTED_PROVIDERS.length);
});

test('Each provider has name, type, integration', () => {
  for (const p of SUPPORTED_PROVIDERS) {
    assert(p.name, 'Missing name');
    assert(p.type, 'Missing type');
    assert(Array.isArray(p.integration), 'integration should be array');
  }
});

test('Providers include claude, codex, copilot', () => {
  const names = SUPPORTED_PROVIDERS.map(p => p.name);
  assert(names.includes('claude'));
  assert(names.includes('codex'));
  assert(names.includes('copilot'));
});

test('Provider names are unique', () => {
  const names = SUPPORTED_PROVIDERS.map(p => p.name);
  assert(new Set(names).size === names.length, 'Duplicate providers');
});

// === 2. ASSIGNMENT_STRATEGIES ===

test('ASSIGNMENT_STRATEGIES has 5 entries', () => {
  assert(ASSIGNMENT_STRATEGIES.length === 5, 'Expected 5, got ' + ASSIGNMENT_STRATEGIES.length);
});

test('Strategies include auto and manual', () => {
  assert(ASSIGNMENT_STRATEGIES.includes('auto'));
  assert(ASSIGNMENT_STRATEGIES.includes('manual'));
  assert(ASSIGNMENT_STRATEGIES.includes('round-robin'));
  assert(ASSIGNMENT_STRATEGIES.includes('cost-optimised'));
  assert(ASSIGNMENT_STRATEGIES.includes('quality-optimised'));
});

// === 3. SCORING_WEIGHTS ===

test('SCORING_WEIGHTS sum to 1.0', () => {
  const sum = Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
  assert(Math.abs(sum - 1.0) < 0.001, 'Weights sum to ' + sum);
});

test('SCORING_WEIGHTS has 5 factors', () => {
  assert(Object.keys(SCORING_WEIGHTS).length === 5);
});

// === 4. createProvider ===

test('createProvider returns valid interface', () => {
  const p = createProvider({ name: 'test', type: 'llm', model: 'test-model' });
  assert(p.name === 'test');
  assert(p.type === 'llm');
  assert(p.model === 'test-model');
  assert(typeof p.execute === 'function');
  assert(typeof p.status === 'function');
});

test('createProvider status returns ready initially', () => {
  const p = createProvider({ name: 'test' });
  assert(p.status() === 'ready');
});

test('createProvider execute returns mock result', async () => {
  const p = createProvider({ name: 'mock' });
  const result = await p.execute({ description: 'test task' });
  assert(result.output.includes('Mock response'));
  assert(typeof result.tokens === 'number');
  assert(typeof result.cost === 'number');
  assert(typeof result.duration === 'number');
});

// === 5. writeYaml / readYaml ===

test('writeYaml creates file', () => {
  const dir = makeTempDir();
  try {
    const fp = path.join(dir, 'test.yaml');
    writeYaml(fp, { name: 'test', count: 42 });
    assert(fs.existsSync(fp));
  } finally { cleanup(dir); }
});

test('readYaml round-trips simple data', () => {
  const dir = makeTempDir();
  try {
    const fp = path.join(dir, 'test.yaml');
    writeYaml(fp, { name: 'test', count: 42, active: true });
    const data = readYaml(fp);
    assert(data.name === 'test');
    assert(data.count === 42);
    assert(data.active === true);
  } finally { cleanup(dir); }
});

test('readYaml returns empty for missing file', () => {
  const data = readYaml('/nonexistent/file.yaml');
  assert(Object.keys(data).length === 0);
});

// === 6. getAgentRoster ===

test('getAgentRoster returns empty without roster', () => {
  const dir = makeTempDir();
  try {
    const roster = getAgentRoster(dir);
    assert(roster.length === 0);
  } finally { cleanup(dir); }
});

test('getAgentRoster reads roster file', () => {
  const dir = makeTempDir();
  try {
    setupRoster(dir);
    const roster = getAgentRoster(dir);
    assert(roster.length === 3, 'Expected 3, got ' + roster.length);
    assert(roster.some(a => a.name === 'claude'));
    assert(roster.some(a => a.name === 'codex'));
  } finally { cleanup(dir); }
});

// === 7. assignTask ===

test('assignTask returns fallback with empty roster', () => {
  const dir = makeTempDir();
  try {
    const result = assignTask(dir, { type: 'review' }, 'auto');
    assert(result.agent === 'claude');
    assert(result.reason === 'no_roster_fallback_to_default');
  } finally { cleanup(dir); }
});

test('assignTask manual returns first agent', () => {
  const dir = makeTempDir();
  try {
    setupRoster(dir);
    const result = assignTask(dir, { type: 'review' }, 'manual');
    assert(result.strategy === 'manual');
    assert(result.agent);
  } finally { cleanup(dir); }
});

test('assignTask round-robin cycles', () => {
  const dir = makeTempDir();
  try {
    setupRoster(dir);
    const r1 = assignTask(dir, { type: 'review' }, 'round-robin');
    assert(r1.strategy === 'round-robin');
    assert(r1.agent);
  } finally { cleanup(dir); }
});

test('assignTask auto returns scores', () => {
  const dir = makeTempDir();
  try {
    setupRoster(dir);
    const result = assignTask(dir, { type: 'review' }, 'auto');
    assert(result.strategy === 'auto');
    assert(result.scores);
    assert(result.scores.length === 3);
  } finally { cleanup(dir); }
});

test('assignTask cost-optimised changes weight bias', () => {
  const dir = makeTempDir();
  try {
    setupRoster(dir);
    const result = assignTask(dir, { type: 'review' }, 'cost-optimised');
    assert(result.strategy === 'cost-optimised');
    assert(result.reason === 'weighted_scoring');
  } finally { cleanup(dir); }
});

test('assignTask quality-optimised changes weight bias', () => {
  const dir = makeTempDir();
  try {
    setupRoster(dir);
    const result = assignTask(dir, { type: 'review' }, 'quality-optimised');
    assert(result.strategy === 'quality-optimised');
  } finally { cleanup(dir); }
});

// === 8. recordTaskResult ===

test('recordTaskResult creates performance file', () => {
  const dir = makeTempDir();
  try {
    const result = recordTaskResult(dir, 'claude', { type: 'review' }, { cost: 0.05, duration: 200, success: true });
    assert(result.tasks_completed === 1);
    assert(result.successes === 1);
    const perfPath = path.join(dir, '.ezra', 'agents', 'performance', 'claude.yaml');
    assert(fs.existsSync(perfPath));
  } finally { cleanup(dir); }
});

test('recordTaskResult accumulates stats', () => {
  const dir = makeTempDir();
  try {
    recordTaskResult(dir, 'claude', {}, { cost: 0.05, duration: 200, success: true });
    recordTaskResult(dir, 'claude', {}, { cost: 0.10, duration: 300, success: true });
    const perf = getAgentPerformance(dir, 'claude');
    assert(perf.tasks_completed === 2, 'Expected 2 tasks');
    assert(perf.total_cost > 0.14);
  } finally { cleanup(dir); }
});

test('recordTaskResult tracks failures', () => {
  const dir = makeTempDir();
  try {
    recordTaskResult(dir, 'codex', {}, { cost: 0.05, duration: 100, success: true });
    recordTaskResult(dir, 'codex', {}, { cost: 0.05, duration: 100, success: false });
    const perf = getAgentPerformance(dir, 'codex');
    assert(perf.tasks_completed === 2);
    assert(perf.successes === 1);
    assert(perf.success_rate === 0.5);
  } finally { cleanup(dir); }
});

test('recordTaskResult updates task log', () => {
  const dir = makeTempDir();
  try {
    recordTaskResult(dir, 'claude', {}, { cost: 0.05, duration: 200 });
    const logPath = path.join(dir, '.ezra', 'agents', 'task-log.yaml');
    assert(fs.existsSync(logPath));
    const log = readYaml(logPath);
    assert(log.total_tasks === 1);
    assert(log.last_agent === 'claude');
  } finally { cleanup(dir); }
});

// === 9. getAgentPerformance ===

test('getAgentPerformance returns defaults for unknown agent', () => {
  const dir = makeTempDir();
  try {
    const perf = getAgentPerformance(dir, 'unknown');
    assert(perf.agent === 'unknown');
    assert(perf.tasks_completed === 0);
    assert(perf.success_rate === 0.5);
  } finally { cleanup(dir); }
});

// === 10. getAgentLeaderboard ===

test('getAgentLeaderboard returns empty without data', () => {
  const dir = makeTempDir();
  try {
    const board = getAgentLeaderboard(dir);
    assert(board.length === 0);
  } finally { cleanup(dir); }
});

test('getAgentLeaderboard ranks agents', () => {
  const dir = makeTempDir();
  try {
    recordTaskResult(dir, 'claude', {}, { cost: 0.02, duration: 100, success: true });
    recordTaskResult(dir, 'codex', {}, { cost: 0.10, duration: 500, success: true });
    const board = getAgentLeaderboard(dir);
    assert(board.length === 2, 'Expected 2 agents');
    assert(board[0].quality_adjusted_cost <= board[1].quality_adjusted_cost, 'Should be sorted ascending');
  } finally { cleanup(dir); }
});

test('getAgentLeaderboard includes quality_adjusted_cost', () => {
  const dir = makeTempDir();
  try {
    recordTaskResult(dir, 'claude', {}, { cost: 0.05, duration: 200, success: true });
    const board = getAgentLeaderboard(dir);
    assert(board[0].quality_adjusted_cost !== undefined);
    assert(typeof board[0].quality_adjusted_cost === 'number');
  } finally { cleanup(dir); }
});

// === 11. checkBudget ===

test('checkBudget returns defaults without budget file', () => {
  const dir = makeTempDir();
  try {
    const budget = checkBudget(dir);
    assert(budget.daily_ceiling === 10);
    assert(budget.monthly_ceiling === 200);
    assert(budget.currency === 'USD');
    assert(budget.overspend === false);
  } finally { cleanup(dir); }
});

test('checkBudget detects overspend', () => {
  const dir = makeTempDir();
  try {
    const budgetDir = path.join(dir, '.ezra', 'agents');
    fs.mkdirSync(budgetDir, { recursive: true });
    writeYaml(path.join(budgetDir, 'budget.yaml'), { daily_spend: 15.0, monthly_spend: 50.0 });
    const budget = checkBudget(dir);
    assert(budget.overspend === true, 'Should detect overspend');
    assert(budget.daily_remaining < 0, 'Daily remaining should be negative');
  } finally { cleanup(dir); }
});

test('checkBudget calculates remaining correctly', () => {
  const dir = makeTempDir();
  try {
    const budgetDir = path.join(dir, '.ezra', 'agents');
    fs.mkdirSync(budgetDir, { recursive: true });
    writeYaml(path.join(budgetDir, 'budget.yaml'), { daily_spend: 3.0, monthly_spend: 50.0 });
    const budget = checkBudget(dir);
    assert(budget.daily_remaining === 7);
    assert(budget.monthly_remaining === 150);
    assert(budget.overspend === false);
  } finally { cleanup(dir); }
});

// === 12. Settings integration ===

test('Settings DEFAULTS includes agents section', () => {
  const settings = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));
  assert(settings.DEFAULTS.agents, 'agents section missing');
  assert(settings.DEFAULTS.agents.assignment_strategy === 'auto');
  assert(settings.DEFAULTS.agents.max_concurrent === 3);
  assert(settings.DEFAULTS.agents.anthropic_model === 'claude-sonnet-4-20250514', 'anthropic_model should be set');
});

test('getAgents accessor works', () => {
  const settings = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));
  assert(typeof settings.getAgents === 'function');
  const dir = makeTempDir();
  try {
    const agents = settings.getAgents(dir);
    assert(agents.assignment_strategy === 'auto');
  } finally { cleanup(dir); }
});

// === 13. Module structure ===

test('Module exports all required items', () => {
  const mod = require(path.join(__dirname, '..', 'hooks', 'ezra-agents.js'));
  const required = ['SUPPORTED_PROVIDERS', 'ASSIGNMENT_STRATEGIES', 'SCORING_WEIGHTS', 'createProvider', 'loadAgentConfig', 'getAgentRoster', 'assignTask', 'recordTaskResult', 'getAgentPerformance', 'getAgentLeaderboard', 'checkBudget'];
  for (const name of required) {
    assert(name in mod, 'Missing export: ' + name);
  }
});

// === 14. Edge cases ===

test('assignTask with null strategy defaults to auto', () => {
  const dir = makeTempDir();
  try {
    setupRoster(dir);
    const result = assignTask(dir, { type: 'review' }, null);
    assert(result.strategy === 'auto');
  } finally { cleanup(dir); }
});

test('Multiple recordTaskResults for different agents', () => {
  const dir = makeTempDir();
  try {
    recordTaskResult(dir, 'claude', {}, { cost: 0.05, duration: 200, success: true });
    recordTaskResult(dir, 'codex', {}, { cost: 0.10, duration: 300, success: true });
    recordTaskResult(dir, 'cursor', {}, { cost: 0.02, duration: 100, success: true });
    const board = getAgentLeaderboard(dir);
    assert(board.length === 3, 'Expected 3 agents on leaderboard');
  } finally { cleanup(dir); }
});

test('createProvider with minimal config', () => {
  const p = createProvider({});
  assert(p.name === 'mock');
  assert(p.type === 'llm');
  assert(p.status() === 'ready');
});

// === Summary ===

console.log('  V6-Agents: ' + passed + ' passed, ' + failed + ' failed');
console.log('  V6-Agents: PASSED: ' + passed + ' FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
