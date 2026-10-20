import { describe, expect, it } from "vitest";
import { hasPrivateCaptions, phase0Samples } from "@/lib/fixtures/phase0";
import { normalizeSource, type NormalizedSource } from "@/lib/source/normalize";
import { fetchInstagramMeta } from "./fetch";
import { decodeEntities, parseOgDescription, readOgMeta } from "./parse";

// 인스타그램이 내려주는 것처럼 엔티티로 인코딩한다 (줄바꿈은 &#xa;).
const encode = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "&#xa;");

const page = (description: string, image = "https://scontent.cdninstagram.com/v/x.jpg?a=1&b=2") => `<!doctype html><html><head>
  <meta property="og:title" content="Instagram" />
  <meta property="og:image" content="${encode(image)}" />
  <meta property="og:description" content="${encode(description)}" />
</head><body></body></html>`;

const SAMPLE_CAPTION = '#테스트맛집 ◾️상무지구\n광주 서구 어딘가로 1\n"룸" 있음 & 단체 가능 🙆🏻‍♂️';

describe("parse", () => {
  it("엔티티를 디코딩한다", () => {
    expect(decodeEntities("&#xb2e4;&#xb3c4; &quot;a&quot; &amp; &#39;b&#39; &lt;c&gt;&#xa;")).toBe('다도 "a" & \'b\' <c>\n');
  });

  it("og 메타를 읽고 캡션·계정·게시일을 뽑는다", () => {
    const meta = readOgMeta(page(`209 likes, 20 comments - bbo.log - October 13, 2026: "${SAMPLE_CAPTION}". `));
    expect(meta["og:image"]).toBe("https://scontent.cdninstagram.com/v/x.jpg?a=1&b=2");
    expect(parseOgDescription(meta["og:description"])).toEqual({
      caption: SAMPLE_CAPTION,
      account: "bbo.log",
      postedAt: "2026-10-13",
    });
  });

  it("좋아요 수가 숨겨진 형식도 읽는다", () => {
    expect(parseOgDescription('gwangju_ari - September 27, 2026: "김밥". ')).toEqual({
      caption: "김밥",
      account: "gwangju_ari",
      postedAt: "2026-09-27",
    });
  });

  it("캡션이 없으면 null", () => {
    expect(parseOgDescription(undefined)).toBeNull();
    expect(parseOgDescription("Instagram")).toBeNull();
  });

  it.skipIf(!hasPrivateCaptions)("Phase 0 캡션 13개가 인코딩·파싱을 거쳐도 그대로다", () => {
    for (const s of phase0Samples) {
      const desc = `1 likes, 0 comments - ${s.account} - October 15, 2026: "${s.caption}". `;
      expect(parseOgDescription(readOgMeta(page(desc))["og:description"]), s.id).toEqual({
        caption: s.caption,
        account: s.account,
        postedAt: "2026-10-15",
      });
    }
  });
});

describe("fetchInstagramMeta", () => {
  const source = normalizeSource("https://www.instagram.com/p/DebSBlTkkvr/?srtk=x") as NormalizedSource;
  const okHtml = page(`bbo.log - October 13, 2026: "${SAMPLE_CAPTION}". `);

  type Reply = { status: number; url?: string; html?: string } | Error;
  const fakeFetch = (replies: Reply[]) => {
    const calls: { url: string; ua: string }[] = [];
    const impl = async (url: string, init: RequestInit) => {
      calls.push({ url, ua: (init.headers as Record<string, string>)["User-Agent"] });
      const r = replies[calls.length - 1];
      if (r instanceof Error) throw r;
      return { status: r.status, url: r.url ?? url, text: async () => r.html ?? "" };
    };
    return { impl, calls };
  };

  it("브라우저 UA로 캡션을 받으면 한 번만 요청한다", async () => {
    const { impl, calls } = fakeFetch([{ status: 200, html: okHtml }]);
    const res = await fetchInstagramMeta(source, { fetchImpl: impl });
    expect(res).toMatchObject({ ok: true, caption: SAMPLE_CAPTION, account: "bbo.log", userAgent: "browser" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://www.instagram.com/p/DebSBlTkkvr/");
  });

  it("브라우저 UA가 로그인 페이지로 가면 크롤러 UA로 재시도한다", async () => {
    const { impl, calls } = fakeFetch([
      { status: 200, url: "https://www.instagram.com/accounts/login/?next=x", html: "<html></html>" },
      { status: 200, html: okHtml },
    ]);
    const res = await fetchInstagramMeta(source, { fetchImpl: impl });
    expect(res).toMatchObject({ ok: true, userAgent: "crawler" });
    expect(res.attempts.map((a) => a.outcome)).toEqual(["login_wall", "caption"]);
    expect(calls[1].ua).toContain("facebookexternalhit");
  });

  it("둘 다 실패하면 마지막 실패 이유를 돌려준다", async () => {
    const { impl } = fakeFetch([{ status: 200, html: "<html></html>" }, { status: 429 }]);
    expect(await fetchInstagramMeta(source, { fetchImpl: impl })).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("네트워크 오류도 실패로 처리한다", async () => {
    const { impl } = fakeFetch([new Error("ECONNRESET"), new Error("timeout")]);
    const res = await fetchInstagramMeta(source, { fetchImpl: impl });
    expect(res).toMatchObject({ ok: false, reason: "network" });
    expect(res.attempts).toHaveLength(2);
  });
});
