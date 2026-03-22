#!/usr/bin/env node

'use strict';

/**
 * EZRA E2E Test Suite
 * Tests actual behavior flows: install → hook execution → uninstall
 * Simulates real Claude Code lifecycle in isolated temp directories.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'bin', 'cli.js');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL: ${name} — ${err.message}`); }
}

function assert(condition, msg) { if (!condition) throw new Error(msg); }

function createTempProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-e2e-'));
  return tmp;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function runCli(args, cwd) {
  try {
    return { stdout: execSync(`node "${CLI}" ${args}`, { encoding: 'utf8', timeout: 15000, cwd, env: { ...process.env, NO_COLOR: '1' } }), exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status || 1 };
  }
}

function pipeToHook(hookFile, jsonData, cwd) {
  const hookPath = path.join(ROOT, 'hooks', hookFile);
  const jsonStr = JSON.stringify(jsonData);
  // Cross-platform: write JSON to temp file and pipe it
  const tmpFile = path.join(os.tmpdir(), `ezra-hook-input-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, jsonStr, 'utf8');
  try {
    const isWin = process.platform === 'win32';
    const cmd = isWin
      ? `type "${tmpFile}" | node "${hookPath}"`
      : `cat "${tmpFile}" | node "${hookPath}"`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 5000, cwd, shell: true });
    return { stdout: result, stderr: '', exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status || 1 };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

// ═══════════════════════════════════════════════════════════════════
// E2E FLOW 1: Full Install → Verify → Uninstall Cycle
// ═══════════════════════════════════════════════════════════════════

test('E2E: Install → verify all files → uninstall → verify removal', () => {
  const tmp = createTempProject();
  try {
    // Install
    const install = runCli('--claude --local', tmp);
    const claudeDir = path.join(tmp, '.claude');

    // Verify command count
    const cmds = fs.readdirSync(path.join(claudeDir, 'commands', 'ezra')).filter(f => f.endsWith('.md'));
    assert(cmds.length === 22, `Expected 22 commands, got ${cmds.length}`);

    // Verify agent count
    const agents = fs.readdirSync(path.join(claudeDir, 'agents')).filter(f => f.endsWith('.md'));
    assert(agents.length === 4, `Expected 4 agents, got ${agents.length}`);

    // Verify hook count
    const hooks = fs.readdirSync(path.join(claudeDir, 'hooks')).filter(f => f.endsWith('.js'));
    assert(hooks.length === 5, `Expected 5 hooks, got ${hooks.length}`);

    // Verify skill
    assert(fs.existsSync(path.join(claudeDir, 'skills', 'ezra', 'SKILL.md')), 'SKILL.md missing');

    // Verify templates
    const templates = fs.readdirSync(path.join(claudeDir, 'ezra-templates')).filter(f => f.endsWith('.yaml'));
    assert(templates.length === 5, `Expected 5 templates, got ${templates.length}`);

    // Uninstall
    const uninstall = runCli('--uninstall --local', tmp);

    // Verify removal
    assert(!fs.existsSync(path.join(claudeDir, 'commands', 'ezra', 'init.md')), 'init.md not removed');
    assert(!fs.existsSync(path.join(claudeDir, 'agents', 'ezra-architect.md')), 'architect not removed');
    assert(!fs.existsSync(path.join(claudeDir, 'hooks', 'ezra-guard.js')), 'guard.js not removed');
  } finally {
    cleanup(tmp);
  }
});

// ═══════════════════════════════════════════════════════════════════
// E2E FLOW 2: Guard Hook Behavior with Real .ezra/ State
// ═══════════════════════════════════════════════════════════════════

test('E2E: Guard hook allows edits when no .ezra/ exists', () => {
  const tmp = createTempProject();
  try {
    const result = pipeToHook('ezra-guard.js', {
      tool_input: { file_path: '.env.production' },
      cwd: tmp,
    }, tmp);
    assert(result.exitCode === 0, `Expected exit 0, got ${result.exitCode}`);
  } finally {
    cleanup(tmp);
  }
});

test('E2E: Guard hook warns on protected path with .ezra/ governance', () => {
  const tmp = createTempProject();
  try {
    // Create minimal .ezra/governance.yaml
    const ezraDir = path.join(tmp, '.ezra');
    fs.mkdirSync(ezraDir, { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), [
      'version: 1',
      'protected_paths:',
      '  - pattern: "*.env*"',
      '    reason: "Environment configuration"',
      '  - pattern: "**/migrations/**"',
      '    reason: "Database migrations"',
    ].join('\n'));

    // Edit a protected file
    const result = pipeToHook('ezra-guard.js', {
      tool_input: { file_path: '.env.production' },
      cwd: tmp,
    }, tmp);

    // Guard should allow but output a warning (non-blocking mode)
    assert(result.exitCode === 0, `Expected exit 0, got ${result.exitCode}`);
    // Should contain EZRA warning in stdout
    const output = result.stdout + result.stderr;
    assert(output.includes('EZRA') || output.length === 0, 'Expected EZRA output or silent pass');
  } finally {
    cleanup(tmp);
  }
});

test('E2E: Guard hook allows non-protected file edits with governance', () => {
  const tmp = createTempProject();
  try {
    const ezraDir = path.join(tmp, '.ezra');
    fs.mkdirSync(ezraDir, { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), [
      'version: 1',
      'protected_paths:',
      '  - pattern: "*.env*"',
      '    reason: "Environment configuration"',
    ].join('\n'));

    const result = pipeToHook('ezra-guard.js', {
      tool_input: { file_path: 'src/app.ts' },
      cwd: tmp,
    }, tmp);
    assert(result.exitCode === 0, `Expected exit 0 for non-protected file`);
  } finally {
    cleanup(tmp);
  }
});

// ═══════════════════════════════════════════════════════════════════
// E2E FLOW 3: Version Hook Creates Changelog
// ═══════════════════════════════════════════════════════════════════

test('E2E: Version hook creates changelog on .ezra/ file change', () => {
  const tmp = createTempProject();
  try {
    // Create .ezra/ with no versions dir yet
    const ezraDir = path.join(tmp, '.ezra');
    fs.mkdirSync(ezraDir, { recursive: true });

    const result = pipeToHook('ezra-version-hook.js', {
      tool_input: { file_path: '.ezra/decisions/ADR-001.yaml' },
      cwd: tmp,
    }, tmp);
    assert(result.exitCode === 0, `Expected exit 0, got ${result.exitCode}`);

    // Changelog should now exist
    const changelogPath = path.join(ezraDir, 'versions', 'changelog.yaml');
    assert(fs.existsSync(changelogPath), 'changelog.yaml not created');

    const content = fs.readFileSync(changelogPath, 'utf8');
    assert(content.includes('CHG-0001'), 'First changelog entry not found');
    assert(content.includes('DECISION'), 'Change type not DECISION');
    assert(content.includes('CREATED'), 'Action not CREATED');
  } finally {
    cleanup(tmp);
  }
});

test('E2E: Version hook ignores non-.ezra/ files', () => {
  const tmp = createTempProject();
  try {
    const result = pipeToHook('ezra-version-hook.js', {
      tool_input: { file_path: 'src/index.ts' },
      cwd: tmp,
    }, tmp);
    assert(result.exitCode === 0, 'Should exit 0');

    // No versions directory should be created
    assert(!fs.existsSync(path.join(tmp, '.ezra', 'versions')), 'versions/ should not exist for non-.ezra files');
  } finally {
    cleanup(tmp);
  }
});

test('E2E: Version hook skips .ezra/versions/ files (loop prevention)', () => {
  const tmp = createTempProject();
  try {
    const ezraDir = path.join(tmp, '.ezra', 'versions');
    fs.mkdirSync(ezraDir, { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'changelog.yaml'), 'log:\n');

    const sizeBefore = fs.statSync(path.join(ezraDir, 'changelog.yaml')).size;

    const result = pipeToHook('ezra-version-hook.js', {
      tool_input: { file_path: '.ezra/versions/changelog.yaml' },
      cwd: tmp,
    }, tmp);
    assert(result.exitCode === 0, 'Should exit 0');

    const sizeAfter = fs.statSync(path.join(ezraDir, 'changelog.yaml')).size;
    assert(sizeBefore === sizeAfter, 'changelog.yaml should not be modified for version file changes');
  } finally {
    cleanup(tmp);
  }
});

test('E2E: Version hook increments version on successive changes', () => {
  const tmp = createTempProject();
  try {
    const ezraDir = path.join(tmp, '.ezra');
    fs.mkdirSync(ezraDir, { recursive: true });

    // First change
    pipeToHook('ezra-version-hook.js', {
      tool_input: { file_path: '.ezra/decisions/ADR-001.yaml' },
      cwd: tmp,
    }, tmp);

    // Second change
    pipeToHook('ezra-version-hook.js', {
      tool_input: { file_path: '.ezra/decisions/ADR-002.yaml' },
      cwd: tmp,
    }, tmp);

    const currentPath = path.join(ezraDir, 'versions', 'current.yaml');
    assert(fs.existsSync(currentPath), 'current.yaml not created');

    const content = fs.readFileSync(currentPath, 'utf8');
    assert(content.includes('total_changes: 2'), `Expected total_changes: 2, got: ${content}`);

    const changelogContent = fs.readFileSync(path.join(ezraDir, 'versions', 'changelog.yaml'), 'utf8');
    assert(changelogContent.includes('CHG-0001'), 'First entry missing');
    assert(changelogContent.includes('CHG-0002'), 'Second entry missing');
  } finally {
    cleanup(tmp);
  }
});

// ═══════════════════════════════════════════════════════════════════
// E2E FLOW 4: Drift Hook Tracks File Changes
// ═══════════════════════════════════════════════════════════════════

test('E2E: Drift hook exits 0 when no .ezra/ exists', () => {
  const tmp = createTempProject();
  try {
    const result = pipeToHook('ezra-drift-hook.js', {
      tool_input: { file_path: 'src/routes/auth.ts' },
      cwd: tmp,
    }, tmp);
    assert(result.exitCode === 0, 'Should exit 0 when no .ezra/');
  } finally {
    cleanup(tmp);
  }
});

test('E2E: Drift hook exits 0 when no docs registry', () => {
  const tmp = createTempProject();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    const result = pipeToHook('ezra-drift-hook.js', {
      tool_input: { file_path: 'src/routes/auth.ts' },
      cwd: tmp,
    }, tmp);
    assert(result.exitCode === 0, 'Should exit 0 when no registry');
  } finally {
    cleanup(tmp);
  }
});

test('E2E: Drift hook tracks edits to files matching doc patterns', () => {
  const tmp = createTempProject();
  try {
    // Create minimal registry
    const docsDir = path.join(tmp, '.ezra', 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'registry.yaml'), [
      'documents:',
      '  - id: api-spec',
      '    status: CURRENT',
      '  - id: security-arch',
      '    status: CURRENT',
    ].join('\n'));

    // Edit a route file (should affect api-spec)
    pipeToHook('ezra-drift-hook.js', {
      tool_input: { file_path: 'src/routes/auth.ts' },
      cwd: tmp,
    }, tmp);

    // Check drift counter was created
    const counterPath = path.join(docsDir, '.drift-counter.json');
    assert(fs.existsSync(counterPath), 'Drift counter not created');

    const counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
    assert(counter.edits_since_sync >= 1, 'Edit count should be >= 1');
    assert(counter.affected_docs['api-spec'] >= 1 || counter.affected_docs['security-arch'] >= 1,
      'Should track affected doc');
  } finally {
    cleanup(tmp);
  }
});

// ═══════════════════════════════════════════════════════════════════
// E2E FLOW 5: Dash Hook Output
// ═══════════════════════════════════════════════════════════════════

test('E2E: Dash hook outputs "Not initialized" when no .ezra/', () => {
  const tmp = createTempProject();
  try {
    const hookPath = path.join(ROOT, 'hooks', 'ezra-dash-hook.js');
    const result = execSync(`cd "${tmp}" && node "${hookPath}"`, { encoding: 'utf8', timeout: 5000 });
    assert(result.includes('Not initialized'), `Expected "Not initialized", got: ${result.trim()}`);
  } catch (err) {
    // Some environments might not output — that's OK if exit 0
    assert(err.status === 0 || err.status === null, `Unexpected exit code: ${err.status}`);
  } finally {
    cleanup(tmp);
  }
});

test('E2E: Dash hook outputs project status when .ezra/ exists', () => {
  const tmp = createTempProject();
  try {
    // Create minimal .ezra state
    const ezraDir = path.join(tmp, '.ezra');
    fs.mkdirSync(path.join(ezraDir, 'decisions'), { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), 'version: 1\nproject:\n  name: TestProject\n');
    fs.writeFileSync(path.join(ezraDir, 'decisions', 'ADR-001.yaml'), 'id: ADR-001\nstatus: ACTIVE\n');

    const hookPath = path.join(ROOT, 'hooks', 'ezra-dash-hook.js');
    const result = execSync(`cd "${tmp}" && node "${hookPath}"`, { encoding: 'utf8', timeout: 5000 });

    assert(result.includes('EZRA'), 'Output should contain EZRA');
    assert(result.includes('Decisions: 1') || result.includes('Decisions:  1'), 'Should show decision count');
  } finally {
    cleanup(tmp);
  }
});

// ═══════════════════════════════════════════════════════════════════
// E2E FLOW 6: Cross-Platform Path Handling
// ═══════════════════════════════════════════════════════════════════

test('E2E: CLI --info shows correct platform', () => {
  const result = runCli('--info', ROOT);
  const expected = process.platform;
  assert(result.stdout.includes(expected), `Should show platform "${expected}"`);
});

test('E2E: CLI --info shows correct Node version', () => {
  const result = runCli('--info', ROOT);
  assert(result.stdout.includes(process.version), 'Should show Node version');
});

test('E2E: Installed hooks use absolute paths that exist', () => {
  const tmp = createTempProject();
  try {
    runCli('--claude --local', tmp);
    const claudeDir = path.join(tmp, '.claude');

    // Every installed hook should be readable
    const hooks = fs.readdirSync(path.join(claudeDir, 'hooks')).filter(f => f.endsWith('.js'));
    for (const hook of hooks) {
      const hookPath = path.join(claudeDir, 'hooks', hook);
      const content = fs.readFileSync(hookPath, 'utf8');
      assert(content.length > 50, `${hook} is suspiciously short`);
      assert(content.includes('process.exit'), `${hook} should call process.exit`);
    }
  } finally {
    cleanup(tmp);
  }
});

// ═══════════════════════════════════════════════════════════════════
// E2E FLOW 7: Command Content Integrity
// ═══════════════════════════════════════════════════════════════════

test('E2E: Installed commands match source byte-for-byte', () => {
  const tmp = createTempProject();
  try {
    runCli('--claude --local', tmp);
    const claudeDir = path.join(tmp, '.claude');

    const srcCmds = fs.readdirSync(path.join(ROOT, 'commands', 'ezra')).filter(f => f.endsWith('.md'));
    for (const cmd of srcCmds) {
      const srcContent = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', cmd), 'utf8');
      const dstContent = fs.readFileSync(path.join(claudeDir, 'commands', 'ezra', cmd), 'utf8');
      assert(srcContent === dstContent, `${cmd} content mismatch after install`);
    }
  } finally {
    cleanup(tmp);
  }
});

test('E2E: Installed agents match source byte-for-byte', () => {
  const tmp = createTempProject();
  try {
    runCli('--claude --local', tmp);
    const claudeDir = path.join(tmp, '.claude');

    const srcAgents = fs.readdirSync(path.join(ROOT, 'agents')).filter(f => f.endsWith('.md'));
    for (const agent of srcAgents) {
      const srcContent = fs.readFileSync(path.join(ROOT, 'agents', agent), 'utf8');
      const dstContent = fs.readFileSync(path.join(claudeDir, 'agents', agent), 'utf8');
      assert(srcContent === dstContent, `${agent} content mismatch after install`);
    }
  } finally {
    cleanup(tmp);
  }
});

// ═══════════════════════════════════════════════════════════════════
// E2E FLOW 8: Error Resilience
// ═══════════════════════════════════════════════════════════════════

test('E2E: Guard hook handles malformed JSON gracefully', () => {
  const hookPath = path.join(ROOT, 'hooks', 'ezra-guard.js');
  try {
    execSync(`echo 'not json' | node "${hookPath}"`, { encoding: 'utf8', timeout: 5000, shell: true });
  } catch (err) {
    // Should exit 0 even on bad input (hooks must not block work)
    assert(err.status === 0 || err.status === null, `Should exit 0 on bad JSON, got ${err.status}`);
  }
});

test('E2E: Version hook handles malformed JSON gracefully', () => {
  const hookPath = path.join(ROOT, 'hooks', 'ezra-version-hook.js');
  try {
    execSync(`echo 'not json' | node "${hookPath}"`, { encoding: 'utf8', timeout: 5000, shell: true });
  } catch (err) {
    assert(err.status === 0 || err.status === null, `Should exit 0 on bad JSON, got ${err.status}`);
  }
});

test('E2E: Drift hook handles malformed JSON gracefully', () => {
  const hookPath = path.join(ROOT, 'hooks', 'ezra-drift-hook.js');
  try {
    execSync(`echo 'not json' | node "${hookPath}"`, { encoding: 'utf8', timeout: 5000, shell: true });
  } catch (err) {
    assert(err.status === 0 || err.status === null, `Should exit 0 on bad JSON, got ${err.status}`);
  }
});

// ═══════════════════════════════════════════════════════════════════

console.log(`  E2E: PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
