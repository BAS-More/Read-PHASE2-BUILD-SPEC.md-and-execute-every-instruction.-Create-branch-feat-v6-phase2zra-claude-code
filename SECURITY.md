# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 6.x.x  | ✅ Active  |
| < 6.0   | ❌ EOL     |

## Reporting a Vulnerability

If you discover a security vulnerability in EZRA, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Email: security@basnmore.com.au
3. Include: description, reproduction steps, impact assessment.
4. We will acknowledge within 48 hours and provide a timeline for a fix.

## Security Design Principles

- **Zero external dependencies.** No supply chain attack surface.
- **No network calls in Core tier.** Core EZRA never phones home.
- **No eval() or dynamic code execution.** Verified by automated security audit.
- **No hardcoded secrets.** All credentials are user-configured in `.ezra/settings.yaml`.
- **Path traversal protection.** All file operations are scoped to `.ezra/` directory.
- **HTTPS required for cloud sync.** Pro/Team cloud features use Supabase with TLS.

## Audit

Run the security audit locally:

```bash
npm test
```

The test suite (`tests/lint-all.js`) scans all 24 hooks for: eval, command injection, hardcoded secrets, path traversal, and dynamic requires.
