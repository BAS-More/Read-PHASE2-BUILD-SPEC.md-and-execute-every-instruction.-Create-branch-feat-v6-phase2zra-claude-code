#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'bin', 'cli.js');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL: ${name} — ${err.message}`); }
}

function assert(condition, msg) { if (!condition) throw new Error(msg); }

function runCli(args, opts) {
  try {
    return execSync(`node "${CLI}" ${args}`, {
      encoding: 'utf8', timeout: 15000,
      env: { ...process.env, NO_COLOR: '1' },
      ...opts,
    });
  } catch (err) {
    return err.stdout || err.stderr || '';
  }
}

// ─── Version ─────────────────────────────────────────────────────

test('--version returns version string', () => {
  const output = runCli('--version');
  assert(output.trim() === '5.0.0', `Expected "5.0.0", got "${output.trim()}"`);
});

test('-v returns version string', () => {
  const output = runCli('-v');
  assert(output.trim() === '5.0.0', `Expected "5.0.0", got "${output.trim()}"`);
});

// ─── Help ────────────────────────────────────────────────────────

test('--help shows usage info', () => {
  const output = runCli('--help');
  assert(output.includes('ezra-claude-code'), 'Should mention package name');
  assert(output.includes('--global'), 'Should mention --global');
  assert(output.includes('--local'), 'Should mention --local');
  assert(output.includes('--uninstall'), 'Should mention --uninstall');
});

test('-h shows usage info', () => {
  const output = runCli('-h');
  assert(output.includes('ezra-claude-code'), 'Should mention package name');
});

// ─── Info ────────────────────────────────────────────────────────

test('--info shows contents', () => {
  const output = runCli('--info');
  assert(output.includes('slash commands'), 'Should mention commands');
  assert(output.includes('subagents'), 'Should mention agents');
  assert(output.includes('hooks'), 'Should mention hooks');
  assert(output.includes(process.platform), 'Should show platform');
});

// ─── Install to temp directory ───────────────────────────────────

test('--claude --local installs to .claude/ in target dir', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-test-'));
  try {
    const output = runCli('--claude --local', { cwd: tmpDir });
    const claudeDir = path.join(tmpDir, '.claude');

    // Check commands installed
    assert(fs.existsSync(path.join(claudeDir, 'commands', 'ezra', 'init.md')), 'init.md not installed');
    assert(fs.existsSync(path.join(claudeDir, 'commands', 'ezra', 'dash.md')), 'dash.md not installed');
    assert(fs.existsSync(path.join(claudeDir, 'commands', 'ezra', 'health.md')), 'health.md not installed');
    assert(fs.existsSync(path.join(claudeDir, 'commands', 'ezra', 'auto.md')), 'auto.md not installed');
    assert(fs.existsSync(path.join(claudeDir, 'commands', 'ezra', 'multi.md')), 'multi.md not installed');

    // Check agents installed
    assert(fs.existsSync(path.join(claudeDir, 'agents', 'ezra-architect.md')), 'architect not installed');
    assert(fs.existsSync(path.join(claudeDir, 'agents', 'ezra-reviewer.md')), 'reviewer not installed');

    // Check hooks installed
    assert(fs.existsSync(path.join(claudeDir, 'hooks', 'ezra-guard.js')), 'guard hook not installed');
    assert(fs.existsSync(path.join(claudeDir, 'hooks', 'ezra-dash-hook.js')), 'dash hook not installed');
    assert(fs.existsSync(path.join(claudeDir, 'hooks', 'ezra-drift-hook.js')), 'drift hook not installed');
    assert(fs.existsSync(path.join(claudeDir, 'hooks', 'ezra-version-hook.js')), 'version hook not installed');

    // Check skill installed
    assert(fs.existsSync(path.join(claudeDir, 'skills', 'ezra', 'SKILL.md')), 'SKILL.md not installed');

    // Count total
    const countFiles = (dir) => {
      let count = 0;
      if (!fs.existsSync(dir)) return 0;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
        else count++;
      }
      return count;
    };
    const total = countFiles(claudeDir);
    assert(total >= 28, `Expected >=28 files installed, got ${total}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Uninstall ───────────────────────────────────────────────────

test('--uninstall --local removes EZRA files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-test-'));
  try {
    // Install first
    runCli('--claude --local', { cwd: tmpDir });
    const claudeDir = path.join(tmpDir, '.claude');
    assert(fs.existsSync(path.join(claudeDir, 'commands', 'ezra', 'init.md')), 'install failed');

    // Uninstall
    runCli('--uninstall --local', { cwd: tmpDir });
    assert(!fs.existsSync(path.join(claudeDir, 'commands', 'ezra', 'init.md')), 'init.md not removed');
    assert(!fs.existsSync(path.join(claudeDir, 'hooks', 'ezra-guard.js')), 'guard.js not removed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Idempotency ─────────────────────────────────────────────────

test('Double install is idempotent', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-test-'));
  try {
    runCli('--claude --local', { cwd: tmpDir });
    runCli('--claude --local', { cwd: tmpDir }); // Second install
    const claudeDir = path.join(tmpDir, '.claude');
    assert(fs.existsSync(path.join(claudeDir, 'commands', 'ezra', 'init.md')), 'File missing after double install');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Installed file integrity ────────────────────────────────────

test('Installed files match source files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-test-'));
  try {
    runCli('--claude --local', { cwd: tmpDir });
    const claudeDir = path.join(tmpDir, '.claude');

    // Check a command file matches source
    const srcContent = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'init.md'), 'utf8');
    const dstContent = fs.readFileSync(path.join(claudeDir, 'commands', 'ezra', 'init.md'), 'utf8');
    assert(srcContent === dstContent, 'Installed init.md does not match source');

    // Check a hook file matches source
    const srcHook = fs.readFileSync(path.join(ROOT, 'hooks', 'ezra-guard.js'), 'utf8');
    const dstHook = fs.readFileSync(path.join(claudeDir, 'hooks', 'ezra-guard.js'), 'utf8');
    assert(srcHook === dstHook, 'Installed guard.js does not match source');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Report ──────────────────────────────────────────────────────

console.log(`  CLI: PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
