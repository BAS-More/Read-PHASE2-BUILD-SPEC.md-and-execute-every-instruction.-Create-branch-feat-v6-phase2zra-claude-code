'use strict';
/**
 * hooks/ezra-http.js — Shared HTTP utility for EZRA cloud hooks
 * Uses Node.js built-in https module. ZERO external dependencies.
 */
const https = require('https');
const http = require('http');

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
    req.on('error', reject);
    req.end();
  });
}

// ─── Exports ────────────────────────────────────────────────────

module.exports = {
  httpsPost,
  httpsGet,
};
