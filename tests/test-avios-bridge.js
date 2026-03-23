#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(ROOT, 'hooks');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL: ${name} — ${err.message}`); }
}

function assert(condition, msg) { if (!condition) throw new Error(msg); }

function createTempDir() {
  const dir = path.join(os.tmpdir(), `ezra-bridge-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function pipeToHook(hookFile, stdinData, cwd) {
  const hookPath = path.join(HOOKS_DIR, hookFile);
  const jsonStr = JSON.stringify(stdinData);
  // Cross-platform: write stdin data to a temp file and redirect
  const tmpFile = path.join(os.tmpdir(), `ezra-stdin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  fs.writeFileSync(tmpFile, jsonStr);
  try {
    const result = execSync(
      `node "${hookPath}" < "${tmpFile}"`,
      { encoding: 'utf8', timeout: 5000, cwd: cwd || ROOT, shell: true }
    );
    return { stdout: result, exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status || 1 };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

// ─── Bridge exits 0 when avios integration disabled ───────────────

test('Bridge exits 0 when avios integration not configured', () => {
  const tmp = createTempDir();
  try {
    const ezraDir = path.join(tmp, '.ezra');
    fs.mkdirSync(path.join(ezraDir, 'decisions'), { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), 'version: 1\nproject:\n  name: test\n');
    fs.writeFileSync(path.join(ezraDir, 'decisions', 'ADR-001.yaml'), 'id: ADR-001\nstatus: ACTIVE\n');

    const result = pipeToHook('ezra-avios-bridge.js', {
      tool_input: { file_path: '.ezra/decisions/ADR-001.yaml' },
      cwd: tmp,
    }, tmp);
    assert(result.exitCode === 0, `Expected exit 0, got ${result.exitCode}`);
    assert(!fs.existsSync(path.join(ezraDir, '.avios-sync', 'pending')), 'Should not create pending dir when disabled');
  } finally { cleanup(tmp); }
});

// ─── Bridge creates pending sync file on decision write ───────────

test('Bridge creates pending sync file on decision write', () => {
  const tmp = createTempDir();
  try {
    const ezraDir = path.join(tmp, '.ezra');
    fs.mkdirSync(path.join(ezraDir, 'decisions'), { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), [
      'version: 1',
      'project:',
      '  name: test-project',
      'avios_integration:',
      '  enabled: true',
      '  project_id: test-proj',
      '  sync_decisions: true',
      '  sync_risks: true',
    ].join('\n'));
    fs.writeFileSync(path.join(ezraDir, 'decisions', 'ADR-002.yaml'), [
      'id: ADR-002',
      'status: ACTIVE',
      'category: ARCHITECTURE',
      'decision: Use Fastify',
      'rationale: Performance',
    ].join('\n'));

    const result = pipeToHook('ezra-avios-bridge.js', {
      tool_input: { file_path: '.ezra/decisions/ADR-002.yaml' },
      cwd: tmp,
    }, tmp);
    assert(result.exitCode === 0, `Expected exit 0, got ${result.exitCode}`);
    const pendingDir = path.join(ezraDir, '.avios-sync', 'pending');
    assert(fs.existsSync(pendingDir), 'Pending dir should be created');
    const files = fs.readdirSync(pendingDir);
    assert(files.length === 1, `Expected 1 pending file, found ${files.length}`);
    const content = JSON.parse(fs.readFileSync(path.join(pendingDir, files[0]), 'utf8'));
    assert(content.action === 'add_decision', `Expected add_decision, got ${content.action}`);
    assert(content.project_id === 'test-proj', `Expected test-proj, got ${content.project_id}`);
  } finally { cleanup(tmp); }
});

// ─── Bridge creates pending sync file on scan with critical findings ──

test('Bridge creates pending risk on scan with critical findings', () => {
  const tmp = createTempDir();
  try {
    const ezraDir = path.join(tmp, '.ezra');
    fs.mkdirSync(path.join(ezraDir, 'scans'), { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), [
      'version: 1',
      'avios_integration:',
      '  enabled: true',
      '  project_id: scan-proj',
    ].join('\n'));
    fs.writeFileSync(path.join(ezraDir, 'scans', 'scan-2026.yaml'), [
      'findings:',
      '  - severity: CRITICAL',
      '    description: "SQL injection in auth module"',
      '  - severity: HIGH',
      '    description: "Missing input validation"',
    ].join('\n'));

    const result = pipeToHook('ezra-avios-bridge.js', {
      tool_input: { file_path: '.ezra/scans/scan-2026.yaml' },
      cwd: tmp,
    }, tmp);
    assert(result.exitCode === 0, `Expected exit 0, got ${result.exitCode}`);
    const pendingDir = path.join(ezraDir, '.avios-sync', 'pending');
    assert(fs.existsSync(pendingDir), 'Pending dir should be created');
    const files = fs.readdirSync(pendingDir);
    assert(files.length === 1, `Expected 1 pending file, found ${files.length}`);
    const content = JSON.parse(fs.readFileSync(path.join(pendingDir, files[0]), 'utf8'));
    assert(content.action === 'add_risk', `Expected add_risk, got ${content.action}`);
    assert(content.impact === 'HIGH', `Expected HIGH impact, got ${content.impact}`);
  } finally { cleanup(tmp); }
});

// ─── Bridge handles missing governance.yaml gracefully ────────────

test('Bridge exits 0 when no .ezra/ directory', () => {
  const tmp = createTempDir();
  try {
    const result = pipeToHook('ezra-avios-bridge.js', {
      tool_input: { file_path: '.ezra/decisions/ADR-001.yaml' },
      cwd: tmp,
    }, tmp);
    assert(result.exitCode === 0, `Expected exit 0, got ${result.exitCode}`);
  } finally { cleanup(tmp); }
});

// ─── Bridge exits 0 for non-.ezra files ─────────────────────────

test('Bridge exits 0 for non-.ezra files', () => {
  const result = pipeToHook('ezra-avios-bridge.js', {
    tool_input: { file_path: 'src/index.ts' },
    cwd: ROOT,
  });
  assert(result.exitCode === 0, 'Should exit 0 for non-.ezra files');
});

// ─── Category mapping tests ──────────────────────────────────────

test('Category mapping covers all 8 EZRA categories', () => {
  const content = fs.readFileSync(path.join(HOOKS_DIR, 'ezra-avios-bridge.js'), 'utf8');
  const categories = ['ARCHITECTURE', 'DATABASE', 'SECURITY', 'API', 'TESTING', 'INFRASTRUCTURE', 'DEPENDENCY', 'CONVENTION'];
  for (const cat of categories) {
    assert(content.includes("'" + cat + "'"), `Missing category mapping for ${cat}`);
  }
  const mappedValues = ['AD', 'DD', 'SC', 'TC'];
  for (const val of mappedValues) {
    assert(content.includes("'" + val + "'"), `Missing mapped value ${val}`);
  }
});

// ─── Sync command exists and has valid frontmatter ────────────────

test('Sync command file exists and has valid frontmatter', () => {
  const syncPath = path.join(ROOT, 'commands', 'ezra', 'sync.md');
  assert(fs.existsSync(syncPath), 'sync.md not found');
  const content = fs.readFileSync(syncPath, 'utf8');
  assert(content.includes('name: ezra:sync'), 'Missing name in frontmatter');
  assert(content.includes('description:'), 'Missing description in frontmatter');
});

// ─── Report ──────────────────────────────────────────────────────

console.log(`  AVI-OS Bridge: PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
