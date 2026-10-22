// LLM 없이 규칙만으로 장소명을 뽑는 baseline (docs/evals.md "baseline").
// 앱에서 쓰지 않는다. LLM 추출 점수를 해석하기 위한 기준선으로만 평가 스크립트에서 돌린다.
// 규칙은 일부러 단순하게 둔다. 규칙을 다듬으면 기준선이 움직여서 LLM과 비교할 수 없게 된다.
import type { Clues, PlaceClue } from "./schema";
import { detectSponsorship } from "./sponsorship";

export const BASELINE_VERSION = "2026-10-22.1";

/** 장소명이 뒤따르는 표지: 📍 📌 🏠, "상호:", "가게명:", "매장명:" */
const MARKER = /^\s*(?:📍|📌|🏠|(?:상호명?|가게\s*(?:이름|명)|매장명)\s*[:：])\s*/u;

/** 시·도/구/로·길 + 번지가 있으면 주소로 본다 */
const ADDRESS = /(?:[가-힣]+(?:시|도|구|군)\s)|(?:[가-힣0-9]+(?:로|길)\s*\d)/;

const blankPlace = (name: string): PlaceClue => ({
  name,
  branch_hint: null,
  region_hint: null,
  region_normalized: null,
  address: null,
  menus: [],
  reason: null,
  tips: [],
  hours_mentioned: null,
});

/** 표지 뒤 텍스트에서 이름 부분만: 구분자(/ | , ( [ -) 앞까지, 앞뒤 해시·공백 제거 */
function cleanName(raw: string): string {
  return raw
    .split(/\s[\/|·\-–]\s|[\/|,(\[（]/u)[0]
    .replace(/^#/, "")
    .trim();
}

export function extractBaseline(caption: string): Clues {
  const names: string[] = [];
  for (const line of caption.split(/\r?\n/)) {
    const m = line.match(MARKER);
    if (!m) continue;
    const name = cleanName(line.slice(m[0].length));
    if (!name || ADDRESS.test(name) || names.includes(name)) continue;
    names.push(name);
  }

  return {
    is_place_content: names.length > 0,
    places: names.map(blankPlace),
    confidence: names.length > 0 ? 0.5 : 0,
    is_sponsored: detectSponsorship(caption),
  };
}
