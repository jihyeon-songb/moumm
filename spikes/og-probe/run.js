// Runs every link in urls.txt through the probe and writes a CSV.
//
//   node run.js --remote https://<your-app>.vercel.app [--token <PROBE_TOKEN>]   # server (datacenter IP)
//   node run.js --local                                                         # this computer (home IP)
//
// Options: --file urls.txt  --delay 2000 (ms between links, to avoid rate limits)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { probe, egressInfo } from './lib/probe.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const remote = opt('remote', null)?.replace(/\/$/, '');
const local = args.includes('--local');
const token = opt('token', process.env.PROBE_TOKEN);
const file = opt('file', 'urls.txt');
const delay = Number(opt('delay', 2000));

if (!remote && !local) {
  console.error('Choose a mode: --remote <deployed url> or --local');
  process.exit(1);
}

const urls = (await readFile(file, 'utf8'))
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
let server = null;

for (const [i, url] of urls.entries()) {
  let result;
  if (remote) {
    const res = await fetch(`${remote}/api/probe?url=${encodeURIComponent(url)}`, {
      headers: token ? { 'x-probe-token': token } : {},
    });
    if (!res.ok) {
      console.error(`#${i + 1} HTTP ${res.status}: ${await res.text()}`);
      process.exit(1);
    }
    result = await res.json();
    server ??= result.server;
  } else {
    result = await probe(url);
    server ??= { region: 'local', ...(await egressInfo()) };
  }

  for (const [agent, r] of Object.entries(result.results ?? { '-': { error: result.reason } })) {
    rows.push({
      no: i + 1,
      shortcode: result.shortcode ?? '',
      type: result.type ?? '',
      imgIndex: result.imgIndex ?? '',
      agent,
      status: r.status ?? '',
      loginWall: r.loginWall ?? '',
      hasOgDescription: r.hasOgDescription ?? '',
      hasCaption: r.hasCaption ?? '',
      captionLength: r.captionLength ?? '',
      captionPreview: r.captionPreview ?? '',
      ms: r.ms ?? '',
      finalUrl: r.finalUrl ?? '',
      error: r.error ?? '',
    });
    console.log(
      `#${String(i + 1).padStart(2)} ${agent.padEnd(7)} status=${r.status ?? '-'} caption=${r.hasCaption ? 'Y' : 'N'}` +
        (r.loginWall ? ' LOGIN_WALL' : '') +
        (r.error ? ` error=${r.error}` : ''),
    );
  }
  if (i < urls.length - 1) await sleep(delay);
}

// Summary per user agent
console.log(`\nserver: region=${server?.region ?? '?'} ip=${server?.egressIp ?? '?'}`);
for (const agent of [...new Set(rows.map((r) => r.agent))]) {
  const mine = rows.filter((r) => r.agent === agent);
  const ok = mine.filter((r) => r.hasCaption === true).length;
  const walls = mine.filter((r) => r.loginWall === true).length;
  console.log(`${agent.padEnd(7)} caption ${ok}/${mine.length}  login wall ${walls}`);
}

const cols = Object.keys(rows[0]);
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
await mkdir('results', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = `results/probe-${remote ? 'server' : 'local'}-${stamp}.csv`;
await writeFile(out, '﻿' + csv); // BOM so Excel reads Korean correctly
console.log(`\nsaved ${out}`);
