// Phase 0 고정 데이터 로더 (테스트·평가 스크립트 전용, 앱 코드에서 쓰지 않는다).
// 공개 정보(samples.json)와 비공개 캡션(private/captions.json, git 제외)을 합친다.
// 비공개 파일이 없는 환경(새로 clone한 경우, CI)에서는 caption이 null이고 hasPrivateCaptions가 false다.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import data from "@/fixtures/phase0/samples.json";

export type Phase0Sample = (typeof data.samples)[number] & { caption: string | null };

const PRIVATE_CAPTIONS = join(process.cwd(), "fixtures/phase0/private/captions.json");

function readPrivateCaptions(): Record<string, string> | null {
  if (!existsSync(PRIVATE_CAPTIONS)) return null;
  const parsed = JSON.parse(readFileSync(PRIVATE_CAPTIONS, "utf8")) as { captions: Record<string, string> };
  return parsed.captions;
}

const captions = readPrivateCaptions();

export const hasPrivateCaptions = captions !== null;

export const phase0Samples: Phase0Sample[] = data.samples.map((s) => ({
  ...s,
  caption: captions?.[s.id] ?? null,
}));
