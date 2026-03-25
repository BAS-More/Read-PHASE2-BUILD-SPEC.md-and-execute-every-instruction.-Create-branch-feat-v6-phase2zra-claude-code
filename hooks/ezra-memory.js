'use strict';

const MAX_STDIN = 1024 * 1024; // 1 MB stdin safety limit
const MAX_SCAN_DEPTH = 5; // Safety limit for recursive directory scans

/**
 * EZRA Agent Memory System
 * Persistent project knowledge base: stores patterns, decisions context,
 * anti-patterns, lessons learned, and cross-session intelligence.
 * Zero external dependencies.
 */

const fs = require('fs');

// EZRA feedback helpers (non-blocking)
let _log, _fmt;
try { _log = require('./ezra-hook-logger').logHookEvent; } catch { _log = () => {}; }
try { _fmt = require('./ezra-error-codes').formatError; } catch { _fmt = (c) => 'EZRA: ' + c; }
const path = require('path');
const crypto = require('crypto');

// ─── Constants ───────────────────────────────────────────────────

const MEMORY_DIR = '.ezra/memory';
const MEMORY_INDEX = 'index.yaml';
const MEMORY_TYPES = ['pattern', 'anti-pattern', 'lesson', 'decision-context', 'preference', 'fact', 'warning'];
const MEMORY_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const MAX_ENTRIES_PER_TYPE = 500;

// ─── YAML Helpers ────────────────────────────────────────────────

function readYaml(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result = {};
  let currentKey = null;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('- ') && currentKey) {
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      result[currentKey].push(trimmed.slice(2).trim());
      continue;
    }
    const match = trimmed.match(/^([\w.-]+):\s*(.*)$/);
    if (match) {
      const [, key, val] = match;
      if (/^(__proto__|constructor|prototype)$/.test(key)) continue;
      if (val === '' || val === '|' || val === '>') {
        currentKey = key;
        result[key] = [];
      } else {
        result[key] = parseVal(val);
        currentKey = key;
      }
    }
  }
  return result;
}

function parseVal(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null' || val === '~') return null;
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
  if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
  if (val.startsWith('[') && val.endsWith(']')) {
    return val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
  }
  return val;
}

function writeYaml(filePath, data) {
  const lines = [];
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      lines.push(key + ':');
      for (const item of val) lines.push('  - ' + item);
    } else if (typeof val === 'object' && val !== null) {
      lines.push(key + ':');
      for (const [k, v] of Object.entries(val)) lines.push('  ' + k + ': ' + v);
    } else {
      lines.push(key + ': ' + (val === null ? 'null' : val));
    }
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

// ─── Memory Directory ────────────────────────────────────────────

function getMemoryDir(projectDir) {
  return path.join(projectDir, MEMORY_DIR);
}

function initMemory(projectDir) {
  const memDir = getMemoryDir(projectDir);
  if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
  
  // Create type subdirectories
  for (const type of MEMORY_TYPES) {
    const typeDir = path.join(memDir, type);
    if (!fs.existsSync(typeDir)) fs.mkdirSync(typeDir, { recursive: true });
  }
  
  // Create index if missing
  const indexPath = path.join(memDir, MEMORY_INDEX);
  if (!fs.existsSync(indexPath)) {
    writeYaml(indexPath, {
      created: new Date().toISOString(),
      total_entries: 0,
      last_updated: new Date().toISOString(),
    });
  }
  
  return {
    memory_dir: memDir,
    types: MEMORY_TYPES.length,
    initialized: true,
  };
}

// ─── Entry Management ────────────────────────────────────────────

function generateId() {
  return crypto.randomBytes(6).toString('hex');
}

function addMemory(projectDir, entry) {
  if (!entry || !entry.type || !entry.content) {
    return { error: 'Entry must have type and content' };
  }
  if (!MEMORY_TYPES.includes(entry.type)) {
    return { error: 'Invalid type: ' + entry.type + '. Valid: ' + MEMORY_TYPES.join(', ') };
  }
  
  const memDir = getMemoryDir(projectDir);
  if (!fs.existsSync(memDir)) initMemory(projectDir);
  
  const id = entry.id || generateId();
  const typeDir = path.join(memDir, entry.type);
  if (!fs.existsSync(typeDir)) fs.mkdirSync(typeDir, { recursive: true });
  
  const filePath = path.join(typeDir, id + '.yaml');
  const now = new Date().toISOString();
  
  const record = {
    id: id,
    type: entry.type,
    content: entry.content,
    context: entry.context || '',
    tags: entry.tags || [],
    priority: entry.priority || 'medium',
    created: now,
    updated: now,
    source: entry.source || 'manual',
    active: true,
  };
  
  writeYaml(filePath, record);
  
  // Auto-prune: enforce MAX_ENTRIES_PER_TYPE
  pruneType(projectDir, entry.type);
  
  updateIndex(projectDir);
  
  return { id: id, path: filePath, type: entry.type };
}

function getMemory(projectDir, type, id) {
  const filePath = path.join(getMemoryDir(projectDir), type, id + '.yaml');
  if (!fs.existsSync(filePath)) return null;
  return readYaml(filePath);
}

function updateMemory(projectDir, type, id, updates) {
  const filePath = path.join(getMemoryDir(projectDir), type, id + '.yaml');
  if (!fs.existsSync(filePath)) return { error: 'Memory not found: ' + type + '/' + id };
  
  const record = readYaml(filePath);
  Object.assign(record, updates);
  record.updated = new Date().toISOString();
  writeYaml(filePath, record);
  
  return record;
}

function deleteMemory(projectDir, type, id) {
  const filePath = path.join(getMemoryDir(projectDir), type, id + '.yaml');
  if (!fs.existsSync(filePath)) return { error: 'Memory not found' };
  fs.unlinkSync(filePath);
  updateIndex(projectDir);
  return { deleted: type + '/' + id };
}

/**
 * Prune oldest low-priority entries when a type exceeds MAX_ENTRIES_PER_TYPE.
 */
function pruneType(projectDir, type) {
  const typeDir = path.join(getMemoryDir(projectDir), type);
  if (!fs.existsSync(typeDir)) return;
  const files = fs.readdirSync(typeDir).filter(f => f.endsWith('.yaml'));
  if (files.length <= MAX_ENTRIES_PER_TYPE) return;
  
  // Read all entries with their created timestamps
  const entries = files.map(f => {
    const data = readYaml(path.join(typeDir, f));
    return { file: f, created: data.created || '', priority: data.priority || 'medium' };
  });
  
  // Sort: low priority first, then oldest first
  const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  entries.sort((a, b) => {
    const pa = priorityOrder[a.priority] || 1;
    const pb = priorityOrder[b.priority] || 1;
    if (pa !== pb) return pa - pb;
    return String(a.created).localeCompare(String(b.created));
  });
  
  // Remove excess entries
  const excess = entries.length - MAX_ENTRIES_PER_TYPE;
  for (let i = 0; i < excess; i++) {
    try { fs.unlinkSync(path.join(typeDir, entries[i].file)); } catch { /* skip */ }
  }
}

// ─── Listing & Search ────────────────────────────────────────────

function listMemories(projectDir, type) {
  const memDir = getMemoryDir(projectDir);
  const entries = [];
  
  const types = type ? [type] : MEMORY_TYPES;
  for (const t of types) {
    const typeDir = path.join(memDir, t);
    if (!fs.existsSync(typeDir)) continue;
    const files = fs.readdirSync(typeDir).filter(f => f.endsWith('.yaml'));
    for (const f of files) {
      const data = readYaml(path.join(typeDir, f));
      if (data.active !== false) {
        entries.push({
          id: data.id || f.replace('.yaml', ''),
          type: t,
          content: data.content || '',
          priority: data.priority || 'medium',
          tags: data.tags || [],
          created: data.created || null,
        });
      }
    }
  }
  
  return entries;
}

function searchMemory(projectDir, query) {
  if (!query) return [];
  const queryLower = query.toLowerCase();
  const all = listMemories(projectDir);
  
  return all.filter(entry => {
    const content = String(entry.content || '').toLowerCase();
    const tags = (entry.tags || []).join(' ').toLowerCase();
    return content.includes(queryLower) || tags.includes(queryLower);
  });
}

function getRelevantMemories(projectDir, context) {
  if (!context) return [];
  const contextLower = context.toLowerCase();
  const words = contextLower.split(/\s+/).filter(w => w.length > 3);
  
  const all = listMemories(projectDir);
  const scored = all.map(entry => {
    const content = String(entry.content || '').toLowerCase();
    const tags = (entry.tags || []).join(' ').toLowerCase();
    let score = 0;
    for (const word of words) {
      if (content.includes(word)) score += 2;
      if (tags.includes(word)) score += 3;
    }
    // Priority boost
    const priorityBoost = { critical: 4, high: 3, medium: 2, low: 1 };
    score += priorityBoost[entry.priority] || 0;
    return { ...entry, relevance: score };
  }).filter(e => e.relevance > 0);
  
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, 10);
}

// ─── Index Management ────────────────────────────────────────────

function updateIndex(projectDir) {
  const memDir = getMemoryDir(projectDir);
  const indexPath = path.join(memDir, MEMORY_INDEX);
  
  let total = 0;
  const typeCounts = {};
  for (const type of MEMORY_TYPES) {
    const typeDir = path.join(memDir, type);
    if (fs.existsSync(typeDir)) {
      const count = fs.readdirSync(typeDir).filter(f => f.endsWith('.yaml')).length;
      typeCounts[type] = count;
      total += count;
    } else {
      typeCounts[type] = 0;
    }
  }
  
  writeYaml(indexPath, {
    total_entries: total,
    last_updated: new Date().toISOString(),
    types: JSON.stringify(typeCounts),
  });
  
  return { total, types: typeCounts };
}

function getMemoryStats(projectDir) {
  const memDir = getMemoryDir(projectDir);
  if (!fs.existsSync(memDir)) {
    return {
      initialized: false,
      total_entries: 0,
      types: {},
    };
  }
  
  const index = updateIndex(projectDir);
  const entries = listMemories(projectDir);
  
  const byPriority = {};
  for (const e of entries) {
    byPriority[e.priority] = (byPriority[e.priority] || 0) + 1;
  }
  
  return {
    initialized: true,
    total_entries: index.total,
    types: index.types,
    by_priority: byPriority,
    oldest: entries.length > 0 ? entries.sort((a,b) => String(a.created || '').localeCompare(String(b.created || '')))[0].created : null,
    newest: entries.length > 0 ? entries.sort((a,b) => String(b.created || '').localeCompare(String(a.created || '')))[0].created : null,
  };
}

// ─── Archiving ───────────────────────────────────────────────────

function archiveMemory(projectDir, type, id) {
  return updateMemory(projectDir, type, id, { active: false, archived: new Date().toISOString() });
}

function getArchivedMemories(projectDir) {
  const memDir = getMemoryDir(projectDir);
  const entries = [];
  
  for (const t of MEMORY_TYPES) {
    const typeDir = path.join(memDir, t);
    if (!fs.existsSync(typeDir)) continue;
    const files = fs.readdirSync(typeDir).filter(f => f.endsWith('.yaml'));
    for (const f of files) {
      const data = readYaml(path.join(typeDir, f));
      if (data.active === false) {
        entries.push({
          id: data.id || f.replace('.yaml', ''),
          type: t,
          content: data.content || '',
          archived: data.archived || null,
        });
      }
    }
  }
  
  return entries;
}

// ─── Export / Import ─────────────────────────────────────────────

function exportMemories(projectDir) {
  const entries = listMemories(projectDir);
  return {
    exported: new Date().toISOString(),
    count: entries.length,
    entries: entries,
  };
}

function importMemories(projectDir, exported) {
  if (!exported || !exported.entries) return { error: 'Invalid export data' };
  
  let imported = 0;
  let skipped = 0;
  
  for (const entry of exported.entries) {
    if (!entry.type || !entry.content) { skipped++; continue; }
    const existing = getMemory(projectDir, entry.type, entry.id);
    if (existing) { skipped++; continue; }
    addMemory(projectDir, entry);
    imported++;
  }
  
  return { imported, skipped };
}

// ─── Exports ─────────────────────────────────────────────────────

module.exports = {
  MEMORY_DIR,
  MEMORY_INDEX,
  MEMORY_TYPES,
  MEMORY_PRIORITIES,
  MAX_ENTRIES_PER_TYPE,
  getMemoryDir,
  initMemory,
  generateId,
  addMemory,
  getMemory,
  updateMemory,
  deleteMemory,
  pruneType,
  listMemories,
  searchMemory,
  getRelevantMemories,
  updateIndex,
  getMemoryStats,
  archiveMemory,
  getArchivedMemories,
  exportMemories,
  importMemories,
  readYaml,
  writeYaml,
};

// ─── Hook Protocol ───────────────────────────────────────────────

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => {
  input += d;
  if (input.length > MAX_STDIN) { process.exit(0); }
});
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const action = data.action || 'stats';
      const projectDir = data.project_dir || data.projectDir || process.cwd();
      let result;
      switch (action) {
        case 'init': result = initMemory(projectDir); break;
        case 'add': result = addMemory(projectDir, data.entry || data); break;
        case 'get': result = getMemory(projectDir, data.type, data.id); break;
        case 'list': result = listMemories(projectDir, data.type); break;
        case 'search': result = searchMemory(projectDir, data.query); break;
        case 'relevant': result = getRelevantMemories(projectDir, data.context); break;
        case 'stats': result = getMemoryStats(projectDir); break;
        case 'delete': result = deleteMemory(projectDir, data.type, data.id); break;
        case 'export': result = exportMemories(projectDir); break;
        case 'import': result = importMemories(projectDir, data.data); break;
        default: result = { error: 'Unknown action: ' + action };
      }
      process.stdout.write(JSON.stringify(result));
    } catch (e) {
      const msg = _fmt('MEMORY_001', { detail: e.message });
      console.error(msg);
      _log(process.cwd(), 'ezra-memory', 'warn', msg);
      process.stdout.write(JSON.stringify({ error: e.message }));
    }
    process.exit(0);
  });
}
