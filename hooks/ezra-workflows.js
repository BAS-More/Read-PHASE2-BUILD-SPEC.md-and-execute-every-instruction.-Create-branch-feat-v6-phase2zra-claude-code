'use strict';

const MAX_STDIN = 1024 * 1024; // 1 MB stdin safety limit
const MAX_SCAN_DEPTH = 5; // Safety limit for recursive directory scans

/**
 * EZRA Workflow Templates Engine
 * Enhanced workflow system: template management, validation, execution tracking,
 * step dependencies, conditional logic, and reusable workflow composition.
 * Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');

// EZRA feedback helpers (non-blocking)
let _log, _fmt;
try { _log = require('./ezra-hook-logger').logHookEvent; } catch { _log = () => {}; }
try { _fmt = require('./ezra-error-codes').formatError; } catch { _fmt = (c) => 'EZRA: ' + c; }

// ─── Constants ───────────────────────────────────────────────────

const STEP_TYPES = ['ezra', 'shell', 'manual', 'conditional', 'parallel', 'checkpoint', 'command', 'report', 'approval'];
const STEP_ON_FAILURE = ['stop', 'skip', 'ask', 'retry'];
const WORKFLOW_STATUSES = ['draft', 'active', 'archived', 'running', 'completed', 'failed'];
const TEMPLATE_DIR = 'templates';
const PROCESS_DIR = '.ezra/processes';
const ACTIVE_DIR = 'active';
const RUNS_DIR = 'runs';

// ─── YAML Helpers (2-level safe) ─────────────────────────────────

function readYaml(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result = {};
  let currentKey = null;
  let inArray = false;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    if (trimmed.startsWith('- ') && currentKey && inArray) {
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      result[currentKey].push(trimmed.slice(2).trim());
      continue;
    }
    
    const match = trimmed.match(/^([\w.-]+):\s*(.*)$/);
    if (match) {
      const [, key, val] = match;
      if (/^(__proto__|constructor|prototype)$/.test(key)) continue;
      if (val === '' || val === '|' || val === '>') {
        currentKey = key;
        inArray = true;
        result[key] = [];
      } else {
        result[key] = parseVal(val);
        currentKey = key;
        inArray = false;
      }
    }
  }
  return result;
}

function parseVal(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null' || val === '~') return null;
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
  if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
  if (val.startsWith('[') && val.endsWith(']')) {
    return val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
  }
  return val;
}

function writeYaml(filePath, data) {
  const lines = [];
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      lines.push(key + ':');
      for (const item of val) {
        if (typeof item === 'object' && item !== null) {
          lines.push('  - ' + serializeInline(item));
        } else {
          lines.push('  - ' + item);
        }
      }
    } else if (typeof val === 'object' && val !== null) {
      lines.push(key + ':');
      for (const [k, v] of Object.entries(val)) lines.push('  ' + k + ': ' + v);
    } else {
      lines.push(key + ': ' + (val === null ? 'null' : val));
    }
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

function serializeInline(obj) {
  return '{' + Object.entries(obj).map(([k, v]) => k + ': ' + v).join(', ') + '}';
}

// ─── Template Parsing (full YAML for templates) ──────────────────

function parseTemplate(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const template = {
    name: '',
    description: '',
    version: 1,
    author: 'EZRA',
    guard_rails: { require_clean_git: false, block_on_failure: false },
    steps: [],
    raw: content,
  };

  let currentBlock = null;
  let currentStep = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed === 'guard_rails:') { currentBlock = 'guard_rails'; continue; }
    if (trimmed === 'steps:') { currentBlock = 'steps'; continue; }

    if (currentBlock === 'guard_rails') {
      const m = trimmed.match(/^(\w+):\s*(.+)$/);
      if (m) template.guard_rails[m[1]] = parseVal(m[2]);
    } else if (currentBlock === 'steps') {
      if (trimmed.startsWith('- id:')) {
        if (currentStep) template.steps.push(currentStep);
        currentStep = { id: parseInt(trimmed.replace('- id:', '').trim(), 10) };
      } else if (currentStep) {
        const m = trimmed.match(/^(\w+):\s*(.+)$/);
        if (m) currentStep[m[1]] = parseVal(m[2]);
      }
    } else {
      const m = trimmed.match(/^(\w+):\s*(.+)$/);
      if (m) template[m[1]] = parseVal(m[2]);
    }
  }
  if (currentStep) template.steps.push(currentStep);

  return template;
}

// ─── Template Management ─────────────────────────────────────────

function getTemplateDir(projectRoot) {
  return path.join(projectRoot, TEMPLATE_DIR);
}

function getProcessDir(projectDir) {
  return path.join(projectDir, PROCESS_DIR);
}

function listTemplates(projectRoot) {
  const dir = getTemplateDir(projectRoot);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => {
      const t = parseTemplate(path.join(dir, f));
      return {
        filename: f,
        name: t ? t.name : f.replace('.yaml', ''),
        description: t ? t.description : '',
        steps: t ? t.steps.length : 0,
        version: t ? t.version : 1,
      };
    });
}

function getTemplate(projectRoot, name) {
  const dir = getTemplateDir(projectRoot);
  const filePath = path.join(dir, name + '.yaml');
  if (fs.existsSync(filePath)) return parseTemplate(filePath);
  // Try without extension
  const alt = path.join(dir, name);
  if (fs.existsSync(alt)) return parseTemplate(alt);
  return null;
}

function validateTemplate(template) {
  const errors = [];
  if (!template) { errors.push('Template is null'); return errors; }
  if (!template.name) errors.push('Missing name');
  if (!template.steps || template.steps.length === 0) errors.push('No steps defined');
  
  const ids = new Set();
  for (const step of (template.steps || [])) {
    if (!step.id) errors.push('Step missing id');
    if (ids.has(step.id)) errors.push('Duplicate step id: ' + step.id);
    ids.add(step.id);
    if (!step.name) errors.push('Step ' + step.id + ' missing name');
    if (step.type && !STEP_TYPES.includes(step.type)) {
      errors.push('Step ' + step.id + ' has invalid type: ' + step.type);
    }
    if (step.on_failure && !STEP_ON_FAILURE.includes(step.on_failure)) {
      errors.push('Step ' + step.id + ' has invalid on_failure: ' + step.on_failure);
    }
  }
  return errors;
}

// ─── Process (Active Workflows) ──────────────────────────────────

function listProcesses(projectDir) {
  const activeDir = path.join(getProcessDir(projectDir), ACTIVE_DIR);
  if (!fs.existsSync(activeDir)) return [];
  return fs.readdirSync(activeDir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => {
      const data = readYaml(path.join(activeDir, f));
      return {
        filename: f,
        name: data.name || f.replace('.yaml', ''),
        status: data.status || 'active',
        steps: data.step_count || 0,
        created: data.created || null,
      };
    });
}

function createProcess(projectDir, name, template) {
  const activeDir = path.join(getProcessDir(projectDir), ACTIVE_DIR);
  if (!fs.existsSync(activeDir)) fs.mkdirSync(activeDir, { recursive: true });
  
  const filePath = path.join(activeDir, name + '.yaml');
  if (fs.existsSync(filePath)) return { error: 'Process already exists: ' + name };
  
  const data = {
    name: name,
    status: 'active',
    created: new Date().toISOString(),
    template_source: template ? template.name : 'custom',
    step_count: template ? template.steps.length : 0,
    description: template ? template.description : '',
  };
  
  writeYaml(filePath, data);
  
  // Also copy the full template content if provided
  if (template && template.raw) {
    fs.writeFileSync(filePath, template.raw, 'utf8');
    // Append status + created
    fs.appendFileSync(filePath, '\nstatus: active\ncreated: ' + data.created + '\n', 'utf8');
  }
  
  return { path: filePath, name: name, steps: data.step_count };
}

function deleteProcess(projectDir, name) {
  const filePath = path.join(getProcessDir(projectDir), ACTIVE_DIR, name + '.yaml');
  if (!fs.existsSync(filePath)) return { error: 'Process not found: ' + name };
  fs.unlinkSync(filePath);
  return { deleted: name };
}

// ─── Execution Tracking ──────────────────────────────────────────

function createRun(projectDir, processName) {
  const runsDir = path.join(getProcessDir(projectDir), RUNS_DIR);
  if (!fs.existsSync(runsDir)) fs.mkdirSync(runsDir, { recursive: true });
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const filename = processName + '-' + timestamp + '.yaml';
  const filePath = path.join(runsDir, filename);
  
  const run = {
    process: processName,
    started: new Date().toISOString(),
    status: 'running',
    steps_completed: 0,
    steps_total: 0,
    steps_failed: 0,
    current_step: 1,
  };
  
  writeYaml(filePath, run);
  return { path: filePath, filename: filename, run: run };
}

function updateRun(runPath, updates) {
  if (!fs.existsSync(runPath)) return { error: 'Run not found' };
  const run = readYaml(runPath);
  Object.assign(run, updates);
  writeYaml(runPath, run);
  return run;
}

function completeRun(runPath, success) {
  return updateRun(runPath, {
    status: success ? 'completed' : 'failed',
    completed: new Date().toISOString(),
  });
}

function listRuns(projectDir, processName) {
  const runsDir = path.join(getProcessDir(projectDir), RUNS_DIR);
  if (!fs.existsSync(runsDir)) return [];
  return fs.readdirSync(runsDir)
    .filter(f => f.endsWith('.yaml') && (!processName || f.startsWith(processName)))
    .sort()
    .reverse()
    .map(f => {
      const data = readYaml(path.join(runsDir, f));
      return {
        filename: f,
        process: data.process || f,
        status: data.status || 'unknown',
        started: data.started || null,
        completed: data.completed || null,
        steps_completed: data.steps_completed || 0,
      };
    });
}

// ─── Step Execution Helpers ──────────────────────────────────────

function resolveStepDependencies(steps) {
  // Build dependency graph — steps with depends_on
  const resolved = [];
  const remaining = [...steps];
  const resolvedIds = new Set();
  
  let maxIterations = steps.length * steps.length;
  while (remaining.length > 0 && maxIterations > 0) {
    maxIterations--;
    const idx = remaining.findIndex(step => {
      if (!step.depends_on) return true;
      const deps = Array.isArray(step.depends_on) ? step.depends_on : [step.depends_on];
      return deps.every(d => resolvedIds.has(d));
    });
    if (idx === -1) break;
    const step = remaining.splice(idx, 1)[0];
    resolved.push(step);
    resolvedIds.add(step.id);
  }
  
  return { resolved, unresolved: remaining };
}

function evaluateCondition(condition, context) {
  if (!condition) return true;
  // Simple condition evaluation: "step.N.status == completed"
  const match = condition.match(/step\.(\d+)\.status\s*==\s*(\w+)/);
  if (match) {
    const stepId = parseInt(match[1], 10);
    const expected = match[2];
    const stepResult = (context.results || {})[stepId];
    return stepResult && stepResult.status === expected;
  }
  // Boolean conditions
  if (condition === 'true' || condition === 'always') return true;
  if (condition === 'false' || condition === 'never') return false;
  return true;
}

// ─── Template Composition ────────────────────────────────────────

function composeWorkflow(templates) {
  if (!templates || templates.length === 0) return null;
  
  const composed = {
    name: templates.map(t => t.name).join(' + '),
    description: 'Composed workflow from: ' + templates.map(t => t.name).join(', '),
    version: 1,
    author: 'EZRA',
    guard_rails: { require_clean_git: false, block_on_failure: false },
    steps: [],
  };
  
  let stepId = 1;
  for (const template of templates) {
    for (const step of (template.steps || [])) {
      composed.steps.push({
        ...step,
        id: stepId,
        source_template: template.name,
      });
      stepId++;
    }
  }
  
  return composed;
}

// ─── Workflow Statistics ─────────────────────────────────────────

function getWorkflowStats(projectDir) {
  const templates = listTemplates(projectDir);
  const processes = listProcesses(projectDir);
  const runs = listRuns(projectDir);
  
  const completedRuns = runs.filter(r => r.status === 'completed').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  
  return {
    template_count: templates.length,
    process_count: processes.length,
    total_runs: runs.length,
    completed_runs: completedRuns,
    failed_runs: failedRuns,
    success_rate: runs.length > 0 ? Math.round((completedRuns / runs.length) * 100) : 0,
  };
}

// ─── Exports ─────────────────────────────────────────────────────

module.exports = {
  STEP_TYPES,
  STEP_ON_FAILURE,
  WORKFLOW_STATUSES,
  TEMPLATE_DIR,
  PROCESS_DIR,
  readYaml,
  writeYaml,
  parseVal,
  parseTemplate,
  getTemplateDir,
  getProcessDir,
  listTemplates,
  getTemplate,
  validateTemplate,
  listProcesses,
  createProcess,
  deleteProcess,
  createRun,
  updateRun,
  completeRun,
  listRuns,
  resolveStepDependencies,
  evaluateCondition,
  composeWorkflow,
  getWorkflowStats,
};

// ─── Hook Protocol ───────────────────────────────────────────────

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => {
  input += d;
  if (input.length > MAX_STDIN) { process.exit(0); }
});
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const action = data.action || 'list-templates';
      const projectDir = data.project_dir || data.projectDir || process.cwd();
      let result;
      switch (action) {
        case 'list-templates':
          result = listTemplates(projectDir);
          break;
        case 'validate':
          result = validateTemplate(getTemplate(projectDir, data.name));
          break;
        case 'list-processes':
          result = listProcesses(projectDir);
          break;
        case 'create':
          result = createProcess(projectDir, data.name, data.template ? getTemplate(projectDir, data.template) : null);
          break;
        case 'stats':
          result = getWorkflowStats(projectDir);
          break;
        default:
          result = { error: 'Unknown action: ' + action };
      }
      process.stdout.write(JSON.stringify(result));
    } catch (e) {
      const msg = _fmt('WORKFLOW_001', { detail: e.message });
      console.error(msg);
      _log(process.cwd(), 'ezra-workflows', 'warn', msg);
      process.stdout.write(JSON.stringify({ error: e.message }));
    }
    process.exit(0);
  });
}
