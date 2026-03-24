#!/usr/bin/env node
'use strict';

/**
 * EZRA Best Practice Library Engine
 *
 * Local best practice library with 14 categories.
 * Manages entries: add, remove, search, get relevant, export.
 * Research agent interface (cloud) is a placeholder for Phase 6.
 *
 * Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');

// --- Library Categories ---

const LIBRARY_CATEGORIES = [
  'code-quality',
  'security',
  'testing',
  'architecture',
  'devops',
  'ui-ux',
  'performance',
  'documentation',
  'process-qc',
  'iso-standards',
  'compliance',
  'ai-agent',
  'database',
  'api-design',
];

// --- Entry Schema ---

const ENTRY_SCHEMA = {
  id: 'string',
  title: 'string',
  description: 'string',
  category: 'string',
  subcategory: 'string',
  source_url: 'string',
  date_added: 'string',
  date_verified: 'string',
  relevance_score: 'number',
  applicable_to: 'array',
  tags: 'array',
  severity: 'string',
};

const SEVERITY_LEVELS = ['info', 'advisory', 'recommended', 'required'];

// --- Simple YAML Serializer ---

function serializeEntry(entry) {
  const lines = [];
  lines.push('- id: ' + entry.id);
  lines.push('  title: "' + (entry.title || '').replace(/"/g, '\\"') + '"');
  lines.push('  description: "' + (entry.description || '').replace(/"/g, '\\"') + '"');
  lines.push('  category: ' + (entry.category || ''));
  lines.push('  subcategory: ' + (entry.subcategory || ''));
  lines.push('  source_url: "' + (entry.source_url || '') + '"');
  lines.push('  date_added: ' + (entry.date_added || ''));
  lines.push('  date_verified: ' + (entry.date_verified || ''));
  lines.push('  relevance_score: ' + (entry.relevance_score || 0));
  lines.push('  applicable_to: [' + (entry.applicable_to || []).join(', ') + ']');
  lines.push('  tags: [' + (entry.tags || []).join(', ') + ']');
  lines.push('  severity: ' + (entry.severity || 'info'));
  return lines.join('\n');
}

function serializeEntries(entries) {
  if (!entries || entries.length === 0) return 'entries: []\n';
  return 'entries:\n' + entries.map(e => serializeEntry(e)).join('\n') + '\n';
}

function parseEntries(text) {
  const entries = [];
  if (!text || !text.includes('entries:')) return entries;
  const entryBlocks = text.split(/^- id:/m);
  for (let i = 1; i < entryBlocks.length; i++) {
    const block = '- id:' + entryBlocks[i];
    const entry = {};
    const lines = block.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- id:')) entry.id = trimmed.slice(5).trim();
      else if (trimmed.startsWith('id:')) entry.id = trimmed.slice(3).trim();
      else if (trimmed.startsWith('title:')) entry.title = trimmed.slice(6).trim().replace(/^"|"$/g, '');
      else if (trimmed.startsWith('description:')) entry.description = trimmed.slice(12).trim().replace(/^"|"$/g, '');
      else if (trimmed.startsWith('category:')) entry.category = trimmed.slice(9).trim();
      else if (trimmed.startsWith('subcategory:')) entry.subcategory = trimmed.slice(12).trim();
      else if (trimmed.startsWith('source_url:')) entry.source_url = trimmed.slice(11).trim().replace(/^"|"$/g, '');
      else if (trimmed.startsWith('date_added:')) entry.date_added = trimmed.slice(11).trim();
      else if (trimmed.startsWith('date_verified:')) entry.date_verified = trimmed.slice(14).trim();
      else if (trimmed.startsWith('relevance_score:')) entry.relevance_score = parseInt(trimmed.slice(16).trim()) || 0;
      else if (trimmed.startsWith('applicable_to:')) {
        const inner = trimmed.slice(14).trim();
        if (inner.startsWith('[') && inner.endsWith(']')) {
          const arr = inner.slice(1, -1).trim();
          entry.applicable_to = arr === '' ? [] : arr.split(',').map(s => s.trim());
        } else { entry.applicable_to = []; }
      }
      else if (trimmed.startsWith('tags:')) {
        const inner = trimmed.slice(5).trim();
        if (inner.startsWith('[') && inner.endsWith(']')) {
          const arr = inner.slice(1, -1).trim();
          entry.tags = arr === '' ? [] : arr.split(',').map(s => s.trim());
        } else { entry.tags = []; }
      }
      else if (trimmed.startsWith('severity:')) entry.severity = trimmed.slice(9).trim();
    }
    if (entry.id) entries.push(entry);
  }
  return entries;
}

// --- Seed Data ---

function getSeedData() {
  const now = new Date().toISOString().slice(0, 10);
  return {
    'code-quality': [
      { id: 'cq-001', title: 'Use strict mode in all modules', description: 'Always include use strict to catch common errors early.', category: 'code-quality', subcategory: 'general', source_url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['js', 'ts'], tags: ['strict', 'safety'], severity: 'required' },
      { id: 'cq-002', title: 'Keep functions under 30 lines', description: 'Shorter functions are easier to test, read, and maintain.', category: 'code-quality', subcategory: 'complexity', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['complexity', 'readability'], severity: 'recommended' },
      { id: 'cq-003', title: 'Prefer const over let', description: 'Use const by default; only use let when reassignment is necessary.', category: 'code-quality', subcategory: 'variables', source_url: '', date_added: now, date_verified: now, relevance_score: 7, applicable_to: ['js', 'ts'], tags: ['variables', 'immutability'], severity: 'recommended' },
      { id: 'cq-004', title: 'No unused variables or imports', description: 'Remove all dead code to improve clarity and reduce bundle size.', category: 'code-quality', subcategory: 'cleanup', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['cleanup', 'lint'], severity: 'required' },
    ],
    'security': [
      { id: 'sec-001', title: 'Never store secrets in code', description: 'Use environment variables or secret managers for all credentials.', category: 'security', subcategory: 'secrets', source_url: 'https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password', date_added: now, date_verified: now, relevance_score: 10, applicable_to: ['all'], tags: ['secrets', 'owasp'], severity: 'required' },
      { id: 'sec-002', title: 'Validate all inputs', description: 'Every user input, API parameter, and file path must be validated.', category: 'security', subcategory: 'validation', source_url: 'https://owasp.org/www-community/Input_Validation_Cheat_Sheet', date_added: now, date_verified: now, relevance_score: 10, applicable_to: ['all'], tags: ['validation', 'owasp'], severity: 'required' },
      { id: 'sec-003', title: 'Use parameterised queries', description: 'Never concatenate user input into SQL or NoSQL queries.', category: 'security', subcategory: 'injection', source_url: 'https://owasp.org/www-community/attacks/SQL_Injection', date_added: now, date_verified: now, relevance_score: 10, applicable_to: ['all'], tags: ['sql', 'injection', 'owasp'], severity: 'required' },
      { id: 'sec-004', title: 'Enforce HTTPS everywhere', description: 'All network communication must use TLS/HTTPS.', category: 'security', subcategory: 'transport', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['web', 'api'], tags: ['https', 'tls'], severity: 'required' },
      { id: 'sec-005', title: 'Apply rate limiting to public endpoints', description: 'Prevent abuse by rate limiting authentication and API endpoints.', category: 'security', subcategory: 'dos', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['api', 'web'], tags: ['rate-limit', 'dos'], severity: 'recommended' },
    ],
    'testing': [
      { id: 'test-001', title: 'Aim for 80%+ code coverage', description: 'Test coverage should be at least 80% for production code.', category: 'testing', subcategory: 'coverage', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['coverage'], severity: 'recommended' },
      { id: 'test-002', title: 'Write tests before fixing bugs', description: 'Create a failing test that reproduces the bug before writing the fix.', category: 'testing', subcategory: 'methodology', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['tdd', 'bugs'], severity: 'recommended' },
      { id: 'test-003', title: 'Test edge cases and error paths', description: 'Cover null, empty, boundary, and error cases in every test suite.', category: 'testing', subcategory: 'edges', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['all'], tags: ['edge-cases', 'errors'], severity: 'required' },
    ],
    'architecture': [
      { id: 'arch-001', title: 'Enforce single responsibility principle', description: 'Each module or class should have exactly one reason to change.', category: 'architecture', subcategory: 'solid', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['all'], tags: ['solid', 'srp'], severity: 'required' },
      { id: 'arch-002', title: 'Define clear layer boundaries', description: 'Separate presentation, business logic, and data access layers.', category: 'architecture', subcategory: 'layers', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['all'], tags: ['layers', 'separation'], severity: 'required' },
      { id: 'arch-003', title: 'Document decisions as ADRs', description: 'Record all significant architectural decisions in a persistent format.', category: 'architecture', subcategory: 'decisions', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['adr', 'decisions'], severity: 'recommended' },
    ],
    'devops': [
      { id: 'devops-001', title: 'Automate CI/CD pipelines', description: 'Every merge to main should trigger automated build, test, and deploy.', category: 'devops', subcategory: 'ci-cd', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['all'], tags: ['ci', 'cd', 'automation'], severity: 'required' },
      { id: 'devops-002', title: 'Use infrastructure as code', description: 'Define all infrastructure in version-controlled templates.', category: 'devops', subcategory: 'iac', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['iac', 'terraform', 'bicep'], severity: 'recommended' },
      { id: 'devops-003', title: 'Monitor production with alerts', description: 'Set up dashboards and alerts for key metrics and error rates.', category: 'devops', subcategory: 'monitoring', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['monitoring', 'alerts'], severity: 'recommended' },
    ],
    'ui-ux': [
      { id: 'ux-001', title: 'Provide loading states for async operations', description: 'Show spinners, skeletons, or progress indicators for all async work.', category: 'ui-ux', subcategory: 'feedback', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['web', 'mobile'], tags: ['loading', 'ux'], severity: 'recommended' },
      { id: 'ux-002', title: 'Support keyboard navigation', description: 'All interactive elements must be accessible via keyboard.', category: 'ui-ux', subcategory: 'accessibility', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['web'], tags: ['a11y', 'keyboard'], severity: 'required' },
      { id: 'ux-003', title: 'Show clear error messages', description: 'Error messages should explain what happened and how to fix it.', category: 'ui-ux', subcategory: 'errors', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['web', 'mobile'], tags: ['errors', 'ux'], severity: 'recommended' },
    ],
    'performance': [
      { id: 'perf-001', title: 'Lazy load non-critical resources', description: 'Defer loading of below-the-fold content and non-essential scripts.', category: 'performance', subcategory: 'loading', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['web'], tags: ['lazy-load', 'bundle'], severity: 'recommended' },
      { id: 'perf-002', title: 'Use caching for repeated reads', description: 'Cache API responses, database queries, and computed values.', category: 'performance', subcategory: 'caching', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['caching'], severity: 'recommended' },
      { id: 'perf-003', title: 'Avoid N+1 query patterns', description: 'Use eager loading or batch queries to prevent N+1 database issues.', category: 'performance', subcategory: 'database', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['all'], tags: ['n+1', 'database'], severity: 'required' },
    ],
    'documentation': [
      { id: 'doc-001', title: 'Keep README current', description: 'README should reflect the current state of setup, usage, and architecture.', category: 'documentation', subcategory: 'readme', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['readme'], severity: 'recommended' },
      { id: 'doc-002', title: 'Document API endpoints', description: 'All public API endpoints need clear request/response documentation.', category: 'documentation', subcategory: 'api', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['api'], tags: ['api', 'openapi'], severity: 'required' },
      { id: 'doc-003', title: 'Add inline comments for complex logic', description: 'Non-obvious algorithms and business rules need explanatory comments.', category: 'documentation', subcategory: 'code', source_url: '', date_added: now, date_verified: now, relevance_score: 7, applicable_to: ['all'], tags: ['comments'], severity: 'advisory' },
    ],
    'process-qc': [
      { id: 'pqc-001', title: 'Require code reviews for all merges', description: 'No code reaches main without peer review.', category: 'process-qc', subcategory: 'review', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['all'], tags: ['review', 'pr'], severity: 'required' },
      { id: 'pqc-002', title: 'Run linting before commit', description: 'Enforce lint rules in pre-commit hooks or CI.', category: 'process-qc', subcategory: 'lint', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['lint', 'pre-commit'], severity: 'recommended' },
      { id: 'pqc-003', title: 'Track technical debt explicitly', description: 'Maintain a tech debt register with severity and remediation priority.', category: 'process-qc', subcategory: 'debt', source_url: '', date_added: now, date_verified: now, relevance_score: 7, applicable_to: ['all'], tags: ['tech-debt'], severity: 'advisory' },
    ],
    'iso-standards': [
      { id: 'iso-001', title: 'Align with ISO 25010 quality model', description: 'Map quality attributes to the 8 ISO 25010 characteristics.', category: 'iso-standards', subcategory: '25010', source_url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010', date_added: now, date_verified: now, relevance_score: 7, applicable_to: ['all'], tags: ['iso', '25010'], severity: 'advisory' },
      { id: 'iso-002', title: 'Define measurable quality metrics', description: 'Each quality characteristic should have quantifiable metrics.', category: 'iso-standards', subcategory: 'metrics', source_url: '', date_added: now, date_verified: now, relevance_score: 7, applicable_to: ['all'], tags: ['metrics', 'quality'], severity: 'advisory' },
      { id: 'iso-003', title: 'Document quality requirements', description: 'Quality requirements should be explicit and testable.', category: 'iso-standards', subcategory: 'requirements', source_url: '', date_added: now, date_verified: now, relevance_score: 7, applicable_to: ['all'], tags: ['requirements'], severity: 'advisory' },
    ],
    'compliance': [
      { id: 'comp-001', title: 'Implement data retention policies', description: 'Define and enforce how long data is kept and when it is purged.', category: 'compliance', subcategory: 'data', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['data', 'retention', 'gdpr'], severity: 'recommended' },
      { id: 'comp-002', title: 'Log all access to sensitive data', description: 'Audit trail for who accessed what data and when.', category: 'compliance', subcategory: 'audit', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['all'], tags: ['audit', 'logging'], severity: 'required' },
      { id: 'comp-003', title: 'Obtain and track consent', description: 'For GDPR/HIPAA ensure user consent is recorded and revocable.', category: 'compliance', subcategory: 'consent', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['web', 'mobile'], tags: ['consent', 'gdpr', 'hipaa'], severity: 'recommended' },
    ],
    'ai-agent': [
      { id: 'ai-001', title: 'Guard agent output before applying', description: 'Always validate AI-generated code against governance rules before committing.', category: 'ai-agent', subcategory: 'safety', source_url: '', date_added: now, date_verified: now, relevance_score: 10, applicable_to: ['all'], tags: ['ai', 'safety', 'guard'], severity: 'required' },
      { id: 'ai-002', title: 'Log all agent actions', description: 'Every action taken by an AI agent must be logged for audit.', category: 'ai-agent', subcategory: 'audit', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['all'], tags: ['ai', 'audit', 'logging'], severity: 'required' },
      { id: 'ai-003', title: 'Set token and cost budgets', description: 'Enforce per-task and per-day token limits to control costs.', category: 'ai-agent', subcategory: 'budget', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['ai', 'budget', 'tokens'], severity: 'recommended' },
    ],
    'database': [
      { id: 'db-001', title: 'Use migrations for schema changes', description: 'Never modify database schemas manually; use versioned migrations.', category: 'database', subcategory: 'migrations', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['all'], tags: ['migrations', 'schema'], severity: 'required' },
      { id: 'db-002', title: 'Index columns used in WHERE clauses', description: 'Add indexes for frequently queried columns to avoid full scans.', category: 'database', subcategory: 'indexes', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['all'], tags: ['indexes', 'performance'], severity: 'recommended' },
      { id: 'db-003', title: 'Back up databases regularly', description: 'Automated backups with tested restore procedures.', category: 'database', subcategory: 'backup', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['all'], tags: ['backup', 'recovery'], severity: 'required' },
    ],
    'api-design': [
      { id: 'api-001', title: 'Use consistent naming conventions', description: 'API endpoints should follow RESTful naming with plural nouns.', category: 'api-design', subcategory: 'naming', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['api'], tags: ['rest', 'naming'], severity: 'recommended' },
      { id: 'api-002', title: 'Version your API', description: 'Include version in URL or headers to support backward compatibility.', category: 'api-design', subcategory: 'versioning', source_url: '', date_added: now, date_verified: now, relevance_score: 8, applicable_to: ['api'], tags: ['versioning'], severity: 'recommended' },
      { id: 'api-003', title: 'Return proper HTTP status codes', description: 'Use 200, 201, 400, 401, 403, 404, 500 appropriately.', category: 'api-design', subcategory: 'status-codes', source_url: '', date_added: now, date_verified: now, relevance_score: 9, applicable_to: ['api'], tags: ['http', 'status-codes'], severity: 'required' },
    ],
  };
}

// --- File extension to category mapping ---

const EXT_CATEGORY_MAP = {
  '.js': ['code-quality', 'security', 'testing'],
  '.ts': ['code-quality', 'security', 'testing'],
  '.jsx': ['code-quality', 'ui-ux', 'performance'],
  '.tsx': ['code-quality', 'ui-ux', 'performance'],
  '.css': ['ui-ux', 'performance'],
  '.scss': ['ui-ux', 'performance'],
  '.html': ['ui-ux', 'security'],
  '.sql': ['database', 'security'],
  '.prisma': ['database'],
  '.yaml': ['devops', 'process-qc'],
  '.yml': ['devops', 'process-qc'],
  '.json': ['api-design', 'devops'],
  '.md': ['documentation'],
  '.dockerfile': ['devops', 'security'],
  '.tf': ['devops'],
  '.bicep': ['devops'],
  '.py': ['code-quality', 'security', 'testing'],
};

// --- Library Path Helpers ---

function getLibraryDir(projectDir) {
  return path.join(projectDir, '.ezra', 'library');
}

function getCategoryPath(projectDir, category) {
  return path.join(getLibraryDir(projectDir), category + '.yaml');
}

function getMetaPath(projectDir) {
  return path.join(getLibraryDir(projectDir), 'meta.yaml');
}

// --- Core Functions ---

function getCategories() {
  return LIBRARY_CATEGORIES.slice();
}

function initLibrary(projectDir) {
  const libDir = getLibraryDir(projectDir);
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  const seed = getSeedData();

  for (const cat of LIBRARY_CATEGORIES) {
    const catPath = getCategoryPath(projectDir, cat);
    const entries = seed[cat] || [];
    fs.writeFileSync(catPath, serializeEntries(entries), 'utf8');
  }

  // Write meta
  const totalEntries = Object.values(seed).reduce((sum, arr) => sum + arr.length, 0);
  const meta = [
    'last_update: ' + new Date().toISOString().slice(0, 10),
    'total_entries: ' + totalEntries,
    'categories: ' + LIBRARY_CATEGORIES.length,
    'research_agent_status: not_configured',
  ].join('\n') + '\n';
  fs.writeFileSync(getMetaPath(projectDir), meta, 'utf8');

  return { categories: LIBRARY_CATEGORIES.length, entries: totalEntries };
}

function getEntries(projectDir, category, filter) {
  if (!LIBRARY_CATEGORIES.includes(category)) {
    return [];
  }
  const catPath = getCategoryPath(projectDir, category);
  if (!fs.existsSync(catPath)) return [];
  const text = fs.readFileSync(catPath, 'utf8');
  let entries = parseEntries(text);

  if (filter) {
    const f = String(filter).toLowerCase();
    entries = entries.filter(e =>
      (e.title && e.title.toLowerCase().includes(f)) ||
      (e.description && e.description.toLowerCase().includes(f)) ||
      (e.tags && e.tags.some(t => t.toLowerCase().includes(f)))
    );
  }
  return entries;
}

function addEntry(projectDir, entry) {
  if (!entry || !entry.id || !entry.category) {
    return { success: false, reason: 'Missing id or category' };
  }
  if (!LIBRARY_CATEGORIES.includes(entry.category)) {
    return { success: false, reason: 'Invalid category: ' + entry.category };
  }
  if (entry.severity && !SEVERITY_LEVELS.includes(entry.severity)) {
    entry.severity = 'info';
  }
  if (!entry.date_added) entry.date_added = new Date().toISOString().slice(0, 10);
  if (!entry.date_verified) entry.date_verified = entry.date_added;
  if (!entry.applicable_to) entry.applicable_to = [];
  if (!entry.tags) entry.tags = [];
  if (!entry.relevance_score) entry.relevance_score = 5;
  if (!entry.subcategory) entry.subcategory = 'general';
  if (!entry.source_url) entry.source_url = '';
  if (!entry.description) entry.description = '';

  const catPath = getCategoryPath(projectDir, entry.category);
  const libDir = getLibraryDir(projectDir);
  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });

  let entries = [];
  if (fs.existsSync(catPath)) {
    const text = fs.readFileSync(catPath, 'utf8');
    entries = parseEntries(text);
  }

  // Dedup check
  if (entries.some(e => e.id === entry.id)) {
    return { success: false, reason: 'Duplicate ID: ' + entry.id };
  }

  entries.push(entry);
  fs.writeFileSync(catPath, serializeEntries(entries), 'utf8');
  return { success: true, total: entries.length };
}

function removeEntry(projectDir, category, entryId) {
  if (!LIBRARY_CATEGORIES.includes(category)) {
    return { success: false, reason: 'Invalid category' };
  }
  const catPath = getCategoryPath(projectDir, category);
  if (!fs.existsSync(catPath)) return { success: false, reason: 'Category file not found' };

  const text = fs.readFileSync(catPath, 'utf8');
  const entries = parseEntries(text);
  const idx = entries.findIndex(e => e.id === entryId);
  if (idx === -1) return { success: false, reason: 'Entry not found: ' + entryId };

  entries.splice(idx, 1);
  fs.writeFileSync(catPath, serializeEntries(entries), 'utf8');
  return { success: true, remaining: entries.length };
}

function searchLibrary(projectDir, query) {
  if (!query) return [];
  const q = String(query).toLowerCase();
  const results = [];
  for (const cat of LIBRARY_CATEGORIES) {
    const catPath = getCategoryPath(projectDir, cat);
    if (!fs.existsSync(catPath)) continue;
    const text = fs.readFileSync(catPath, 'utf8');
    const entries = parseEntries(text);
    for (const e of entries) {
      if (
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.tags && e.tags.some(t => t.toLowerCase().includes(q))) ||
        (e.id && e.id.toLowerCase().includes(q))
      ) {
        results.push(e);
      }
    }
  }
  return results;
}

function getRelevant(projectDir, filePath) {
  if (!filePath) return [];
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();

  // Determine relevant categories from extension
  let categories = EXT_CATEGORY_MAP[ext] || [];

  // Special cases
  if (basename === 'dockerfile' || basename.startsWith('dockerfile')) {
    categories = [...new Set([...categories, 'devops', 'security'])];
  }
  if (basename.includes('test') || basename.includes('spec')) {
    categories = [...new Set([...categories, 'testing'])];
  }
  if (basename.includes('api') || basename.includes('route')) {
    categories = [...new Set([...categories, 'api-design', 'security'])];
  }

  const results = [];
  for (const cat of categories) {
    const entries = getEntries(projectDir, cat);
    results.push(...entries);
  }
  return results;
}

function importFromUrl(projectDir, url) {
  if (!url || typeof url !== 'string') {
    return { status: 'error', message: 'URL is required' };
  }

  if (url.startsWith('ezra-cloud://')) {
    // Extract query from cloud URL
    const query = url.slice('ezra-cloud://'.length);
    // Read settings for endpoint
    const settingsPath = path.join(projectDir, '.ezra', 'settings.yaml');
    if (!fs.existsSync(settingsPath)) {
      return { status: 'error', message: 'No settings found. Run /ezra:init first.' };
    }
    const content = fs.readFileSync(settingsPath, 'utf8');
    const endpointMatch = content.match(/endpoint:\s*['"]?([^\s'"]+)/);
    if (!endpointMatch) {
      return { status: 'requires_research_agent', url: url, message: 'Cloud endpoint not configured in settings.' };
    }
    const endpoint = endpointMatch[1].replace(/\/+$/, '');
    const { httpsPost } = require(path.join(__dirname, 'ezra-http.js'));
    const apiUrl = endpoint + '/functions/v1/research-agent';
    return httpsPost(apiUrl, { query: query, project: path.basename(projectDir) })
      .then((response) => {
        if (response.statusCode !== 200) {
          return { status: 'error', message: 'Research agent returned ' + response.statusCode };
        }
        return { status: 'success', data: response.body };
      })
      .catch((err) => {
        return { status: 'error', message: 'Network error: ' + err.message };
      });
  }

  return { status: 'requires_research_agent', url: url, message: 'Cloud research agent not configured. Available in Phase 6.' };
}

function exportLibrary(projectDir) {
  const allEntries = {};
  let total = 0;
  for (const cat of LIBRARY_CATEGORIES) {
    const entries = getEntries(projectDir, cat);
    allEntries[cat] = entries;
    total += entries.length;
  }
  return { categories: LIBRARY_CATEGORIES.length, total_entries: total, entries: allEntries };
}

// --- Exports ---

module.exports = {
  LIBRARY_CATEGORIES,
  ENTRY_SCHEMA,
  SEVERITY_LEVELS,
  initLibrary,
  getCategories,
  getEntries,
  addEntry,
  removeEntry,
  searchLibrary,
  getRelevant,
  importFromUrl,
  exportLibrary,
  serializeEntry,
  serializeEntries,
  parseEntries,
};

// --- Hook Protocol ---

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input);
      const cwd = event.cwd || process.cwd();
      const action = event.action || 'export';

      if (action === 'init') {
        const result = initLibrary(cwd);
        process.stdout.write(JSON.stringify(result));
      } else if (action === 'search') {
        const results = searchLibrary(cwd, event.query || '');
        process.stdout.write(JSON.stringify(results));
      } else if (action === 'add') {
        const result = addEntry(cwd, event.entry);
        process.stdout.write(JSON.stringify(result));
      } else if (action === 'remove') {
        const result = removeEntry(cwd, event.category, event.entryId);
        process.stdout.write(JSON.stringify(result));
      } else {
        const data = exportLibrary(cwd);
        process.stdout.write(JSON.stringify(data));
      }
    } catch {
      process.stdout.write('{}');
    }
    process.exit(0);
  });
}
