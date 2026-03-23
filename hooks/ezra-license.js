'use strict';
/**
 * hooks/ezra-license.js — License Management Engine for EZRA v6
 * Core free forever, Pro/Team via license key.
 * ZERO external dependencies.
 */
const fs = require('fs');
const path = require('path');

// ─── Constants ──────────────────────────────────────────────────

const LICENSE_TIERS = {
  core:       { name: 'Core',       price: 'Free',        requiresKey: false },
  pro:        { name: 'Pro',        price: '\$29/user/mo', requiresKey: true  },
  team:       { name: 'Team',       price: '\$59/user/mo', requiresKey: true  },
  enterprise: { name: 'Enterprise', price: 'Custom',      requiresKey: true  },
};

const FEATURE_TIER_MAP = {
  'oversight.level':         'core',
  'oversight.standards':     'core',
  'doc_sync':                'core',
  'workflow_custom':         'core',
  'settings':                'core',
  'init':                    'core',
  'guard':                   'core',
  'scan':                    'core',
  'status':                  'core',
  'help':                    'core',
  'health':                  'core',
  'version':                 'core',
  'multi_agent':             'pro',
  'research_agent':          'pro',
  'cloud_sync':              'pro',
  'workflow_import':         'pro',
  'memory_system':           'pro',
  'planning_engine':         'pro',
  'dashboard':               'pro',
  'compliance_profiles':     'pro',
  'self_learning':           'pro',
  'advisor':                 'pro',
  'cost_tracking':           'pro',
  'project_manager':         'team',
  'cross_project_learning':  'team',
  'portfolio':               'team',
  'handoff':                 'team',
};

const LICENSE_CACHE_FILE = 'license-cache.json';
const CACHE_MAX_DAYS = 30;

const TIER_ORDER = ['core', 'pro', 'team', 'enterprise'];

// ─── Helpers ────────────────────────────────────────────────────

function getCachePath(projectDir) {
  return path.join(projectDir, '.ezra', LICENSE_CACHE_FILE);
}

function daysBetween(d1, d2) {
  return Math.abs(d2 - d1) / (1000 * 60 * 60 * 24);
}

function tierRank(tier) {
  const idx = TIER_ORDER.indexOf(tier);
  return idx >= 0 ? idx : 0;
}

// ─── Core Functions ─────────────────────────────────────────────

/**
 * Validate key format (does NOT call external API).
 */
function validateKey(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, reason: 'key must be a non-empty string' };
  }
  const prefixes = ['ezra_pro_', 'ezra_team_', 'ezra_ent_'];
  const hasValidPrefix = prefixes.some(p => key.startsWith(p));
  if (!hasValidPrefix) {
    return { valid: false, reason: 'key must start with ezra_pro_, ezra_team_, or ezra_ent_' };
  }
  const suffix = key.slice(key.indexOf('_', 5) + 1);
  if (suffix.length < 8) {
    return { valid: false, reason: 'key suffix too short (min 8 chars)' };
  }
  // Determine tier from prefix
  let tier = 'pro';
  if (key.startsWith('ezra_team_')) tier = 'team';
  if (key.startsWith('ezra_ent_')) tier = 'enterprise';
  return { valid: true, tier, prefix: key.split('_').slice(0, 2).join('_') + '_' };
}

/**
 * Check license status.
 */
function checkLicense(projectDir) {
  // Try to read settings for tier
  let tier = 'core';
  const settingsPath = path.join(projectDir, '.ezra', 'settings.yaml');
  if (fs.existsSync(settingsPath)) {
    const content = fs.readFileSync(settingsPath, 'utf8');
    const tierMatch = content.match(/^  tier:\s*(.+)/m) || content.match(/tier:\s*(.+)/m);
    if (tierMatch) {
      const parsed = tierMatch[1].trim().replace(/^['"]|['"]$/g, '');
      if (TIER_ORDER.includes(parsed)) tier = parsed;
    }
  }

  // Core always valid
  if (tier === 'core') {
    return {
      valid: true,
      tier: 'core',
      expires: null,
      features_available: Object.keys(FEATURE_TIER_MAP).filter(f => FEATURE_TIER_MAP[f] === 'core'),
      features_locked: Object.keys(FEATURE_TIER_MAP).filter(f => FEATURE_TIER_MAP[f] !== 'core'),
    };
  }

  // For pro/team/enterprise, check cache
  const cachePath = getCachePath(projectDir);
  if (!fs.existsSync(cachePath)) {
    return {
      valid: false,
      tier,
      reason: 'no_cache',
      action: 'revalidate',
      features_available: [],
      features_locked: Object.keys(FEATURE_TIER_MAP),
    };
  }

  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const validatedAt = new Date(cache.validated_at);
    const now = new Date();
    const age = daysBetween(validatedAt, now);

    if (age > CACHE_MAX_DAYS) {
      return {
        valid: false,
        tier,
        reason: 'cache_expired',
        action: 'revalidate',
        cache_age_days: Math.round(age),
        features_available: [],
        features_locked: Object.keys(FEATURE_TIER_MAP),
      };
    }

    const currentRank = tierRank(cache.tier || tier);
    const available = Object.keys(FEATURE_TIER_MAP).filter(f => tierRank(FEATURE_TIER_MAP[f]) <= currentRank);
    const locked = Object.keys(FEATURE_TIER_MAP).filter(f => tierRank(FEATURE_TIER_MAP[f]) > currentRank);

    return {
      valid: true,
      tier: cache.tier || tier,
      expires: cache.expires_at || null,
      seats: cache.seats || 1,
      cache_age_days: Math.round(age),
      features_available: available,
      features_locked: locked,
    };
  } catch (_) {
    return {
      valid: false,
      tier,
      reason: 'cache_corrupted',
      action: 'revalidate',
      features_available: [],
      features_locked: Object.keys(FEATURE_TIER_MAP),
    };
  }
}

/**
 * Check if a specific feature is available at current license tier.
 */
function isFeatureAvailable(projectDir, feature) {
  const requiredTier = FEATURE_TIER_MAP[feature];
  if (!requiredTier) return { available: true, reason: 'unmapped_feature' };
  if (requiredTier === 'core') return { available: true, tier: 'core' };

  const license = checkLicense(projectDir);
  if (!license.valid) {
    return { available: false, requiredTier, currentTier: license.tier, reason: license.reason };
  }

  const currentRank = tierRank(license.tier);
  const requiredRank = tierRank(requiredTier);

  if (currentRank >= requiredRank) {
    return { available: true, tier: license.tier, requiredTier };
  }

  return {
    available: false,
    currentTier: license.tier,
    requiredTier,
    reason: 'insufficient_tier',
    upgrade: 'Requires EZRA ' + LICENSE_TIERS[requiredTier].name + '. Upgrade at ezra.dev/pricing',
  };
}

/**
 * Get license status summary.
 */
function getLicenseStatus(projectDir) {
  const license = checkLicense(projectDir);
  return {
    tier: license.tier,
    valid: license.valid,
    features_available: license.features_available ? license.features_available.length : 0,
    features_locked: license.features_locked ? license.features_locked.length : 0,
    expires: license.expires || null,
    reason: license.reason || null,
  };
}

/**
 * Get cached license data.
 */
function getCachedLicense(projectDir) {
  const cachePath = getCachePath(projectDir);
  if (!fs.existsSync(cachePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * Write license cache (used after external validation).
 */
function writeLicenseCache(projectDir, cacheData) {
  const cachePath = getCachePath(projectDir);
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
  return { success: true, path: cachePath };
}

/**
 * Refresh license (invalidate cache, forcing revalidation).
 */
function refreshLicense(projectDir) {
  const cachePath = getCachePath(projectDir);
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    return { success: true, action: 'cache_cleared' };
  }
  return { success: true, action: 'no_cache_to_clear' };
}

// ─── Exports ────────────────────────────────────────────────────

module.exports = {
  LICENSE_TIERS,
  FEATURE_TIER_MAP,
  LICENSE_CACHE_FILE,
  CACHE_MAX_DAYS,
  TIER_ORDER,
  validateKey,
  checkLicense,
  isFeatureAvailable,
  getLicenseStatus,
  getCachedLicense,
  writeLicenseCache,
  refreshLicense,
  tierRank,
};
