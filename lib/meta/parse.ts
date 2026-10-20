// 인스타그램 페이지 HTML에서 공개 메타 태그를 읽는다 (설계 문서 7장).
// og:description 형식 예:
//   `209 likes, 20 comments - bbo.log - October 13, 2026: "캡션". `
//   `gwangju_ari - September 27, 2026: "캡션". `   (좋아요 수가 숨겨진 경우)

export type OgMeta = Partial<Record<"og:title" | "og:description" | "og:image" | "og:url" | "description", string>>;

export type ParsedDescription = {
  caption: string;
  account: string | null;
  /** YYYY-MM-DD, 읽지 못하면 null */
  postedAt: string | null;
};

const ENTITY: Record<string, string> = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", "#039": "'" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#039);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITY[code.toLowerCase()] ?? whole;
  });
}

const META_KEYS = new Set(["og:title", "og:description", "og:image", "og:url", "description"]);

export function readOgMeta(html: string): OgMeta {
  const meta: OgMeta = {};
  for (const tag of html.match(/<meta\s[^>]*>/gi) ?? []) {
    const key = tag.match(/(?:property|name)\s*=\s*"([^"]+)"/i)?.[1];
    const content = tag.match(/content\s*=\s*"([^"]*)"/i)?.[1];
    if (key && content !== undefined && META_KEYS.has(key)) {
      meta[key as keyof OgMeta] = decodeEntities(content);
    }
  }
  return meta;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HEAD_RE = /(?:^|- )([A-Za-z0-9._]+) - ([A-Z][a-z]+) (\d{1,2}), (\d{4}): "$/;

export function parseOgDescription(description: string | undefined): ParsedDescription | null {
  if (!description) return null;
  const start = description.indexOf(': "');
  const end = description.lastIndexOf('"');
  if (start === -1 || end <= start + 3) return null;

  const caption = description.slice(start + 3, end);
  const head = description.slice(0, start + 3).match(HEAD_RE);
  let postedAt: string | null = null;
  if (head) {
    const month = MONTHS.indexOf(head[2]) + 1;
    if (month > 0) postedAt = `${head[4]}-${String(month).padStart(2, "0")}-${head[3].padStart(2, "0")}`;
  }
  return { caption, account: head?.[1] ?? null, postedAt };
}
