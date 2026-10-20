import { describe, expect, it } from "vitest";
import { phase0Samples } from "@/lib/fixtures/phase0";
import { normalizeSource } from "./normalize";

describe("normalizeSource", () => {
  it.each(phase0Samples)("Phase 0 $id 공유 링크를 정규화한다", (sample) => {
    const result = normalizeSource(sample.url);
    expect(result).toEqual({
      ok: true,
      platform: "instagram",
      type: sample.type,
      shortcode: sample.shortcode,
      canonicalUrl: `https://www.instagram.com/${sample.type === "post" ? "p" : "reel"}/${sample.shortcode}/`,
      imgIndex: sample.imgIndex,
    });
  });

  it("공유 링크와 og:url(계정명 포함)을 같은 게시물로 본다", () => {
    const shared = normalizeSource("https://www.instagram.com/p/DebSBlTkkvr/?srtk=bWwwM2k0dWgxam9z");
    const ogUrl = normalizeSource("https://www.instagram.com/bbo.log/p/DebSBlTkkvr/");
    expect(shared.ok && ogUrl.ok && shared.canonicalUrl === ogUrl.canonicalUrl).toBe(true);
  });

  it("reels, tv, m.instagram.com, 앞뒤 공백을 처리한다", () => {
    expect(normalizeSource("  https://instagram.com/reels/DaVBs5ABuMS/ ")).toMatchObject({
      ok: true,
      type: "reel",
      canonicalUrl: "https://www.instagram.com/reel/DaVBs5ABuMS/",
    });
    expect(normalizeSource("https://m.instagram.com/tv/ABC123/")).toMatchObject({ ok: true, type: "reel" });
  });

  it("잘못된 img_index는 null로 둔다", () => {
    expect(normalizeSource("https://www.instagram.com/p/X1/?img_index=0")).toMatchObject({ imgIndex: null });
    expect(normalizeSource("https://www.instagram.com/p/X1/?img_index=abc")).toMatchObject({ imgIndex: null });
  });

  it.each([
    ["not a url", "invalid_url"],
    ["https://example.com/p/abc/", "not_instagram"],
    ["https://www.instagram.com.evil.com/p/abc/", "not_instagram"],
    ["https://www.instagram.com/bbo.log/", "unsupported_path"],
    ["https://www.instagram.com/stories/bbo.log/123/", "unsupported_path"],
  ])("%s → %s", (input, reason) => {
    expect(normalizeSource(input)).toEqual({ ok: false, reason });
  });
});

