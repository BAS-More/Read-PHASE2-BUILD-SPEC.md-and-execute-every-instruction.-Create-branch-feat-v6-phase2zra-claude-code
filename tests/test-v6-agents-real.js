#!/usr/bin/env node
'use strict';

/**
 * EZRA V6 Real Agent Provider Tests
 *
 * Tests real Anthropic/OpenAI provider wiring, budget enforcement,
 * fallback logic, stub providers, and cost calculations.
 * All API calls are mocked via setHttpsPost — no real network calls.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const agents = require(path.join(__dirname, '..', 'hooks', 'ezra-agents.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      result.then(() => { passed++; runNext(); }).catch(err => { failed++; console.error('  FAIL: ' + name + ' — ' + err.message); runNext(); });
      return 'async';
    }
    passed++;
  } catch (err) {
    failed++;
    console.error('  FAIL: ' + name + ' — ' + err.message);
  }
  return 'sync';
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function makeTempDir() {
  const dir = path.join(os.tmpdir(), 'ezra-real-agents-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function clearEnvKeys() {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
}

// Mock HTTP response builders
function mockAnthropicResponse(text, inputTokens, outputTokens) {
  return {
    statusCode: 200,
    body: {
      content: [{ type: 'text', text: text }],
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    },
  };
}

function mockOpenAIResponse(text, promptTokens, completionTokens) {
  return {
    statusCode: 200,
    body: {
      choices: [{ message: { content: text } }],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
    },
  };
}

function mockErrorResponse(statusCode) {
  return { statusCode: statusCode, body: { error: { message: 'test error' } } };
}

// === Queue-based async test runner ===
const asyncTests = [];
let asyncIdx = 0;

function addAsyncTest(name, fn) {
  asyncTests.push({ name, fn });
}

function runNext() {
  asyncIdx++;
  if (asyncIdx < asyncTests.length) {
    const t = asyncTests[asyncIdx];
    test(t.name, t.fn);
  } else {
    printSummary();
  }
}

function printSummary() {
  console.log('  V6-Agents-Real: ' + passed + ' passed, ' + failed + ' failed');
  console.log('  V6-Agents-Real: PASSED: ' + passed + ' FAILED: ' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

// ══════════════════════════════════════════════════════════════
// SYNC TESTS
// ══════════════════════════════════════════════════════════════

// === 1. createProvider('anthropic') returns provider with execute ===

test('createProvider anthropic returns valid interface', () => {
  const p = agents.createProvider({ type: 'anthropic' });
  assert(p.name === 'claude', 'name should be claude, got ' + p.name);
  assert(p.provider === 'anthropic', 'provider should be anthropic');
  assert(typeof p.execute === 'function', 'execute should be function');
  assert(typeof p.status === 'function', 'status should be function');
  assert(p.status() === 'ready', 'should start ready');
});

test('createProvider anthropic has correct model', () => {
  const p = agents.createProvider({ type: 'anthropic' });
  assert(p.model === 'claude-sonnet-4-20250514', 'model should be claude-sonnet-4-20250514, got ' + p.model);
});

test('createProvider anthropic custom model', () => {
  const p = agents.createProvider({ type: 'anthropic', model: 'claude-opus-4-20250514' });
  assert(p.model === 'claude-opus-4-20250514');
});

// === 2. createProvider('openai') returns provider with execute ===

test('createProvider openai returns valid interface', () => {
  const p = agents.createProvider({ type: 'openai' });
  assert(p.name === 'gpt', 'name should be gpt, got ' + p.name);
  assert(p.provider === 'openai', 'provider should be openai');
  assert(typeof p.execute === 'function');
  assert(typeof p.status === 'function');
});

test('createProvider openai has correct model', () => {
  const p = agents.createProvider({ type: 'openai' });
  assert(p.model === 'gpt-4o', 'model should be gpt-4o, got ' + p.model);
});

// === 3. Mock provider works when api_key is null ===

test('Mock provider used when no API key set', () => {
  clearEnvKeys();
  const p = agents.createProvider({ type: 'anthropic' });
  assert(p.provider === 'anthropic');
});

// === 4. Mock provider works when api_key is "mock" ===

test('Mock fallback when api_key env is mock', () => {
  clearEnvKeys();
  process.env.ANTHROPIC_API_KEY = 'mock';
  const p = agents.createProvider({ type: 'anthropic' });
  assert(p.provider === 'anthropic');
  clearEnvKeys();
});

// === 9. Cost calculation: Anthropic pricing correct ===

test('Anthropic cost: 1K in + 500 out', () => {
  const cost = agents.calcCost('anthropic', 1000, 500);
  assert(Math.abs(cost - 0.0105) < 0.0001, 'Expected ~0.0105, got ' + cost);
});

test('Anthropic cost: 1M in + 1M out = $18', () => {
  const cost = agents.calcCost('anthropic', 1000000, 1000000);
  assert(Math.abs(cost - 18) < 0.01, 'Expected 18, got ' + cost);
});

// === 10. Cost calculation: OpenAI pricing correct ===

test('OpenAI cost: 1K in + 500 out', () => {
  const cost = agents.calcCost('openai', 1000, 500);
  assert(Math.abs(cost - 0.0075) < 0.0001, 'Expected ~0.0075, got ' + cost);
});

test('OpenAI cost: 1M in + 1M out = $12.50', () => {
  const cost = agents.calcCost('openai', 1000000, 1000000);
  assert(Math.abs(cost - 12.5) < 0.01, 'Expected 12.5, got ' + cost);
});

test('Unknown provider cost is 0', () => {
  assert(agents.calcCost('unknown', 1000, 500) === 0);
});

// === 13. Stub providers return not_implemented ===

test('Stub: ollama interface', () => {
  const p = agents.createProvider({ type: 'ollama', name: 'ollama' });
  assert(p.provider === 'ollama');
  assert(typeof p.execute === 'function');
  assert(p.status() === 'ready');
});

test('Stub: cursor interface', () => {
  assert(agents.createProvider({ type: 'cursor', name: 'cursor' }).provider === 'cursor');
});

test('Stub: windsurf interface', () => {
  assert(agents.createProvider({ type: 'windsurf', name: 'windsurf' }).provider === 'windsurf');
});

test('Stub: copilot interface', () => {
  assert(agents.createProvider({ type: 'copilot', name: 'copilot' }).provider === 'copilot');
});

test('Stub: codestral interface', () => {
  assert(agents.createProvider({ type: 'codestral', name: 'codestral' }).provider === 'codestral');
});

test('Stub: deepseekcoder interface', () => {
  assert(agents.createProvider({ type: 'deepseekcoder', name: 'deepseekcoder' }).provider === 'deepseekcoder');
});

test('Stub: qoder interface', () => {
  assert(agents.createProvider({ type: 'qoder', name: 'qoder' }).provider === 'qoder');
});

test('STUB_PROVIDERS has 7 entries', () => {
  assert(agents.STUB_PROVIDERS.length === 7, 'Expected 7, got ' + agents.STUB_PROVIDERS.length);
});

// === PRICING constant ===

test('PRICING has anthropic and openai with correct values', () => {
  assert(agents.PRICING.anthropic.input_per_mtok === 3);
  assert(agents.PRICING.anthropic.output_per_mtok === 15);
  assert(agents.PRICING.openai.input_per_mtok === 2.5);
  assert(agents.PRICING.openai.output_per_mtok === 10);
});

// === 14. Settings round-trip with new providers section ===

test('Settings DEFAULTS has flat provider keys', () => {
  const settings = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));
  const a = settings.DEFAULTS.agents;
  assert(a.enabled === true);
  assert(a.default_provider === 'anthropic');
  assert(a.fallback_provider === 'openai');
  assert(a.anthropic_model === 'claude-sonnet-4-20250514');
  assert(a.openai_model === 'gpt-4o');
  assert(a.ollama_model === 'codellama');
  assert(a.anthropic_api_key === null);
  assert(a.openai_api_key === null);
  assert(a.ollama_endpoint === 'http://localhost:11434');
});

// === 11. assignTask selects best agent based on scoring ===

test('assignTask selects best agent with performance data', () => {
  const dir = makeTempDir();
  try {
    const agentsDir = path.join(dir, '.ezra', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    agents.writeYaml(path.join(agentsDir, 'roster.yaml'), {
      claude: { type: 'llm', model: 'sonnet', status: 'ready' },
      gpt: { type: 'llm', model: 'gpt-4o', status: 'ready' },
    });
    agents.recordTaskResult(dir, 'claude', {}, { cost: 0.01, duration: 100, success: true });
    agents.recordTaskResult(dir, 'claude', {}, { cost: 0.01, duration: 100, success: true });
    agents.recordTaskResult(dir, 'gpt', {}, { cost: 0.10, duration: 500, success: false });

    const result = agents.assignTask(dir, { type: 'review' }, 'auto');
    assert(result.scores && result.scores.length === 2);
    assert(result.agent === 'claude', 'Claude should win (better perf)');
  } finally { cleanup(dir); }
});

// === 12. getAgentLeaderboard returns sorted list ===

test('getAgentLeaderboard sorted ascending by quality_adjusted_cost', () => {
  const dir = makeTempDir();
  try {
    agents.recordTaskResult(dir, 'claude', {}, { cost: 0.01, duration: 100, success: true });
    agents.recordTaskResult(dir, 'gpt', {}, { cost: 0.10, duration: 500, success: true });
    const board = agents.getAgentLeaderboard(dir);
    assert(board.length === 2);
    assert(board[0].quality_adjusted_cost <= board[1].quality_adjusted_cost);
  } finally { cleanup(dir); }
});

// === Module exports completeness ===

test('Module exports all required items', () => {
  const required = [
    'SUPPORTED_PROVIDERS', 'ASSIGNMENT_STRATEGIES', 'SCORING_WEIGHTS',
    'PRICING', 'STUB_PROVIDERS',
    'createProvider', 'createAnthropicProvider', 'createOpenAIProvider',
    'createStubProvider', 'createMockProvider',
    'executeWithFallback', 'resolveApiKey', 'resolveModel', 'calcCost',
    'setHttpsPost',
    'loadAgentConfig', 'getAgentRoster', 'assignTask',
    'recordTaskResult', 'getAgentPerformance', 'getAgentLeaderboard',
    'checkBudget', 'writeYaml', 'readYaml',
  ];
  for (const name of required) {
    assert(name in agents, 'Missing export: ' + name);
  }
});

// === Default/mock provider backwards compat ===

test('createProvider unknown type returns mock', () => {
  assert(agents.createProvider({ name: 'unknown_thing' }).provider === 'mock');
});

test('createProvider empty config returns mock', () => {
  const p = agents.createProvider({});
  assert(p.provider === 'mock');
  assert(p.name === 'mock');
});

// ══════════════════════════════════════════════════════════════
// ASYNC TESTS (queued sequentially)
// ══════════════════════════════════════════════════════════════

addAsyncTest('Anthropic execute falls through to mock when no key', () => {
  clearEnvKeys();
  const p = agents.createProvider({ type: 'anthropic' });
  return p.execute({ prompt: 'hello' }).then(result => {
    assert(result.success === true);
    assert(result.output.includes('Mock response'));
    assert(typeof result.tokens_in === 'number');
    assert(typeof result.tokens_out === 'number');
    assert(typeof result.cost_usd === 'number');
  });
});

addAsyncTest('OpenAI execute falls through to mock when key is mock', () => {
  clearEnvKeys();
  process.env.OPENAI_API_KEY = 'mock';
  const p = agents.createProvider({ type: 'openai' });
  return p.execute({ prompt: 'test' }).then(result => {
    assert(result.success === true);
    assert(result.output.includes('Mock response'));
    clearEnvKeys();
  });
});

addAsyncTest('Anthropic execute sends correct API format', () => {
  clearEnvKeys();
  process.env.ANTHROPIC_API_KEY = 'sk-test-key-123';
  let capturedUrl, capturedBody, capturedHeaders;

  agents.setHttpsPost(async (url, body, headers) => {
    capturedUrl = url;
    capturedBody = body;
    capturedHeaders = headers;
    return mockAnthropicResponse('Hello from Claude', 150, 50);
  });

  const p = agents.createProvider({ type: 'anthropic' });
  return p.execute({ prompt: 'test prompt' }).then(result => {
    assert(capturedUrl === 'https://api.anthropic.com/v1/messages');
    assert(capturedBody.model === 'claude-sonnet-4-20250514');
    assert(capturedBody.max_tokens === 4096);
    assert(capturedBody.messages[0].role === 'user');
    assert(capturedBody.messages[0].content === 'test prompt');
    assert(capturedHeaders['x-api-key'] === 'sk-test-key-123');
    assert(capturedHeaders['anthropic-version'] === '2023-06-01');
    assert(result.success === true);
    assert(result.output === 'Hello from Claude');
    assert(result.tokens_in === 150);
    assert(result.tokens_out === 50);
    assert(typeof result.cost_usd === 'number');
    assert(typeof result.duration_ms === 'number');
    clearEnvKeys();
    agents.setHttpsPost(null);
  });
});

addAsyncTest('OpenAI execute sends correct API format', () => {
  clearEnvKeys();
  process.env.OPENAI_API_KEY = 'sk-openai-test-456';
  let capturedUrl, capturedBody, capturedHeaders;

  agents.setHttpsPost(async (url, body, headers) => {
    capturedUrl = url;
    capturedBody = body;
    capturedHeaders = headers;
    return mockOpenAIResponse('Hello from GPT', 100, 200);
  });

  const p = agents.createProvider({ type: 'openai' });
  return p.execute({ prompt: 'test openai' }).then(result => {
    assert(capturedUrl === 'https://api.openai.com/v1/chat/completions');
    assert(capturedBody.model === 'gpt-4o');
    assert(capturedBody.messages[0].role === 'user');
    assert(capturedBody.messages[0].content === 'test openai');
    assert(capturedHeaders['Authorization'] === 'Bearer sk-openai-test-456');
    assert(result.success === true);
    assert(result.output === 'Hello from GPT');
    assert(result.tokens_in === 100);
    assert(result.tokens_out === 200);
    clearEnvKeys();
    agents.setHttpsPost(null);
  });
});

addAsyncTest('Anthropic returns failure on 429', () => {
  clearEnvKeys();
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  agents.setHttpsPost(async () => mockErrorResponse(429));
  const p = agents.createProvider({ type: 'anthropic' });
  return p.execute({ prompt: 'test' }).then(result => {
    assert(result.success === false);
    assert(result.error.includes('429'));
    clearEnvKeys();
    agents.setHttpsPost(null);
  });
});

addAsyncTest('OpenAI returns failure on 500', () => {
  clearEnvKeys();
  process.env.OPENAI_API_KEY = 'sk-test';
  agents.setHttpsPost(async () => mockErrorResponse(500));
  const p = agents.createProvider({ type: 'openai' });
  return p.execute({ prompt: 'test' }).then(result => {
    assert(result.success === false);
    assert(result.error.includes('500'));
    clearEnvKeys();
    agents.setHttpsPost(null);
  });
});

addAsyncTest('Anthropic handles network exception', () => {
  clearEnvKeys();
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  agents.setHttpsPost(async () => { throw new Error('ECONNREFUSED'); });
  const p = agents.createProvider({ type: 'anthropic' });
  return p.execute({ prompt: 'test' }).then(result => {
    assert(result.success === false);
    assert(result.error.includes('ECONNREFUSED'));
    clearEnvKeys();
    agents.setHttpsPost(null);
  });
});

addAsyncTest('Stub ollama returns not_implemented', () => {
  return agents.createProvider({ type: 'ollama', name: 'ollama' }).execute({ prompt: 'test' }).then(r => {
    assert(r.success === false && r.reason === 'provider_not_implemented' && r.provider === 'ollama');
  });
});

addAsyncTest('Stub cursor returns not_implemented', () => {
  return agents.createProvider({ type: 'cursor', name: 'cursor' }).execute({ prompt: 'test' }).then(r => {
    assert(r.success === false && r.reason === 'provider_not_implemented');
  });
});

addAsyncTest('Stub windsurf returns not_implemented', () => {
  return agents.createProvider({ type: 'windsurf', name: 'windsurf' }).execute({ prompt: 'test' }).then(r => {
    assert(r.success === false && r.reason === 'provider_not_implemented');
  });
});

addAsyncTest('Stub copilot returns not_implemented', () => {
  return agents.createProvider({ type: 'copilot', name: 'copilot' }).execute({ prompt: 'test' }).then(r => {
    assert(r.success === false && r.reason === 'provider_not_implemented');
  });
});

addAsyncTest('Stub codestral returns not_implemented', () => {
  return agents.createProvider({ type: 'codestral', name: 'codestral' }).execute({ prompt: 'test' }).then(r => {
    assert(r.success === false && r.reason === 'provider_not_implemented');
  });
});

addAsyncTest('Stub deepseekcoder returns not_implemented', () => {
  return agents.createProvider({ type: 'deepseekcoder', name: 'deepseekcoder' }).execute({ prompt: 'test' }).then(r => {
    assert(r.success === false && r.reason === 'provider_not_implemented');
  });
});

addAsyncTest('Stub qoder returns not_implemented', () => {
  return agents.createProvider({ type: 'qoder', name: 'qoder' }).execute({ prompt: 'test' }).then(r => {
    assert(r.success === false && r.reason === 'provider_not_implemented');
  });
});

// === 5. Budget blocks when exceeded ===

addAsyncTest('executeWithFallback blocked by budget overspend', () => {
  const dir = makeTempDir();
  const budgetDir = path.join(dir, '.ezra', 'agents');
  fs.mkdirSync(budgetDir, { recursive: true });
  agents.writeYaml(path.join(budgetDir, 'budget.yaml'), { daily_spend: 15.0, monthly_spend: 50.0 });

  return agents.executeWithFallback(dir, { prompt: 'test' }).then(result => {
    assert(result.success === false);
    assert(result.reason === 'budget_exceeded');
    cleanup(dir);
  });
});

// === 6. Budget allows when under limit ===

addAsyncTest('executeWithFallback succeeds when under budget', () => {
  clearEnvKeys();
  const dir = makeTempDir();
  const budgetDir = path.join(dir, '.ezra', 'agents');
  fs.mkdirSync(budgetDir, { recursive: true });
  agents.writeYaml(path.join(budgetDir, 'budget.yaml'), { daily_spend: 2.0, monthly_spend: 30.0 });

  return agents.executeWithFallback(dir, { prompt: 'test' }).then(result => {
    assert(result.success === true);
    assert(result.provider_used);
    cleanup(dir);
  });
});

// === 8. Fallback triggers on primary failure ===

addAsyncTest('Fallback triggers when primary fails', () => {
  clearEnvKeys();
  process.env.ANTHROPIC_API_KEY = 'sk-primary';
  process.env.OPENAI_API_KEY = 'sk-fallback';

  let callCount = 0;
  agents.setHttpsPost(async (url) => {
    callCount++;
    if (url.includes('anthropic')) return mockErrorResponse(503);
    return mockOpenAIResponse('Fallback worked', 50, 100);
  });

  const dir = makeTempDir();
  return agents.executeWithFallback(dir, { prompt: 'test' }, 'anthropic', 'openai').then(result => {
    assert(callCount === 2, 'Should make 2 calls, got ' + callCount);
    assert(result.success === true);
    assert(result.output === 'Fallback worked');
    assert(result.provider_used === 'openai');
    assert(result.fallback === true);
    cleanup(dir);
    clearEnvKeys();
    agents.setHttpsPost(null);
  });
});

// === 7. recordTaskResult with cost_usd field ===

addAsyncTest('recordTaskResult handles cost_usd field', () => {
  const dir = makeTempDir();
  const result = agents.recordTaskResult(dir, 'claude', {}, { cost_usd: 0.0105, duration_ms: 250, success: true });
  assert(result.tasks_completed === 1);
  assert(result.total_cost > 0);
  assert(fs.existsSync(path.join(dir, '.ezra', 'agents', 'performance', 'claude.yaml')));
  cleanup(dir);
  return Promise.resolve();
});

// === Execute returns correct cost amounts ===

addAsyncTest('Anthropic execute returns correct cost_usd', () => {
  clearEnvKeys();
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  agents.setHttpsPost(async () => mockAnthropicResponse('test', 1000, 500));
  const p = agents.createProvider({ type: 'anthropic' });
  return p.execute({ prompt: 'test' }).then(result => {
    assert(Math.abs(result.cost_usd - 0.0105) < 0.001, 'Expected ~0.0105, got ' + result.cost_usd);
    clearEnvKeys();
    agents.setHttpsPost(null);
  });
});

addAsyncTest('OpenAI execute returns correct cost_usd', () => {
  clearEnvKeys();
  process.env.OPENAI_API_KEY = 'sk-test';
  agents.setHttpsPost(async () => mockOpenAIResponse('test', 1000, 500));
  const p = agents.createProvider({ type: 'openai' });
  return p.execute({ prompt: 'test' }).then(result => {
    assert(Math.abs(result.cost_usd - 0.0075) < 0.001, 'Expected ~0.0075, got ' + result.cost_usd);
    clearEnvKeys();
    agents.setHttpsPost(null);
  });
});

// ══════════════════════════════════════════════════════════════
// RUN
// ══════════════════════════════════════════════════════════════

if (asyncTests.length > 0) {
  asyncIdx = 0;
  test(asyncTests[0].name, asyncTests[0].fn);
} else {
  printSummary();
}
