/**
 * 本地调试用的 mv 模拟层：把 Muvyo 沙箱里的同步 mv.fetch 用 curl 实现出来，
 * 这样可以在 Node 里直接跑 main.js，对着真实的 NextFind 验证。
 *
 * 只实现了插件用到的部分：fetch / config / service / storage / crypto / log。
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function tmp(name) {
  return path.join(os.tmpdir(), `mvshim-${process.pid}-${name}`);
}

function fetchSync(req) {
  if (typeof req === 'string') req = { url: req };
  const headers = req.headers || {};
  const bodyFile = tmp('body');
  const headFile = tmp('head');
  const outFile = tmp('out');

  if (req.body !== undefined) fs.writeFileSync(bodyFile, req.body, 'utf8');

  const args = [
    '-s', '-S',
    '-m', String(req.timeout || 20),
    '-X', String(req.method || 'GET'),
    '-D', headFile,
    '-o', outFile,
  ];
  for (const [k, v] of Object.entries(headers)) {
    args.push('-H', `${k}: ${v}`);
  }
  if (req.body !== undefined) {
    args.push('--data-binary', '@' + bodyFile);
  }
  args.push(req.url);

  let status = 0;
  try {
    execFileSync('curl', args, { stdio: 'pipe' });
  } catch (e) {
    throw new Error('网络请求失败：' + (e.stderr ? e.stderr.toString().trim() : e.message));
  }

  const head = fs.existsSync(headFile) ? fs.readFileSync(headFile, 'utf8') : '';
  const body = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';

  const blocks = head.split(/\r?\n\r?\n/).filter(Boolean);
  const last = blocks[blocks.length - 1] || '';
  const lines = last.split(/\r?\n/);
  const m = /^HTTP\/[\d.]+\s+(\d{3})/.exec(lines[0] || '');
  status = m ? Number(m[1]) : 0;

  const resHeaders = {};
  const setCookies = [];
  for (const line of lines.slice(1)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const name = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (name === 'set-cookie') setCookies.push(value);
    else resHeaders[name] = value;
  }

  for (const f of [bodyFile, headFile, outFile]) {
    try { fs.unlinkSync(f); } catch (_) {}
  }

  return { status, headers: resHeaders, set_cookies: setCookies, body, body_base64: '', url: req.url, proxied: false };
}

function createMv(options = {}) {
  const store = new Map(Object.entries(options.storage || {}));
  const logs = [];
  return {
    service: options.service || '',
    config: options.config || {},
    fetch: fetchSync,
    fetchAll: (list) => list.map((r) => { try { return fetchSync(r); } catch (e) { return { error: e.message }; } }),
    storage: {
      get: (k) => (store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : null),
      set: (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); },
      remove: (k) => { store.delete(k); },
    },
    cache: {
      _m: new Map(),
      set(k, v, ttl) { this._m.set(k, { v: JSON.parse(JSON.stringify(v)), exp: Date.now() + ttl * 1000 }); },
      get(k) { const e = this._m.get(k); if (!e || e.exp < Date.now()) return null; return JSON.parse(JSON.stringify(e.v)); },
      delete(k) { this._m.delete(k); },
    },
    crypto: {
      md5: (s) => crypto.createHash('md5').update(String(s), 'utf8').digest('hex'),
      sha256: (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex'),
    },
    log: {
      info: (m) => logs.push(['info', m]),
      warn: (m) => logs.push(['warn', m]),
      error: (m) => logs.push(['error', m]),
    },
    can: () => false,
    sleep: () => {},
    _logs: logs,
    _store: store,
  };
}

module.exports = { createMv, fetchSync };
