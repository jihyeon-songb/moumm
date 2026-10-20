import { describe, expect, it } from "vitest";
import { phase0Samples } from "@/lib/fixtures/phase0";
import { extractClues } from "./extract";
import { createGeminiProvider } from "./providers/gemini";
import type { ClueProvider } from "./providers/types";
import { cluesJsonSchema, llmCluesSchema, placeClueSchema, type Clues } from "./schema";
import { detectSponsorship } from "./sponsorship";
import { sameName, scoreSample } from "./score";

const place = (name: string, extra: Partial<Clues["places"][number]> = {}) => ({
  name,
  branch_hint: null,
  region_hint: null,
  region_normalized: null,
  address: null,
  menus: [],
  reason: null,
  tips: [],
  hours_mentioned: null,
  ...extra,
});

const clues = (over: Partial<Clues> = {}): Clues => ({
  is_place_content: true,
  is_sponsored: null,
  places: [place("다도해물나라")],
  confidence: 0.9,
  ...over,
});

const fakeProvider = (replies: (string | Error)[]): ClueProvider & { calls: number } => {
  const p = {
    name: "fake",
    calls: 0,
    async generate() {
      const r = replies[p.calls++];
      if (r instanceof Error) throw r;
      return { text: r, model: "fake", ms: 1 };
    },
  };
  return p;
};

describe("schema", () => {
  it("JSON 스키마와 zod 스키마의 필드가 같다", () => {
    expect(Object.keys(cluesJsonSchema.properties).sort()).toEqual(Object.keys(llmCluesSchema.shape).sort());
    expect(Object.keys(cluesJsonSchema.properties.places.items.properties).sort()).toEqual(
      Object.keys(placeClueSchema.shape).sort(),
    );
    expect([...cluesJsonSchema.properties.places.items.required].sort()).toEqual(Object.keys(placeClueSchema.shape).sort());
  });
});

describe("extractClues", () => {
  it("올바른 응답을 한 번에 받는다", async () => {
    const provider = fakeProvider([JSON.stringify(clues())]);
    const res = await extractClues({ caption: "x" }, provider);
    expect(res).toMatchObject({ ok: true, clues: { places: [{ name: "다도해물나라" }] } });
    expect(provider.calls).toBe(1);
  });

  it("JSON이 깨지거나 스키마가 틀리면 다시 요청한다", async () => {
    const provider = fakeProvider(["{not json", JSON.stringify({ ...clues(), confidence: "high" }), JSON.stringify(clues())]);
    const res = await extractClues({ caption: "x" }, provider);
    expect(res.ok).toBe(true);
    expect(res.attempts.map((a) => a.outcome)).toEqual(["invalid_json", "schema_mismatch", "ok"]);
  });

  it("세 번 모두 실패하면 실패를 돌려준다", async () => {
    const provider = fakeProvider([new Error("503"), "{", "{"]);
    const res = await extractClues({ caption: "x" }, provider);
    expect(res).toMatchObject({ ok: false });
    expect(res.attempts).toHaveLength(3);
  });

  it("범위 밖이면 장소를 비우고, # 제거·중복 제거를 한다", async () => {
    const outOfScope = await extractClues(
      { caption: "x" },
      fakeProvider([JSON.stringify(clues({ is_place_content: false, places: [place("식단템")] }))]),
    );
    expect(outOfScope.ok && outOfScope.clues.places).toEqual([]);

    const dup = await extractClues(
      { caption: "x" },
      fakeProvider([JSON.stringify(clues({ places: [place("#고봉당"), place("고봉당"), place("8번식당", { branch_hint: "본점" })] }))]),
    );
    expect(dup.ok && dup.clues.places.map((p) => p.name)).toEqual(["고봉당", "8번식당"]);
  });
});

describe("detectSponsorship", () => {
  it.each([
    ["#내돈내산 맛집", false],
    ["업체에서 이용권을 지원받아 작성한 글입니다", true],
    ["#협찬 #광고", true],
    ["협찬 아님! 내 돈으로 먹음", false],
    ["진짜 맛있어요", null],
  ])("%s → %s", (caption, expected) => {
    expect(detectSponsorship(caption)).toBe(expected);
  });

  it("모델 응답의 is_sponsored 대신 캡션 키워드로 판단한다", async () => {
    const res = await extractClues(
      { caption: "광주 맛집 #내돈내산" },
      fakeProvider([JSON.stringify({ ...clues(), is_sponsored: true })]),
    );
    expect(res.ok && res.clues.is_sponsored).toBe(false);
  });
});

describe("Gemini provider", () => {
  it("구조화 출력 요청을 보내고 응답 텍스트를 꺼낸다", async () => {
    let sent: { url: string; init: RequestInit } | undefined;
    const provider = createGeminiProvider({
      apiKey: "test-key",
      model: "gemini-test",
      fetchImpl: async (url, init) => {
        sent = { url, init };
        return {
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => ({
            candidates: [{ content: { parts: [{ text: '{"a":' }, { text: "1}" }] } }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
          }),
        };
      },
    });
    const out = await provider.generate({ system: "sys", user: "usr", jsonSchema: { type: "object" } });
    expect(out).toMatchObject({ text: '{"a":1}', model: "gemini-test", inputTokens: 10, outputTokens: 5 });
    expect(sent!.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    expect((sent!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(sent!.init.body as string);
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", responseJsonSchema: { type: "object" } });
    expect(body.systemInstruction.parts[0].text).toBe("sys");
  });

  it("오류 응답은 상태 코드와 함께 던진다", async () => {
    const provider = createGeminiProvider({
      apiKey: "k",
      fetchImpl: async () => ({ ok: false, status: 429, text: async () => "quota", json: async () => ({}) }),
    });
    await expect(provider.generate({ system: "", user: "", jsonSchema: {} })).rejects.toMatchObject({ status: 429 });
  });
});

describe("scoreSample", () => {
  const byId = (id: string) => phase0Samples.find((s) => s.id === id)!;

  it("상호 비교는 공백·지점 표현을 무시한다", () => {
    expect(sameName("신세계 양꼬치", "신세계양꼬치")).toBe(true);
    expect(sameName("8번식당 본점", "8번식당")).toBe(true);
    expect(sameName("마라도생굴구이 대현점", "마라도생굴구이")).toBe(true);
    expect(sameName("아이안", "코리야")).toBe(false);
  });

  it("한 곳 게시물은 정답 상호를 찾고 다른 장소를 내지 않아야 통과", () => {
    expect(scoreSample(byId("s04"), clues({ places: [place("이현김밥")] })).pass).toBe(true);
    expect(scoreSample(byId("s04"), clues({ places: [place("이현김밥"), place("참치와사비김밥")] })).pass).toBe(false);
  });

  it("범위 밖 게시물은 is_place_content=false여야 통과", () => {
    expect(scoreSample(byId("s02"), clues({ is_place_content: false, places: [] })).pass).toBe(true);
    expect(scoreSample(byId("s02"), clues()).pass).toBe(false);
  });

  it("이미지에만 장소가 있는 게시물은 그 장소를 지어내지 않아야 통과", () => {
    expect(scoreSample(byId("s06"), clues({ places: [] })).pass).toBe(true);
    expect(scoreSample(byId("s06"), clues({ places: [place("국제연탄")] })).pass).toBe(false);
  });

  it("이미지 게시물의 캡션에 나온 장소는 허용하고, 사진 출처 같은 다른 이름은 오답", () => {
    expect(scoreSample(byId("s12"), clues({ places: [place("영미오리탕"), place("화정떡갈비")] })).pass).toBe(true);
    const withCredit = scoreSample(byId("s12"), clues({ places: [place("영미오리탕"), place("스페이스고")] }));
    expect(withCredit.pass).toBe(false);
    expect(withCredit.extraNames).toEqual(["스페이스고"]);
  });
});
