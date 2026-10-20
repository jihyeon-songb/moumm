// SourceNormalizer (설계 문서 6장): 공유 링크를 게시물 단위의 표준 형태로 바꾼다.
// - 추적 파라미터(srtk, cplk, mdxt …)를 버린다.
// - /p/{코드}, /reel/{코드}, /reels/{코드}, /tv/{코드}, /{계정명}/p/{코드}를 같은 게시물로 본다.
// - img_index는 버리지 않고 따로 돌려준다 (사용자가 보던 캐러셀 이미지).

export type SourceType = "post" | "reel";

export type NormalizedSource = {
  ok: true;
  platform: "instagram";
  type: SourceType;
  shortcode: string;
  /** 같은 게시물이면 항상 같은 값. 캐시 키로 쓴다. */
  canonicalUrl: string;
  /** 1부터 시작하는 캐러셀 이미지 번호. 없으면 null. */
  imgIndex: number | null;
};

export type NormalizeError = {
  ok: false;
  reason: "invalid_url" | "not_instagram" | "unsupported_path";
};

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);
const PATH_RE = /^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/;

export function normalizeSource(input: string): NormalizedSource | NormalizeError {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, reason: "not_instagram" };
  }

  const match = url.pathname.match(PATH_RE);
  if (!match) return { ok: false, reason: "unsupported_path" };

  const [, kind, shortcode] = match;
  const segment = kind === "p" ? "p" : "reel";
  const rawIndex = Number(url.searchParams.get("img_index"));

  return {
    ok: true,
    platform: "instagram",
    type: segment === "p" ? "post" : "reel",
    shortcode,
    canonicalUrl: `https://www.instagram.com/${segment}/${shortcode}/`,
    imgIndex: Number.isInteger(rawIndex) && rawIndex >= 1 ? rawIndex : null,
  };
}
