#!/usr/bin/env node
'use strict';

/**
 * EZRA v6 — HTTP Module Tests
 * Tests for hooks/ezra-http.js: SSRF protection, exports, URL handling.
 * Zero external dependencies.
 */

const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log(`  FAIL: ${name} — ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const ezraHttp = require(path.join(__dirname, '..', 'hooks', 'ezra-http.js'));

// ═══ EXPORTS ═══════════════════════════════════════════════════

test('exports: httpsPost is a function', () => {
  assert(typeof ezraHttp.httpsPost === 'function', 'httpsPost should be a function');
});

test('exports: httpsGet is a function', () => {
  assert(typeof ezraHttp.httpsGet === 'function', 'httpsGet should be a function');
});

test('exports: isBlockedHost is a function', () => {
  assert(typeof ezraHttp.isBlockedHost === 'function', 'isBlockedHost should be a function');
});

test('exports: PRIVATE_IP_PATTERNS is an array', () => {
  assert(Array.isArray(ezraHttp.PRIVATE_IP_PATTERNS), 'PRIVATE_IP_PATTERNS should be an array');
  assert(ezraHttp.PRIVATE_IP_PATTERNS.length > 0, 'should have patterns');
});

test('exports: BLOCKED_HOSTNAMES is an array', () => {
  assert(Array.isArray(ezraHttp.BLOCKED_HOSTNAMES), 'BLOCKED_HOSTNAMES should be an array');
  assert(ezraHttp.BLOCKED_HOSTNAMES.includes('localhost'), 'should include localhost');
});

// ═══ SSRF PROTECTION — BLOCKED HOSTS ═══════════════════════════

test('isBlockedHost: blocks localhost', () => {
  assert(ezraHttp.isBlockedHost('localhost') === true, 'localhost should be blocked');
});

test('isBlockedHost: blocks 127.0.0.1', () => {
  assert(ezraHttp.isBlockedHost('127.0.0.1') === true, '127.0.0.1 should be blocked');
});

test('isBlockedHost: blocks 127.0.0.2', () => {
  assert(ezraHttp.isBlockedHost('127.0.0.2') === true, '127.0.0.2 should be blocked');
});

test('isBlockedHost: blocks 10.0.0.1 (Class A private)', () => {
  assert(ezraHttp.isBlockedHost('10.0.0.1') === true, '10.x should be blocked');
});

test('isBlockedHost: blocks 10.255.255.255', () => {
  assert(ezraHttp.isBlockedHost('10.255.255.255') === true, '10.x should be blocked');
});

test('isBlockedHost: blocks 172.16.0.1 (Class B private)', () => {
  assert(ezraHttp.isBlockedHost('172.16.0.1') === true, '172.16.x should be blocked');
});

test('isBlockedHost: blocks 172.31.255.255', () => {
  assert(ezraHttp.isBlockedHost('172.31.255.255') === true, '172.31.x should be blocked');
});

test('isBlockedHost: allows 172.15.0.1 (not private)', () => {
  assert(ezraHttp.isBlockedHost('172.15.0.1') === false, '172.15.x should be allowed');
});

test('isBlockedHost: allows 172.32.0.1 (not private)', () => {
  assert(ezraHttp.isBlockedHost('172.32.0.1') === false, '172.32.x should be allowed');
});

test('isBlockedHost: blocks 192.168.0.1 (Class C private)', () => {
  assert(ezraHttp.isBlockedHost('192.168.0.1') === true, '192.168.x should be blocked');
});

test('isBlockedHost: blocks 192.168.255.255', () => {
  assert(ezraHttp.isBlockedHost('192.168.255.255') === true, '192.168.x should be blocked');
});

test('isBlockedHost: blocks 169.254.169.254 (link-local / cloud metadata)', () => {
  assert(ezraHttp.isBlockedHost('169.254.169.254') === true, '169.254.x should be blocked');
});

test('isBlockedHost: blocks 0.0.0.0', () => {
  assert(ezraHttp.isBlockedHost('0.0.0.0') === true, '0.0.0.0 should be blocked');
});

test('isBlockedHost: blocks [::1] (IPv6 loopback)', () => {
  assert(ezraHttp.isBlockedHost('[::1]') === true, '[::1] should be blocked');
});

test('isBlockedHost: blocks ::1 (IPv6 loopback bare)', () => {
  assert(ezraHttp.isBlockedHost('::1') === true, '::1 should be blocked');
});

test('isBlockedHost: blocks fd00:... (IPv6 unique local)', () => {
  assert(ezraHttp.isBlockedHost('fd12:3456:789a::1') === true, 'fd00 should be blocked');
});

test('isBlockedHost: blocks fe80:... (IPv6 link-local)', () => {
  assert(ezraHttp.isBlockedHost('fe80::1') === true, 'fe80 should be blocked');
});

// ═══ SSRF PROTECTION — ALLOWED HOSTS ════════════════════════════

test('isBlockedHost: allows api.anthropic.com', () => {
  assert(ezraHttp.isBlockedHost('api.anthropic.com') === false, 'public API should be allowed');
});

test('isBlockedHost: allows api.openai.com', () => {
  assert(ezraHttp.isBlockedHost('api.openai.com') === false, 'public API should be allowed');
});

test('isBlockedHost: allows 8.8.8.8 (public IP)', () => {
  assert(ezraHttp.isBlockedHost('8.8.8.8') === false, 'public IP should be allowed');
});

test('isBlockedHost: allows 1.1.1.1 (public IP)', () => {
  assert(ezraHttp.isBlockedHost('1.1.1.1') === false, 'public IP should be allowed');
});

test('isBlockedHost: allows example.com', () => {
  assert(ezraHttp.isBlockedHost('example.com') === false, 'public domain should be allowed');
});

test('isBlockedHost: allows 192.167.1.1 (not private)', () => {
  assert(ezraHttp.isBlockedHost('192.167.1.1') === false, '192.167 should be allowed');
});

// ═══ httpsPost — SSRF REJECTION ═════════════════════════════════

test('httpsPost: rejects localhost URL', async () => {
  let caught = false;
  try {
    await ezraHttp.httpsPost('http://localhost:8080/api', { test: 1 });
  } catch (e) {
    caught = true;
    assert(e.message.includes('SSRF'), 'error should mention SSRF');
  }
  assert(caught, 'should have thrown SSRF error');
});

test('httpsPost: rejects 127.0.0.1 URL', async () => {
  let caught = false;
  try {
    await ezraHttp.httpsPost('http://127.0.0.1/api', { test: 1 });
  } catch (e) {
    caught = true;
    assert(e.message.includes('SSRF'), 'error should mention SSRF');
  }
  assert(caught, 'should have thrown SSRF error');
});

test('httpsPost: rejects 10.0.0.1 URL', async () => {
  let caught = false;
  try {
    await ezraHttp.httpsPost('http://10.0.0.1/internal', { test: 1 });
  } catch (e) {
    caught = true;
    assert(e.message.includes('SSRF'), 'error should mention SSRF');
  }
  assert(caught, 'should have thrown SSRF error');
});

test('httpsPost: rejects 192.168.1.1 URL', async () => {
  let caught = false;
  try {
    await ezraHttp.httpsPost('http://192.168.1.1/admin', { test: 1 });
  } catch (e) {
    caught = true;
    assert(e.message.includes('SSRF'), 'error should mention SSRF');
  }
  assert(caught, 'should have thrown SSRF error');
});

test('httpsPost: rejects 169.254.169.254 (cloud metadata)', async () => {
  let caught = false;
  try {
    await ezraHttp.httpsPost('http://169.254.169.254/latest/meta-data/', {});
  } catch (e) {
    caught = true;
    assert(e.message.includes('SSRF'), 'error should mention SSRF');
  }
  assert(caught, 'should have thrown SSRF error');
});

// ═══ httpsGet — SSRF REJECTION ══════════════════════════════════

test('httpsGet: rejects localhost URL', async () => {
  let caught = false;
  try {
    await ezraHttp.httpsGet('http://localhost:3000/');
  } catch (e) {
    caught = true;
    assert(e.message.includes('SSRF'), 'error should mention SSRF');
  }
  assert(caught, 'should have thrown SSRF error');
});

test('httpsGet: rejects 172.16.0.1 URL', async () => {
  let caught = false;
  try {
    await ezraHttp.httpsGet('http://172.16.0.1/internal');
  } catch (e) {
    caught = true;
    assert(e.message.includes('SSRF'), 'error should mention SSRF');
  }
  assert(caught, 'should have thrown SSRF error');
});

test('httpsGet: rejects 169.254.169.254 (cloud metadata)', async () => {
  let caught = false;
  try {
    await ezraHttp.httpsGet('http://169.254.169.254/latest/meta-data/');
  } catch (e) {
    caught = true;
    assert(e.message.includes('SSRF'), 'error should mention SSRF');
  }
  assert(caught, 'should have thrown SSRF error');
});

// ═══ PRIVATE_IP_PATTERNS — REGEX COVERAGE ═══════════════════════

test('PRIVATE_IP_PATTERNS: each pattern is a valid RegExp', () => {
  for (const pat of ezraHttp.PRIVATE_IP_PATTERNS) {
    assert(pat instanceof RegExp, 'each pattern should be a RegExp');
  }
});

test('PRIVATE_IP_PATTERNS: covers all RFC 1918 ranges', () => {
  const testCases = [
    ['127.0.0.1', true],
    ['10.0.0.0', true],
    ['172.16.0.0', true],
    ['172.31.255.255', true],
    ['192.168.0.0', true],
    ['169.254.0.0', true],
    ['0.0.0.1', true],
  ];
  for (const [ip, shouldMatch] of testCases) {
    const matched = ezraHttp.PRIVATE_IP_PATTERNS.some(p => p.test(ip));
    assert(matched === shouldMatch, `${ip} should${shouldMatch ? '' : ' not'} match`);
  }
});

// ═══ URL HANDLING ═══════════════════════════════════════════════

test('httpsPost: handles invalid URL gracefully', async () => {
  let caught = false;
  try {
    await ezraHttp.httpsPost('not-a-url', {});
  } catch (e) {
    caught = true;
  }
  assert(caught, 'invalid URL should throw');
});

test('httpsGet: handles invalid URL gracefully', async () => {
  let caught = false;
  try {
    await ezraHttp.httpsGet('not-a-url');
  } catch (e) {
    caught = true;
  }
  assert(caught, 'invalid URL should throw');
});

test('httpsPost: handles empty string URL', async () => {
  let caught = false;
  try {
    await ezraHttp.httpsPost('', {});
  } catch (e) {
    caught = true;
  }
  assert(caught, 'empty URL should throw');
});

// ═══ DONE ═══════════════════════════════════════════════════════

console.log(`PASSED: ${passed}  FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
