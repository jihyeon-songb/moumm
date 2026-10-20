import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalize, readMeta, captionFrom } from './lib/probe.js';

test('normalizes every sample link to a canonical post/reel URL', async () => {
  const urls = (await readFile('urls.txt', 'utf8')).split('\n').filter((l) => l.startsWith('http'));
  assert.equal(urls.length, 13);
  for (const u of urls) {
    const n = normalize(u);
    assert.ok(n.ok, u);
    assert.match(n.canonical, /^https:\/\/www\.instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/$/);
  }
});

test('treats share link and og:url (with username) as the same post', () => {
  const a = normalize('https://www.instagram.com/p/DebSBlTkkvr/?srtk=bWwwM2k0dWgxam9z');
  const b = normalize('https://www.instagram.com/bbo.log/p/DebSBlTkkvr/');
  assert.equal(a.canonical, b.canonical);
  assert.equal(a.type, 'post');
});

test('keeps img_index and maps reels/tv to reel', () => {
  assert.equal(normalize('https://www.instagram.com/p/DXijTeAAWME/?img_index=2&psln=x').imgIndex, 2);
  assert.equal(normalize('https://instagram.com/reels/DaVBs5ABuMS/').canonical, 'https://www.instagram.com/reel/DaVBs5ABuMS/');
  assert.equal(normalize('https://www.instagram.com/tv/ABC123/').type, 'reel');
});

test('rejects non-Instagram and unsupported links', () => {
  assert.equal(normalize('https://example.com/p/abc/').reason, 'not_instagram');
  assert.equal(normalize('https://www.instagram.com/bbo.log/').reason, 'unsupported_path');
  assert.equal(normalize('not a url').reason, 'invalid_url');
});

test('reads og meta and extracts the caption with entities decoded', () => {
  const html = `<html><head>
    <meta property="og:title" content="Instagram&#xc758; #&#xb6a5;&#xb85c;&#xadf8;" />
    <meta name="description" content="209 likes, 20 comments - bbo.log - October 13, 2026: &quot;#&#xb6a5;&#xb3c8;&#xb6a5;&#xc0b0; &#x25fe;&#xfe0f;&#xc0c1;&#xbb34;&#xc9c0;&#xad6c; #&#xb2e4;&#xb3c4;&#xd574;&#xbb3c;&#xb098;&#xb77c;&#x a;&#xc804;&#xb0a8;&#xad11;&#xc8fc; &#xc11c;&#xad6c; &#xb9c8;&#xb975;&#xbcf5;&#xac1c;&#xb85c;57&quot;. " />
    <meta property="og:description" content="209 likes, 20 comments - bbo.log - October 13, 2026: &quot;#&#xb6a5;&#xb3c8;&#xb6a5;&#xc0b0; &#xc0c1;&#xbb34;&#xc9c0;&#xad6c; #&#xb2e4;&#xb3c4;&#xd574;&#xbb3c;&#xb098;&#xb77c;&#xa;&#xc804;&#xb0a8;&#xad11;&#xc8fc; &#xc11c;&#xad6c; &#xb9c8;&#xb975;&#xbcf5;&#xac1c;&#xb85c;57 &amp; &quot;&#xb8f8;&quot; &#xc788;&#xc74c;&quot;. " />
    <meta property="og:image" content="https://scontent.cdninstagram.com/x.jpg?a=1&amp;b=2" />
  </head></html>`;
  const meta = readMeta(html);
  assert.equal(meta['og:image'], 'https://scontent.cdninstagram.com/x.jpg?a=1&b=2');
  const caption = captionFrom(meta['og:description']);
  assert.ok(caption.includes('다도해물나라'));
  assert.ok(caption.includes('전남광주 서구 마륵복개로57'));
  assert.ok(caption.includes('"룸" 있음'), 'quotes inside the caption survive');
});

test('returns null when there is no caption', () => {
  assert.equal(captionFrom(undefined), null);
  assert.equal(captionFrom('Instagram'), null);
});
