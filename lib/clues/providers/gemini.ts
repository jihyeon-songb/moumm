// Gemini API (generateContent) 제공자. 무료 등급 Flash-Lite가 기본이다.
// https://ai.google.dev/api/generate-content
import { ProviderError, type ClueProvider, type GenerateInput, type GenerateOutput } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json" | "text">>;

type Options = {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  promptFeedback?: { blockReason?: string };
};

export function createGeminiProvider(options: Options): ClueProvider {
  const model = options.model ?? DEFAULT_GEMINI_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;

  return {
    name: `gemini:${model}`,
    async generate(input: GenerateInput): Promise<GenerateOutput> {
      const started = Date.now();
      const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "Content-Type": "application/json", "x-goog-api-key": options.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: "user", parts: [{ text: input.user }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseJsonSchema: input.jsonSchema,
          },
        }),
      });

      if (!res.ok) {
        const detail = (await res.text()).slice(0, 500);
        throw new ProviderError(`Gemini ${res.status}: ${detail}`, res.status);
      }

      const body = (await res.json()) as GeminiResponse;
      const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) {
        const why = body.promptFeedback?.blockReason ?? body.candidates?.[0]?.finishReason ?? "empty response";
        throw new ProviderError(`Gemini returned no text (${why})`);
      }

      return {
        text,
        model,
        ms: Date.now() - started,
        inputTokens: body.usageMetadata?.promptTokenCount,
        outputTokens: body.usageMetadata?.candidatesTokenCount,
      };
    },
  };
}
