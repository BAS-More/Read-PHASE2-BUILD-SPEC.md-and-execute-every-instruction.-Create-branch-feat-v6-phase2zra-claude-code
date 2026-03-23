'use strict';

/**
 * EZRA Cloud Sync Foundation
 * Local state backup/restore + sync manifest for future cloud integration.
 * Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Constants ───────────────────────────────────────────────────

const SYNC_DIR = '.ezra-sync';
const MANIFEST_FILE = 'sync-manifest.yaml';
const SYNC_STATE_FILE = 'sync-state.yaml';

const SYNCABLE_PATHS = [
  'governance.yaml',
  'knowledge.yaml',
  'settings.yaml',
  'decisions',
  'versions',
  'docs/registry.yaml',
  'library',
  'agents',
  'scans',
];

// ─── YAML Helpers ────────────────────────────────────────────────

function readYaml(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([\w.-]+):\s*(.*)$/);
    if (match) {
      const [, key, val] = match;
      if (val === 'true') result[key] = true;
      else if (val === 'false') result[key] = false;
      else if (val === 'null' || val === '~') result[key] = null;
      else if (/^-?\d+$/.test(val)) result[key] = parseInt(val, 10);
      else if (/^-?\d+\.\d+$/.test(val)) result[key] = parseFloat(val);
      else result[key] = val.replace(/^['"]|['"]$/g, '');
    }
  }
  return result;
}

function writeYaml(filePath, data) {
  const lines = [];
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      lines.push(key + ':');
      for (const item of val) lines.push('  - ' + item);
    } else {
      lines.push(key + ': ' + (val === null ? 'null' : val));
    }
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

// ─── Hashing ─────────────────────────────────────────────────────

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function hashDir(dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  const files = fs.readdirSync(dirPath).filter(f => !f.startsWith('.')).sort();
  const hashes = files.map(f => {
    const fp = path.join(dirPath, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) return hashDir(fp);
    return hashFile(fp);
  }).filter(Boolean);
  if (hashes.length === 0) return null;
  return crypto.createHash('sha256').update(hashes.join(',')).digest('hex').slice(0, 16);
}

// ─── Manifest ────────────────────────────────────────────────────

function generateManifest(projectDir) {
  const ezraDir = path.join(projectDir, '.ezra');
  if (!fs.existsSync(ezraDir)) return { error: 'EZRA not initialized', entries: [] };

  const entries = [];
  const now = new Date().toISOString();

  for (const syncPath of SYNCABLE_PATHS) {
    const fullPath = path.join(ezraDir, syncPath);
    if (!fs.existsSync(fullPath)) continue;

    const stat = fs.statSync(fullPath);
    const entry = {
      path: syncPath,
      type: stat.isDirectory() ? 'directory' : 'file',
      hash: stat.isDirectory() ? hashDir(fullPath) : hashFile(fullPath),
      size: stat.isDirectory() ? countFilesInDir(fullPath) : stat.size,
      modified: stat.mtime.toISOString(),
    };
    entries.push(entry);
  }

  return {
    generated: now,
    project: path.basename(projectDir),
    entries: entries,
    total_entries: entries.length,
  };
}

function countFilesInDir(dirPath) {
  let count = 0;
  for (const f of fs.readdirSync(dirPath)) {
    const fp = path.join(dirPath, f);
    const stat = fs.statSync(fp);
    count += stat.isDirectory() ? countFilesInDir(fp) : 1;
  }
  return count;
}

// ─── Sync State ──────────────────────────────────────────────────

function getSyncDir(projectDir) {
  return path.join(projectDir, '.ezra', SYNC_DIR);
}

function loadSyncState(projectDir) {
  const statePath = path.join(getSyncDir(projectDir), SYNC_STATE_FILE);
  return readYaml(statePath);
}

function saveSyncState(projectDir, state) {
  const syncDir = getSyncDir(projectDir);
  if (!fs.existsSync(syncDir)) fs.mkdirSync(syncDir, { recursive: true });
  writeYaml(path.join(syncDir, SYNC_STATE_FILE), state);
}

// ─── Backup / Restore ────────────────────────────────────────────

function createBackup(projectDir) {
  const ezraDir = path.join(projectDir, '.ezra');
  if (!fs.existsSync(ezraDir)) return { error: 'EZRA not initialized' };

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const backupDir = path.join(getSyncDir(projectDir), 'backups', timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  let filesCopied = 0;
  for (const syncPath of SYNCABLE_PATHS) {
    const srcPath = path.join(ezraDir, syncPath);
    if (!fs.existsSync(srcPath)) continue;
    const destPath = path.join(backupDir, syncPath);

    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
      filesCopied += countFilesInDir(srcPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      filesCopied++;
    }
  }

  const manifest = generateManifest(projectDir);
  writeYaml(path.join(backupDir, MANIFEST_FILE), {
    backup_date: new Date().toISOString(),
    files_copied: filesCopied,
    total_entries: manifest.total_entries,
  });

  saveSyncState(projectDir, {
    last_backup: new Date().toISOString(),
    last_backup_dir: backupDir,
    files_backed_up: filesCopied,
  });

  return {
    backup_dir: backupDir,
    files_copied: filesCopied,
    timestamp: timestamp,
  };
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcItem = path.join(src, entry);
    const destItem = path.join(dest, entry);
    const stat = fs.statSync(srcItem);
    if (stat.isDirectory()) {
      copyDirRecursive(srcItem, destItem);
    } else {
      fs.copyFileSync(srcItem, destItem);
    }
  }
}

function listBackups(projectDir) {
  const backupsDir = path.join(getSyncDir(projectDir), 'backups');
  if (!fs.existsSync(backupsDir)) return [];
  return fs.readdirSync(backupsDir)
    .filter(d => {
      const fp = path.join(backupsDir, d);
      return fs.statSync(fp).isDirectory();
    })
    .sort()
    .reverse()
    .map(d => ({
      name: d,
      path: path.join(backupsDir, d),
      manifest: readYaml(path.join(backupsDir, d, MANIFEST_FILE)),
    }));
}

function restoreFromBackup(projectDir, backupName) {
  const backupDir = path.join(getSyncDir(projectDir), 'backups', backupName);
  if (!fs.existsSync(backupDir)) return { error: 'Backup not found: ' + backupName };

  const ezraDir = path.join(projectDir, '.ezra');
  let filesRestored = 0;

  for (const syncPath of SYNCABLE_PATHS) {
    const srcPath = path.join(backupDir, syncPath);
    if (!fs.existsSync(srcPath)) continue;
    const destPath = path.join(ezraDir, syncPath);

    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
      filesRestored += countFilesInDir(srcPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      filesRestored++;
    }
  }

  saveSyncState(projectDir, {
    last_restore: new Date().toISOString(),
    restored_from: backupName,
    files_restored: filesRestored,
  });

  return {
    files_restored: filesRestored,
    restored_from: backupName,
  };
}

// ─── Diff ────────────────────────────────────────────────────────

function diffManifests(manifest1, manifest2) {
  const diffs = [];
  const map1 = {};
  const map2 = {};
  for (const e of manifest1.entries || []) map1[e.path] = e;
  for (const e of manifest2.entries || []) map2[e.path] = e;

  for (const p of Object.keys(map2)) {
    if (!map1[p]) {
      diffs.push({ path: p, change: 'added' });
    } else if (map1[p].hash !== map2[p].hash) {
      diffs.push({ path: p, change: 'modified', old_hash: map1[p].hash, new_hash: map2[p].hash });
    }
  }
  for (const p of Object.keys(map1)) {
    if (!map2[p]) {
      diffs.push({ path: p, change: 'removed' });
    }
  }
  return diffs;
}

// ─── Exports ─────────────────────────────────────────────────────

module.exports = {
  SYNC_DIR,
  MANIFEST_FILE,
  SYNC_STATE_FILE,
  SYNCABLE_PATHS,
  readYaml,
  writeYaml,
  hashFile,
  hashDir,
  generateManifest,
  countFilesInDir,
  getSyncDir,
  loadSyncState,
  saveSyncState,
  createBackup,
  copyDirRecursive,
  listBackups,
  restoreFromBackup,
  diffManifests,
};

// ─── Hook Protocol ───────────────────────────────────────────────

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => input += d);
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const action = data.action || 'manifest';
      const projectDir = data.project_dir || data.projectDir || process.cwd();
      let result;
      switch (action) {
        case 'manifest':
          result = generateManifest(projectDir);
          break;
        case 'backup':
          result = createBackup(projectDir);
          break;
        case 'list-backups':
          result = listBackups(projectDir);
          break;
        case 'restore':
          result = restoreFromBackup(projectDir, data.backup_name || data.backupName);
          break;
        case 'state':
          result = loadSyncState(projectDir);
          break;
        default:
          result = { error: 'Unknown action: ' + action };
      }
      process.stdout.write(JSON.stringify(result));
    } catch (e) {
      process.stdout.write(JSON.stringify({ error: e.message }));
    }
    process.exit(0);
  });
}
