'use strict';
/**
 * tests/test-v6-license.js — Tests for EZRA v6 Licensing + Distribution
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const license = require(path.join(__dirname, '..', 'hooks', 'ezra-license.js'));
const tierGate = require(path.join(__dirname, '..', 'hooks', 'ezra-tier-gate.js'));
const installer = require(path.join(__dirname, '..', 'hooks', 'ezra-installer.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error('  FAIL: ' + name + ' — ' + e.message);
  }
}

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-license-'));
}
function cleanup(d) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
// LICENSE MODULE
// ═══════════════════════════════════════════════════════════════

test('LICENSE_TIERS has 4 entries', () => {
  assert.strictEqual(Object.keys(license.LICENSE_TIERS).length, 4);
});

test('LICENSE_TIERS includes core, pro, team, enterprise', () => {
  for (const t of ['core', 'pro', 'team', 'enterprise']) {
    assert(license.LICENSE_TIERS[t], 'missing tier: ' + t);
  }
});

test('Core tier does not require key', () => {
  assert.strictEqual(license.LICENSE_TIERS.core.requiresKey, false);
});

test('Pro tier requires key', () => {
  assert.strictEqual(license.LICENSE_TIERS.pro.requiresKey, true);
});

test('FEATURE_TIER_MAP covers features', () => {
  const features = Object.keys(license.FEATURE_TIER_MAP);
  assert(features.length >= 20, 'expected at least 20 features mapped');
});

test('FEATURE_TIER_MAP has core features', () => {
  assert.strictEqual(license.FEATURE_TIER_MAP['oversight.level'], 'core');
  assert.strictEqual(license.FEATURE_TIER_MAP['guard'], 'core');
});

test('FEATURE_TIER_MAP has pro features', () => {
  assert.strictEqual(license.FEATURE_TIER_MAP['multi_agent'], 'pro');
  assert.strictEqual(license.FEATURE_TIER_MAP['planning_engine'], 'pro');
});

test('FEATURE_TIER_MAP has team features', () => {
  assert.strictEqual(license.FEATURE_TIER_MAP['project_manager'], 'team');
  assert.strictEqual(license.FEATURE_TIER_MAP['cross_project_learning'], 'team');
});

test('TIER_ORDER has 4 entries in order', () => {
  assert.deepStrictEqual(license.TIER_ORDER, ['core', 'pro', 'team', 'enterprise']);
});

// ─── validateKey ────────────────────────────────────────────────

test('validateKey rejects null', () => {
  assert.strictEqual(license.validateKey(null).valid, false);
});

test('validateKey rejects empty string', () => {
  assert.strictEqual(license.validateKey('').valid, false);
});

test('validateKey rejects bad prefix', () => {
  assert.strictEqual(license.validateKey('bad_prefix_12345678').valid, false);
});

test('validateKey rejects short suffix', () => {
  assert.strictEqual(license.validateKey('ezra_pro_short').valid, false);
});

test('validateKey accepts valid pro key', () => {
  const result = license.validateKey('ezra_pro_abcdefgh12345678');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.tier, 'pro');
});

test('validateKey accepts valid team key', () => {
  const result = license.validateKey('ezra_team_abcdefgh12345678');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.tier, 'team');
});

test('validateKey accepts valid enterprise key', () => {
  const result = license.validateKey('ezra_ent_abcdefgh12345678');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.tier, 'enterprise');
});

// ─── checkLicense ───────────────────────────────────────────────

test('checkLicense returns valid for core (no settings)', () => {
  const tmp = makeTmp();
  try {
    const result = license.checkLicense(tmp);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.tier, 'core');
  } finally {
    cleanup(tmp);
  }
});

test('checkLicense core has available features', () => {
  const tmp = makeTmp();
  try {
    const result = license.checkLicense(tmp);
    assert(result.features_available.length > 0);
    assert(result.features_available.includes('guard'));
  } finally {
    cleanup(tmp);
  }
});

test('checkLicense core has locked features', () => {
  const tmp = makeTmp();
  try {
    const result = license.checkLicense(tmp);
    assert(result.features_locked.length > 0);
    assert(result.features_locked.includes('multi_agent'));
  } finally {
    cleanup(tmp);
  }
});

test('checkLicense pro without cache returns invalid', () => {
  const tmp = makeTmp();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'settings.yaml'), 'licensing:\n  tier: pro\n', 'utf8');
    const result = license.checkLicense(tmp);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, 'no_cache');
  } finally {
    cleanup(tmp);
  }
});

test('checkLicense pro with valid cache returns valid', () => {
  const tmp = makeTmp();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'settings.yaml'), 'licensing:\n  tier: pro\n', 'utf8');
    const cache = {
      tier: 'pro',
      validated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      seats: 1,
    };
    fs.writeFileSync(path.join(tmp, '.ezra', 'license-cache.json'), JSON.stringify(cache), 'utf8');
    const result = license.checkLicense(tmp);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.tier, 'pro');
  } finally {
    cleanup(tmp);
  }
});

test('checkLicense handles expired cache', () => {
  const tmp = makeTmp();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'settings.yaml'), 'licensing:\n  tier: pro\n', 'utf8');
    const cache = {
      tier: 'pro',
      validated_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      expires_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    };
    fs.writeFileSync(path.join(tmp, '.ezra', 'license-cache.json'), JSON.stringify(cache), 'utf8');
    const result = license.checkLicense(tmp);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, 'cache_expired');
  } finally {
    cleanup(tmp);
  }
});

test('checkLicense handles corrupted cache', () => {
  const tmp = makeTmp();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'settings.yaml'), 'licensing:\n  tier: pro\n', 'utf8');
    fs.writeFileSync(path.join(tmp, '.ezra', 'license-cache.json'), 'NOT JSON', 'utf8');
    const result = license.checkLicense(tmp);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, 'cache_corrupted');
  } finally {
    cleanup(tmp);
  }
});

test('checkLicense always passes for core', () => {
  const tmp = makeTmp();
  try {
    // Even with no .ezra dir at all
    const result = license.checkLicense(tmp);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.tier, 'core');
  } finally {
    cleanup(tmp);
  }
});

// ─── isFeatureAvailable ─────────────────────────────────────────

test('isFeatureAvailable allows core features on core', () => {
  const tmp = makeTmp();
  try {
    const result = license.isFeatureAvailable(tmp, 'guard');
    assert.strictEqual(result.available, true);
  } finally {
    cleanup(tmp);
  }
});

test('isFeatureAvailable blocks pro features on core', () => {
  const tmp = makeTmp();
  try {
    const result = license.isFeatureAvailable(tmp, 'multi_agent');
    assert.strictEqual(result.available, false);
  } finally {
    cleanup(tmp);
  }
});

test('isFeatureAvailable allows pro features on pro', () => {
  const tmp = makeTmp();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'settings.yaml'), 'licensing:\n  tier: pro\n', 'utf8');
    const cache = { tier: 'pro', validated_at: new Date().toISOString() };
    fs.writeFileSync(path.join(tmp, '.ezra', 'license-cache.json'), JSON.stringify(cache), 'utf8');
    const result = license.isFeatureAvailable(tmp, 'multi_agent');
    assert.strictEqual(result.available, true);
  } finally {
    cleanup(tmp);
  }
});

test('isFeatureAvailable blocks team features on pro', () => {
  const tmp = makeTmp();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'settings.yaml'), 'licensing:\n  tier: pro\n', 'utf8');
    const cache = { tier: 'pro', validated_at: new Date().toISOString() };
    fs.writeFileSync(path.join(tmp, '.ezra', 'license-cache.json'), JSON.stringify(cache), 'utf8');
    const result = license.isFeatureAvailable(tmp, 'project_manager');
    assert.strictEqual(result.available, false);
  } finally {
    cleanup(tmp);
  }
});

test('isFeatureAvailable allows unmapped features', () => {
  const tmp = makeTmp();
  try {
    const result = license.isFeatureAvailable(tmp, 'nonexistent_feature');
    assert.strictEqual(result.available, true);
  } finally {
    cleanup(tmp);
  }
});

// ─── getLicenseStatus ───────────────────────────────────────────

test('getLicenseStatus returns summary', () => {
  const tmp = makeTmp();
  try {
    const status = license.getLicenseStatus(tmp);
    assert.strictEqual(status.tier, 'core');
    assert.strictEqual(status.valid, true);
    assert(status.features_available > 0);
  } finally {
    cleanup(tmp);
  }
});

// ─── getCachedLicense / writeLicenseCache ────────────────────────

test('getCachedLicense returns null when no cache', () => {
  const tmp = makeTmp();
  try {
    assert.strictEqual(license.getCachedLicense(tmp), null);
  } finally {
    cleanup(tmp);
  }
});

test('writeLicenseCache and getCachedLicense roundtrip', () => {
  const tmp = makeTmp();
  try {
    const data = { tier: 'pro', validated_at: new Date().toISOString(), seats: 5 };
    license.writeLicenseCache(tmp, data);
    const cached = license.getCachedLicense(tmp);
    assert.strictEqual(cached.tier, 'pro');
    assert.strictEqual(cached.seats, 5);
  } finally {
    cleanup(tmp);
  }
});

// ─── refreshLicense ─────────────────────────────────────────────

test('refreshLicense clears cache', () => {
  const tmp = makeTmp();
  try {
    license.writeLicenseCache(tmp, { tier: 'pro', validated_at: new Date().toISOString() });
    assert(license.getCachedLicense(tmp) !== null);
    license.refreshLicense(tmp);
    assert.strictEqual(license.getCachedLicense(tmp), null);
  } finally {
    cleanup(tmp);
  }
});

test('refreshLicense succeeds when no cache', () => {
  const tmp = makeTmp();
  try {
    const result = license.refreshLicense(tmp);
    assert.strictEqual(result.success, true);
  } finally {
    cleanup(tmp);
  }
});

// ─── tierRank ───────────────────────────────────────────────────

test('tierRank orders correctly', () => {
  assert(license.tierRank('core') < license.tierRank('pro'));
  assert(license.tierRank('pro') < license.tierRank('team'));
  assert(license.tierRank('team') < license.tierRank('enterprise'));
});

// ═══════════════════════════════════════════════════════════════
// TIER GATE MODULE
// ═══════════════════════════════════════════════════════════════

test('GATED_COMMANDS has entries', () => {
  assert(Object.keys(tierGate.GATED_COMMANDS).length > 0);
});

test('CORE_COMMANDS has entries', () => {
  assert(tierGate.CORE_COMMANDS.length > 0);
});

test('checkGate allows core commands', () => {
  const tmp = makeTmp();
  try {
    const result = tierGate.checkGate('ezra:init', tmp);
    assert.strictEqual(result, null);
  } finally {
    cleanup(tmp);
  }
});

test('checkGate allows core commands regardless of license', () => {
  const tmp = makeTmp();
  try {
    for (const cmd of ['ezra:scan', 'ezra:guard', 'ezra:status', 'ezra:help']) {
      const result = tierGate.checkGate(cmd, tmp);
      assert.strictEqual(result, null, cmd + ' should not be gated');
    }
  } finally {
    cleanup(tmp);
  }
});

test('checkGate blocks pro features on core', () => {
  const tmp = makeTmp();
  try {
    const result = tierGate.checkGate('ezra:cost', tmp);
    assert(result !== null, 'ezra:cost should be blocked on core');
    assert.strictEqual(result.blocked, true);
  } finally {
    cleanup(tmp);
  }
});

test('checkGate allows pro features on pro', () => {
  const tmp = makeTmp();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'settings.yaml'), 'licensing:\n  tier: pro\n', 'utf8');
    const cache = { tier: 'pro', validated_at: new Date().toISOString() };
    fs.writeFileSync(path.join(tmp, '.ezra', 'license-cache.json'), JSON.stringify(cache), 'utf8');
    const result = tierGate.checkGate('ezra:cost', tmp);
    assert.strictEqual(result, null, 'ezra:cost should be allowed on pro');
  } finally {
    cleanup(tmp);
  }
});

test('checkGate allows unknown commands', () => {
  const tmp = makeTmp();
  try {
    const result = tierGate.checkGate('ezra:unknown', tmp);
    assert.strictEqual(result, null);
  } finally {
    cleanup(tmp);
  }
});

test('handleHook returns empty object for no event', () => {
  const result = tierGate.handleHook(null);
  assert.deepStrictEqual(result, {});
});

test('handleHook returns empty for core command', () => {
  const result = tierGate.handleHook({ tool_name: 'ezra:init', project_dir: os.tmpdir() });
  assert.deepStrictEqual(result, {});
});

// ═══════════════════════════════════════════════════════════════
// INSTALLER MODULE
// ═══════════════════════════════════════════════════════════════

test('HOOK_FILES is an array', () => {
  assert(Array.isArray(installer.HOOK_FILES));
  assert(installer.HOOK_FILES.length > 0);
});

test('INSTALL_PATHS has expected keys', () => {
  assert(installer.INSTALL_PATHS.global_hooks);
  assert(installer.INSTALL_PATHS.global_commands);
});

test('getInstallStatus returns status', () => {
  const tmp = makeTmp();
  try {
    const status = installer.getInstallStatus(path.join(tmp, 'hooks'));
    assert.strictEqual(status.installed, false);
    assert(status.missing > 0);
  } finally {
    cleanup(tmp);
  }
});

test('install copies hooks to target', () => {
  const tmp = makeTmp();
  try {
    const target = path.join(tmp, 'hooks');
    const result = installer.install(target);
    assert.strictEqual(result.success || result.installed_hooks > 0, true);
  } finally {
    cleanup(tmp);
  }
});

test('uninstall removes hooks', () => {
  const tmp = makeTmp();
  try {
    const target = path.join(tmp, 'hooks');
    installer.install(target);
    const result = installer.uninstall(target);
    assert.strictEqual(result.success, true);
  } finally {
    cleanup(tmp);
  }
});

test('initProject creates .ezra directory', () => {
  const tmp = makeTmp();
  try {
    installer.initProject(tmp);
    assert(fs.existsSync(path.join(tmp, '.ezra')));
    assert(fs.existsSync(path.join(tmp, '.ezra', 'settings.yaml')));
  } finally {
    cleanup(tmp);
  }
});

test('getEzraRoot returns a directory', () => {
  const root = installer.getEzraRoot();
  assert(typeof root === 'string');
  assert(root.length > 0);
});

// ═══════════════════════════════════════════════════════════════
// SETTINGS ACCESSOR
// ═══════════════════════════════════════════════════════════════

test('settings: getLicensing accessor exists', () => {
  const settings = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));
  assert(typeof settings.getLicensing === 'function', 'getLicensing should be a function');
});

test('settings: licensing defaults present', () => {
  const settings = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));
  const defaults = settings.getDefault();
  assert(defaults.licensing, 'licensing section should exist in defaults');
  assert.strictEqual(defaults.licensing.tier, 'core');
  assert.strictEqual(defaults.licensing.offline_cache_days, 30);
});

// ─── Report ─────────────────────────────────────────────────────

console.log('');
console.log('PASSED: ' + passed + '  FAILED: ' + failed);
if (failed > 0) process.exit(1);
