// Fix script for ezra-pm.js — 18 test failures
// Root cause: parseYamlSimple can't handle arrays of objects (2-level nesting)
// Fix: add readDeepYamlFile that handles the tasks/milestones format

const fs = require('fs');
let code = fs.readFileSync('hooks/ezra-pm.js', 'utf-8');

// 1. Add a deeper YAML parser that handles arrays of objects
const newParser = `
/**
 * Enhanced YAML reader for progress files that need arrays of objects.
 * Handles: top-level keys, arrays of objects (- key: val\\n  key: val), nested sections.
 */
function readDeepYaml(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const result = {};
    const lines = text.split(/\\r?\\n/);
    let currentKey = null;
    let currentArray = null;
    let currentObj = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\\s*$/.test(line) || /^\\s*#/.test(line)) continue;
      const indent = (line.match(/^(\\s*)/)[1] || '').length;

      // Top-level key (no indent)
      if (indent === 0) {
        if (currentObj && currentArray) { currentArray.push(currentObj); currentObj = null; }
        if (currentArray && currentKey) { result[currentKey] = currentArray; }
        const m = line.match(/^(\\w[\\w_-]*):\\s*(.*)?$/);
        if (!m) continue;
        const key = m[1];
        const val = (m[2] || '').trim();
        if (val === '') {
          currentKey = key;
          currentArray = null;
          currentObj = null;
        } else {
          currentKey = null;
          currentArray = null;
          currentObj = null;
          result[key] = parsePrimitive(val);
        }
        continue;
      }

      const trimmed = line.trim();

      // Array item start
      if (trimmed.startsWith('- ')) {
        if (currentObj && currentArray) { currentArray.push(currentObj); }
        if (!currentArray) currentArray = [];
        const rest = trimmed.slice(2).trim();
        const m = rest.match(/^(\\w[\\w_-]*):\\s*(.*)?$/);
        if (m) {
          currentObj = {};
          currentObj[m[1]] = parsePrimitive((m[2] || '').trim());
        } else {
          currentObj = null;
          currentArray.push(parsePrimitive(rest));
        }
        continue;
      }

      // Continuation of array object item
      if (currentObj) {
        const m = trimmed.match(/^(\\w[\\w_-]*):\\s*(.*)?$/);
        if (m) {
          currentObj[m[1]] = parsePrimitive((m[2] || '').trim());
          continue;
        }
      }

      // Plain nested key:value (not in array)
      if (currentKey && !currentArray) {
        const m = trimmed.match(/^(\\w[\\w_-]*):\\s*(.*)?$/);
        if (m) {
          if (typeof result[currentKey] !== 'object' || Array.isArray(result[currentKey])) {
            result[currentKey] = {};
          }
          result[currentKey][m[1]] = parsePrimitive((m[2] || '').trim());
        }
      }
    }

    // Flush last item
    if (currentObj && currentArray) { currentArray.push(currentObj); }
    if (currentArray && currentKey) { result[currentKey] = currentArray; }

    return result;
  } catch { return {}; }
}
`;

// Insert after the readYamlFile function
code = code.replace(
  /function readYamlFile\(filePath\) \{[\s\S]*?\n\}/,
  (match) => match + '\n' + newParser
);

// 2. Replace readYamlFile calls for tasks and milestones with readDeepYaml
code = code.replace(
  /const tasksData = readYamlFile\(tasksPath\)/g,
  'const tasksData = readDeepYaml(tasksPath)'
);
code = code.replace(
  /const msData = readYamlFile\(milestonesPath\)/g,
  'const msData = readDeepYaml(milestonesPath)'
);

// 3. Fix updateProgress to handle updates (not just creates)
// Find the updateProgress function and check if it handles existing tasks
const updateMatch = code.match(/function updateProgress\(projectDir, task, status\) \{[\s\S]*?\n\}/);
if (updateMatch) {
  const oldFunc = updateMatch[0];
  const newFunc = `function updateProgress(projectDir, task, status) {
  const ezraDir = path.join(projectDir, '.ezra');
  const progressDir = path.join(ezraDir, 'progress');
  ensureDir(progressDir);
  const tasksPath = path.join(progressDir, 'tasks.yaml');
  const tasksData = readDeepYaml(tasksPath);
  let tasks = Array.isArray(tasksData.tasks) ? tasksData.tasks : [];

  const now = new Date().toISOString();
  const existing = tasks.find(t => t.id === task || t.description === task);

  let action;
  if (existing) {
    existing.status = status || existing.status;
    existing.updated = now;
    action = 'updated';
  } else {
    const id = 'task-' + (tasks.length + 1);
    tasks.push({ id, description: task, status: status || 'pending', created: now, updated: now });
    action = 'created';
  }

  // Serialize tasks back to YAML
  let yaml = 'tasks:\\n';
  for (const t of tasks) {
    yaml += '  - id: ' + (t.id || '') + '\\n';
    if (t.description) yaml += '    description: ' + t.description + '\\n';
    yaml += '    status: ' + (t.status || 'pending') + '\\n';
    if (t.created) yaml += '    created: ' + t.created + '\\n';
    if (t.updated) yaml += '    updated: ' + t.updated + '\\n';
  }
  fs.writeFileSync(tasksPath, yaml, 'utf8');
  return { action, task: existing || tasks[tasks.length - 1] };
}`;
  code = code.replace(oldFunc, newFunc);
}

// 4. Fix detectStalls to read timestamps from tasks
const stallMatch = code.match(/function detectStalls\(projectDir[^)]*\) \{[\s\S]*?\n\}/);
if (stallMatch) {
  const oldFunc = stallMatch[0];
  const newFunc = `function detectStalls(projectDir, thresholdMinutes) {
  const ezraDir = path.join(projectDir, '.ezra');
  const pmSettings = loadPMSettings(projectDir);
  const threshold = thresholdMinutes || pmSettings.stall_detection || 30;
  const tasksPath = path.join(ezraDir, 'progress', 'tasks.yaml');
  const tasksData = readDeepYaml(tasksPath);
  const tasks = Array.isArray(tasksData.tasks) ? tasksData.tasks : [];

  if (tasks.length === 0) {
    return { stalled: false, lastActivity: null, minutesSinceActivity: 0, message: 'No tasks tracked' };
  }

  // Find most recent update
  let latest = null;
  let latestTask = null;
  for (const t of tasks) {
    const ts = t.updated || t.created;
    if (ts) {
      const d = new Date(ts);
      if (!latest || d > latest) {
        latest = d;
        latestTask = t;
      }
    }
  }

  if (!latest) {
    return { stalled: false, lastActivity: null, minutesSinceActivity: 0, message: 'No timestamps found' };
  }

  const now = new Date();
  const minutes = (now - latest) / 60000;
  const stalled = minutes > threshold;

  return {
    stalled,
    lastActivity: latest.toISOString(),
    minutesSinceActivity: Math.round(minutes),
    stalledTask: latestTask ? (latestTask.description || latestTask.id) : null,
    message: stalled ? 'Stalled: ' + Math.round(minutes) + ' minutes since last activity' : 'Active',
  };
}`;
  code = code.replace(oldFunc, newFunc);
}

// 5. Fix checkEscalation to read from escalations.yaml
const escMatch = code.match(/function checkEscalation\(projectDir[^)]*\) \{[\s\S]*?\n\}/);
if (escMatch) {
  const oldFunc = escMatch[0];
  const newFunc = `function checkEscalation(projectDir, consecutiveFailures) {
  const pmSettings = loadPMSettings(projectDir);
  const threshold = pmSettings.escalation_threshold || 3;
  const failures = consecutiveFailures || 0;

  // Also check escalation log
  const escPath = path.join(projectDir, '.ezra', 'progress', 'escalations.yaml');
  const escData = readDeepYaml(escPath);
  const history = Array.isArray(escData.escalations) ? escData.escalations : [];

  return {
    escalate: failures >= threshold,
    reason: failures >= threshold ? failures + ' consecutive failures (threshold: ' + threshold + ')' : null,
    count: failures,
    threshold,
    history,
  };
}`;
  code = code.replace(oldFunc, newFunc);
}

fs.writeFileSync('hooks/ezra-pm.js', code, 'utf-8');
console.log('PM hook patched with deep YAML parser, updateProgress, detectStalls, checkEscalation fixes');
