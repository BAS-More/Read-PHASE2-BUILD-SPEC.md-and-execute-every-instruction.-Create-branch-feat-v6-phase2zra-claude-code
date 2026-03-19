#!/usr/bin/env node

/**
 * EZRA Session Dashboard Hook
 * 
 * Renders a compact project status line on every Claude Code session start.
 * Reads .ezra/ state and outputs a 3-5 line summary injected into context.
 * 
 * Install: Add to settings.json under hooks.SessionStart
 * 
 * {
 *   "matcher": "startup|compact",
 *   "hooks": [{
 *     "type": "command",
 *     "command": "node <path>/ezra-dash-hook.js",
 *     "timeout": 5
 *   }]
 * }
 */

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const ezraDir = path.join(cwd, '.ezra');

// Quick exit if EZRA not initialized
if (!fs.existsSync(ezraDir)) {
  console.log('EZRA: Not initialized. Run /ezra:init');
  process.exit(0);
}

try {
  // Read governance
  let projectName = path.basename(cwd);
  let phase = '?';
  let protectedPaths = 0;
  const govPath = path.join(ezraDir, 'governance.yaml');
  if (fs.existsSync(govPath)) {
    const gov = fs.readFileSync(govPath, 'utf8');
    const nameMatch = gov.match(/name:\s*(.+)/);
    const phaseMatch = gov.match(/project_phase:\s*(.+)/);
    const ppMatches = gov.match(/- pattern:/g);
    if (nameMatch) projectName = nameMatch[1].trim();
    if (phaseMatch) phase = phaseMatch[1].trim();
    if (ppMatches) protectedPaths = ppMatches.length;
  }

  // Count decisions
  let decisions = 0;
  const decDir = path.join(ezraDir, 'decisions');
  if (fs.existsSync(decDir)) {
    decisions = fs.readdirSync(decDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).length;
  }

  // Find last scan
  let lastScan = 'Never';
  let healthScore = '—';
  let critical = 0;
  let high = 0;
  const scanDir = path.join(ezraDir, 'scans');
  if (fs.existsSync(scanDir)) {
    const scans = fs.readdirSync(scanDir).filter(f => f.includes('scan')).sort().reverse();
    if (scans.length > 0) {
      const scanContent = fs.readFileSync(path.join(scanDir, scans[0]), 'utf8');
      const dateMatch = scanContent.match(/timestamp:\s*(.+)/);
      const healthMatch = scanContent.match(/health_score:\s*(\d+)/);
      const critMatch = scanContent.match(/critical:\s*(\d+)/);
      const highMatch = scanContent.match(/high:\s*(\d+)/);
      if (dateMatch) lastScan = dateMatch[1].trim().substring(0, 10);
      if (healthMatch) healthScore = healthMatch[1];
      if (critMatch) critical = parseInt(critMatch[1]);
      if (highMatch) high = parseInt(highMatch[1]);
    }
  }

  // Count documents
  let docCount = 0;
  let docTotal = 55; // Total document types in taxonomy
  let criticalGaps = 0;
  const regPath = path.join(ezraDir, 'docs', 'registry.yaml');
  if (fs.existsSync(regPath)) {
    const reg = fs.readFileSync(regPath, 'utf8');
    const docMatches = reg.match(/- id:/g);
    if (docMatches) docCount = docMatches.length;
    // Count missing criticals
    const critDocs = ['prd', 'tad', 'adr', 'deploy-runbook', 'go-live', 'dr-plan', 'handover'];
    for (const cd of critDocs) {
      if (!reg.includes(`id: ${cd}`)) criticalGaps++;
    }
  } else {
    criticalGaps = 7; // All critical docs missing
  }

  // Count plans
  let activePlans = 0;
  const planDir = path.join(ezraDir, 'plans');
  if (fs.existsSync(planDir)) {
    activePlans = fs.readdirSync(planDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).length;
  }

  // Count risks
  let openRisks = 0;
  const riskFiles = [];
  // Risks might be in scans or a dedicated risks file
  const riskPath = path.join(ezraDir, 'risks.yaml');
  if (fs.existsSync(riskPath)) {
    const riskContent = fs.readFileSync(riskPath, 'utf8');
    const openMatches = riskContent.match(/status:\s*OPEN/gi);
    if (openMatches) openRisks = openMatches.length;
  }

  // Git state
  let branch = '?';
  let uncommitted = 0;
  try {
    const { execSync } = require('child_process');
    branch = execSync('git branch --show-current 2>/dev/null', { encoding: 'utf8' }).trim() || '?';
    const status = execSync('git status --porcelain 2>/dev/null', { encoding: 'utf8' });
    uncommitted = status.split('\n').filter(l => l.trim()).length;
  } catch { /* not a git repo */ }

  // Build compact dashboard
  const healthIcon = healthScore === '—' ? '⚪' : 
    parseInt(healthScore) >= 80 ? '🟢' : 
    parseInt(healthScore) >= 50 ? '🟡' : '🔴';

  const findingsStr = (critical > 0 || high > 0) 
    ? ` │ Findings: ${critical}C ${high}H` 
    : '';

  const gapsStr = criticalGaps > 0 
    ? ` │ Doc gaps: ${criticalGaps} critical` 
    : '';

  const riskStr = openRisks > 0 
    ? ` │ Risks: ${openRisks} open` 
    : '';

  console.log(`═══ EZRA ═══ ${projectName} │ ${phase} │ ${healthIcon} Health: ${healthScore}/100 │ Branch: ${branch} (${uncommitted} uncommitted)`);
  console.log(`  Decisions: ${decisions} │ Docs: ${docCount}/${docTotal} │ Plans: ${activePlans}${findingsStr}${gapsStr}${riskStr}`);
  
  // Urgent alerts
  if (critical > 0) {
    console.log(`  🔴 ${critical} CRITICAL scan findings unresolved`);
  }
  if (criticalGaps > 3) {
    console.log(`  ⚠️  ${criticalGaps} critical documents missing — run /ezra:doc check`);
  }

} catch (err) {
  console.log(`EZRA: ${projectName || 'Unknown'} │ Error reading state: ${err.message}`);
}

process.exit(0);
