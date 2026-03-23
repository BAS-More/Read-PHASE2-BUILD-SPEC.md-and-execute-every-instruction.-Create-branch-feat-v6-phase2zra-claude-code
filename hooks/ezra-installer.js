'use strict';
/**
 * hooks/ezra-installer.js — CLI Installer for EZRA v6
 * Installs EZRA hooks into Claude Code hooks directory.
 * ZERO external dependencies.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Constants ──────────────────────────────────────────────────

const HOOK_FILES = [
  'ezra-guard.js',
  'ezra-settings.js',
  'ezra-settings-writer.js',
  'ezra-oversight.js',
  'ezra-pm.js',
  'ezra-agents.js',
  'ezra-library.js',
  'ezra-memory.js',
  'ezra-memory-hook.js',
  'ezra-planner.js',
  'ezra-dashboard-data.js',
  'ezra-cloud-sync.js',
  'ezra-workflows.js',
  'ezra-license.js',
  'ezra-tier-gate.js',
  'ezra-installer.js',
  'ezra-drift-hook.js',
  'ezra-dash-hook.js',
  'ezra-version-hook.js',
  'ezra-progress-hook.js',
  'ezra-avios-bridge.js',
];

const INSTALL_PATHS = {
  global_hooks: path.join(os.homedir(), '.claude', 'hooks'),
  global_commands: path.join(os.homedir(), '.claude', 'commands', 'ezra'),
  local_hooks: path.join('.claude', 'hooks'),
  local_commands: path.join('.claude', 'commands', 'ezra'),
};

// ─── Helpers ────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function getEzraRoot() {
  // Try to find EZRA root by looking for package.json with name "ezra"
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'ezra' || pkg.name === 'ezra-claude-code') return dir;
      } catch (_) {}
    }
    dir = path.dirname(dir);
  }
  // Fallback: assume hooks/ is inside EZRA root
  return path.dirname(__dirname);
}

// ─── Core Functions ─────────────────────────────────────────────

/**
 * Install EZRA hooks globally (~/.claude/hooks/).
 */
function install(targetDir) {
  const ezraRoot = getEzraRoot();
  const hooksSource = path.join(ezraRoot, 'hooks');
  const cmdsSource = path.join(ezraRoot, 'commands', 'ezra');

  const target = targetDir || INSTALL_PATHS.global_hooks;
  const cmdsTarget = targetDir
    ? path.join(path.dirname(targetDir), 'commands', 'ezra')
    : INSTALL_PATHS.global_commands;

  ensureDir(target);
  ensureDir(cmdsTarget);

  const results = { hooks: [], commands: [], errors: [] };

  // Copy hooks
  for (const hookFile of HOOK_FILES) {
    const src = path.join(hooksSource, hookFile);
    const dest = path.join(target, hookFile);
    if (copyFile(src, dest)) {
      results.hooks.push(hookFile);
    } else {
      results.errors.push('hook not found: ' + hookFile);
    }
  }

  // Copy commands
  if (fs.existsSync(cmdsSource)) {
    const cmdFiles = fs.readdirSync(cmdsSource).filter(f => f.endsWith('.md'));
    for (const cmdFile of cmdFiles) {
      const src = path.join(cmdsSource, cmdFile);
      const dest = path.join(cmdsTarget, cmdFile);
      if (copyFile(src, dest)) {
        results.commands.push(cmdFile);
      }
    }
  }

  return {
    success: results.errors.length === 0,
    installed_hooks: results.hooks.length,
    installed_commands: results.commands.length,
    errors: results.errors,
    target,
  };
}

/**
 * Uninstall EZRA hooks (preserves .ezra/ data).
 */
function uninstall(targetDir) {
  const target = targetDir || INSTALL_PATHS.global_hooks;
  const cmdsTarget = targetDir
    ? path.join(path.dirname(targetDir), 'commands', 'ezra')
    : INSTALL_PATHS.global_commands;

  let removed = 0;

  // Remove hooks
  if (fs.existsSync(target)) {
    for (const hookFile of HOOK_FILES) {
      const fp = path.join(target, hookFile);
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
        removed++;
      }
    }
  }

  // Remove commands dir
  if (fs.existsSync(cmdsTarget)) {
    fs.rmSync(cmdsTarget, { recursive: true, force: true });
  }

  return { success: true, removed };
}

/**
 * Update EZRA (reinstall).
 */
function update(targetDir) {
  uninstall(targetDir);
  return install(targetDir);
}

/**
 * Check installation status.
 */
function getInstallStatus(targetDir) {
  const target = targetDir || INSTALL_PATHS.global_hooks;

  const missing = [];
  const present = [];

  for (const hookFile of HOOK_FILES) {
    const fp = path.join(target, hookFile);
    if (fs.existsSync(fp)) {
      present.push(hookFile);
    } else {
      missing.push(hookFile);
    }
  }

  return {
    installed: missing.length === 0,
    present: present.length,
    missing: missing.length,
    missingFiles: missing,
    target,
  };
}

/**
 * Initialize .ezra/ in a target project directory.
 */
function initProject(projectDir) {
  const ezraDir = path.join(projectDir, '.ezra');
  ensureDir(ezraDir);

  // Create minimal settings.yaml if not exists
  const settingsPath = path.join(ezraDir, 'settings.yaml');
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, '# EZRA Settings\nversion: 6.0.0\n', 'utf8');
  }

  return { success: true, path: ezraDir };
}

// ─── Exports ────────────────────────────────────────────────────

module.exports = {
  HOOK_FILES,
  INSTALL_PATHS,
  install,
  uninstall,
  update,
  getInstallStatus,
  initProject,
  getEzraRoot,
};
