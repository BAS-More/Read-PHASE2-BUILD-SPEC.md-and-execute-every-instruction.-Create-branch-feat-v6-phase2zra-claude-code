#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const EZRA_VERSION = '4.0.0';
const PACKAGE_DIR = path.resolve(__dirname, '..');
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

// ─── Colors (safe on Windows 10+, Mac, Linux) ───────────────────

function c(style, text) {
  if (process.env.NO_COLOR || process.env.TERM === 'dumb') return text;
  const codes = {
    bold: [1, 22], cyan: [36, 39], green: [32, 39],
    yellow: [33, 39], red: [31, 39], dim: [2, 22],
  };
  const [open, close] = codes[style] || [0, 0];
  return `\x1b[${open}m${text}\x1b[${close}m`;
}

// ─── Banner ──────────────────────────────────────────────────────

function showBanner() {
  console.log(`
  ${c('cyan', '╔═══════════════════════════════════════════════╗')}
  ${c('cyan', '║')}                                               ${c('cyan', '║')}
  ${c('cyan', '║')}   ${c('bold', 'A E G I S')}   v${EZRA_VERSION}                        ${c('cyan', '║')}
  ${c('cyan', '║')}   Automated Epistemic Governance              ${c('cyan', '║')}
  ${c('cyan', '║')}   & Intelligence System                       ${c('cyan', '║')}
  ${c('cyan', '║')}                                               ${c('cyan', '║')}
  ${c('cyan', '║')}   The divine shield for codebases.            ${c('cyan', '║')}
  ${c('cyan', '║')}                                               ${c('cyan', '║')}
  ${c('cyan', '╚═══════════════════════════════════════════════╝')}
  `);
}

// ─── Manifest ────────────────────────────────────────────────────

const MANIFEST = {
  commands: fs.readdirSync(path.join(PACKAGE_DIR, 'commands', 'ezra'))
    .filter(f => f.endsWith('.md'))
    .map(f => path.join('commands', 'ezra', f)),
  agents: fs.readdirSync(path.join(PACKAGE_DIR, 'agents'))
    .filter(f => f.endsWith('.md'))
    .map(f => path.join('agents', f)),
  skills: [path.join('skills', 'ezra', 'SKILL.md')],
  hooks: fs.readdirSync(path.join(PACKAGE_DIR, 'hooks'))
    .filter(f => f.endsWith('.js'))
    .map(f => path.join('hooks', f)),
  templates: fs.existsSync(path.join(PACKAGE_DIR, 'templates'))
    ? fs.readdirSync(path.join(PACKAGE_DIR, 'templates'))
        .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map(f => path.join('templates', f))
    : [],
};

// ─── Path helpers ────────────────────────────────────────────────

function getGlobalDir() {
  return path.join(os.homedir(), '.claude');
}

function getLocalDir() {
  return path.join(process.cwd(), '.claude');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function escapeForSettingsJson(p) {
  if (IS_WIN) return p.replace(/\\/g, '\\\\');
  return p;
}

// ─── Ask helper ──────────────────────────────────────────────────

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

// ─── Install ─────────────────────────────────────────────────────

function install(targetDir) {
  const dirsToCreate = [
    path.join(targetDir, 'commands', 'ezra'),
    path.join(targetDir, 'agents'),
    path.join(targetDir, 'skills', 'ezra'),
    path.join(targetDir, 'hooks'),
  ];
  dirsToCreate.forEach(ensureDir);

  const allFiles = [
    ...MANIFEST.commands,
    ...MANIFEST.agents,
    ...MANIFEST.skills,
    ...MANIFEST.hooks,
  ];

  let installed = 0;
  let skipped = 0;

  for (const file of allFiles) {
    const src = path.join(PACKAGE_DIR, file);
    const dest = path.join(targetDir, file);

    if (!fs.existsSync(src)) {
      console.log(`  ${c('yellow', '⚠')} Missing source: ${file}`);
      skipped++;
      continue;
    }

    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    installed++;
    console.log(`  ${c('green', '✓')} ${file}`);
  }

  // Copy templates to a shared location
  if (MANIFEST.templates.length > 0) {
    const templatesDir = path.join(targetDir, 'ezra-templates');
    ensureDir(templatesDir);
    for (const file of MANIFEST.templates) {
      const src = path.join(PACKAGE_DIR, file);
      const dest = path.join(templatesDir, path.basename(file));
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        installed++;
        console.log(`  ${c('green', '✓')} ${file}`);
      }
    }
  }

  return { installed, skipped };
}

// ─── Uninstall ───────────────────────────────────────────────────

function uninstall(targetDir) {
  if (!fs.existsSync(path.join(targetDir, 'commands', 'ezra'))) {
    return { removed: 0, found: false };
  }

  let removed = 0;
  const allFiles = [
    ...MANIFEST.commands, ...MANIFEST.agents,
    ...MANIFEST.skills, ...MANIFEST.hooks,
  ];

  for (const file of allFiles) {
    const dest = path.join(targetDir, file);
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
      removed++;
    }
  }

  // Clean empty dirs
  const emptyDirs = [
    path.join(targetDir, 'commands', 'ezra'),
    path.join(targetDir, 'skills', 'ezra'),
    path.join(targetDir, 'ezra-templates'),
  ];
  for (const dir of emptyDirs) {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    } catch { /* ignore */ }
  }

  return { removed, found: true };
}

// ─── Show Info ───────────────────────────────────────────────────

function showInfo() {
  showBanner();
  console.log(`  ${c('bold', 'Contents:')}`);
  console.log(`  ${c('cyan', `${MANIFEST.commands.length}`)} slash commands (/ezra:init, /ezra:dash, /ezra:health, ...)`);
  console.log(`  ${c('cyan', `${MANIFEST.agents.length}`)} subagents (architect, reviewer, guardian, reconciler)`);
  console.log(`  ${c('cyan', `${MANIFEST.hooks.length}`)} hooks (guard, dash, drift, version)`);
  console.log(`  ${c('cyan', `${MANIFEST.skills.length}`)} skill definition`);
  console.log(`  ${c('cyan', `${MANIFEST.templates.length}`)} process templates`);
  console.log('');
  console.log(`  ${c('bold', 'Platform:')} ${process.platform} (${os.arch()})`);
  console.log(`  ${c('bold', 'Node:')} ${process.version}`);
  console.log(`  ${c('bold', 'Home:')} ${os.homedir()}`);
  console.log(`  ${c('bold', 'Global target:')} ${getGlobalDir()}`);
  console.log(`  ${c('bold', 'Local target:')} ${getLocalDir()}`);
}

// ─── Show Help ───────────────────────────────────────────────────

function showHelp() {
  console.log(`
  ${c('bold', 'ezra-claude-code')} — Install EZRA for Claude Code

  ${c('bold', 'USAGE:')}
    npx ezra-claude-code                      Interactive installer
    npx ezra-claude-code --claude --global     Install to ~/.claude/
    npx ezra-claude-code --claude --local      Install to ./.claude/
    npx ezra-claude-code --uninstall           Remove EZRA files
    npx ezra-claude-code --uninstall --global  Remove from global only
    npx ezra-claude-code --uninstall --local   Remove from local only
    npx ezra-claude-code --info                Show package contents
    npx ezra-claude-code --version             Show version
    npx ezra-claude-code --help                This help

  ${c('bold', 'PLATFORM:')}
    Works on Windows (PowerShell, CMD), macOS, and Linux.
    Requires Node.js >= 16.7.0
    Requires Claude Code installed and working.

  ${c('bold', 'AFTER INSTALL:')}
    Restart Claude Code, then run /ezra:help
  `);
}

// ─── Settings.json Hook Helper ───────────────────────────────────

function generateHooksConfig(targetDir) {
  const guardPath = escapeForSettingsJson(path.join(targetDir, 'hooks', 'ezra-guard.js'));
  const dashPath = escapeForSettingsJson(path.join(targetDir, 'hooks', 'ezra-dash-hook.js'));
  const driftPath = escapeForSettingsJson(path.join(targetDir, 'hooks', 'ezra-drift-hook.js'));
  const versionPath = escapeForSettingsJson(path.join(targetDir, 'hooks', 'ezra-version-hook.js'));

  return {
    hooks: {
      PreToolUse: [{
        matcher: 'Edit|Write|MultiEdit',
        hooks: [{
          type: 'command',
          command: `node "${guardPath}"`,
          timeout: 5,
        }],
      }],
      SessionStart: [{
        matcher: 'startup|compact',
        hooks: [{
          type: 'command',
          command: `node "${dashPath}"`,
          timeout: 5,
        }],
      }],
      PostToolUse: [{
        matcher: 'Write|Edit|MultiEdit',
        hooks: [
          { type: 'command', command: `node "${driftPath}"`, timeout: 3 },
          { type: 'command', command: `node "${versionPath}"`, timeout: 3 },
        ],
      }],
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const hasFlag = (f) => args.includes(f);

  if (hasFlag('--version') || hasFlag('-v')) { console.log(EZRA_VERSION); return; }
  if (hasFlag('--help') || hasFlag('-h')) { showHelp(); return; }
  if (hasFlag('--info') || hasFlag('-i')) { showInfo(); return; }

  showBanner();

  // ─── Uninstall ─────────────────────────────────────────────
  if (hasFlag('--uninstall')) {
    console.log(`  ${c('bold', 'Uninstalling EZRA...')}`);
    let totalRemoved = 0;

    if (hasFlag('--global') || (!hasFlag('--local'))) {
      const r = uninstall(getGlobalDir());
      if (r.found) {
        console.log(`  ${c('green', '✓')} Removed ${r.removed} files from global (~/.claude/)`);
        totalRemoved += r.removed;
      }
    }
    if (hasFlag('--local') || (!hasFlag('--global'))) {
      const r = uninstall(getLocalDir());
      if (r.found) {
        console.log(`  ${c('green', '✓')} Removed ${r.removed} files from local (./.claude/)`);
        totalRemoved += r.removed;
      }
    }
    if (totalRemoved === 0) {
      console.log(`  ${c('yellow', '⚠')} EZRA not found.`);
    }
    console.log('');
    return;
  }

  // ─── Platform Info ─────────────────────────────────────────
  const platName = IS_WIN ? 'Windows' : IS_MAC ? 'macOS' : 'Linux';
  console.log(`  Platform: ${c('cyan', platName)} │ Node: ${c('cyan', process.version)} │ Home: ${c('dim', os.homedir())}`);
  console.log('');

  // ─── Scope Selection ───────────────────────────────────────
  let scope = null;
  if (hasFlag('--global') || hasFlag('-g')) scope = 'global';
  if (hasFlag('--local') || hasFlag('-l')) scope = 'local';

  if (!scope) {
    console.log('  Where should EZRA be installed?');
    console.log(`    ${c('bold', '1.')} Global  (${c('dim', getGlobalDir())}) — all projects`);
    console.log(`    ${c('bold', '2.')} Local   (${c('dim', getLocalDir())}) — this project only`);
    console.log('');
    const choice = await ask('  Choice [1]: ');
    scope = (choice === '2') ? 'local' : 'global';
  }

  const targetDir = scope === 'global' ? getGlobalDir() : getLocalDir();

  console.log('');
  console.log(`  ${c('bold', 'Installing to:')} ${targetDir}`);
  console.log('');

  // ─── Install ───────────────────────────────────────────────
  const result = install(targetDir);

  console.log('');
  console.log(`  ${c('green', '═══════════════════════════════════════════════')}`);
  console.log(`  ${c('green', `✓ Installed ${result.installed} files`)}`);
  if (result.skipped > 0) {
    console.log(`  ${c('yellow', `⚠ Skipped ${result.skipped} files (not found in package)`)}`);
  }
  console.log(`  ${c('green', '═══════════════════════════════════════════════')}`);

  // ─── Post-Install Guidance ─────────────────────────────────
  console.log('');
  console.log(`  ${c('bold', 'Next steps:')}`);
  console.log('');
  console.log(`  ${c('cyan', '1.')} Restart Claude Code`);
  console.log(`  ${c('cyan', '2.')} Run ${c('bold', '/ezra:help')} to see all 19 commands`);
  console.log(`  ${c('cyan', '3.')} Run ${c('bold', '/ezra:init')} to initialize your project`);
  console.log('');

  // ─── Optional: Hooks Configuration ─────────────────────────
  console.log(`  ${c('bold', 'Optional — Enable auto-hooks:')}`);
  console.log(`  Add the following to ${c('dim', path.join(targetDir, 'settings.json'))}`);
  console.log('');

  const hooksConfig = generateHooksConfig(targetDir);
  const configSnippet = JSON.stringify(hooksConfig, null, 2);
  // Indent each line for display
  configSnippet.split('\n').forEach(line => {
    console.log(`    ${c('dim', line)}`);
  });

  console.log('');
  console.log(`  ${c('bold', 'Hooks provide:')}`);
  console.log(`    • Protected path warnings on file edits (PreToolUse)`);
  console.log(`    • Compact project status on every session start (SessionStart)`);
  console.log(`    • Document drift tracking as you code (PostToolUse)`);
  console.log(`    • Automatic versioning of all .ezra/ state changes (PostToolUse)`);
  console.log('');
}

main().catch(err => {
  console.error(`  ${c('red', '✗')} ${err.message}`);
  process.exit(1);
});
