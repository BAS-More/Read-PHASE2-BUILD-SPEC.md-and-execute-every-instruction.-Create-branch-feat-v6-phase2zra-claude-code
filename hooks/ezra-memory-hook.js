'use strict';

/**
 * EZRA Memory Auto-Capture Hook
 * Automatically captures patterns, facts, and lessons from Claude Code tool outputs.
 * Hooks into the tool result pipeline and extracts learnings.
 * Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');

// EZRA feedback helpers (non-blocking)
let _log, _fmt;
try { _log = require('./ezra-hook-logger').logHookEvent; } catch { _log = () => {}; }
try { _fmt = require('./ezra-error-codes').formatError; } catch { _fmt = (c) => 'EZRA: ' + c; }

// ─── Pattern Detection ───────────────────────────────────────────

const CAPTURE_TRIGGERS = [
  { pattern: /always use/i, type: 'pattern', priority: 'high' },
  { pattern: /never use/i, type: 'anti-pattern', priority: 'high' },
  { pattern: /prefer .+ over/i, type: 'preference', priority: 'medium' },
  { pattern: /lesson learned/i, type: 'lesson', priority: 'high' },
  { pattern: /important:/i, type: 'fact', priority: 'high' },
  { pattern: /warning:/i, type: 'warning', priority: 'high' },
  { pattern: /best practice/i, type: 'pattern', priority: 'medium' },
  { pattern: /avoid .+ because/i, type: 'anti-pattern', priority: 'medium' },
  { pattern: /decided to/i, type: 'decision-context', priority: 'medium' },
  { pattern: /changed .+ from .+ to/i, type: 'decision-context', priority: 'medium' },
];

const MAX_CONTENT_LENGTH = 500;
const MIN_CONTENT_LENGTH = 10;

// ─── Detection Engine ────────────────────────────────────────────

function detectPatterns(text) {
  if (!text || typeof text !== 'string') return [];
  if (text.length < MIN_CONTENT_LENGTH) return [];
  
  const detections = [];
  for (const trigger of CAPTURE_TRIGGERS) {
    const match = text.match(trigger.pattern);
    if (match) {
      // Extract a relevant sentence around the match
      const idx = match.index || 0;
      const start = Math.max(0, text.lastIndexOf('.', idx) + 1);
      const end = Math.min(text.length, text.indexOf('.', idx + match[0].length) + 1 || text.length);
      const content = text.slice(start, end).trim().slice(0, MAX_CONTENT_LENGTH);
      
      if (content.length >= MIN_CONTENT_LENGTH) {
        detections.push({
          type: trigger.type,
          priority: trigger.priority,
          content: content,
          trigger: trigger.pattern.source,
        });
      }
    }
  }
  
  return detections;
}

function extractTags(content) {
  if (!content) return [];
  const tags = [];
  // Extract technology keywords
  const techPatterns = [
    /\b(react|vue|angular|node|python|typescript|javascript|docker|kubernetes|aws|azure|gcp)\b/gi,
    /\b(api|rest|graphql|sql|nosql|redis|mongodb|postgres)\b/gi,
    /\b(testing|security|performance|deployment|ci|cd|lint|format)\b/gi,
  ];
  for (const pat of techPatterns) {
    const matches = content.match(pat);
    if (matches) {
      for (const m of matches) {
        const tag = m.toLowerCase();
        if (!tags.includes(tag)) tags.push(tag);
      }
    }
  }
  return tags.slice(0, 10);
}

// ─── Auto-Capture Handler ────────────────────────────────────────

function processToolOutput(toolOutput, projectDir) {
  if (!toolOutput || typeof toolOutput !== 'string') return { captured: 0, entries: [] };
  
  const detections = detectPatterns(toolOutput);
  if (detections.length === 0) return { captured: 0, entries: [] };
  
  // Try to require memory module for storing
  let memory;
  try {
    memory = require(path.join(__dirname, 'ezra-memory.js'));
  } catch (e) {
    return { captured: 0, entries: [], error: 'Memory module not available' };
  }
  
  const entries = [];
  for (const detection of detections) {
    const tags = extractTags(detection.content);
    const result = memory.addMemory(projectDir, {
      type: detection.type,
      content: detection.content,
      tags: tags,
      priority: detection.priority,
      source: 'auto-capture',
    });
    if (!result.error) {
      entries.push(result);
    }
  }
  
  return { captured: entries.length, entries: entries };
}

// ─── Deduplication ───────────────────────────────────────────────

function isDuplicate(projectDir, content) {
  let memory;
  try {
    memory = require(path.join(__dirname, 'ezra-memory.js'));
  } catch (e) {
    return false;
  }
  
  const existing = memory.searchMemory(projectDir, content.slice(0, 50));
  return existing.some(e => {
    const similarity = calculateSimilarity(String(e.content || ''), content);
    return similarity > 0.8;
  });
}

function calculateSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.length / union.size : 0;
}

// ─── Exports ─────────────────────────────────────────────────────

module.exports = {
  CAPTURE_TRIGGERS,
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
  detectPatterns,
  extractTags,
  processToolOutput,
  isDuplicate,
  calculateSimilarity,
};

// ─── Hook Protocol ───────────────────────────────────────────────

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => input += d);
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const projectDir = data.project_dir || data.projectDir || process.cwd();
      const result = processToolOutput(data.tool_output || data.output || '', projectDir);
      process.stdout.write(JSON.stringify(result));
    } catch (e) {
      const msg = _fmt('MEMORY_001', { detail: e.message });
      console.error(msg);
      _log(process.cwd(), 'ezra-memory-hook', 'warn', msg);
      process.stdout.write(JSON.stringify({ error: e.message }));
    }
    process.exit(0);
  });
}
