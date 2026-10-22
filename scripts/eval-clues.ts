// Phase 0 샘플 13개로 ClueExtractor를 평가한다.
//   pnpm eval:clues                  # Gemini 기본 모델
//   pnpm eval:clues --model gemini-3.6-flash
//   pnpm eval:clues --only s03,s09
//   pnpm eval:clues --verbose        # 장소별 지역 해석·협찬 판정도 출력
//   pnpm eval:clues --baseline       # LLM 없이 규칙 기반 baseline으로 채점 (API 키 불필요)
// 필요: .env.local의 GEMINI_API_KEY(--baseline이면 불필요), fixtures/phase0/private/captions.json
// 결과 상세는 fixtures/phase0/private/eval/ 에 저장된다 (캡션에서 뽑은 내용이라 git 제외).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { BASELINE_VERSION, extractBaseline } from "@/lib/clues/baseline";
import { extractClues, type ExtractResult } from "@/lib/clues/extract";
import { PROMPT_VERSION } from "@/lib/clues/prompt";
import { createGeminiProvider, DEFAULT_GEMINI_MODEL } from "@/lib/clues/providers/gemini";
import { scoreSample, type SampleScore } from "@/lib/clues/score";
import { hasPrivateCaptions, phase0Samples } from "@/lib/fixtures/phase0";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const baseline = args.includes("--baseline");
const apiKey = process.env.GEMINI_API_KEY;
if (!baseline && !apiKey) {
  console.error("GEMINI_API_KEY가 없어요. .env.local에 넣어 주세요.");
  process.exit(1);
}
if (!hasPrivateCaptions) {
  console.error("fixtures/phase0/private/captions.json이 없어요. fixtures/phase0/README.md를 확인해 주세요.");
  process.exit(1);
}

const model = baseline ? "baseline" : (arg("model") ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL);
const promptVersion = baseline ? BASELINE_VERSION : PROMPT_VERSION;
const only = arg("only")?.split(",");
const verbose = args.includes("--verbose");
const provider = baseline ? null : createGeminiProvider({ apiKey: apiKey!, model });
const samples = phase0Samples.filter((s) => !only || only.includes(s.id));

console.log(
  baseline
    ? `규칙 기반 baseline ${BASELINE_VERSION} · 샘플 ${samples.length}개\n`
    : `모델 ${provider!.name} · 프롬프트 ${PROMPT_VERSION} · 샘플 ${samples.length}개\n`,
);

async function run(sample: (typeof samples)[number]): Promise<ExtractResult> {
  if (!provider) {
    const started = Date.now();
    const clues = extractBaseline(sample.caption!);
    return { ok: true, clues, model: "baseline", attempts: [{ ms: Date.now() - started, outcome: "ok" }] };
  }
  return extractClues({ caption: sample.caption!, account: sample.account }, provider);
}

async function main() {
  const rows: { score: SampleScore | null; ms: number; tries: number; error?: string; output?: unknown }[] = [];

  for (const sample of samples) {
    const result = await run(sample);
    const ms = result.attempts.reduce((sum, a) => sum + a.ms, 0);
    const tries = result.attempts.length;

    if (!result.ok) {
      rows.push({ score: null, ms, tries, error: result.error });
      console.log(`✗ ${sample.id} ${sample.kind.padEnd(12)} 실패 (${tries}회): ${result.error.slice(0, 160)}`);
      continue;
    }

    const score = scoreSample(sample, result.clues);
    rows.push({ score, ms, tries, output: result.clues });
    const recall = score.nameRecall ? ` 장소 ${score.nameRecall.found}/${score.nameRecall.expected}` : "";
    const names = result.clues.places.map((p) => p.name + (p.branch_hint ? `(${p.branch_hint})` : "")).join(", ") || "-";
    console.log(
      `${score.pass ? "✓" : "✗"} ${sample.id} ${sample.kind.padEnd(12)}${recall.padEnd(10)} ${String(ms).padStart(5)}ms` +
        `${tries > 1 ? ` 재시도${tries - 1}` : ""}  [${names}]` +
        (score.notes.length ? `\n    → ${score.notes.join(" / ")}` : ""),
    );
    if (verbose) {
      console.log(`    협찬: ${result.clues.is_sponsored}`);
      for (const p of result.clues.places) {
        console.log(`    · ${p.name} | ${p.region_hint ?? "-"} → ${p.region_normalized ?? "-"} | 메뉴 ${p.menus.length} · 팁 ${p.tips.length}`);
      }
    }
  }

  const scored = rows.filter((r) => r.score);
  const pass = scored.filter((r) => r.score!.pass).length;
  const recalls = scored.map((r) => r.score!.nameRecall).filter((r) => r !== null);
  const found = recalls.reduce((s, r) => s + r.found, 0);
  const expected = recalls.reduce((s, r) => s + r.expected, 0);
  const times = rows.map((r) => r.ms).sort((a, b) => a - b);
  const p90 = times[Math.min(times.length - 1, Math.ceil(times.length * 0.9) - 1)];

  console.log(
    [
      "",
      "요약",
      `- 통과: ${pass}/${rows.length}`,
      `- 범위 판정 정답: ${scored.filter((r) => r.score!.scopeOk).length}/${scored.length}`,
      `- 캡션 속 장소 이름 찾음: ${found}/${expected}`,
      `- 3회 시도 후 최종 실패: ${rows.filter((r) => r.error).length}`,
      `- 응답 시간: 중앙값 ${times[Math.floor(times.length / 2)]}ms, p90 ${p90}ms`,
    ].join("\n"),
  );

  const dir = "fixtures/phase0/private/eval";
  mkdirSync(dir, { recursive: true });
  const file = `${dir}/${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${model}.json`;
  writeFileSync(file, JSON.stringify({ model, promptVersion, rows }, null, 2));
  console.log(`\n상세 결과: ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
