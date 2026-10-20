// ClueExtractor (설계 문서 6·7장): 캡션을 LLM으로 구조화한다.
// 응답이 스키마에 맞지 않으면 최대 maxAttempts번까지 다시 요청한다.
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import type { ClueProvider } from "./providers/types";
import { cluesJsonSchema, llmCluesSchema, type Clues, type LlmClues } from "./schema";
import { detectSponsorship } from "./sponsorship";

export type ExtractInput = { caption: string; account?: string | null; postedAt?: string | null };

export type ExtractAttempt = { ms: number; outcome: "ok" | "invalid_json" | "schema_mismatch" | "provider_error"; detail?: string };

export type ExtractResult =
  | { ok: true; clues: Clues; model: string; attempts: ExtractAttempt[] }
  | { ok: false; error: string; attempts: ExtractAttempt[] };

export async function extractClues(
  input: ExtractInput,
  provider: ClueProvider,
  { maxAttempts = 3 }: { maxAttempts?: number } = {},
): Promise<ExtractResult> {
  const attempts: ExtractAttempt[] = [];
  const user = buildUserPrompt(input);

  for (let i = 0; i < maxAttempts; i++) {
    const started = Date.now();
    let text: string;
    let model: string;
    try {
      ({ text, model } = await provider.generate({ system: SYSTEM_PROMPT, user, jsonSchema: cluesJsonSchema }));
    } catch (err) {
      attempts.push({ ms: Date.now() - started, outcome: "provider_error", detail: String(err) });
      continue;
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      attempts.push({ ms: Date.now() - started, outcome: "invalid_json", detail: text.slice(0, 200) });
      continue;
    }

    const parsed = llmCluesSchema.safeParse(json);
    if (!parsed.success) {
      attempts.push({ ms: Date.now() - started, outcome: "schema_mismatch", detail: parsed.error.message.slice(0, 300) });
      continue;
    }

    attempts.push({ ms: Date.now() - started, outcome: "ok" });
    return { ok: true, clues: normalizeClues(parsed.data, input.caption), model, attempts };
  }

  return { ok: false, error: attempts.at(-1)?.detail ?? "unknown", attempts };
}

/** 모델이 지켜야 하지만 가끔 어기는 규칙을 코드로 한 번 더 맞춘다. */
function normalizeClues(clues: LlmClues, caption: string): Clues {
  const places = clues.is_place_content
    ? clues.places
        .map((p) => ({ ...p, name: p.name.replace(/^#/, "").trim() }))
        .filter((p, i, all) => p.name && all.findIndex((q) => q.name === p.name && q.branch_hint === p.branch_hint) === i)
    : [];
  return { ...clues, places, is_sponsored: detectSponsorship(caption) };
}
