#!/usr/bin/env node

'use strict';

/**
 * EZRA Test Runner
 * Runs all test suites and reports results.
 */

const { execSync } = require('child_process');
const path = require('path');

const SUITES = [
  { name: 'Structure', script: 'test-structure.js' },
  { name: 'Commands', script: 'test-commands.js' },
  { name: 'Hooks', script: 'test-hooks.js' },
  { name: 'CLI', script: 'test-cli.js' },
  { name: 'Templates', script: 'test-templates.js' },
  { name: 'AVI-OS Bridge', script: 'test-avios-bridge.js' },
  { name: 'V6-Oversight', script: 'test-v6-oversight.js' },
];

const testsDir = __dirname;
let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;
const results = [];

console.log('');
console.log('EZRA Test Runner');
console.log('═══════════════════════════════════════════');

for (const suite of SUITES) {
  const scriptPath = path.join(testsDir, suite.script);
  try {
    const output = execSync(`node "${scriptPath}"`, {
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, EZRA_TEST: '1' },
    });

    // Parse output for pass/fail counts
    const passMatch = output.match(/PASSED:\s*(\d+)/);
    const failMatch = output.match(/FAILED:\s*(\d+)/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;

    totalPassed += passed;
    totalFailed += failed;
    totalTests += passed + failed;

    const icon = failed === 0 ? '✅' : '❌';
    results.push({ name: suite.name, passed, failed, icon });
    console.log(`  ${icon} ${suite.name}: ${passed} passed, ${failed} failed`);
  } catch (err) {
    const output = err.stdout || '';
    const passMatch = output.match(/PASSED:\s*(\d+)/);
    const failMatch = output.match(/FAILED:\s*(\d+)/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 1;

    totalPassed += passed;
    totalFailed += failed;
    totalTests += passed + failed;

    results.push({ name: suite.name, passed, failed, icon: '❌' });
    console.log(`  ❌ ${suite.name}: ${passed} passed, ${failed} failed`);
  }
}

console.log('═══════════════════════════════════════════');
console.log(`  Total: ${totalTests} tests │ ${totalPassed} passed │ ${totalFailed} failed`);
console.log(`  Result: ${totalFailed === 0 ? '✅ ALL GREEN' : '❌ FAILURES DETECTED'}`);
console.log('═══════════════════════════════════════════');
console.log('');

process.exit(totalFailed > 0 ? 1 : 0);
