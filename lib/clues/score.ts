// Phase 0 정답과 추출 결과를 비교한다 (평가 스크립트와 테스트에서 공용).
import type { Phase0Sample } from "@/lib/fixtures/phase0";
import type { Clues } from "./schema";

export type SampleScore = {
  id: string;
  kind: string;
  /** 이 샘플에서 확인한 항목이 모두 맞았는가 */
  pass: boolean;
  scopeOk: boolean;
  /** 캡션에 이름이 있는 정답 장소 중 찾은 수 / 전체 (캡션에 이름이 없는 샘플은 null) */
  nameRecall: { found: number; expected: number } | null;
  /** 정답에 없는 장소 이름 */
  extraNames: string[];
  notes: string[];
};

// 공백·대소문자만 무시하고 포함 관계로 비교한다 ("8번식당 본점" ⊃ "8번식당").
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export function sameName(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return x.length > 0 && y.length > 0 && (x === y || x.includes(y) || y.includes(x));
}

export function scoreSample(sample: Phase0Sample, clues: Clues): SampleScore {
  const notes: string[] = [];
  const expectPlace = sample.kind !== "out_of_scope";
  const scopeOk = clues.is_place_content === expectPlace;
  if (!scopeOk) notes.push(`is_place_content=${clues.is_place_content}, 기대=${expectPlace}`);

  if (!expectPlace) {
    return { id: sample.id, kind: sample.kind, pass: scopeOk && clues.places.length === 0, scopeOk, nameRecall: null, extraNames: [], notes };
  }

  // 장소 이름이 캡션이 아니라 이미지에만 있는 샘플은 캡션 추출로 찾을 수 없다.
  // 이때는 이미지 속 장소를 지어내지 않았는지만 본다.
  // captionPlaces: 이런 샘플에서 캡션에 이름이 실제로 나오는 장소 (그 외 이름은 모두 오답).
  if (sample.clueSource !== "caption") {
    const allowed = "captionPlaces" in sample && Array.isArray(sample.captionPlaces) ? (sample.captionPlaces as string[]) : [];
    const invented = clues.places.filter((p) => !allowed.some((a) => sameName(a, p.name))).map((p) => p.name);
    if (invented.length) notes.push(`캡션에 없는 장소를 냄: ${invented.join(", ")}`);
    return { id: sample.id, kind: sample.kind, pass: scopeOk && invented.length === 0, scopeOk, nameRecall: null, extraNames: invented, notes };
  }

  const found = sample.places.filter((e) => clues.places.some((p) => sameName(e.name, p.name)));
  const extraNames = clues.places.filter((p) => !sample.places.some((e) => sameName(e.name, p.name))).map((p) => p.name);
  const missing = sample.places.filter((e) => !found.includes(e)).map((e) => e.name);
  if (missing.length) notes.push(`못 찾음: ${missing.join(", ")}`);
  if (extraNames.length) notes.push(`정답에 없음: ${extraNames.join(", ")}`);

  return {
    id: sample.id,
    kind: sample.kind,
    pass: scopeOk && missing.length === 0 && extraNames.length === 0,
    scopeOk,
    nameRecall: { found: found.length, expected: sample.places.length },
    extraNames,
    notes,
  };
}
