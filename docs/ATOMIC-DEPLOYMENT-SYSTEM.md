# Atomic Deployment System — Agent Implementation Guide

**Version:** 1.0.0
**Author:** Avi Bendetsky / AVI-OS
**Purpose:** Hand this document to any AI agent (Claude Code, Cursor, Copilot, etc.) to implement atomic deployment on any multi-component software project.

---

## What This Is

This document tells you — the AI agent — exactly how to build an atomic deployment system for a software project. "Atomic" means ALL components deploy together or NONE deploy. No partial states. No version drift. No silent failures.

**Read this entire document before writing any code.**

---

## The Problem You Are Solving

Multi-component software (e.g., API + frontend + database migrations + background workers + extensions) breaks when components deploy at different times or some fail silently. The symptoms:

- API expects a database column that hasn't been migrated yet
- Frontend calls an endpoint that doesn't exist on the old API version
- A webhook handler references a queue that was renamed
- Extension version 2 talks to API version 1
- Nobody knows which components actually made it to production

**Your job:** Build a system where deploying is ONE command that either succeeds completely or fails completely with automatic rollback.

---

## Step 1: Inventory All Components

Before writing any code, you MUST inventory every deployable component. Ask the project owner or examine the repo structure. For each component, document:

| Field | Description |
|-------|-------------|
| Name | Human-readable name (e.g., "API Server") |
| Key | Short machine name (e.g., `api`) |
| Path | Local filesystem path |
| Repo | Git repository URL |
| Deploy Target | Where it deploys (npm, Docker, Vercel, Railway, AWS, Supabase, marketplace, etc.) |
| Version Source | Where the version number lives (package.json, Cargo.toml, build.gradle, etc.) |
| Deploy Command | Exact command to deploy this component |
| Verify Command | Exact command to confirm it deployed successfully |
| Rollback Command | Exact command to undo the deployment |
| Dependencies | Which other components must deploy before this one |

**CRITICAL:** Do not skip any component. If it deploys separately, it's a component. This includes:

- Database migrations
- Edge functions / serverless functions
- Background workers / cron jobs
- API servers
- Frontend apps
- Browser extensions
- IDE plugins
- npm/PyPI/crate packages
- Infrastructure-as-code (Terraform, Pulumi)
- Configuration changes (environment variables, feature flags)

---

## Step 2: Define the Deploy Sequence

Components must deploy in dependency order. Database migrations before API. API before frontend. Shared libraries before consumers.

Rules for ordering:

1. **Infrastructure first** — Database migrations, queue creation, cache setup
2. **Shared libraries second** — npm packages, SDKs that other components import
3. **Backend services third** — API servers, background workers
4. **Consumer-facing last** — Frontend, extensions, plugins, CLI tools

Each step has a **gate** (how to verify success) and a **rollback trigger** (what failure looks like).

---

## Step 3: Create the Release Manifest

Create a file called `RELEASE-MANIFEST.yaml` in the project root. This is the single source of truth for what version every component should be at.

```yaml
# RELEASE-MANIFEST.yaml
# Single source of truth. All components deploy together or none deploy.

version: "X.Y.Z"               # The target version for this release
release_date: null              # Set when release executes
release_status: PENDING         # PENDING > DEPLOYING > LIVE > ROLLBACK

components:
  # List every component using the inventory from Step 1
  component_key:
    repo: org/repo-name
    path: /absolute/path/to/local/clone
    deploy_target: npm|docker|vercel|railway|supabase|marketplace|manual
    package_name: package-name-if-applicable
    current_version: "X.Y.Z"
    deploy_command: "exact deploy command"
    verify_command: "exact verify command"
    rollback_command: "exact rollback command"
    depends_on: []              # List of component keys that must deploy first
    status: NOT_DEPLOYED        # NOT_DEPLOYED > DEPLOYING > DEPLOYED > ROLLED_BACK

deploy_sequence:
  # Ordered list — deploy in this exact order
  - step: 1
    component: component_key
    gate: "How to verify this step succeeded"
    rollback_trigger: "What failure looks like"

  - step: 2
    component: next_component_key
    gate: "Verification method"
    rollback_trigger: "Failure condition"
    depends_on: component_key

rollback:
  strategy: REVERSE_ORDER
  description: "If any step fails, rollback all previously deployed steps in reverse order"
```

---

## Step 4: Build the Release Orchestrator Script

Create `scripts/release.js` (or `scripts/release.py` or `scripts/release.sh` — match the project's primary language).

The script MUST implement these 5 commands:

### `preflight` — Pre-deploy verification

Checks BEFORE any deployment happens:

1. **Version alignment** — Every component's version file matches the target version
2. **Git status** — Every repo is clean (no uncommitted changes) and pushed
3. **Tests pass** — Run the test suite; must be green
4. **Build check** — Every component that needs building can build
5. **Pack/bundle check** — Every publishable package can pack without errors
6. **Dependency check** — All deploy tools are installed (npm, vsce, docker, vercel CLI, etc.)

If ANY check fails, preflight fails. Do not proceed to deploy.

### `deploy` — Execute deployment

1. Run preflight automatically first
2. Deploy each component in sequence order
3. After each component deploys, run its verify command (the "gate")
4. If verification passes, move to the next component
5. **If ANY component fails to deploy or verify: STOP and rollback everything already deployed**
6. Report final status

### `verify` — Post-deploy verification

After deployment, independently verify every component is live and on the correct version. This is a read-only check — it doesn't change anything.

### `rollback` — Undo everything

Roll back all deployed components in REVERSE order. Each component's rollback command runs. Report what was rolled back and what couldn't be.

### `status` — Show current state

Display every component's version, git status, and deployment status in a table.

---

## Step 5: Implementation Template

Below is a complete, working template in Node.js. **Adapt this to the project** — replace the COMPONENTS object, DEPLOY_ORDER array, and deploy/verify/rollback logic for each component type.

**IMPORTANT: This template uses ES5 string concatenation, not template literals. This is deliberate — template literals get corrupted by PowerShell on Windows. Do not "modernise" the syntax.**

```javascript
#!/usr/bin/env node
'use strict';

var execSync = require('child_process').execSync;
var fs = require('fs');
var path = require('path');

// CONFIGURATION — EDIT THIS FOR YOUR PROJECT

var VERSION = 'X.Y.Z';

var COMPONENTS = {
  // database: { path: '/path/to/migrations', name: 'my-app-db', target: 'prisma' },
  // api:      { path: '/path/to/api',        name: 'my-app-api', target: 'railway' },
  // frontend: { path: '/path/to/frontend',   name: 'my-app-web', target: 'vercel' },
  // worker:   { path: '/path/to/worker',     name: 'my-app-worker', target: 'railway' },
  // package:  { path: '/path/to/sdk',        name: 'my-sdk', target: 'npm' },
};

var DEPLOY_ORDER = [
  // 'database', 'package', 'api', 'worker', 'frontend',
];

// ENGINE — DO NOT EDIT BELOW THIS LINE (unless adding new deploy target types)

function run(cmd, opts) {
  var timeout = (opts && opts.timeout) || 120000;
  try {
    var result = execSync(cmd, { encoding: 'utf-8', timeout: timeout, stdio: 'pipe' });
    return (result || '').trim();
  } catch (e) {
    if (e.stdout && e.stdout.trim()) return e.stdout.trim();
    return '__ERROR__:' + ((e.stderr || e.message || '').slice(0, 500));
  }
}

function isError(result) {
  return typeof result === 'string' && result.indexOf('__ERROR__') === 0;
}

function log(emoji, msg) { console.log(emoji + ' ' + msg); }
function ok(msg)   { log('\u2705', msg); }
function fail(msg) { log('\u274C', msg); }
function warn(msg) { log('\u26A0\uFE0F', msg); }
function info(msg) { log('\uD83D\uDCCB', msg); }
function divider() { console.log('\n' + Array(51).join('\u2550')); }

function preflight() {
  info('PREFLIGHT CHECK\n');
  var allPassed = true;
  var keys = Object.keys(COMPONENTS);

  info('Step 1: Version alignment');
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]; var comp = COMPONENTS[key];
    var pkgPath = path.join(comp.path, 'package.json');
    if (fs.existsSync(pkgPath)) {
      var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.version === VERSION) ok(key + ': v' + pkg.version);
      else { fail(key + ': v' + pkg.version + ' (expected ' + VERSION + ')'); allPassed = false; }
    }
  }

  console.log(''); info('Step 2: Git status');
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]; var comp = COMPONENTS[key];
    if (!fs.existsSync(path.join(comp.path, '.git'))) { warn(key + ': no .git'); continue; }
    var status = run('cd /d "' + comp.path + '" && git status --short');
    if (!isError(status) && status === '') ok(key + ': clean');
    else { fail(key + ': uncommitted changes'); allPassed = false; }
  }

  console.log(''); info('Step 3: Test suite');
  warn('Tests: configure test command in preflight()');

  console.log(''); info('Step 4: Build check');
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]; var comp = COMPONENTS[key];
    var pkgPath = path.join(comp.path, 'package.json');
    if (fs.existsSync(pkgPath)) {
      var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts && pkg.scripts.build) {
        var buildResult = run('cd /d "' + comp.path + '" && npm run build', { timeout: 180000 });
        if (!isError(buildResult)) ok(key + ': builds');
        else { fail(key + ': build failed'); allPassed = false; }
      }
    }
  }

  console.log(''); info('Step 5: Pack check');
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]; var comp = COMPONENTS[key];
    if (comp.target === 'npm') {
      var packResult = run('cd /d "' + comp.path + '" && npm pack --dry-run 2>&1');
      if (!isError(packResult) && (packResult.indexOf('total files') >= 0 || packResult.indexOf('.tgz') >= 0))
        ok(key + ': pack OK');
      else { fail(key + ': pack failed'); allPassed = false; }
    }
  }

  divider();
  if (allPassed) { ok('PREFLIGHT PASSED'); ok('Run: node scripts/release.js deploy'); }
  else fail('PREFLIGHT FAILED');
  return allPassed;
}

function deployComponent(key, comp) {
  switch (comp.target) {
    case 'npm':     return !isError(run('cd /d "' + comp.path + '" && npm publish --access public'));
    case 'vercel':  return !isError(run('cd /d "' + comp.path + '" && npx vercel --prod --yes', { timeout: 180000 }));
    case 'railway': return !isError(run('cd /d "' + comp.path + '" && railway up --detach'));
    case 'docker':
      var tag = comp.name + ':' + VERSION;
      if (isError(run('cd /d "' + comp.path + '" && docker build -t ' + tag + ' .'))) return false;
      return !isError(run('docker push ' + tag));
    case 'supabase': warn(key + ': configure Supabase deploy'); return true;
    case 'prisma':   return !isError(run('cd /d "' + comp.path + '" && npx prisma migrate deploy'));
    case 'manual':   warn(key + ': requires manual deployment'); return true;
    default: fail(key + ': unknown target "' + comp.target + '"'); return false;
  }
}

function deploy() {
  info('DEPLOYING v' + VERSION + '\n');
  if (!preflight()) { fail('Preflight failed. Aborting.'); return false; }
  console.log('\n'); info('Starting deployment sequence...\n');
  var deployed = [];
  for (var i = 0; i < DEPLOY_ORDER.length; i++) {
    var key = DEPLOY_ORDER[i]; var comp = COMPONENTS[key];
    info('Step ' + (i + 1) + '/' + DEPLOY_ORDER.length + ': ' + key);
    if (deployComponent(key, comp)) { ok(key + ': DEPLOYED'); deployed.push(key); }
    else {
      fail(key + ': DEPLOY FAILED');
      if (deployed.length > 0) { fail('ROLLBACK...'); rollback(deployed); }
      return false;
    }
  }
  divider(); ok('v' + VERSION + ' — ALL ' + deployed.length + ' COMPONENTS DEPLOYED');
  return true;
}

function verify() {
  info('VERIFYING v' + VERSION + '\n');
  for (var i = 0; i < DEPLOY_ORDER.length; i++) {
    var key = DEPLOY_ORDER[i]; var comp = COMPONENTS[key];
    if (comp.target === 'npm') {
      var r = run('npm view ' + comp.name + ' version 2>&1');
      if (r === VERSION) ok(key + ': v' + VERSION); else warn(key + ': ' + (r || 'not found'));
    } else warn(key + ': configure verify for "' + comp.target + '"');
  }
}

function rollback(deployed) {
  if (!deployed) deployed = DEPLOY_ORDER.slice();
  info('ROLLING BACK...\n');
  for (var i = deployed.length - 1; i >= 0; i--) {
    var key = deployed[i]; var comp = COMPONENTS[key];
    if (comp.target === 'vercel') { run('cd /d "' + comp.path + '" && npx vercel rollback'); ok(key + ': rolled back'); }
    else if (comp.target === 'prisma') warn(key + ': DB MIGRATION — manual rollback required');
    else warn(key + ': manual rollback required');
  }
}

function status() {
  info('v' + VERSION + ' — Status\n');
  var keys = Object.keys(COMPONENTS);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]; var comp = COMPONENTS[key];
    var version = '?'; var pkgPath = path.join(comp.path, 'package.json');
    if (fs.existsSync(pkgPath)) version = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version || '?';
    var gitClean = fs.existsSync(path.join(comp.path, '.git'))
      ? (run('cd /d "' + comp.path + '" && git status --short') === '' ? 'clean' : 'DIRTY') : 'no-git';
    console.log('  ' + key.padEnd(15) + ' v' + version.padEnd(10) + ' ' + comp.target.padEnd(12) + ' git:' + gitClean);
  }
}

var command = process.argv[2] || 'status';
if (command === 'preflight') preflight();
else if (command === 'deploy') deploy();
else if (command === 'verify') verify();
else if (command === 'rollback') rollback();
else if (command === 'status') status();
else console.log('Usage: node scripts/release.js [preflight|deploy|verify|rollback|status]');
```

---

## Step 6: Integration Checklist

After implementing the script, verify:

- [ ] `RELEASE-MANIFEST.yaml` exists in the project root with all components listed
- [ ] `scripts/release.js` exists and runs without errors
- [ ] `node scripts/release.js status` shows all components with correct versions
- [ ] `node scripts/release.js preflight` passes all checks (N/N green)
- [ ] All component repos are clean and pushed
- [ ] All version files match the target version
- [ ] The deploy sequence respects dependency order
- [ ] Every deploy target has a corresponding verify and rollback implementation
- [ ] The script uses ES5 string concatenation (NOT template literals) for Windows/PowerShell safety

---

## Rules for the Agent

1. **Do not deploy partially.** If you cannot deploy all components, deploy none.
2. **Do not skip preflight.** Every deploy must pass preflight first.
3. **Do not ignore failures.** If a step fails, rollback immediately.
4. **Do not use template literals.** PowerShell on Windows corrupts them. Use string concatenation.
5. **Version alignment is non-negotiable.** All components must show the same version before deploying.
6. **Git must be clean.** No uncommitted changes in any repo.
7. **Document every component.** If it deploys separately, it goes in the manifest.
8. **Test the script before using it.** Run `preflight` and `status` before ever running `deploy`.

---

## Adapting to Non-Node.js Projects

### Python Projects
- Replace `package.json` version checks with `pyproject.toml` or `setup.cfg` parsing
- Replace `npm publish` with `twine upload dist/*`
- Replace `npm pack --dry-run` with `python -m build --sdist --no-isolation`
- Use `subprocess.run` instead of `execSync`

### Rust Projects
- Parse version from `Cargo.toml`
- Use `cargo publish` for crate deployment
- Use `cargo build --release` for build verification

### Docker-only Projects
- All components are Docker images
- Deploy = build + push + restart service
- Verify = health check endpoint returns correct version
- Rollback = deploy previous image tag

### Monorepo Projects
- Single repo, multiple packages/services
- Version alignment may use a root `lerna.json` or `pnpm-workspace.yaml`
- Deploy order is determined by the dependency graph within the monorepo

---

## FAQ

**Q: What if a component doesn't have a version file?**
A: Add one. Every deployable component must have an explicit version.

**Q: What about database migrations that can't roll back?**
A: Flag them as `rollback: MANUAL`. Deploy database changes first so if they fail, nothing else has deployed yet.

**Q: What if I need to deploy to staging first?**
A: Add an `--env staging` flag. Staging and production use the same sequence but different deploy commands.

**Q: Can I deploy just one component?**
A: No. That defeats the purpose. Bump ALL versions, deploy ALL components. The cost of a full deploy is low. The cost of version drift is high.

**Q: What about zero-downtime deployments?**
A: Separate concern. Atomic ensures version consistency. Zero-downtime ensures no traffic drops. They complement each other.
