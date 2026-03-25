'use strict';

const MAX_SCAN_DEPTH = 5; // Safety limit for recursive directory scans
/**
 * hooks/ezra-planner.js — Holistic Planning Engine for EZRA v6
 * Plans comprehensively upfront, delivers in verified chunks.
 * ZERO external dependencies.
 */
const fs = require('fs');
const path = require('path');

// ─── Constants ──────────────────────────────────────────────────

const PLAN_STAGES = [
  'holistic_plan',
  'task_decomposition',
  'assignment',
  'execution',
  'verification',
  'gap_check',
  'checkpoint',
];

const TASK_STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'failed', 'blocked'];

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

const PLANS_DIR = '.ezra/plans';
const MASTER_PLAN_FILE = 'master-plan.yaml';
const TASK_QUEUE_FILE = 'task-queue.yaml';
const CHECKPOINTS_DIR = 'checkpoints';
const GAP_REPORTS_DIR = 'gap-reports';

// ─── YAML Helpers ───────────────────────────────────────────────

function parseVal(v) {
  if (v === undefined || v === null) return '';
  const s = String(v).trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '') return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  return s.replace(/^['"]|['"]$/g, '');
}

function readYaml(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const result = {};
  let currentKey = null;
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const topMatch = line.match(/^([\w][\w_.-]*):\s*(.*)/);
    if (topMatch) {
      const key = topMatch[1];
      if (/^(__proto__|constructor|prototype)$/.test(key)) continue;
      const val = topMatch[2].trim();
      if (val === '' || val === '|' || val === '>') {
        result[key] = {};
        currentKey = key;
      } else {
        result[key] = parseVal(val);
        currentKey = null;
      }
      continue;
    }
    const subMatch = line.match(/^  ([\w][\w_.-]*):\s*(.*)/);
    if (subMatch && currentKey) {
      if (/^(__proto__|constructor|prototype)$/.test(subMatch[1])) continue;
      if (typeof result[currentKey] !== 'object') result[currentKey] = {};
      result[currentKey][subMatch[1]] = parseVal(subMatch[2]);
    }
  }
  return result;
  } catch (e) { return {}; }
}

function writeYaml(filePath, obj) {
  const lines = [];
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      lines.push(key + ':');
      for (const [k2, v2] of Object.entries(val)) {
        const sv = v2 === null ? 'null' : String(v2);
        lines.push('  ' + k2 + ': ' + sv);
      }
    } else {
      const sv = val === null ? 'null' : String(val);
      lines.push(key + ': ' + sv);
    }
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

// ─── Helpers ────────────────────────────────────────────────────

function getPlansDir(projectDir) {
  const d = path.join(projectDir, PLANS_DIR);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function getCheckpointsDir(projectDir) {
  const d = path.join(getPlansDir(projectDir), CHECKPOINTS_DIR);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function getGapReportsDir(projectDir) {
  const d = path.join(getPlansDir(projectDir), GAP_REPORTS_DIR);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '-' + Math.random().toString(36).slice(2, 6);
}

// ─── Core Functions ─────────────────────────────────────────────

/**
 * Create a master plan from a spec/description.
 */
function createPlan(projectDir, spec) {
  if (!spec || typeof spec !== 'object') {
    return { success: false, error: 'spec must be an object with name, description, features' };
  }
  if (!spec.name || !spec.description) {
    return { success: false, error: 'spec must have name and description' };
  }

  const planId = generateId();
  const features = Array.isArray(spec.features) ? spec.features : [];
  const risks = Array.isArray(spec.risks) ? spec.risks : [];

  const plan = {
    id: planId,
    name: spec.name,
    description: spec.description,
    stage: 'holistic_plan',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    feature_count: features.length,
    completed_features: 0,
    risk_level: risks.length > 3 ? 'high' : risks.length > 0 ? 'medium' : 'low',
    status: 'active',
  };

  // Store features as indexed entries
  features.forEach((f, i) => {
    plan['feature_' + i] = typeof f === 'string' ? f : String(f);
  });
  risks.forEach((r, i) => {
    plan['risk_' + i] = typeof r === 'string' ? r : String(r);
  });

  const plansDir = getPlansDir(projectDir);
  writeYaml(path.join(plansDir, MASTER_PLAN_FILE), plan);

  return { success: true, planId, stage: plan.stage, features: features.length };
}

/**
 * Load the current master plan.
 */
function loadPlan(projectDir) {
  const planPath = path.join(getPlansDir(projectDir), MASTER_PLAN_FILE);
  if (!fs.existsSync(planPath)) return null;
  return readYaml(planPath);
}

/**
 * Decompose a master plan into individual file-level tasks.
 */
function decomposeTasks(projectDir, tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { success: false, error: 'tasks must be a non-empty array' };
  }

  const plan = loadPlan(projectDir);
  if (!plan) {
    return { success: false, error: 'no master plan found — create one first' };
  }

  const taskQueue = {
    plan_id: plan.id,
    created_at: new Date().toISOString(),
    total_tasks: tasks.length,
    completed_tasks: 0,
    status: 'active',
  };

  tasks.forEach((t, i) => {
    const taskId = 'task_' + i;
    const name = (t && t.name) ? t.name : 'task-' + i;
    const file = (t && t.file) ? t.file : '';
    const deps = (t && t.depends_on) ? t.depends_on : '';
    const priority = (t && t.priority) ? t.priority : 'medium';
    taskQueue[taskId + '_name'] = name;
    taskQueue[taskId + '_file'] = file;
    taskQueue[taskId + '_status'] = 'pending';
    taskQueue[taskId + '_depends_on'] = deps;
    taskQueue[taskId + '_priority'] = priority;
    taskQueue[taskId + '_assigned_to'] = '';
  });

  // Update master plan stage
  plan.stage = 'task_decomposition';
  plan.updated_at = new Date().toISOString();
  const plansDir = getPlansDir(projectDir);
  writeYaml(path.join(plansDir, MASTER_PLAN_FILE), plan);
  writeYaml(path.join(plansDir, TASK_QUEUE_FILE), taskQueue);

  return { success: true, taskCount: tasks.length, stage: 'task_decomposition' };
}

/**
 * Assign a task to an agent (integration with ezra-agents.js).
 */
function assignTask(projectDir, taskIndex, agentId) {
  const queuePath = path.join(getPlansDir(projectDir), TASK_QUEUE_FILE);
  if (!fs.existsSync(queuePath)) {
    return { success: false, error: 'no task queue found — decompose tasks first' };
  }
  const queue = readYaml(queuePath);
  const key = 'task_' + taskIndex + '_status';
  if (!(key in queue)) {
    return { success: false, error: 'task index ' + taskIndex + ' not found' };
  }
  if (queue[key] !== 'pending') {
    return { success: false, error: 'task ' + taskIndex + ' is not pending (status: ' + queue[key] + ')' };
  }

  queue[key] = 'assigned';
  queue['task_' + taskIndex + '_assigned_to'] = agentId || 'default';

  // Update plan stage
  const plan = loadPlan(projectDir);
  if (plan && plan.stage === 'task_decomposition') {
    plan.stage = 'assignment';
    plan.updated_at = new Date().toISOString();
    writeYaml(path.join(getPlansDir(projectDir), MASTER_PLAN_FILE), plan);
  }

  writeYaml(queuePath, queue);
  return { success: true, taskIndex, assignedTo: agentId || 'default', stage: 'assignment' };
}

/**
 * Get the task queue.
 */
function getTaskQueue(projectDir) {
  const queuePath = path.join(getPlansDir(projectDir), TASK_QUEUE_FILE);
  if (!fs.existsSync(queuePath)) return null;
  return readYaml(queuePath);
}

/**
 * Advance a task to the next status.
 */
function advanceTask(projectDir, taskIndex, newStatus) {
  if (!TASK_STATUSES.includes(newStatus)) {
    return { success: false, error: 'invalid status: ' + newStatus };
  }
  const queuePath = path.join(getPlansDir(projectDir), TASK_QUEUE_FILE);
  if (!fs.existsSync(queuePath)) {
    return { success: false, error: 'no task queue found' };
  }
  const queue = readYaml(queuePath);
  const key = 'task_' + taskIndex + '_status';
  if (!(key in queue)) {
    return { success: false, error: 'task index ' + taskIndex + ' not found' };
  }

  const oldStatus = queue[key];
  queue[key] = newStatus;

  // Track completions
  if (newStatus === 'completed' && oldStatus !== 'completed') {
    queue.completed_tasks = (parseInt(queue.completed_tasks, 10) || 0) + 1;

    // Also update master plan
    const plan = loadPlan(projectDir);
    if (plan) {
      plan.completed_features = (parseInt(plan.completed_features, 10) || 0) + 1;
      plan.stage = 'verification';
      plan.updated_at = new Date().toISOString();
      writeYaml(path.join(getPlansDir(projectDir), MASTER_PLAN_FILE), plan);
    }
  }

  writeYaml(queuePath, queue);
  return { success: true, taskIndex, oldStatus, newStatus };
}

/**
 * Run a gap check — compare completed tasks against master plan.
 */
function runGapCheck(projectDir) {
  const plan = loadPlan(projectDir);
  if (!plan) return { success: false, error: 'no master plan found' };

  const queue = getTaskQueue(projectDir);
  if (!queue) return { success: false, error: 'no task queue found' };

  const totalTasks = parseInt(queue.total_tasks, 10) || 0;
  const completedTasks = parseInt(queue.completed_tasks, 10) || 0;
  const pendingTasks = totalTasks - completedTasks;

  // Count features in plan
  let featureCount = parseInt(plan.feature_count, 10) || 0;

  // Collect blocked/failed tasks
  const issues = [];
  for (let i = 0; i < totalTasks; i++) {
    const status = queue['task_' + i + '_status'];
    if (status === 'failed') {
      issues.push({ task: i, name: queue['task_' + i + '_name'] || '', issue: 'failed' });
    }
    if (status === 'blocked') {
      issues.push({ task: i, name: queue['task_' + i + '_name'] || '', issue: 'blocked' });
    }
  }

  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const drift = issues.length > 0 ? 'detected' : 'none';

  const report = {
    plan_id: plan.id || 'unknown',
    timestamp: new Date().toISOString(),
    total_tasks: totalTasks,
    completed_tasks: completedTasks,
    pending_tasks: pendingTasks,
    completion_pct: completionPct,
    feature_count: featureCount,
    drift: drift,
    issue_count: issues.length,
  };

  issues.forEach((iss, i) => {
    report['issue_' + i + '_task'] = iss.task;
    report['issue_' + i + '_name'] = iss.name;
    report['issue_' + i + '_type'] = iss.issue;
  });

  // Update plan stage
  if (plan) {
    plan.stage = 'gap_check';
    plan.updated_at = new Date().toISOString();
    writeYaml(path.join(getPlansDir(projectDir), MASTER_PLAN_FILE), plan);
  }

  // Save report
  const gapDir = getGapReportsDir(projectDir);
  const reportFile = 'gap-' + timestamp() + '.yaml';
  writeYaml(path.join(gapDir, reportFile), report);

  return { success: true, report, file: reportFile };
}

/**
 * Create a checkpoint — save current progress as recovery point.
 */
function createCheckpoint(projectDir, label) {
  const plan = loadPlan(projectDir);
  if (!plan) return { success: false, error: 'no master plan found' };

  const queue = getTaskQueue(projectDir);

  const ts = timestamp();
  const checkpoint = {
    label: label || 'checkpoint-' + ts,
    timestamp: new Date().toISOString(),
    plan_id: plan.id || 'unknown',
    plan_stage: plan.stage || 'unknown',
    completed_features: plan.completed_features || 0,
  };

  if (queue) {
    checkpoint.total_tasks = queue.total_tasks || 0;
    checkpoint.completed_tasks = queue.completed_tasks || 0;
  }

  // Update plan stage
  plan.stage = 'checkpoint';
  plan.updated_at = new Date().toISOString();
  writeYaml(path.join(getPlansDir(projectDir), MASTER_PLAN_FILE), plan);

  // Save checkpoint
  const cpDir = getCheckpointsDir(projectDir);
  const cpFile = 'checkpoint-' + ts + '.yaml';
  writeYaml(path.join(cpDir, cpFile), checkpoint);

  return { success: true, checkpoint, file: cpFile };
}

/**
 * Get plan status summary.
 */
function getPlanStatus(projectDir) {
  const plan = loadPlan(projectDir);
  if (!plan) return { exists: false };

  const queue = getTaskQueue(projectDir);
  const totalTasks = queue ? (parseInt(queue.total_tasks, 10) || 0) : 0;
  const completedTasks = queue ? (parseInt(queue.completed_tasks, 10) || 0) : 0;

  // Count checkpoints
  const cpDir = path.join(getPlansDir(projectDir), CHECKPOINTS_DIR);
  let checkpointCount = 0;
  if (fs.existsSync(cpDir)) {
    checkpointCount = fs.readdirSync(cpDir).filter(f => f.endsWith('.yaml')).length;
  }

  // Count gap reports
  const gapDir = path.join(getPlansDir(projectDir), GAP_REPORTS_DIR);
  let gapReportCount = 0;
  if (fs.existsSync(gapDir)) {
    gapReportCount = fs.readdirSync(gapDir).filter(f => f.endsWith('.yaml')).length;
  }

  return {
    exists: true,
    id: plan.id,
    name: plan.name || '',
    stage: plan.stage || 'unknown',
    status: plan.status || 'unknown',
    feature_count: parseInt(plan.feature_count, 10) || 0,
    completed_features: parseInt(plan.completed_features, 10) || 0,
    total_tasks: totalTasks,
    completed_tasks: completedTasks,
    checkpoints: checkpointCount,
    gap_reports: gapReportCount,
  };
}

/**
 * List all checkpoints.
 */
function listCheckpoints(projectDir) {
  const cpDir = path.join(getPlansDir(projectDir), CHECKPOINTS_DIR);
  if (!fs.existsSync(cpDir)) return [];
  return fs.readdirSync(cpDir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => {
      const data = readYaml(path.join(cpDir, f));
      return { file: f, ...data };
    })
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
}

/**
 * List all gap reports.
 */
function listGapReports(projectDir) {
  const gapDir = path.join(getPlansDir(projectDir), GAP_REPORTS_DIR);
  if (!fs.existsSync(gapDir)) return [];
  return fs.readdirSync(gapDir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => {
      const data = readYaml(path.join(gapDir, f));
      return { file: f, ...data };
    })
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
}

/**
 * Delete all plan data (for reset/testing).
 */
function deletePlan(projectDir) {
  const plansDir = path.join(projectDir, PLANS_DIR);
  if (!fs.existsSync(plansDir)) return { success: false, error: 'no plans directory' };
  fs.rmSync(plansDir, { recursive: true, force: true });
  return { success: true };
}

/**
 * Describe a plan in human-readable format.
 */
function describePlan(projectDir) {
  const plan = loadPlan(projectDir);
  if (!plan) return 'No plan found.';

  const lines = [];
  lines.push('# Plan: ' + (plan.name || 'Unnamed'));
  lines.push('');
  lines.push('**ID:** ' + (plan.id || 'unknown'));
  lines.push('**Stage:** ' + (plan.stage || 'unknown'));
  lines.push('**Status:** ' + (plan.status || 'unknown'));
  lines.push('**Features:** ' + (plan.completed_features || 0) + '/' + (plan.feature_count || 0));
  lines.push('**Risk Level:** ' + (plan.risk_level || 'unknown'));
  lines.push('**Created:** ' + (plan.created_at || 'unknown'));
  lines.push('**Updated:** ' + (plan.updated_at || 'unknown'));
  lines.push('');

  // List features
  const featureCount = parseInt(plan.feature_count, 10) || 0;
  if (featureCount > 0) {
    lines.push('## Features');
    for (let i = 0; i < featureCount; i++) {
      const f = plan['feature_' + i] || 'unknown';
      lines.push('- ' + f);
    }
    lines.push('');
  }

  // Task queue info
  const queue = getTaskQueue(projectDir);
  if (queue) {
    const total = parseInt(queue.total_tasks, 10) || 0;
    const completed = parseInt(queue.completed_tasks, 10) || 0;
    lines.push('## Tasks: ' + completed + '/' + total);
    for (let i = 0; i < total; i++) {
      const name = queue['task_' + i + '_name'] || 'task-' + i;
      const status = queue['task_' + i + '_status'] || 'unknown';
      const assigned = queue['task_' + i + '_assigned_to'] || 'unassigned';
      const marker = status === 'completed' ? '[x]' : '[ ]';
      lines.push('- ' + marker + ' ' + name + ' (' + status + ', ' + assigned + ')');
    }
  }

  return lines.join('\n');
}

// ─── Exports ────────────────────────────────────────────────────

module.exports = {
  PLAN_STAGES,
  TASK_STATUSES,
  RISK_LEVELS,
  PLANS_DIR,
  createPlan,
  loadPlan,
  decomposeTasks,
  assignTask,
  getTaskQueue,
  advanceTask,
  runGapCheck,
  createCheckpoint,
  getPlanStatus,
  listCheckpoints,
  listGapReports,
  deletePlan,
  describePlan,
  readYaml,
  writeYaml,
  getPlansDir,
  getCheckpointsDir,
  getGapReportsDir,
  generateId,
};
