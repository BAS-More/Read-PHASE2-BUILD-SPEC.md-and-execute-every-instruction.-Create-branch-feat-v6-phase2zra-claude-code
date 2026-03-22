#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CMD_DIR = path.join(ROOT, 'commands', 'ezra');
const AGENT_DIR = path.join(ROOT, 'agents');
const SKILL_FILE = path.join(ROOT, 'skills', 'ezra', 'SKILL.md');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL: ${name} — ${err.message}`); }
}

function assert(condition, msg) { if (!condition) throw new Error(msg); }

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fm = {};
  match[1].split(/\r?\n/).forEach(line => {
    const m = line.match(/^(\w[\w-]*):\s*"?(.+?)"?\s*$/);
    if (m) fm[m[1]] = m[2];
  });
  return fm;
}

// ─── Expected Commands ───────────────────────────────────────────

const EXPECTED_COMMANDS = [
  'init', 'scan', 'guard', 'reconcile', 'decide', 'review',
  'status', 'health', 'advisor', 'dash', 'doc', 'doc-check',
  'doc-sync', 'doc-approve', 'process', 'auto', 'multi',
  'version', 'help',
];

const EXPECTED_AGENTS = [
  'ezra-architect', 'ezra-reviewer', 'ezra-guardian', 'ezra-reconciler',
];

// ─── Command Tests ───────────────────────────────────────────────

for (const cmd of EXPECTED_COMMANDS) {
  test(`Command ${cmd}.md exists`, () => {
    const p = path.join(CMD_DIR, `${cmd}.md`);
    assert(fs.existsSync(p), `${cmd}.md not found`);
  });

  test(`Command ${cmd}.md has valid frontmatter`, () => {
    const content = fs.readFileSync(path.join(CMD_DIR, `${cmd}.md`), 'utf8');
    const fm = parseFrontmatter(content);
    assert(fm !== null, `No frontmatter found in ${cmd}.md`);
    assert(fm.name, `No "name" in frontmatter of ${cmd}.md`);
    assert(fm.description, `No "description" in frontmatter of ${cmd}.md`);
  });

  test(`Command ${cmd}.md name starts with ezra:`, () => {
    const content = fs.readFileSync(path.join(CMD_DIR, `${cmd}.md`), 'utf8');
    const fm = parseFrontmatter(content);
    assert(fm.name.startsWith('ezra:'), `name "${fm.name}" should start with "ezra:"`);
  });

  test(`Command ${cmd}.md is non-trivial (>30 lines)`, () => {
    const content = fs.readFileSync(path.join(CMD_DIR, `${cmd}.md`), 'utf8');
    const lines = content.split('\n').length;
    assert(lines > 30, `${cmd}.md only has ${lines} lines — too short`);
  });
}

// ─── No unexpected command files ─────────────────────────────────

test('No unexpected command files', () => {
  const files = fs.readdirSync(CMD_DIR).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
  const unexpected = files.filter(f => !EXPECTED_COMMANDS.includes(f));
  assert(unexpected.length === 0, `Unexpected commands: ${unexpected.join(', ')}`);
});

// ─── Agent Tests ─────────────────────────────────────────────────

for (const agent of EXPECTED_AGENTS) {
  test(`Agent ${agent}.md exists`, () => {
    const p = path.join(AGENT_DIR, `${agent}.md`);
    assert(fs.existsSync(p), `${agent}.md not found`);
  });

  test(`Agent ${agent}.md has valid frontmatter`, () => {
    const content = fs.readFileSync(path.join(AGENT_DIR, `${agent}.md`), 'utf8');
    const fm = parseFrontmatter(content);
    assert(fm !== null, `No frontmatter found in ${agent}.md`);
    assert(fm.name, `No "name" in frontmatter`);
    assert(fm.description, `No "description" in frontmatter`);
  });

  test(`Agent ${agent}.md defines output format`, () => {
    const content = fs.readFileSync(path.join(AGENT_DIR, `${agent}.md`), 'utf8');
    assert(content.includes('Output Format') || content.includes('output'), `${agent}.md lacks output format section`);
    assert(content.includes('yaml') || content.includes('YAML'), `${agent}.md should output YAML`);
  });
}

// ─── SKILL.md Tests ──────────────────────────────────────────────

test('SKILL.md has frontmatter', () => {
  const content = fs.readFileSync(SKILL_FILE, 'utf8');
  const fm = parseFrontmatter(content);
  assert(fm !== null, 'No frontmatter');
  assert(fm.name === 'ezra', `name is "${fm.name}" not "ezra"`);
});

test('SKILL.md references all commands', () => {
  const content = fs.readFileSync(SKILL_FILE, 'utf8');
  const critical = ['init', 'scan', 'health', 'dash', 'doc', 'process', 'auto', 'multi', 'version'];
  for (const cmd of critical) {
    assert(content.includes(`/ezra:${cmd}`), `SKILL.md missing reference to /ezra:${cmd}`);
  }
});

// ─── Cross-references ────────────────────────────────────────────

test('Help command lists all 19 commands', () => {
  const content = fs.readFileSync(path.join(CMD_DIR, 'help.md'), 'utf8');
  const critical = ['init', 'scan', 'guard', 'health', 'advisor', 'dash', 'doc', 'process', 'auto', 'multi', 'version'];
  for (const cmd of critical) {
    assert(content.includes(`/ezra:${cmd}`), `help.md missing /ezra:${cmd}`);
  }
});

// ─── Report ──────────────────────────────────────────────────────

console.log(`  Commands: PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
