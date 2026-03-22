#!/usr/bin/env node

/**
 * EZRA Installer
 * 
 * Copies EZRA commands, agents, hooks, and skills into your
 * Claude Code configuration directory.
 * 
 * Usage:
 *   node install.js              # Interactive — asks global or local
 *   node install.js --global     # Install to ~/.claude/
 *   node install.js --local      # Install to ./.claude/
 *   node install.js --uninstall  # Remove EZRA files
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const EZRA_VERSION = '1.0.0';

// What we install
const MANIFEST = {
  commands: [
    'commands/ezra/init.md',
    'commands/ezra/scan.md',
    'commands/ezra/guard.md',
    'commands/ezra/reconcile.md',
    'commands/ezra/decide.md',
    'commands/ezra/review.md',
    'commands/ezra/status.md',
    'commands/ezra/help.md',
    'commands/ezra/doc.md',
    'commands/ezra/dash.md',
    'commands/ezra/doc-check.md',
    'commands/ezra/doc-sync.md',
    'commands/ezra/doc-approve.md',
    'commands/ezra/version.md',
    'commands/ezra/health.md',
    'commands/ezra/advisor.md',
    'commands/ezra/process.md',
    'commands/ezra/auto.md',
    'commands/ezra/multi.md',
  ],
  agents: [
    'agents/ezra-architect.md',
    'agents/ezra-reviewer.md',
    'agents/ezra-guardian.md',
    'agents/ezra-reconciler.md',
  ],
  skills: [
    'skills/ezra/SKILL.md',
  ],
  hooks: [
    'hooks/ezra-guard.js',
    'hooks/ezra-dash-hook.js',
    'hooks/ezra-drift-hook.js',
    'hooks/ezra-version-hook.js',
  ],
};

const sourceDir = __dirname;

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--uninstall')) {
    return uninstall(args);
  }

  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║     A E G I S                                 ║
  ║     Automated Epistemic Governance            ║
  ║     & Intelligence System                     ║
  ║                                               ║
  ║     v${EZRA_VERSION}                                    ║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝
  `);

  let targetDir;

  if (args.includes('--global') || args.includes('-g')) {
    targetDir = getGlobalDir();
    console.log(`  Installing globally to: ${targetDir}`);
  } else if (args.includes('--local') || args.includes('-l')) {
    targetDir = path.join(process.cwd(), '.claude');
    console.log(`  Installing locally to: ${targetDir}`);
  } else {
    // Interactive
    const choice = await ask('Install globally (~/.claude/) or locally (./.claude/)? [g/l]: ');
    if (choice.toLowerCase().startsWith('g')) {
      targetDir = getGlobalDir();
    } else {
      targetDir = path.join(process.cwd(), '.claude');
    }
    console.log(`  Installing to: ${targetDir}`);
  }

  // Create directories
  const dirs = [
    path.join(targetDir, 'commands', 'ezra'),
    path.join(targetDir, 'agents'),
    path.join(targetDir, 'skills', 'ezra'),
    path.join(targetDir, 'hooks'),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Copy files
  let installed = 0;
  const allFiles = [
    ...MANIFEST.commands,
    ...MANIFEST.agents,
    ...MANIFEST.skills,
    ...MANIFEST.hooks,
  ];

  for (const file of allFiles) {
    const src = path.join(sourceDir, file);
    const dest = path.join(targetDir, file);

    if (!fs.existsSync(src)) {
      console.log(`  ⚠ Missing: ${file}`);
      continue;
    }

    fs.copyFileSync(src, dest);
    installed++;
    console.log(`  ✓ Installed: ${file}`);
  }

  // Add hook configuration hint
  console.log(`
  ═══════════════════════════════════════════════
  ✓ Installed ${installed} files

  EZRA is ready. Restart Claude Code, then run:

    /ezra:help     — See all commands
    /ezra:init     — Initialize for your project

  OPTIONAL — Auto-guard hook:
  Add this to your settings.json (${targetDir}/settings.json)
  under "hooks" → "PreToolUse":

  {
    "matcher": "Edit|Write|MultiEdit",
    "hooks": [{
      "type": "command",
      "command": "node ${path.join(targetDir, 'hooks', 'ezra-guard.js').replace(/\\/g, '\\\\\\\\')}",
      "timeout": 5
    }]
  }
  ═══════════════════════════════════════════════
  `);
}

function uninstall(args) {
  let targetDir;
  if (args.includes('--global') || args.includes('-g')) {
    targetDir = getGlobalDir();
  } else if (args.includes('--local') || args.includes('-l')) {
    targetDir = path.join(process.cwd(), '.claude');
  } else {
    // Try both
    const globalDir = getGlobalDir();
    const localDir = path.join(process.cwd(), '.claude');
    
    let found = false;
    if (fs.existsSync(path.join(globalDir, 'commands', 'ezra'))) {
      removeFiles(globalDir);
      found = true;
    }
    if (fs.existsSync(path.join(localDir, 'commands', 'ezra'))) {
      removeFiles(localDir);
      found = true;
    }
    
    if (!found) {
      console.log('  EZRA not found in global or local directories.');
    }
    return;
  }

  removeFiles(targetDir);
}

function removeFiles(targetDir) {
  console.log(`  Uninstalling EZRA from: ${targetDir}`);
  
  let removed = 0;
  const allFiles = [
    ...MANIFEST.commands,
    ...MANIFEST.agents,
    ...MANIFEST.skills,
    ...MANIFEST.hooks,
  ];

  for (const file of allFiles) {
    const dest = path.join(targetDir, file);
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
      removed++;
      console.log(`  ✓ Removed: ${file}`);
    }
  }

  // Remove empty directories
  const emptyDirs = [
    path.join(targetDir, 'commands', 'ezra'),
    path.join(targetDir, 'skills', 'ezra'),
  ];
  for (const dir of emptyDirs) {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    } catch { /* ignore */ }
  }

  console.log(`  ✓ Removed ${removed} EZRA files.`);
}

function getGlobalDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, '.claude');
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

main().catch(err => {
  console.error(`  ✗ Install failed: ${err.message}`);
  process.exit(1);
});
