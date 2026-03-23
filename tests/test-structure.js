#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name} — ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ─── Directory Structure ─────────────────────────────────────────

test('bin/ directory exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'bin')), 'bin/ missing');
});

test('commands/ezra/ directory exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'commands', 'ezra')), 'commands/ezra/ missing');
});

test('agents/ directory exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'agents')), 'agents/ missing');
});

test('hooks/ directory exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'hooks')), 'hooks/ missing');
});

test('skills/ezra/ directory exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'skills', 'ezra')), 'skills/ezra/ missing');
});

test('templates/ directory exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'templates')), 'templates/ missing');
});

test('tests/ directory exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'tests')), 'tests/ missing');
});

// ─── Critical Files ──────────────────────────────────────────────

test('package.json exists and is valid JSON', () => {
  const p = path.join(ROOT, 'package.json');
  assert(fs.existsSync(p), 'package.json missing');
  const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert(pkg.name === 'ezra-claude-code', `name is "${pkg.name}" not "ezra-claude-code"`);
  assert(pkg.version === '6.0.0', `version is "${pkg.version}" not "6.0.0"`);
  assert(pkg.bin['ezra-claude-code'] === 'bin/cli.js', 'bin entry wrong');
  assert(pkg.engines.node === '>=16.7.0', 'engines.node wrong');
});

test('bin/cli.js exists and has shebang', () => {
  const p = path.join(ROOT, 'bin', 'cli.js');
  assert(fs.existsSync(p), 'bin/cli.js missing');
  const content = fs.readFileSync(p, 'utf8');
  assert(content.startsWith('#!/usr/bin/env node'), 'missing shebang');
});

test('README.md exists and is non-empty', () => {
  const p = path.join(ROOT, 'README.md');
  assert(fs.existsSync(p), 'README.md missing');
  const content = fs.readFileSync(p, 'utf8');
  assert(content.length > 100, 'README.md too short');
});

test('LICENSE exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'LICENSE')), 'LICENSE missing');
});

test('.gitignore exists', () => {
  assert(fs.existsSync(path.join(ROOT, '.gitignore')), '.gitignore missing');
});

// ─── File Counts ─────────────────────────────────────────────────

test('28 command files exist', () => {
  const dir = path.join(ROOT, 'commands', 'ezra');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  assert(files.length === 28, `Expected 28 commands, found ${files.length}: ${files.join(', ')}`);
});

test('4 agent files exist', () => {
  const dir = path.join(ROOT, 'agents');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  assert(files.length === 4, `Expected 4 agents, found ${files.length}`);
});

test('9 hook files exist', () => {
  const dir = path.join(ROOT, 'hooks');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  assert(files.length === 9, `Expected 9 hooks, found ${files.length}`);
});

test('1 skill file exists', () => {
  const p = path.join(ROOT, 'skills', 'ezra', 'SKILL.md');
  assert(fs.existsSync(p), 'SKILL.md missing');
});

test('5 template files exist', () => {
  const dir = path.join(ROOT, 'templates');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml'));
  assert(files.length === 5, `Expected 5 templates, found ${files.length}`);
});

// ─── Cross-platform ──────────────────────────────────────────────

test('No hardcoded Unix paths in CLI', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'cli.js'), 'utf8');
  assert(!content.includes("'/home/"), 'Hardcoded /home/ path found');
  assert(!content.includes("'/Users/"), 'Hardcoded /Users/ path found');
  assert(!content.includes("'C:\\\\Users"), 'Hardcoded C:\\Users path found');
});

test('CLI uses os.homedir() not env vars directly', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'cli.js'), 'utf8');
  assert(content.includes('os.homedir()'), 'Should use os.homedir()');
});

test('CLI uses path.join not string concat for paths', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'cli.js'), 'utf8');
  assert(content.includes('path.join'), 'Should use path.join');
});

// ─── Report ──────────────────────────────────────────────────────

console.log(`  Structure: PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
