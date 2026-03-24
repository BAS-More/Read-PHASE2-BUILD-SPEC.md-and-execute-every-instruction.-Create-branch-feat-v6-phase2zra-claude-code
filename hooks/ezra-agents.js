#!/usr/bin/env node
'use strict';

/**
 * EZRA Multi-Agent Orchestration Engine
 *
 * Agent roster management, task assignment with weighted scoring,
 * performance tracking, budget management, and real LLM providers.
 *
 * Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');

// EZRA feedback helpers (non-blocking)
let _log, _fmt;
try { _log = require('./ezra-hook-logger').logHookEvent; } catch { _log = () => {}; }
try { _fmt = require('./ezra-error-codes').formatError; } catch { _fmt = (c) => 'EZRA: ' + c; }

// --- HTTP dependency (injectable for testing) ---

let _httpsPost = null;
function getHttpsPost() {
  if (!_httpsPost) {
    _httpsPost = require(path.join(__dirname, 'ezra-http.js')).httpsPost;
  }
  return _httpsPost;
}
function setHttpsPost(fn) { _httpsPost = fn; }

// --- Supported Providers ---

const SUPPORTED_PROVIDERS = [
  { name: 'claude', type: 'llm', integration: ['api', 'mcp'] },
  { name: 'codex', type: 'llm', integration: ['api'] },
  { name: 'cursor', type: 'ide-agent', integration: ['extension'] },
  { name: 'copilot', type: 'ide-agent', integration: ['extension', 'api'] },
  { name: 'gemini', type: 'llm', integration: ['api'] },
  { name: 'grok', type: 'llm', integration: ['api'] },
  { name: 'mistral', type: 'llm', integration: ['api'] },
  { name: 'llama', type: 'llm', integration: ['local', 'api'] },
  { name: 'deepseek', type: 'llm', integration: ['api'] },
];

// --- Assignment Strategies ---

const ASSIGNMENT_STRATEGIES = ['auto', 'manual', 'round-robin', 'cost-optimised', 'quality-optimised'];

// --- Scoring Weights ---

const SCORING_WEIGHTS = {
  skill_match: 0.35,
  cost_efficiency: 0.25,
  speed: 0.15,
  quality_score: 0.15,
  availability: 0.10,
};

// --- Pricing ---

const PRICING = {
  anthropic: { input_per_mtok: 3, output_per_mtok: 15 },
  openai: { input_per_mtok: 2.5, output_per_mtok: 10 },
};

// --- Path Helpers ---

function getAgentsDir(projectDir) {
  return path.join(projectDir, '.ezra', 'agents');
}

function getRosterPath(projectDir) {
  return path.join(getAgentsDir(projectDir), 'roster.yaml');
}

function getBudgetPath(projectDir) {
  return path.join(getAgentsDir(projectDir), 'budget.yaml');
}

function getTaskLogPath(projectDir) {
  return path.join(getAgentsDir(projectDir), 'task-log.yaml');
}

function getPerformancePath(projectDir, agentName) {
  return path.join(getAgentsDir(projectDir), 'performance', agentName + '.yaml');
}

// --- Simple YAML helpers ---

function writeYaml(filePath, obj) {
  const lines = [];
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) {
      lines.push(key + ': [' + val.join(', ') + ']');
    } else if (typeof val === 'object' && val !== null) {
      lines.push(key + ':');
      for (const [k2, v2] of Object.entries(val)) {
        lines.push('  ' + k2 + ': ' + v2);
      }
    } else {
      lines.push(key + ': ' + val);
    }
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

function readYaml(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, 'utf8');
  const result = {};
  let currentSection = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent === 0) {
      const m = line.match(/^([\w_-]+):\s*(.*)?$/);
      if (!m) continue;
      const key = m[1];
      const val = (m[2] || '').trim();
      if (val === '' || val === undefined) {
        currentSection = key;
        result[key] = {};
      } else if (val.startsWith('[') && val.endsWith(']')) {
        currentSection = null;
        const inner = val.slice(1, -1).trim();
        result[key] = inner === '' ? [] : inner.split(',').map(s => s.trim());
      } else if (val === 'true') { result[key] = true; currentSection = null; }
      else if (val === 'false') { result[key] = false; currentSection = null; }
      else if (/^-?\d+\.\d+$/.test(val)) { result[key] = parseFloat(val); currentSection = null; }
      else if (/^-?\d+$/.test(val)) { result[key] = parseInt(val, 10); currentSection = null; }
      else { result[key] = val; currentSection = null; }
    } else if (currentSection) {
      const trimmed = line.trim();
      const m = trimmed.match(/^([\w_-]+):\s*(.*)?$/);
      if (m) {
        const key = m[1];
        const val = (m[2] || '').trim();
        if (typeof result[currentSection] !== 'object') result[currentSection] = {};
        if (val === 'true') result[currentSection][key] = true;
        else if (val === 'false') result[currentSection][key] = false;
        else if (/^-?\d+\.\d+$/.test(val)) result[currentSection][key] = parseFloat(val);
        else if (/^-?\d+$/.test(val)) result[currentSection][key] = parseInt(val, 10);
        else result[currentSection][key] = val;
      }
    }
  }
  return result;
}

// --- Resolve API Key ---

function resolveApiKey(providerType, projectDir) {
  // 1. Try settings (flat keys: anthropic_api_key, openai_api_key)
  try {
    const settings = require(path.join(__dirname, 'ezra-settings.js'));
    const agentsCfg = settings.loadSettings(projectDir).agents || {};
    const key = agentsCfg[providerType + '_api_key'];
    if (key && key !== 'null' && key !== 'mock') {
      return key;
    }
  } catch {
    const msg = _fmt('AGENTS_002', {});
    console.error(msg);
    _log(projectDir || process.cwd(), 'ezra-agents', 'info', msg);
  }
  // 2. Try env
  if (providerType === 'anthropic') return process.env.ANTHROPIC_API_KEY || null;
  if (providerType === 'openai') return process.env.OPENAI_API_KEY || null;
  return null;
}

function resolveModel(providerType, projectDir) {
  try {
    const settings = require(path.join(__dirname, 'ezra-settings.js'));
    const agentsCfg = settings.loadSettings(projectDir).agents || {};
    const model = agentsCfg[providerType + '_model'];
    if (model) return model;
  } catch {
    const msg = _fmt('AGENTS_002', {});
    console.error(msg);
    _log(projectDir || process.cwd(), 'ezra-agents', 'info', msg);
  }
  if (providerType === 'anthropic') return 'claude-sonnet-4-20250514';
  if (providerType === 'openai') return 'gpt-4o';
  return 'unknown';
}

// --- Cost Calculation ---

function calcCost(providerType, tokensIn, tokensOut) {
  const pricing = PRICING[providerType];
  if (!pricing) return 0;
  const inputCost = (tokensIn / 1000000) * pricing.input_per_mtok;
  const outputCost = (tokensOut / 1000000) * pricing.output_per_mtok;
  return Math.round((inputCost + outputCost) * 1000000) / 1000000;
}

// --- Provider Factory ---

function createMockProvider(config) {
  const name = config.name || 'mock';
  const type = config.type || 'llm';
  const model = config.model || name;
  let busy = false;

  return {
    name,
    type,
    model,
    provider: 'mock',
    execute: async (task) => {
      busy = true;
      const tokens_in = 200 + Math.floor(Math.random() * 300);
      const tokens_out = 300 + Math.floor(Math.random() * 700);
      const cost = tokens_in * 0.000003 + tokens_out * 0.000015;
      await new Promise(r => setTimeout(r, 10));
      busy = false;
      return {
        success: true,
        output: 'Mock response for: ' + (task.prompt || task.description || task),
        tokens_in,
        tokens_out,
        tokens: tokens_in + tokens_out,
        cost_usd: Math.round(cost * 1000000) / 1000000,
        cost: Math.round(cost * 10000) / 10000,
        duration_ms: 100 + Math.floor(Math.random() * 200),
        duration: 100 + Math.floor(Math.random() * 200),
      };
    },
    status: () => busy ? 'busy' : 'ready',
  };
}

function createAnthropicProvider(config) {
  const name = 'claude';
  const type = 'llm';
  const providerType = 'anthropic';
  const projectDir = config.projectDir || process.cwd();
  const model = config.model || resolveModel(providerType, projectDir);
  let busy = false;

  return {
    name,
    type,
    model,
    provider: providerType,
    execute: async (task) => {
      const apiKey = resolveApiKey(providerType, projectDir);
      if (!apiKey || apiKey === 'mock') {
        return createMockProvider({ name, type, model }).execute(task);
      }

      busy = true;
      const start = Date.now();
      try {
        const prompt = task.prompt || task.description || String(task);
        const body = {
          model: model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        };
        const headers = {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        };
        const httpPost = getHttpsPost();
        const res = await httpPost('https://api.anthropic.com/v1/messages', body, headers);
        const duration_ms = Date.now() - start;

        if (res.statusCode !== 200) {
          busy = false;
          return { success: false, output: '', error: 'API error: ' + res.statusCode, duration_ms };
        }

        const resBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
        const output = (resBody.content && resBody.content[0] && resBody.content[0].text) || '';
        const usage = resBody.usage || {};
        const tokens_in = usage.input_tokens || 0;
        const tokens_out = usage.output_tokens || 0;
        const cost_usd = calcCost(providerType, tokens_in, tokens_out);

        busy = false;
        return { success: true, output, tokens_in, tokens_out, cost_usd, duration_ms };
      } catch (err) {
        busy = false;
        return { success: false, output: '', error: err.message, duration_ms: Date.now() - start };
      }
    },
    status: () => busy ? 'busy' : 'ready',
  };
}

function createOpenAIProvider(config) {
  const name = 'gpt';
  const type = 'llm';
  const providerType = 'openai';
  const projectDir = config.projectDir || process.cwd();
  const model = config.model || resolveModel(providerType, projectDir);
  let busy = false;

  return {
    name,
    type,
    model,
    provider: providerType,
    execute: async (task) => {
      const apiKey = resolveApiKey(providerType, projectDir);
      if (!apiKey || apiKey === 'mock') {
        return createMockProvider({ name, type, model }).execute(task);
      }

      busy = true;
      const start = Date.now();
      try {
        const prompt = task.prompt || task.description || String(task);
        const body = {
          model: model,
          messages: [{ role: 'user', content: prompt }],
        };
        const headers = {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        };
        const httpPost = getHttpsPost();
        const res = await httpPost('https://api.openai.com/v1/chat/completions', body, headers);
        const duration_ms = Date.now() - start;

        if (res.statusCode !== 200) {
          busy = false;
          return { success: false, output: '', error: 'API error: ' + res.statusCode, duration_ms };
        }

        const resBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
        const output = (resBody.choices && resBody.choices[0] && resBody.choices[0].message && resBody.choices[0].message.content) || '';
        const usage = resBody.usage || {};
        const tokens_in = usage.prompt_tokens || 0;
        const tokens_out = usage.completion_tokens || 0;
        const cost_usd = calcCost(providerType, tokens_in, tokens_out);

        busy = false;
        return { success: true, output, tokens_in, tokens_out, cost_usd, duration_ms };
      } catch (err) {
        busy = false;
        return { success: false, output: '', error: err.message, duration_ms: Date.now() - start };
      }
    },
    status: () => busy ? 'busy' : 'ready',
  };
}

// --- Stub Providers ---

const STUB_PROVIDERS = ['ollama', 'cursor', 'windsurf', 'copilot', 'codestral', 'deepseekcoder', 'qoder'];

function createStubProvider(config) {
  const name = config.name || config.type || 'stub';
  return {
    name,
    type: config.type || 'llm',
    model: config.model || name,
    provider: name,
    execute: async () => {
      return { success: false, reason: 'provider_not_implemented', provider: name };
    },
    status: () => 'ready',
  };
}

// --- Unified Provider Factory ---

function createProvider(config) {
  const providerType = config.type || config.name || 'mock';

  if (providerType === 'anthropic') return createAnthropicProvider(config);
  if (providerType === 'openai') return createOpenAIProvider(config);
  if (STUB_PROVIDERS.includes(providerType)) return createStubProvider(config);

  // Default: mock provider (backwards-compatible)
  return createMockProvider(config);
}

// --- Execute With Fallback ---

async function executeWithFallback(projectDir, task, primaryType, fallbackType) {
  const config = loadAgentConfig(projectDir);
  primaryType = primaryType || config.default_provider || 'anthropic';
  fallbackType = fallbackType || config.fallback_provider || (primaryType === 'anthropic' ? 'openai' : 'anthropic');

  // Budget check
  const budget = checkBudget(projectDir);
  if (budget.overspend) {
    return { success: false, reason: 'budget_exceeded', budget };
  }

  // Try primary
  const primary = createProvider({ type: primaryType, projectDir });
  const result = await primary.execute(task);
  if (result.success) {
    return { ...result, provider_used: primaryType };
  }

  // Try fallback (max 1 attempt)
  const fallback = createProvider({ type: fallbackType, projectDir });
  const fallbackResult = await fallback.execute(task);
  return { ...fallbackResult, provider_used: fallbackType, fallback: true };
}

// --- Load Agent Config ---

function loadAgentConfig(projectDir) {
  try {
    const settings = require(path.join(__dirname, 'ezra-settings.js'));
    return settings.loadSettings(projectDir).agents || {};
  } catch {
    const msg = _fmt('AGENTS_002', {});
    _log(projectDir || process.cwd(), 'ezra-agents', 'info', msg);
    return {};
  }
}

// --- Roster Management ---

function getAgentRoster(projectDir) {
  const rosterPath = getRosterPath(projectDir);
  if (!fs.existsSync(rosterPath)) return [];
  const data = readYaml(rosterPath);
  const agents = [];
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'object' && val !== null) {
      agents.push({ name: key, ...val });
    }
  }
  return agents;
}

// --- Task Assignment ---

function assignTask(projectDir, task, strategy) {
  strategy = strategy || 'auto';
  const roster = getAgentRoster(projectDir);
  if (roster.length === 0) {
    return { agent: SUPPORTED_PROVIDERS[0].name, strategy, reason: 'no_roster_fallback_to_default' };
  }

  if (strategy === 'manual') {
    return { agent: roster[0].name, strategy: 'manual', reason: 'manual_selection' };
  }

  if (strategy === 'round-robin') {
    const log = readYaml(getTaskLogPath(projectDir));
    const lastIdx = log.last_index || 0;
    const nextIdx = (lastIdx + 1) % roster.length;
    return { agent: roster[nextIdx].name, strategy: 'round-robin', reason: 'round_robin_index_' + nextIdx };
  }

  // Auto / cost-optimised / quality-optimised: use weighted scoring
  const taskType = (task && task.type) || 'general';
  const scores = [];

  for (const agent of roster) {
    const perf = getAgentPerformance(projectDir, agent.name);
    const skillMatch = perf.success_rate || 0.5;
    const costEff = perf.avg_cost ? (1 / (perf.avg_cost + 0.001)) : 0.5;
    const speed = perf.avg_duration ? (1 / (perf.avg_duration + 1)) : 0.5;
    const quality = perf.acceptance_rate || 0.5;
    const avail = agent.status === 'offline' ? 0 : 1;

    let weights = { ...SCORING_WEIGHTS };
    if (strategy === 'cost-optimised') {
      weights = { skill_match: 0.2, cost_efficiency: 0.45, speed: 0.15, quality_score: 0.1, availability: 0.1 };
    } else if (strategy === 'quality-optimised') {
      weights = { skill_match: 0.25, cost_efficiency: 0.1, speed: 0.1, quality_score: 0.45, availability: 0.1 };
    }

    const score = (skillMatch * weights.skill_match) +
      (Math.min(costEff, 1) * weights.cost_efficiency) +
      (Math.min(speed, 1) * weights.speed) +
      (quality * weights.quality_score) +
      (avail * weights.availability);

    scores.push({ agent: agent.name, score: Math.round(score * 1000) / 1000 });
  }

  scores.sort((a, b) => b.score - a.score);
  return { agent: scores[0].agent, strategy, scores, reason: 'weighted_scoring' };
}

// --- Performance Tracking ---

function recordTaskResult(projectDir, agentName, task, result) {
  const perfDir = path.join(getAgentsDir(projectDir), 'performance');
  if (!fs.existsSync(perfDir)) fs.mkdirSync(perfDir, { recursive: true });

  const perfPath = getPerformancePath(projectDir, agentName);
  const perf = fs.existsSync(perfPath) ? readYaml(perfPath) : {};

  const tasks_completed = (perf.tasks_completed || 0) + 1;
  const total_cost = (perf.total_cost || 0) + (result.cost || result.cost_usd || 0);
  const total_duration = (perf.total_duration || 0) + (result.duration || result.duration_ms || 0);
  const successes = (perf.successes || 0) + (result.success !== false ? 1 : 0);

  const updated = {
    agent: agentName,
    tasks_completed,
    successes,
    total_cost: Math.round(total_cost * 10000) / 10000,
    total_duration,
    avg_cost: Math.round((total_cost / tasks_completed) * 10000) / 10000,
    avg_duration: Math.round(total_duration / tasks_completed),
    success_rate: Math.round((successes / tasks_completed) * 100) / 100,
    acceptance_rate: Math.round((successes / tasks_completed) * 100) / 100,
    last_task: new Date().toISOString().slice(0, 19),
  };

  writeYaml(perfPath, updated);

  // Also log to task-log
  const logPath = getTaskLogPath(projectDir);
  const log = fs.existsSync(logPath) ? readYaml(logPath) : {};
  log.total_tasks = (log.total_tasks || 0) + 1;
  log.last_agent = agentName;
  log.last_task_time = updated.last_task;
  writeYaml(logPath, log);

  return updated;
}

function getAgentPerformance(projectDir, agentName) {
  const perfPath = getPerformancePath(projectDir, agentName);
  if (!fs.existsSync(perfPath)) {
    return { agent: agentName, tasks_completed: 0, successes: 0, total_cost: 0, avg_cost: 0, avg_duration: 0, success_rate: 0.5, acceptance_rate: 0.5 };
  }
  return readYaml(perfPath);
}

function getAgentLeaderboard(projectDir) {
  const perfDir = path.join(getAgentsDir(projectDir), 'performance');
  if (!fs.existsSync(perfDir)) return [];
  const files = fs.readdirSync(perfDir).filter(f => f.endsWith('.yaml'));
  const agents = files.map(f => {
    const data = readYaml(path.join(perfDir, f));
    const qualityAdjustedCost = data.avg_cost && data.success_rate
      ? Math.round((data.avg_cost / Math.max(data.success_rate, 0.01)) * 10000) / 10000
      : 999;
    return { ...data, quality_adjusted_cost: qualityAdjustedCost };
  });
  agents.sort((a, b) => a.quality_adjusted_cost - b.quality_adjusted_cost);
  return agents;
}

// --- Budget ---

function checkBudget(projectDir) {
  const budgetPath = getBudgetPath(projectDir);
  const config = loadAgentConfig(projectDir);
  const dailyCeiling = config.daily_budget_usd || config.budget_ceiling_daily || 10;
  const monthlyCeiling = config.monthly_budget_usd || config.budget_ceiling_monthly || 200;
  const currency = config.budget_ceiling_currency || 'USD';

  const budget = fs.existsSync(budgetPath) ? readYaml(budgetPath) : { daily_spend: 0, monthly_spend: 0 };

  return {
    daily_spend: budget.daily_spend || 0,
    monthly_spend: budget.monthly_spend || 0,
    daily_ceiling: dailyCeiling,
    monthly_ceiling: monthlyCeiling,
    currency: currency,
    daily_remaining: dailyCeiling - (budget.daily_spend || 0),
    monthly_remaining: monthlyCeiling - (budget.monthly_spend || 0),
    overspend: (budget.daily_spend || 0) > dailyCeiling || (budget.monthly_spend || 0) > monthlyCeiling,
  };
}

// --- Exports ---

module.exports = {
  SUPPORTED_PROVIDERS,
  ASSIGNMENT_STRATEGIES,
  SCORING_WEIGHTS,
  PRICING,
  STUB_PROVIDERS,
  createProvider,
  createAnthropicProvider,
  createOpenAIProvider,
  createStubProvider,
  createMockProvider,
  executeWithFallback,
  resolveApiKey,
  resolveModel,
  calcCost,
  setHttpsPost,
  loadAgentConfig,
  getAgentRoster,
  assignTask,
  recordTaskResult,
  getAgentPerformance,
  getAgentLeaderboard,
  checkBudget,
  writeYaml,
  readYaml,
};

// --- Hook Protocol ---

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input);
      const cwd = event.cwd || process.cwd();
      const action = event.action || 'roster';

      if (action === 'roster') {
        process.stdout.write(JSON.stringify(getAgentRoster(cwd)));
      } else if (action === 'assign') {
        process.stdout.write(JSON.stringify(assignTask(cwd, event.task, event.strategy)));
      } else if (action === 'performance') {
        process.stdout.write(JSON.stringify(getAgentPerformance(cwd, event.agent)));
      } else if (action === 'leaderboard') {
        process.stdout.write(JSON.stringify(getAgentLeaderboard(cwd)));
      } else if (action === 'budget') {
        process.stdout.write(JSON.stringify(checkBudget(cwd)));
      } else {
        process.stdout.write('{}');
      }
    } catch (hookErr) {
      const msg = 'EZRA [AGENTS]: Hook error — ' + (hookErr && hookErr.message ? hookErr.message : 'unknown');
      console.error(msg);
      _log(process.cwd(), 'ezra-agents', 'error', msg);
      process.stdout.write('{}');
    }
    process.exit(0);
  });
}
