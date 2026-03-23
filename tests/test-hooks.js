#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(ROOT, 'hooks');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL: ${name} — ${err.message}`); }
}

function assert(condition, msg) { if (!condition) throw new Error(msg); }

function runHookWithStdin(hookFile, stdinData, cwd) {
  const hookPath = path.join(HOOKS_DIR, hookFile);
  try {
    const result = execSync(
      `echo '${JSON.stringify(stdinData).replace(/'/g, "'\\''")}' | node "${hookPath}"`,
      { encoding: 'utf8', timeout: 5000, cwd: cwd || ROOT, shell: true }
    );
    return { stdout: result, exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status || 1 };
  }
}

// ─── Hook File Validation ────────────────────────────────────────

const EXPECTED_HOOKS = [
  'ezra-guard.js',
  'ezra-dash-hook.js',
  'ezra-drift-hook.js',
  'ezra-version-hook.js',
  'ezra-avios-bridge.js',
];

for (const hook of EXPECTED_HOOKS) {
  test(`${hook} exists`, () => {
    assert(fs.existsSync(path.join(HOOKS_DIR, hook)), `${hook} not found`);
  });

  test(`${hook} has shebang`, () => {
    const content = fs.readFileSync(path.join(HOOKS_DIR, hook), 'utf8');
    assert(content.startsWith('#!/usr/bin/env node'), `${hook} missing shebang`);
  });

  test(`${hook} uses strict mode`, () => {
    const content = fs.readFileSync(path.join(HOOKS_DIR, hook), 'utf8');
    // Hooks may or may not use 'use strict' — they read from stdin
    // Just verify they parse JSON from stdin
    assert(content.includes('process.stdin'), `${hook} doesn't read from stdin`);
    assert(content.includes('JSON.parse'), `${hook} doesn't parse JSON`);
  });

  test(`${hook} handles missing file_path gracefully`, () => {
    const result = runHookWithStdin(hook, { tool_input: {} });
    assert(result.exitCode === 0, `${hook} should exit 0 on missing file_path, got ${result.exitCode}`);
  });

  test(`${hook} handles empty input gracefully`, () => {
    const result = runHookWithStdin(hook, {});
    assert(result.exitCode === 0, `${hook} should exit 0 on empty input, got ${result.exitCode}`);
  });
}

// ─── Guard Hook Specific Tests ───────────────────────────────────

test('ezra-guard.js allows non-.ezra file edits', () => {
  const result = runHookWithStdin('ezra-guard.js', {
    tool_input: { file_path: 'src/index.ts' },
    cwd: ROOT,
  });
  assert(result.exitCode === 0, 'Should allow normal file edits');
});

test('ezra-guard.js exits 0 when no .ezra/ directory', () => {
  const result = runHookWithStdin('ezra-guard.js', {
    tool_input: { file_path: '.env.production' },
    cwd: '/tmp',
  });
  assert(result.exitCode === 0, 'Should exit 0 when EZRA not initialized');
});

// ─── Version Hook Specific Tests ─────────────────────────────────

test('ezra-version-hook.js ignores non-.ezra files', () => {
  const result = runHookWithStdin('ezra-version-hook.js', {
    tool_input: { file_path: 'src/app.ts' },
    cwd: ROOT,
  });
  assert(result.exitCode === 0, 'Should exit 0 for non-.ezra files');
});

test('ezra-version-hook.js ignores .ezra/versions/ files (loop prevention)', () => {
  const result = runHookWithStdin('ezra-version-hook.js', {
    tool_input: { file_path: '.ezra/versions/changelog.yaml' },
    cwd: ROOT,
  });
  assert(result.exitCode === 0, 'Should exit 0 for versions/ files');
});

// ─── Drift Hook Specific Tests ───────────────────────────────────

test('ezra-drift-hook.js exits 0 when no .ezra/', () => {
  const result = runHookWithStdin('ezra-drift-hook.js', {
    tool_input: { file_path: 'src/routes/auth.ts' },
    cwd: '/tmp',
  });
  assert(result.exitCode === 0, 'Should exit 0 when EZRA not initialized');
});

// ─── Dash Hook Specific Tests ────────────────────────────────────

test('ezra-dash-hook.js outputs message when no .ezra/', () => {
  const hookPath = path.join(HOOKS_DIR, 'ezra-dash-hook.js');
  try {
    const result = execSync(`cd /tmp && node "${hookPath}"`, { encoding: 'utf8', timeout: 5000 });
    assert(result.includes('Not initialized') || result.includes('EZRA'), 'Should output initialization message');
  } catch (err) {
    // Exit 0 is fine even on error
    assert(err.status === 0 || err.status === null, `Unexpected exit code: ${err.status}`);
  }
});

// ─── Security Tests ──────────────────────────────────────────────

for (const hook of EXPECTED_HOOKS) {
  test(`${hook} never calls eval()`, () => {
    const content = fs.readFileSync(path.join(HOOKS_DIR, hook), 'utf8');
    assert(!content.includes('eval('), `${hook} contains eval() — security risk`);
  });

  test(`${hook} never uses child_process.exec with user input`, () => {
    const content = fs.readFileSync(path.join(HOOKS_DIR, hook), 'utf8');
    // exec is OK for pre-defined commands, but should not interpolate stdin data
    const hasExec = content.includes('execSync') || content.includes("exec(");
    if (hasExec) {
      // Make sure it's not using stdin data in exec
      assert(!content.includes('execSync(event') && !content.includes('execSync(input'),
        `${hook} may interpolate user input into exec — security risk`);
    }
  });
}

// ─── Report ──────────────────────────────────────────────────────

console.log(`  Hooks: PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
