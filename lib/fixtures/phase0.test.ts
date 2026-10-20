import { describe, expect, it } from "vitest";
import { hasPrivateCaptions, phase0Samples } from "./phase0";

describe("Phase 0 고정 데이터", () => {
  it("샘플 13개와 유형 분포가 측정 결과와 같다", () => {
    const count = (kind: string) => phase0Samples.filter((s) => s.kind === kind).length;
    expect(phase0Samples).toHaveLength(13);
    expect({ single: count("single"), multi: count("multi"), chain: count("chain"), out: count("out_of_scope") })
      .toEqual({ single: 6, multi: 5, chain: 1, out: 1 });
  });

  it("장소가 있는 샘플은 모두 장소 목록이 있다", () => {
    for (const s of phase0Samples) {
      expect(s.places.length > 0).toBe(s.kind !== "out_of_scope");
    }
  });

  // 서버 수집(og-probe, 2026-10-15)에서 측정한 캡션 길이 (UTF-16 기준)
  it.skipIf(!hasPrivateCaptions)("비공개 캡션 13개가 서버 수집 결과와 같은 길이다", () => {
    const expected: Record<string, number> = {
      s01: 121, s02: 56, s03: 274, s04: 336, s05: 254, s06: 58, s07: 374,
      s08: 697, s09: 566, s10: 598, s11: 383, s12: 231, s13: 419,
    };
    for (const s of phase0Samples) {
      expect(s.caption?.length, s.id).toBe(expected[s.id]);
    }
  });
});
