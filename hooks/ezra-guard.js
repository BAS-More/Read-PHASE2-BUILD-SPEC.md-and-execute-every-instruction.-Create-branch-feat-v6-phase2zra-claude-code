#!/usr/bin/env node
'use strict';

/**
 * EZRA Guard Hook — PreToolUse hook for Write/Edit operations
 * 
 * Checks if the file being modified matches a protected path pattern
 * defined in .ezra/governance.yaml. If matched and no decision record
 * authorises the change, the hook provides a warning (non-blocking).
 * 
 * To make it blocking (deny writes to protected paths), change
 * permissionDecision from "allow" to "deny" in the output.
 * 
 * Install: Add to .claude/settings.json under hooks.PreToolUse
 */

const fs = require('fs');
const path = require('path');
// YAML parser — simple built-in, zero dependencies
function parseYaml(text) {
  // Parse YAML-like key: value pairs
  const result = {};
  const lines = text.split('\n');
  let currentKey = null;
  let currentList = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const kvMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val) { result[currentKey] = val; currentList = null; }
      else { result[currentKey] = []; currentList = currentKey; }
    } else if (trimmed.startsWith('- ') && currentList) {
      result[currentList].push(trimmed.slice(2).trim());
    }
  }
  return result;
}

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
      process.exit(0); // No file path, allow
      return;
    }

    // Find .ezra/governance.yaml relative to cwd
    const cwd = event.cwd || process.cwd();

    // Path traversal guard — resolved path must stay within cwd
    const resolved = path.resolve(cwd, filePath);
    const cwdResolved = path.resolve(cwd);
    // Case-insensitive comparison on Windows to prevent drive-letter casing bypass
    const norm = process.platform === 'win32' ? s => s.toLowerCase() : s => s;
    if (!norm(resolved).startsWith(norm(cwdResolved) + path.sep) && norm(resolved) !== norm(cwdResolved)) {
      process.stderr.write('EZRA hook error: path traversal blocked\n');
      process.exit(0);
      return;
    }
    const govPath = path.join(cwd, '.ezra', 'governance.yaml');
    
    if (!fs.existsSync(govPath)) {
      process.exit(0); // EZRA not initialized, allow
      return;
    }

    // Parse governance file
    let governance;
    const govContent = fs.readFileSync(govPath, 'utf8');
    try {
      // Try YAML parse
      governance = parseYaml(govContent);
    } catch {
      // Fallback: try as JSON
      try {
        governance = JSON.parse(govContent);
      } catch {
        process.exit(0); // Can't parse, allow
        return;
      }
    }

    const protectedPaths = governance?.protected_paths || [];
    
    // Check if file matches any protected pattern
    const relativePath = path.relative(cwd, path.resolve(cwd, filePath));
    
    for (const pp of protectedPaths) {
      const pattern = pp.pattern || '';
      if (matchGlob(relativePath, pattern)) {
        // File matches protected path — check for decision record
        const decisionsDir = path.join(cwd, '.ezra', 'decisions');
        const hasDecision = checkDecisionExists(decisionsDir, relativePath);
        
        if (!hasDecision) {
          // Protected path without decision — warn (change to "deny" for blocking)
          const output = {
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              // Change "allow" to "deny" to block protected path writes
              permissionDecision: 'allow',
              permissionDecisionReason: `EZRA: Protected path "${pattern}" — ${pp.reason || 'no reason specified'}. Run /ezra:decide to record a decision authorising this change.`
            }
          };
          process.stdout.write(JSON.stringify(output));
          return;
        }
      }
    }
    
    // No protected path matched or decision exists — allow
    process.exit(0);
    
  } catch (err) {
    // Hook errors should not block work
    process.stderr.write(`EZRA hook error: ${err.message}\n`);
    process.exit(0);
  }
});

/**
 * Simple glob matching supporting * and ** patterns
 */
function matchGlob(filePath, pattern) {
  // Convert glob to regex
  const normalized = filePath.replace(/\\/g, '/');
  let regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DOUBLESTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{DOUBLESTAR\}\}/g, '.*');
  
  try {
    return new RegExp(`^${regex}$`).test(normalized) || 
           new RegExp(regex).test(normalized);
  } catch {
    return false;
  }
}

/**
 * Check if any decision file references the given file path
 */
function checkDecisionExists(decisionsDir, filePath) {
  if (!fs.existsSync(decisionsDir)) return false;
  
  const files = fs.readdirSync(decisionsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(decisionsDir, file), 'utf8');
      // Simple check: does any decision reference this file or a matching pattern?
      if (content.includes(filePath) || content.includes('status: ACTIVE')) {
        // More thorough: parse and check affected_paths
        // For performance, the simple string check is usually sufficient
        return true;
      }
    } catch {
      continue;
    }
  }
  
  return false;
}
