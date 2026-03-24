#!/usr/bin/env node
'use strict';

/**
 * EZRA Document Drift Detection Hook
 * 
 * PostToolUse hook for Write/Edit/MultiEdit operations.
 * When a file is modified, checks if it falls within the scope of any
 * existing EZRA document. If so, increments a drift counter and
 * periodically reminds the user to run /ezra:doc-sync.
 * 
 * Non-blocking — provides feedback only, never denies actions.
 * 
 * Install: Add to settings.json under hooks.PostToolUse:
 * {
 *   "matcher": "Write|Edit|MultiEdit",
 *   "hooks": [{
 *     "type": "command",
 *     "command": "node <path>/ezra-drift-hook.js",
 *     "timeout": 3
 *   }]
 * }
 */

const fs = require('fs');
const path = require('path');

// EZRA feedback helpers (non-blocking)
let _log, _fmt;
try { _log = require('./ezra-hook-logger').logHookEvent; } catch { _log = () => {}; }
try { _fmt = require('./ezra-error-codes').formatError; } catch { _fmt = (c) => 'EZRA: ' + c; }

const MAX_STDIN = 1024 * 1024; // 1 MB stdin limit
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
  if (input.length > MAX_STDIN) { process.exit(0); }
});
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input);
    const filePath = event.tool_input?.file_path || event.tool_input?.path || '';
    
    if (!filePath) {
      process.exit(0);
      return;
    }

    const cwd = event.cwd || process.cwd();
    const ezraDir = path.join(cwd, '.ezra');
    
    // Quick exit if EZRA not initialized or no docs exist
    if (!fs.existsSync(ezraDir)) {
      process.exit(0);
      return;
    }

    const regPath = path.join(ezraDir, 'docs', 'registry.yaml');
    if (!fs.existsSync(regPath)) {
      process.exit(0);
      return;
    }

    // Drift counter file — tracks edits since last doc-sync
    const driftCounterPath = path.join(ezraDir, 'docs', '.drift-counter.json');
    let counter = { edits_since_sync: 0, affected_docs: {}, last_reminded: null };
    
    if (fs.existsSync(driftCounterPath)) {
      try {
        counter = JSON.parse(fs.readFileSync(driftCounterPath, 'utf8'));
      } catch { /* reset on parse error */ }
    }

    const relativePath = path.relative(cwd, path.resolve(cwd, filePath)).replace(/\\/g, '/');

    // File-to-document relevance mapping
    const relevanceRules = [
      { patterns: [/^src\/(routes|controllers|handlers|api)\//i, /\.controller\./i, /\.route\./i], docs: ['api-spec', 'api-docs'] },
      { patterns: [/migrations?\//i, /schema/i, /\.entity\./i, /\.model\./i], docs: ['data-model', 'migrations'] },
      { patterns: [/(auth|session|jwt|oauth|token)/i, /middleware/i], docs: ['security-arch'] },
      { patterns: [/docker/i, /\.github\/workflows/i, /ci/i, /cd/i, /deploy/i], docs: ['deploy-runbook', 'infra-plan'] },
      { patterns: [/\.env/i, /docker-compose/i, /config\//i], docs: ['env-setup', 'config-mgmt'] },
      { patterns: [/package\.json$/i, /package-lock/i, /yarn\.lock/i], docs: ['dependencies', 'tech-stack'] },
      { patterns: [/tsconfig/i, /\.eslint/i, /\.prettier/i, /lint/i], docs: ['coding-standards'] },
      { patterns: [/test/i, /spec/i, /\.test\./i, /\.spec\./i, /jest/i, /vitest/i], docs: ['test-strategy', 'test-cases'] },
      { patterns: [/src\//i], docs: ['tad'] },  // Any source change can affect architecture doc
      { patterns: [/\.ezra\/decisions\//i], docs: ['adr'] },
      { patterns: [/monitoring|health|metrics|logging/i], docs: ['monitoring', 'ops-manual'] },
      { patterns: [/components?\//i, /pages?\//i, /views?\//i, /ui\//i], docs: ['user-guide', 'wireframes'] },
    ];

    // Check which docs this file change affects
    const affectedDocs = new Set();
    for (const rule of relevanceRules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(relativePath)) {
          rule.docs.forEach(d => affectedDocs.add(d));
        }
      }
    }

    if (affectedDocs.size === 0) {
      process.exit(0);
      return;
    }

    // Read registry to check which affected docs actually exist
    const regContent = fs.readFileSync(regPath, 'utf8');
    const existingAffected = [];
    for (const docId of affectedDocs) {
      if (regContent.includes(`id: ${docId}`)) {
        existingAffected.push(docId);
        // Increment per-doc counter
        counter.affected_docs[docId] = (counter.affected_docs[docId] || 0) + 1;
      }
    }

    if (existingAffected.length === 0) {
      process.exit(0);
      return;
    }

    // Increment global counter
    counter.edits_since_sync++;

    // Save counter
    const proposalsDir = path.join(ezraDir, 'docs');
    if (!fs.existsSync(proposalsDir)) {
      fs.mkdirSync(proposalsDir, { recursive: true });
    }
    fs.writeFileSync(driftCounterPath, JSON.stringify(counter, null, 2));

    // Decide whether to remind
    // Remind every 10 edits, or if a high-impact doc is affected 3+ times
    const shouldRemind = (
      counter.edits_since_sync % 10 === 0 ||
      existingAffected.some(d => (counter.affected_docs[d] || 0) >= 3 && !counter.last_reminded_docs?.[d])
    );

    if (shouldRemind) {
      // Find the most-affected docs
      const sorted = Object.entries(counter.affected_docs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      const docList = sorted.map(([id, count]) => `${id} (${count} edits)`).join(', ');
      
      // Output as stderr feedback (non-blocking)
      console.error(`EZRA: ${counter.edits_since_sync} edits since last doc-sync. Docs potentially stale: ${docList}. Run /ezra:doc-sync to review.`);
      
      // Track that we reminded about these
      counter.last_reminded = new Date().toISOString();
      if (!counter.last_reminded_docs) counter.last_reminded_docs = {};
      for (const [id] of sorted) {
        counter.last_reminded_docs[id] = counter.last_reminded;
      }
      fs.writeFileSync(driftCounterPath, JSON.stringify(counter, null, 2));
    }

    process.exit(0);

  } catch (err) {
    // Never block work due to hook errors
    const msg = _fmt('DRIFT_001', { detail: err.message });
    console.error(msg);
    _log(process.cwd(), 'ezra-drift-hook', 'warn', msg);
    process.exit(0);
  }
});
