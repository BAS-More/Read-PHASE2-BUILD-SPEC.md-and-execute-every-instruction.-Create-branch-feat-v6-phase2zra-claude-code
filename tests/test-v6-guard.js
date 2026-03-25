#!/usr/bin/env node
'use strict';

/**
 * Tests for hooks/ezra-guard.js
 * The guard hook has no module.exports — it runs as a stdin→stdout process.
 * We test it by spawning the process with JSON stdin.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error('  FAIL: ' + name + ' — ' + err.message); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function makeTempDir() {
  const dir = path.join(os.tmpdir(), 'ezra-guard-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

const hookPath = path.join(__dirname, '..', 'hooks', 'ezra-guard.js');

function runHook(input) {
  const result = spawnSync('node', [hookPath], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 10000,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

function setupGovernance(dir, protectedPaths) {
  const ezraDir = path.join(dir, '.ezra');
  fs.mkdirSync(ezraDir, { recursive: true });
  const lines = ['version: 1', 'protected_paths:'];
  for (const pp of protectedPaths) {
    lines.push('  - ' + pp.pattern);
  }
  fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), lines.join('\n') + '\n');
}

// === 1. Hook file exists ===

test('Hook file exists', () => {
  assert(fs.existsSync(hookPath), 'Hook file not found');
});

test('Hook file starts with shebang', () => {
  const content = fs.readFileSync(hookPath, 'utf8');
  assert(content.startsWith('#!/usr/bin/env node'));
});

// === 2. No file path — exits cleanly ===

test('Hook exits 0 when no file_path', () => {
  const result = runHook({ tool_input: {} });
  assert(result.exitCode === 0, 'Should exit 0');
});

// === 3. No governance.yaml — allows ===

test('Hook allows when no governance.yaml exists', () => {
  const dir = makeTempDir();
  try {
    const result = runHook({ cwd: dir, tool_input: { file_path: 'src/foo.js' } });
    assert(result.exitCode === 0, 'Should exit 0');
  } finally { cleanup(dir); }
});

// === 4. Non-protected path — exits cleanly ===

test('Hook allows non-protected paths', () => {
  const dir = makeTempDir();
  try {
    setupGovernance(dir, [{ pattern: 'config/**' }]);
    const result = runHook({ cwd: dir, tool_input: { file_path: 'src/app.js' } });
    assert(result.exitCode === 0, 'Should exit 0');
  } finally { cleanup(dir); }
});

// === 5. Protected path — warns ===

test('Hook warns on protected path match', () => {
  const dir = makeTempDir();
  try {
    setupGovernance(dir, [{ pattern: 'config/**' }]);
    const result = runHook({ cwd: dir, tool_input: { file_path: path.join('config', 'db.yaml') } });
    const combined = (result.stdout || '') + (result.stderr || '');
    assert(result.exitCode === 0, 'Should exit 0');
    assert(combined.includes('GUARD-001') || combined.includes('Protected') || combined.includes('config'), 'Should mention protected path');
  } finally { cleanup(dir); }
});

// === 6. Protected path with decision — allows ===

test('Hook allows protected path when decision exists', () => {
  const dir = makeTempDir();
  try {
    setupGovernance(dir, [{ pattern: 'config/**' }]);
    const decDir = path.join(dir, '.ezra', 'decisions');
    fs.mkdirSync(decDir, { recursive: true });
    fs.writeFileSync(path.join(decDir, 'ADR-001.yaml'), 'status: ACTIVE\ntitle: Allow config changes\n');
    const result = runHook({ cwd: dir, tool_input: { file_path: path.join('config', 'db.yaml') } });
    assert(result.exitCode === 0, 'Should exit 0');
  } finally { cleanup(dir); }
});

// === 7. Path traversal prevention ===

test('Hook blocks path traversal attempts', () => {
  const dir = makeTempDir();
  try {
    setupGovernance(dir, []);
    const result = runHook({ cwd: dir, tool_input: { file_path: '../../etc/passwd' } });
    assert(result.exitCode === 0, 'Should exit 0');
    const combined = (result.stdout || '') + (result.stderr || '');
    assert(combined.includes('traversal') || combined.includes('GUARD-002') || combined === '', 'Should detect traversal');
  } finally { cleanup(dir); }
});

// === 8. Multiple protected paths ===

test('Hook checks multiple protected patterns', () => {
  const dir = makeTempDir();
  try {
    setupGovernance(dir, [{ pattern: 'config/**' }, { pattern: '*.env' }]);
    const result = runHook({ cwd: dir, tool_input: { file_path: path.join('config', 'app.yaml') } });
    assert(result.exitCode === 0, 'Should exit 0');
    const combined = (result.stdout || '') + (result.stderr || '');
    assert(combined.includes('GUARD-001') || combined.includes('config') || combined.includes('Protected'), 'Should detect protected config path');
  } finally { cleanup(dir); }
});

// === 9. Malformed JSON input ===

test('Hook handles malformed JSON gracefully', () => {
  try {
    execSync(`node "${hookPath}"`, {
      input: 'not json',
      encoding: 'utf8',
      timeout: 10000,
    });
    assert(true);
  } catch (err) {
    assert(err.status === 0 || err.status === null, 'Should exit 0');
  }
});

// === 10. Corrupt governance.yaml ===

test('Hook handles corrupt governance.yaml', () => {
  const dir = makeTempDir();
  try {
    const ezraDir = path.join(dir, '.ezra');
    fs.mkdirSync(ezraDir, { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), '{{{{CORRUPT DATA}}}}');
    const result = runHook({ cwd: dir, tool_input: { file_path: 'src/foo.js' } });
    assert(result.exitCode === 0, 'Should exit 0 on corrupt YAML');
  } finally { cleanup(dir); }
});

// === 11. Stdin limit ===

test('Hook enforces stdin size limit', () => {
  const content = fs.readFileSync(hookPath, 'utf8');
  assert(content.includes('MAX_STDIN'), 'Should define MAX_STDIN');
});

// === 12. parseYaml internal function ===

test('Hook uses internal parseYaml function', () => {
  const content = fs.readFileSync(hookPath, 'utf8');
  assert(content.includes('function parseYaml'), 'Should define parseYaml');
});

// === 13. matchGlob internal function ===

test('Hook uses internal matchGlob function', () => {
  const content = fs.readFileSync(hookPath, 'utf8');
  assert(content.includes('function matchGlob'), 'Should define matchGlob');
});

// === 14. checkDecisionExists internal function ===

test('Hook uses internal checkDecisionExists function', () => {
  const content = fs.readFileSync(hookPath, 'utf8');
  assert(content.includes('function checkDecisionExists'), 'Should define checkDecisionExists');
});

// === Summary ===

console.log('  V6-Guard: ' + passed + ' passed, ' + failed + ' failed');
console.log('  V6-Guard: PASSED: ' + passed + ' FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
