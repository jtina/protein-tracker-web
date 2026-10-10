// Fetches a public web page for Protein Tracker's "Import from link" (browsers can't read
// other websites directly). Runs as a Vercel serverless function: GET /api/fetch-page?url=…
// Returns { url, html } where url is the final address after redirects.
const dns = require('dns').promises;
const net = require('net');

// Pages allowed to call this from another site (the GitHub Pages copy of the app).
const ALLOWED_ORIGINS = ['https://jtina.github.io'];
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19));
  }
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6);
}

// Only public http(s) sites on standard ports.
async function checkUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch (_) {
    throw new Error('That isn’t a web address.');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only http and https links work.');
  if (u.username || u.password) throw new Error('Links with passwords aren’t supported.');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('That port isn’t supported.');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('That site isn’t public.');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) throw new Error('That site isn’t public.');
  return u;
}

async function readLimited(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      reader.cancel().catch(() => {});
      break; // the recipe data is near the top; a cut-off page is still useful
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.statusCode = 204;
    res.end();
    return;
  }
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });

  const target = new URL(req.url, 'http://local').searchParams.get('url');
  if (!target) return send(400, { error: 'Add ?url=' });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let url = await checkUrl(target);
    let response;
    for (let hop = 0; ; hop++) {
      response = await fetch(url, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'en-US,en;q=0.9'
        }
      });
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects.');
        url = await checkUrl(new URL(location, url).toString());
        continue;
      }
      break;
    }
    if (!response.ok) return send(502, { error: `The site answered ${response.status}.` });
    const type = response.headers.get('content-type') || '';
    if (!/html|xml/i.test(type)) return send(415, { error: 'That link isn’t a web page.' });
    const html = await readLimited(response);
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return send(200, { url: url.toString(), html: html });
  } catch (err) {
    const message = err && err.name === 'AbortError' ? 'The site took too long to answer.' : (err && err.message) || 'Couldn’t load that page.';
    return send(400, { error: message });
  } finally {
    clearTimeout(timer);
  }
};

module.exports.isPrivateIp = isPrivateIp;
module.exports.checkUrl = checkUrl;
