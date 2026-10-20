// MetaFetcher (설계 문서 6장): 서버에서 게시물의 공개 메타데이터를 가져온다.
// 모바일 브라우저 UA로 먼저 요청하고, 캡션을 못 받으면 링크 미리보기 크롤러 UA로 한 번 더 요청한다.
// 정규화된 주소(www.instagram.com)만 요청하므로 임의 URL을 대신 요청하는 데 쓸 수 없다.
import type { NormalizedSource } from "@/lib/source/normalize";
import { parseOgDescription, readOgMeta } from "./parse";

export const USER_AGENTS = {
  browser:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  crawler: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
} as const;

export type UserAgentName = keyof typeof USER_AGENTS;

export type MetaResult =
  | {
      ok: true;
      caption: string;
      account: string | null;
      postedAt: string | null;
      imageUrl: string | null;
      userAgent: UserAgentName;
      attempts: Attempt[];
    }
  | { ok: false; reason: FailureReason; attempts: Attempt[] };

export type FailureReason = "login_wall" | "blocked" | "no_caption" | "network";

export type Attempt = { userAgent: UserAgentName; status: number; ms: number; outcome: "caption" | FailureReason };

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, "status" | "url" | "text">>;

type Options = { fetchImpl?: FetchLike; timeoutMs?: number };

export async function fetchInstagramMeta(source: NormalizedSource, options: Options = {}): Promise<MetaResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const attempts: Attempt[] = [];

  for (const userAgent of ["browser", "crawler"] as const) {
    const started = Date.now();
    let status = 0;
    try {
      const res = await fetchImpl(source.canonicalUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "User-Agent": USER_AGENTS[userAgent],
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      status = res.status;
      const html = await res.text();
      const ms = Date.now() - started;

      if (/\/accounts\/login|\/challenge\//.test(res.url)) {
        attempts.push({ userAgent, status, ms, outcome: "login_wall" });
        continue;
      }
      if (status === 403 || status === 429 || status >= 500) {
        attempts.push({ userAgent, status, ms, outcome: "blocked" });
        continue;
      }

      const meta = readOgMeta(html);
      const parsed = parseOgDescription(meta["og:description"]);
      if (!parsed) {
        attempts.push({ userAgent, status, ms, outcome: "no_caption" });
        continue;
      }

      attempts.push({ userAgent, status, ms, outcome: "caption" });
      return {
        ok: true,
        caption: parsed.caption,
        account: parsed.account,
        postedAt: parsed.postedAt,
        imageUrl: meta["og:image"] ?? null,
        userAgent,
        attempts,
      };
    } catch {
      attempts.push({ userAgent, status, ms: Date.now() - started, outcome: "network" });
    }
  }

  // 마지막 시도의 실패 이유를 대표로 쓴다.
  const last = attempts.at(-1)?.outcome;
  return { ok: false, reason: last && last !== "caption" ? last : "network", attempts };
}
