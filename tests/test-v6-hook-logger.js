#!/usr/bin/env node
'use strict';

/**
 * Tests for hooks/ezra-hook-logger.js
 * Verifies: log writing, JSON-line format, readback, rotation, directory creation.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error('FAIL: ' + name + ' — ' + e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// Create a temp directory for each test
function makeTempDir() {
  const tmp = path.join(os.tmpdir(), 'ezra-logger-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ─── Import module ───────────────────────────────────────────────

const { logHookEvent, readHookLog, MAX_LOG_SIZE } = require(path.join(__dirname, '..', 'hooks', 'ezra-hook-logger.js'));

// ─── Tests ───────────────────────────────────────────────────────

test('exports logHookEvent function', () => {
  assert(typeof logHookEvent === 'function', 'logHookEvent should be a function');
});

test('exports readHookLog function', () => {
  assert(typeof readHookLog === 'function', 'readHookLog should be a function');
});

test('exports MAX_LOG_SIZE constant', () => {
  assert(typeof MAX_LOG_SIZE === 'number', 'MAX_LOG_SIZE should be a number');
  assert(MAX_LOG_SIZE === 1024 * 1024, 'MAX_LOG_SIZE should be 1MB');
});

test('creates .ezra/logs/ directory and writes log entry', () => {
  const tmp = makeTempDir();
  try {
    logHookEvent(tmp, 'test-hook', 'info', 'Test message');
    const logPath = path.join(tmp, '.ezra', 'logs', 'hooks.log');
    assert(fs.existsSync(logPath), 'hooks.log should be created');
    const content = fs.readFileSync(logPath, 'utf8').trim();
    const entry = JSON.parse(content);
    assert(entry.hook === 'test-hook', 'hook field should match');
    assert(entry.level === 'info', 'level field should match');
    assert(entry.msg === 'Test message', 'msg field should match');
    assert(entry.ts, 'should have timestamp');
  } finally {
    cleanup(tmp);
  }
});

test('includes action field when provided', () => {
  const tmp = makeTempDir();
  try {
    logHookEvent(tmp, 'test-hook', 'warn', 'Warning', 'Run /ezra:fix');
    const entries = readHookLog(tmp, 10);
    assert(entries.length === 1, 'should have 1 entry');
    assert(entries[0].action === 'Run /ezra:fix', 'action should be stored');
  } finally {
    cleanup(tmp);
  }
});

test('omits action field when not provided', () => {
  const tmp = makeTempDir();
  try {
    logHookEvent(tmp, 'test-hook', 'error', 'Error only');
    const entries = readHookLog(tmp, 10);
    assert(entries.length === 1, 'should have 1 entry');
    assert(!entries[0].action, 'action should not be present');
  } finally {
    cleanup(tmp);
  }
});

test('appends multiple entries as JSON lines', () => {
  const tmp = makeTempDir();
  try {
    logHookEvent(tmp, 'hook-a', 'info', 'First');
    logHookEvent(tmp, 'hook-b', 'warn', 'Second');
    logHookEvent(tmp, 'hook-c', 'error', 'Third');
    const entries = readHookLog(tmp, 10);
    assert(entries.length === 3, 'should have 3 entries');
    assert(entries[0].hook === 'hook-a', 'first entry correct');
    assert(entries[2].hook === 'hook-c', 'last entry correct');
  } finally {
    cleanup(tmp);
  }
});

test('readHookLog returns empty array for missing log', () => {
  const tmp = makeTempDir();
  try {
    const entries = readHookLog(tmp, 10);
    assert(Array.isArray(entries), 'should return array');
    assert(entries.length === 0, 'should be empty');
  } finally {
    cleanup(tmp);
  }
});

test('readHookLog respects limit parameter', () => {
  const tmp = makeTempDir();
  try {
    for (let i = 0; i < 10; i++) {
      logHookEvent(tmp, 'hook', 'info', 'Entry ' + i);
    }
    const entries = readHookLog(tmp, 3);
    assert(entries.length === 3, 'should return only 3 most recent');
    assert(entries[0].msg === 'Entry 7', 'should start from 7th');
    assert(entries[2].msg === 'Entry 9', 'should end at 9th');
  } finally {
    cleanup(tmp);
  }
});

test('readHookLog defaults to 50 entries', () => {
  const tmp = makeTempDir();
  try {
    for (let i = 0; i < 5; i++) {
      logHookEvent(tmp, 'hook', 'info', 'Entry ' + i);
    }
    const entries = readHookLog(tmp);
    assert(entries.length === 5, 'should return all 5 (under default 50)');
  } finally {
    cleanup(tmp);
  }
});

test('log rotation triggers when file exceeds MAX_LOG_SIZE', () => {
  const tmp = makeTempDir();
  try {
    const logsDir = path.join(tmp, '.ezra', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    const logPath = path.join(logsDir, 'hooks.log');
    // Write a file just over the size limit
    const bigContent = 'x'.repeat(MAX_LOG_SIZE + 100);
    fs.writeFileSync(logPath, bigContent);
    // This should trigger rotation
    logHookEvent(tmp, 'post-rotation', 'info', 'After rotation');
    assert(fs.existsSync(logPath + '.1'), 'rotated file should exist');
    const newContent = fs.readFileSync(logPath, 'utf8').trim();
    const entry = JSON.parse(newContent);
    assert(entry.hook === 'post-rotation', 'new log should have the new entry');
  } finally {
    cleanup(tmp);
  }
});

test('never throws — silently recovers from errors', () => {
  // Passing invalid cwd should not throw
  logHookEvent('/nonexistent/path/that/cannot/exist', 'hook', 'info', 'test');
  // No assert needed — if it throws, the test framework catches it
});

// ─── Summary ─────────────────────────────────────────────────────

console.log('');
console.log('Hook Logger Tests');
console.log('PASSED: ' + passed + ' FAILED: ' + failed);
if (failed > 0) process.exit(1);
