// Phase 0 spike: can a server fetch Instagram's public og meta (caption) for a post/reel link?
// Shared by the Vercel function (api/probe.js) and the local runner (run.js).

const IG_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
// /p/{code}, /reel/{code}, /reels/{code}, /tv/{code}, optionally prefixed by /{username}/
const PATH_RE = /^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/;

export const AGENTS = {
  browser:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  crawler: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
};

export function normalize(input) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (!IG_HOSTS.has(u.hostname)) return { ok: false, reason: 'not_instagram' };
  const m = u.pathname.match(PATH_RE);
  if (!m) return { ok: false, reason: 'unsupported_path' };
  const kind = m[1] === 'p' ? 'p' : 'reel';
  const imgIndex = u.searchParams.get('img_index');
  return {
    ok: true,
    type: kind === 'p' ? 'post' : 'reel',
    shortcode: m[2],
    canonical: `https://www.instagram.com/${kind}/${m[2]}/`,
    imgIndex: imgIndex ? Number(imgIndex) : null,
  };
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function readMeta(html) {
  const meta = {};
  const tagRe = /<meta\s+[^>]*>/gi;
  for (const tag of html.match(tagRe) ?? []) {
    const key = tag.match(/(?:property|name)\s*=\s*"([^"]+)"/i)?.[1];
    const content = tag.match(/content\s*=\s*"([^"]*)"/i)?.[1];
    if (key && content !== undefined && /^(og:|description$)/.test(key)) {
      meta[key] = decodeEntities(content);
    }
  }
  return meta;
}

// og:description looks like: `1,234 likes, 5 comments - user - October 13, 2026: "caption". `
export function captionFrom(description) {
  if (!description) return null;
  const start = description.indexOf(': "');
  const end = description.lastIndexOf('"');
  if (start === -1 || end <= start + 3) return null;
  return description.slice(start + 3, end);
}

async function fetchPage(url, userAgent) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const html = await res.text();
    const meta = readMeta(html);
    const caption = captionFrom(meta['og:description']);
    return {
      status: res.status,
      finalUrl: res.url,
      ms: Date.now() - started,
      bytes: html.length,
      loginWall: /\/accounts\/login|\/challenge\//.test(res.url),
      hasOgDescription: Boolean(meta['og:description']),
      hasOgImage: Boolean(meta['og:image']),
      hasCaption: Boolean(caption),
      captionLength: caption ? caption.length : 0,
      captionPreview: caption ? caption.replace(/\s+/g, ' ').slice(0, 100) : '',
    };
  } catch (err) {
    return { status: 0, error: String(err?.cause?.code ?? err?.name ?? err), ms: Date.now() - started };
  }
}

export async function probe(input, agentNames = Object.keys(AGENTS)) {
  const n = normalize(input);
  if (!n.ok) return { input, ...n };
  const results = {};
  for (const name of agentNames) {
    results[name] = await fetchPage(n.canonical, AGENTS[name]);
  }
  return { input, ...n, results };
}

export async function egressInfo() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
    return { egressIp: (await res.json()).ip };
  } catch {
    return { egressIp: null };
  }
}
