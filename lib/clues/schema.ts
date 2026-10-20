// ClueExtractor 출력 스키마 (설계 문서 7장).
// - zod 스키마: 모델 응답을 검증한다.
// - JSON 스키마: 모델에 넘겨 구조화 출력을 강제한다.
// 두 정의가 어긋나지 않는지는 clues.test.ts에서 확인한다.
import { z } from "zod";

const nullableString = z.string().nullable();

export const menuSchema = z.object({
  name: z.string(),
  /** 원 단위 정수. 게시물에 가격이 없으면 null */
  price: z.number().int().nullable(),
});

export const placeClueSchema = z.object({
  /** 상호 (지점명 제외) */
  name: z.string().min(1),
  /** "본점", "망원점" 등 */
  branch_hint: nullableString,
  /** 게시물에 적힌 지역 표현 그대로: "경대정문", "망원" */
  region_hint: nullableString,
  /** 행정구역: "대구 북구", "서울 마포구" */
  region_normalized: nullableString,
  /** 게시물에 적힌 주소 */
  address: nullableString,
  menus: z.array(menuSchema),
  /** 추천 이유 한 문장 */
  reason: nullableString,
  /** 웨이팅, 주차, 유아의자 등 방문 팁 */
  tips: z.array(z.string()),
  /** 게시물에 적힌 영업시간 */
  hours_mentioned: nullableString,
});

/** 모델이 돌려주는 부분 */
export const llmCluesSchema = z.object({
  is_place_content: z.boolean(),
  places: z.array(placeClueSchema),
  confidence: z.number().min(0).max(1),
});

/** 최종 결과. is_sponsored는 모델이 아니라 캡션 키워드로 판단한다 (sponsorship.ts). */
export const cluesSchema = llmCluesSchema.extend({
  /** 협찬·광고 표기가 있으면 true, "내돈내산"이면 false, 언급이 없으면 null */
  is_sponsored: z.boolean().nullable(),
});

export type LlmClues = z.infer<typeof llmCluesSchema>;
export type Clues = z.infer<typeof cluesSchema>;
export type PlaceClue = z.infer<typeof placeClueSchema>;

const str = { type: "string" } as const;
const strOrNull = { type: ["string", "null"] } as const;

/** 모델에 넘기는 JSON 스키마 (Gemini responseJsonSchema) */
export const cluesJsonSchema = {
  type: "object",
  properties: {
    is_place_content: { type: "boolean", description: "맛집·카페 등 음식점을 소개하는 게시물이면 true" },
    places: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { ...str, description: "상호. 지점명은 branch_hint로 분리. 사진 출처·계정은 장소가 아님" },
          branch_hint: { ...strOrNull, description: "본점, OO점 등 지점 표현" },
          region_hint: { ...strOrNull, description: "게시물에 적힌 지역 표현 그대로" },
          region_normalized: { ...strOrNull, description: "캡션의 지역 표현이나 주소로 알 수 있는 만큼만. 예: 대구 북구, 광주" },
          address: { ...strOrNull, description: "게시물에 적힌 주소 그대로" },
          menus: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: str,
                price: { type: ["integer", "null"], description: "원 단위 정수" },
              },
              required: ["name", "price"],
            },
          },
          reason: { ...strOrNull, description: "게시물이 추천하는 이유 한 문장" },
          tips: { type: "array", items: str, description: "웨이팅, 주차, 유아의자, 예약, 휴무 등 방문 팁" },
          hours_mentioned: { ...strOrNull, description: "게시물에 적힌 영업시간 그대로" },
        },
        required: ["name", "branch_hint", "region_hint", "region_normalized", "address", "menus", "reason", "tips", "hours_mentioned"],
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["is_place_content", "places", "confidence"],
} as const;
