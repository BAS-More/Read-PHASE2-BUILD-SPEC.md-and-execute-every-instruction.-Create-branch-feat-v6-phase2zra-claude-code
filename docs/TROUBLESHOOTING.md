# EZRA Troubleshooting

## Installation Issues

### Commands not appearing after install

**Symptom:** `/ezra:help` doesn't work after installation.

**Fix:**
1. Restart Claude Code (close and reopen)
2. Verify files exist:
   - Global: `~/.claude/commands/ezra/` should contain 22 `.md` files
   - Local: `./.claude/commands/ezra/` should contain 22 `.md` files
3. Re-run the installer: `npx ezra-claude-code --claude --global`

### "command not found: npx"

**Fix:** Install Node.js >= 16.7.0 from https://nodejs.org

### Install succeeds but hooks don't fire

**Symptom:** Guard warnings, drift tracking, and session dashboard don't appear.

**Fix:** Hooks require manual configuration in `settings.json`. After install, the CLI prints the JSON block to add. Copy it to:
- Global: `~/.claude/settings.json`
- Local: `./.claude/settings.json`

---

## Runtime Issues

### "/ezra:init says .ezra/ already exists"

**Not a problem.** Init is idempotent. It will update missing pieces without overwriting existing state. Use `/ezra:bootstrap` for a more comprehensive re-initialization.

### "Guard hook blocks my edit"

**Symptom:** You can't edit a file because the guard hook denies it.

**Fix options:**
1. Record a decision authorizing the change: `/ezra:decide "Allow modification to [path] because [reason]"`
2. Edit `governance.yaml` to remove or adjust the protected path pattern
3. The default guard mode is non-blocking (warn only). If it's blocking, the hook was customized — check `hooks/ezra-guard.js` for `permissionDecision: "deny"` and change to `"allow"`

### "Drift counter keeps reminding me"

**Symptom:** Frequent "X edits since last doc-sync" messages.

**Fix:**
1. Run `/ezra:doc-sync` to review and sync documents
2. The counter resets to 0 after doc-sync
3. To adjust thresholds, add to `governance.yaml`:
   ```yaml
   drift:
     warn_threshold: 20   # Default is 10
   ```

### "Version hook creating too many changelog entries"

**Symptom:** `changelog.yaml` growing rapidly.

**This is expected.** The version hook fires on every `.ezra/` file change. The changelog is append-only by design for audit trails. It does NOT track changes outside `.ezra/`.

### "Health score seems wrong"

**Fix:** Run `/ezra:scan` for a fresh analysis. Health scores are based on the most recent scan results plus current state. If no scan exists, scores may be incomplete.

---

## State Issues

### Corrupted governance.yaml

**Symptom:** Hooks fail silently, commands can't read governance state.

**Fix:**
1. Check YAML syntax — common issues: missing quotes, bad indentation, tabs instead of spaces
2. If beyond repair, delete and re-create:
   ```
   rm .ezra/governance.yaml
   /ezra:init
   ```
   This will regenerate governance.yaml with defaults. Your decisions, scans, and changelog are preserved.

### Missing .ezra/ directory

**Symptom:** All commands say "not initialized."

**Fix:** Run `/ezra:bootstrap` (preferred) or `/ezra:init`.

### Changelog out of sync with current.yaml

**Symptom:** `current.yaml` shows version X but changelog shows version Y.

**Fix:** The changelog is the source of truth (immutable). To reset current.yaml:
1. Delete `.ezra/versions/current.yaml`
2. Make any change to a `.ezra/` file
3. The version hook will recreate `current.yaml` from the last changelog entry

### Decisions reference paths that no longer exist

**Symptom:** Guard warns about paths that were renamed or deleted.

**Fix:** Supersede the old decision:
```
/ezra:decide "Update auth module path from src/auth/ to src/modules/auth/ (supersedes ADR-003)"
```
The new decision will have status ACTIVE and the old one will be marked SUPERSEDED.

---

## Hook Issues

### All hooks: "EZRA hook error" in stderr

**Not a problem.** This message appears when hooks receive input they can't parse (e.g., echo piping in tests). The hook still exits 0 — work is never blocked.

### Hook timeout

**Symptom:** Claude Code reports hook took too long.

**Fix:** Hooks have a 3-5 second timeout. If timing out:
1. Check if `.ezra/` directory is on a slow filesystem (network drive, etc.)
2. Check if governance.yaml or changelog.yaml is very large (>1MB)
3. Increase timeout in settings.json: `"timeout": 10`

### AVI-OS bridge not creating sync items

**Symptom:** Editing decisions but no files appear in `.ezra/.avios-sync/pending/`.

**Fix:** Check governance.yaml:
```yaml
avios_integration:
  enabled: true        # Must be true
  sync_decisions: true # Must not be false
```

---

## Cross-Platform Issues

### Windows: path separator issues

**Symptom:** Hooks can't find files or governance.yaml.

**Fix:** This shouldn't happen — all hooks use `path.join()` and normalize paths. If it does:
1. Verify Node.js version: `node --version` (must be >= 16.7.0)
2. Check that `.ezra/governance.yaml` uses forward slashes in patterns: `**/migrations/**` not `**\migrations\**`

### macOS/Linux: permission denied on hooks

**Fix:**
```bash
chmod +x ~/.claude/hooks/ezra-*.js
```

---

## Recovery Procedures

### Full reset (preserve decisions)

```bash
# Backup decisions
cp -r .ezra/decisions/ /tmp/ezra-decisions-backup/

# Remove state
rm -rf .ezra/

# Re-initialize
# Run in Claude Code: /ezra:bootstrap

# Restore decisions
cp /tmp/ezra-decisions-backup/* .ezra/decisions/
```

### Revert to a previous governance state

If you have git tracking `.ezra/`:
```bash
# See when governance.yaml changed
git log --oneline .ezra/governance.yaml

# Restore a specific version
git checkout <commit-hash> -- .ezra/governance.yaml
```

### Clear all scan history

```bash
rm -rf .ezra/scans/*
```

Then run `/ezra:scan` for a fresh baseline.

---

## Getting Help

- **All commands:** `/ezra:help`
- **Project status:** `/ezra:status`
- **Detailed dashboard:** `/ezra:dash`
- **File issues:** https://github.com/BAS-More/ezra-claude-code/issues
