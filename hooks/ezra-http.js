'use strict';
/**
 * hooks/ezra-http.js — Shared HTTP utility for EZRA cloud hooks
 * Uses Node.js built-in https module. ZERO external dependencies.
 */
const https = require('https');
const http = require('http');

// ─── SSRF Protection ────────────────────────────────────────────

/**
 * Block requests to private/internal IP ranges (SSRF protection).
 * Blocks: localhost, 10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1
 */
const PRIVATE_IP_PATTERNS = [
  /^127\./,                          // loopback
  /^10\./,                           // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./,     // Class B private
  /^192\.168\./,                     // Class C private
  /^169\.254\./,                     // link-local
  /^0\./,                            // current network
  /^::1$/,                           // IPv6 loopback
  /^fd[0-9a-f]{2}:/i,               // IPv6 unique local
  /^fe80:/i,                         // IPv6 link-local
];

const BLOCKED_HOSTNAMES = ['localhost', '[::1]', '0.0.0.0'];

function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(h)) return true;
  for (const pat of PRIVATE_IP_PATTERNS) {
    if (pat.test(h)) return true;
  }
  return false;
}

// ─── httpsPost ──────────────────────────────────────────────────

/**
 * Send an HTTPS POST request.
 * @param {string} url — Full URL (https://...)
 * @param {object} body — JSON body to send
 * @param {object} [headers] — Additional headers
 * @returns {Promise<{statusCode: number, body: object|string}>}
 */
function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    if (isBlockedHost(urlObj.hostname)) {
      return reject(new Error('SSRF blocked: requests to private/internal addresses are not allowed'));
    }
    const postData = JSON.stringify(body);
    const mod = urlObj.protocol === 'http:' ? http : https;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'http:' ? 80 : 443),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      }, headers || {}),
    };
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
        resolve({ statusCode: res.statusCode, body: parsed });
      });
    });
    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timed out after 15s'));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ─── httpsGet ───────────────────────────────────────────────────

/**
 * Send an HTTPS GET request.
 * @param {string} url — Full URL (https://...)
 * @param {object} [headers] — Additional headers
 * @returns {Promise<{statusCode: number, body: object|string}>}
 */
function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    if (isBlockedHost(urlObj.hostname)) {
      return reject(new Error('SSRF blocked: requests to private/internal addresses are not allowed'));
    }
    const mod = urlObj.protocol === 'http:' ? http : https;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'http:' ? 80 : 443),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: Object.assign({}, headers || {}),
    };
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
        resolve({ statusCode: res.statusCode, body: parsed });
      });
    });
    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timed out after 15s'));
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── Exports ────────────────────────────────────────────────────

module.exports = {
  httpsPost,
  httpsGet,
  isBlockedHost,
  PRIVATE_IP_PATTERNS,
  BLOCKED_HOSTNAMES,
};
