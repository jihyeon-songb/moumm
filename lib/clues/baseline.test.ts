// 규칙 기반 baseline 테스트. 캡션은 실제 게시물이 아니라 형식만 흉내 낸 가짜 문장이다.
import { describe, expect, it } from "vitest";
import { phase0Samples } from "@/lib/fixtures/phase0";
import { extractBaseline } from "./baseline";
import { scoreSample } from "./score";

const names = (caption: string) => extractBaseline(caption).places.map((p) => p.name);

describe("extractBaseline", () => {
  it("📍 뒤 텍스트를 장소명으로 쓴다", () => {
    expect(names("오늘 점심\n📍 테스트식당\n맛있어요")).toEqual(["테스트식당"]);
  });

  it("상호: 표지도 인식하고 구분자 뒤는 버린다", () => {
    expect(names("상호: 가짜카페 / 매주 월 휴무")).toEqual(["가짜카페"]);
    expect(names("📌 가짜국밥(본점)")).toEqual(["가짜국밥"]);
  });

  it("표지 뒤가 주소면 장소명으로 쓰지 않는다", () => {
    expect(names("📍 광주 서구 가짜로 12\n📍 진짜이름")).toEqual(["진짜이름"]);
    expect(names("📍 가짜로 57")).toEqual([]);
  });

  it("여러 장소를 순서대로, 중복 없이 뽑는다", () => {
    expect(names("📍가게A\n설명\n📍가게B\n📍가게A")).toEqual(["가게A", "가게B"]);
  });

  it("표지가 없으면 장소 게시물이 아니라고 본다", () => {
    const res = extractBaseline("다이어트 식단 공유합니다 #식단");
    expect(res).toMatchObject({ is_place_content: false, places: [] });
  });

  it("해시태그 장소명은 #을 뗀다", () => {
    expect(names("📍 #가짜분식")).toEqual(["가짜분식"]);
  });

  it("채점 함수에 그대로 넣을 수 있다 (s01 정답 장소명)", () => {
    const s01 = phase0Samples.find((s) => s.id === "s01")!;
    const score = scoreSample(s01, extractBaseline(`📍 ${s01.places[0].name}`));
    expect(score).toMatchObject({ pass: true, nameRecall: { found: 1, expected: 1 } });
  });
});
