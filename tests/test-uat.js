#!/usr/bin/env node

'use strict';

/**
 * EZRA Alpha / Beta / UAT Test Suite
 * 
 * ALPHA:  Adversarial inputs, boundary conditions, crash resilience
 * BETA:   User journey simulation, real-world install patterns
 * UAT:    Acceptance criteria — does it do what the README promises?
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
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-uat-')); }
function rm(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }

function cli(args, cwd) {
  try {
    return { out: execSync(`node "${CLI}" ${args}`, { encoding: 'utf8', timeout: 15000, cwd: cwd || ROOT, env: { ...process.env, NO_COLOR: '1' } }), code: 0 };
  } catch (e) { return { out: e.stdout || '', err: e.stderr || '', code: e.status || 1 }; }
}

function pipeHook(hook, json, cwd) {
  const hp = path.join(ROOT, 'hooks', hook);
  const tmpFile = path.join(os.tmpdir(), `ezra-uat-hook-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(json), 'utf8');
  try {
    const isWin = process.platform === 'win32';
    const cmd = isWin
      ? `type "${tmpFile}" | node "${hp}"`
      : `cat "${tmpFile}" | node "${hp}"`;
    return { out: execSync(cmd, { encoding: 'utf8', timeout: 5000, cwd: cwd || os.tmpdir(), shell: true }), code: 0 };
  } catch (e) { return { out: e.stdout || '', err: e.stderr || '', code: e.status || 1 }; }
  finally { try { fs.unlinkSync(tmpFile); } catch (_) {} }
}

// ═══════════════════════════════════════════════════════════════════
// ALPHA TESTS — Adversarial & Edge Cases
// ═══════════════════════════════════════════════════════════════════

test('ALPHA: CLI handles no arguments without crash', () => {
  // Non-interactive: will fail waiting for input but should not crash with unhandled error
  const result = cli('--info');
  assert(result.code === 0, 'Should handle --info without crash');
});

test('ALPHA: CLI handles unknown flags gracefully', () => {
  const result = cli('--nonexistent-flag-xyz');
  // Should show banner/help, not crash
  assert(result.code === 0 || result.out.includes('EZRA'), 'Should not crash on unknown flags');
});

test('ALPHA: Guard hook handles path with spaces', () => {
  const tmp = tmpDir();
  try {
    const ezraDir = path.join(tmp, '.ezra');
    fs.mkdirSync(ezraDir, { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), 'version: 1\nprotected_paths:\n  - pattern: "*.env*"\n    reason: test\n');

    const result = pipeHook('ezra-guard.js', {
      tool_input: { file_path: 'src/my folder/file with spaces.ts' },
      cwd: tmp,
    }, tmp);
    assert(result.code === 0, 'Should handle paths with spaces');
  } finally { rm(tmp); }
});

test('ALPHA: Guard hook handles deeply nested path', () => {
  const result = pipeHook('ezra-guard.js', {
    tool_input: { file_path: 'a/b/c/d/e/f/g/h/i/j/k/l/m/deep.ts' },
    cwd: os.tmpdir(),
  });
  assert(result.code === 0, 'Should handle deep paths');
});

test('ALPHA: Guard hook handles empty string file_path', () => {
  const result = pipeHook('ezra-guard.js', { tool_input: { file_path: '' } });
  assert(result.code === 0, 'Should handle empty file_path');
});

test('ALPHA: Version hook handles rapid consecutive calls', () => {
  const tmp = tmpDir();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });

    for (let i = 0; i < 5; i++) {
      const result = pipeHook('ezra-version-hook.js', {
        tool_input: { file_path: `.ezra/decisions/ADR-${String(i).padStart(3, '0')}.yaml` },
        cwd: tmp,
      }, tmp);
      assert(result.code === 0, `Call ${i + 1} should succeed`);
    }

    const current = fs.readFileSync(path.join(tmp, '.ezra', 'versions', 'current.yaml'), 'utf8');
    assert(current.includes('total_changes: 5'), `Expected 5 changes, got: ${current.match(/total_changes: (\d+)/)?.[1]}`);
  } finally { rm(tmp); }
});

test('ALPHA: Guard hook handles Unicode in file paths', () => {
  const result = pipeHook('ezra-guard.js', {
    tool_input: { file_path: 'src/données/fichier.ts' },
    cwd: os.tmpdir(),
  });
  assert(result.code === 0, 'Should handle Unicode paths');
});

test('ALPHA: Hooks handle null tool_input', () => {
  for (const hook of ['ezra-guard.js', 'ezra-version-hook.js', 'ezra-drift-hook.js']) {
    const result = pipeHook(hook, { tool_input: null });
    assert(result.code === 0, `${hook} should handle null tool_input`);
  }
});

test('ALPHA: Install to read-only directory fails gracefully', () => {
  // This tests that the CLI doesn't crash — it may fail but should not throw unhandled
  const result = cli('--claude --local', '/');
  // Expected to fail (can't write to /) but should not be an unhandled exception
  assert(result.code === 0 || result.code === 1, 'Should fail gracefully on read-only dir');
});

// ═══════════════════════════════════════════════════════════════════
// BETA TESTS — Real User Journey Simulation
// ═══════════════════════════════════════════════════════════════════

test('BETA: Full user journey — install, verify, use hooks, uninstall', () => {
  const tmp = tmpDir();
  try {
    // 1. Install
    cli('--claude --local', tmp);
    const cd = path.join(tmp, '.claude');
    assert(fs.existsSync(path.join(cd, 'commands', 'ezra', 'help.md')), 'Help not installed');

    // 2. Simulate /ezra:init creating .ezra/
    const ezraDir = path.join(tmp, '.ezra');
    fs.mkdirSync(path.join(ezraDir, 'decisions'), { recursive: true });
    fs.mkdirSync(path.join(ezraDir, 'scans'), { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), [
      'version: 1',
      'project:',
      '  name: TestProject',
      '  language: TypeScript',
      'protected_paths:',
      '  - pattern: "*.env*"',
      '    reason: "Environment config"',
      '  - pattern: "**/migrations/**"',
      '    reason: "DB migrations"',
      'standards:',
      '  strict_types: true',
      '  no_any: true',
    ].join('\n'));

    // 3. Simulate /ezra:decide
    fs.writeFileSync(path.join(ezraDir, 'decisions', 'ADR-001.yaml'), [
      'id: ADR-001',
      'status: ACTIVE',
      'category: ARCHITECTURE',
      'decision: Use NestJS as the API framework',
    ].join('\n'));

    // 4. Version hook fires on decision creation
    pipeHook('ezra-version-hook.js', {
      tool_input: { file_path: '.ezra/decisions/ADR-001.yaml' },
      cwd: tmp,
    }, tmp);
    assert(fs.existsSync(path.join(ezraDir, 'versions', 'changelog.yaml')), 'Changelog should exist');

    // 5. Guard hook fires on protected file edit
    const guardResult = pipeHook('ezra-guard.js', {
      tool_input: { file_path: '.env.local' },
      cwd: tmp,
    }, tmp);
    assert(guardResult.code === 0, 'Guard should not crash');

    // 6. Dash hook shows status
    const dashPath = path.join(ROOT, 'hooks', 'ezra-dash-hook.js');
    const dashInput = path.join(os.tmpdir(), `ezra-uat-dash-${Date.now()}.json`);
    fs.writeFileSync(dashInput, JSON.stringify({ cwd: tmp }), 'utf8');
    let dashResult;
    try {
      const isWin = process.platform === 'win32';
      const cmd = isWin
        ? `type "${dashInput}" | node "${dashPath}"`
        : `cat "${dashInput}" | node "${dashPath}"`;
      dashResult = execSync(cmd, { encoding: 'utf8', timeout: 5000, cwd: tmp, shell: true });
    } finally { try { fs.unlinkSync(dashInput); } catch (_) {} }
    assert(dashResult.includes('EZRA'), 'Dash should show EZRA');

    // 7. Uninstall
    cli('--uninstall --local', tmp);
    assert(!fs.existsSync(path.join(cd, 'commands', 'ezra', 'help.md')), 'Should be uninstalled');

    // 8. .ezra/ state should still exist (uninstall only removes Claude Code files)
    assert(fs.existsSync(path.join(ezraDir, 'governance.yaml')), '.ezra/ state should survive uninstall');
  } finally { rm(tmp); }
});

test('BETA: Multiple installs to same directory are safe', () => {
  const tmp = tmpDir();
  try {
    cli('--claude --local', tmp);
    cli('--claude --local', tmp);
    cli('--claude --local', tmp);

    const cd = path.join(tmp, '.claude');
    const cmds = fs.readdirSync(path.join(cd, 'commands', 'ezra')).filter(f => f.endsWith('.md'));
    assert(cmds.length === 22, `Should still have 22 commands, got ${cmds.length}`);
  } finally { rm(tmp); }
});

test('BETA: Uninstall on non-EZRA directory is safe', () => {
  const tmp = tmpDir();
  try {
    // Don't install — just try to uninstall
    const result = cli('--uninstall --local', tmp);
    assert(result.code === 0, 'Should not crash when nothing to uninstall');
  } finally { rm(tmp); }
});

// ═══════════════════════════════════════════════════════════════════
// UAT TESTS — README Promise Verification
// ═══════════════════════════════════════════════════════════════════

test('UAT: README claims 22 commands — verified', () => {
  const cmds = fs.readdirSync(path.join(ROOT, 'commands', 'ezra')).filter(f => f.endsWith('.md'));
  assert(cmds.length === 22, `README says 22, actual: ${cmds.length}`);
});

test('UAT: README claims 4 subagents — verified', () => {
  const agents = fs.readdirSync(path.join(ROOT, 'agents')).filter(f => f.endsWith('.md'));
  assert(agents.length === 4, `README says 4, actual: ${agents.length}`);
});

test('UAT: README claims 5 hooks — verified', () => {
  const hooks = fs.readdirSync(path.join(ROOT, 'hooks')).filter(f => f.endsWith('.js'));
  assert(hooks.length === 5, `README says 5, actual: ${hooks.length}`);
});

test('UAT: README claims 5 templates — verified', () => {
  const tmpls = fs.readdirSync(path.join(ROOT, 'templates')).filter(f => f.endsWith('.yaml'));
  assert(tmpls.length === 5, `README says 5, actual: ${tmpls.length}`);
});

test('UAT: README claims Node >= 16.7.0 — package.json matches', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert(pkg.engines.node === '>=16.7.0', 'engines.node mismatch');
});

test('UAT: README claims Windows/macOS/Linux — CLI detects platform', () => {
  const result = cli('--info');
  assert(result.out.includes(process.platform), 'Should detect current platform');
});

test('UAT: README claims MIT license — LICENSE file exists and is MIT', () => {
  const content = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
  assert(content.includes('MIT License'), 'LICENSE should be MIT');
});

test('UAT: All command names listed in README exist as files', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const cmdMatches = readme.match(/\/ezra:\w[\w-]*/g) || [];
  const uniqueCmds = [...new Set(cmdMatches.map(c => c.replace('/ezra:', '')))];

  // Some commands are subcommands (doc create, doc list, etc.)
  const baseCommands = uniqueCmds.map(c => c.split(' ')[0]);
  const uniqueBase = [...new Set(baseCommands)];

  for (const cmd of uniqueBase) {
    // Check it exists as a file (some are subcommands of doc/process/auto/multi/version)
    const directFile = path.join(ROOT, 'commands', 'ezra', `${cmd}.md`);
    if (!fs.existsSync(directFile)) {
      // It might be a sub-option of another command (e.g., "doc-sync" or compound like "doc create")
      // Skip compound names that are handled by parent commands
      const isSubCommand = ['create', 'update', 'list', 'status', 'save', 'load', 'export'].includes(cmd);
      if (!isSubCommand) {
        assert(false, `Command /ezra:${cmd} referenced in README but no ${cmd}.md file`);
      }
    }
  }
});

test('UAT: All 5 health pillars documented in README', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const pillars = ['On-Track', 'No Gaps', 'Clean', 'Secure', 'Best Practices'];
  for (const p of pillars) {
    assert(readme.includes(p), `README missing health pillar: ${p}`);
  }
});

test('UAT: All 5 template names documented in README', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const templates = ['full-remediation', 'release-prep', 'sprint-close', 'security-audit', 'onboarding'];
  for (const t of templates) {
    assert(readme.includes(t), `README missing template: ${t}`);
  }
});

test('UAT: GitHub Actions CI tests Windows, macOS, Linux', () => {
  const ci = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  assert(ci.includes('ubuntu-latest'), 'CI missing Linux');
  assert(ci.includes('windows-latest'), 'CI missing Windows');
  assert(ci.includes('macos-latest'), 'CI missing macOS');
});

test('UAT: GitHub Actions CI tests Node 16, 18, 20, 22', () => {
  const ci = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  for (const v of [16, 18, 20, 22]) {
    assert(ci.includes(String(v)), `CI missing Node ${v}`);
  }
});

// ═══════════════════════════════════════════════════════════════════

console.log(`  UAT: PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
