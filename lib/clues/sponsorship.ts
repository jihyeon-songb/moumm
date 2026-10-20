// 협찬 여부는 모델보다 키워드가 정확하다 (Phase 0: 모델이 근거 없이 "협찬 아님"으로 판정).
// 캡션에 표기가 없으면 null — 화면의 "협찬 광고" 라벨처럼 메타데이터에 없는 정보는 알 수 없다.

const NOT_SPONSORED = /내돈내산|협찬\s*(아님|아닙니다|x)|광고\s*(아님|아닙니다)/i;
const SPONSORED = /협찬|광고|제공\s*받|지원\s*받|원고료|소정의|체험단|paid\s*partnership|#ad\b/i;

export function detectSponsorship(caption: string): boolean | null {
  if (NOT_SPONSORED.test(caption)) return false;
  if (SPONSORED.test(caption)) return true;
  return null;
}
