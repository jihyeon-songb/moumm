<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Moumm 에이전트 작업 매뉴얼

> 인스타그램 맛집·카페 링크에서 장소와 방문 판단 정보를 모아주는 모바일 웹. 지금은 Phase 0(추출 정확도 측정) 단계다.
> 규칙이 바뀌면 이 문서도 함께 갱신한다. 마지막 갱신: 2026-10-21

## 1. 목적과 범위

**수정 허용**
- `app/**` — Next.js App Router 화면
- `lib/**` — 도메인 로직(링크 정규화, 메타 수집, 단서 추출, 채점)과 테스트
- `scripts/**` — 평가 등 실행 스크립트
- `e2e/**` — Playwright E2E 테스트
- `docs/evals.md`, `docs/ai-log.md`, `docs/adr/**` — 요청받았을 때만

**수정 금지**
- `fixtures/phase0/samples.json` — 사람이 라벨링한 정답. 에이전트가 바꾸면 평가 점수를 믿을 수 없다. 틀린 정답을 발견하면 수정하지 말고 보고한다.
- `fixtures/**/private/**` — 다른 사람의 게시물 캡션 원문과 그 평가 결과. 읽기만 허용한다. 직접 만들기·수정·삭제·커밋하지 않고, 캡션 원문을 응답·로그·다른 파일·테스트 코드로 옮기지 않는다.
  - 예외: `fixtures/phase0/private/eval/`의 결과 파일은 `pnpm eval:clues` 실행으로만 생긴다. 생긴 파일도 직접 편집·삭제하지 않는다.
- `docs/superpowers/specs/**`, `docs/superpowers/plans/**` — 설계·계획 원본. 변경은 사람이 결정한다.
- `docs/phase0/**`, `spikes/**` — 끝난 스파이크 기록. 앱 코드에서 import하지 않는다.
- `pnpm-lock.yaml` — 직접 편집하지 않고 `pnpm` 명령으로만 갱신한다.
- `AGENTS.md` 맨 위 `nextjs-agent-rules` 블록 — `next dev`가 관리한다.

## 2. 개발 환경 및 주요 명령어

전제 조건: pnpm 10 (`corepack enable pnpm`), `.env.local`에 키 (`.env.example` 참고)

| 작업 | 명령어 |
| --- | --- |
| 설치 | `pnpm install` |
| 개발 서버 | `pnpm dev` |
| 빌드 | `pnpm build` |
| 린트 | `pnpm lint` |
| 타입 체크 | `pnpm typecheck` |
| 단위 테스트 | `pnpm test` |
| E2E 테스트 | `pnpm test:e2e` (최초 1회 `pnpm exec playwright install chromium`) |
| 단서 추출 평가 | `pnpm eval:clues` (`--only s01,s03`, `--model <이름>`, `--verbose`) |

- 패키지는 배포 7일이 지난 버전만 설치된다 (`pnpm-workspace.yaml`의 `minimumReleaseAge`). 설치가 막히면 이 설정을 끄지 말고 이전 버전을 고른다.
- 새 의존성은 추가 전에 이유를 설명하고 승인받는다.

## 3. 프로젝트 구조

```
app/              # 화면 (App Router)
lib/
├── source/       # SourceNormalizer: 공유 링크 → 게시물 표준 키
├── meta/         # MetaFetcher: 공개 메타(og:*) 수집·파싱
├── clues/        # ClueExtractor: 캡션 → 구조화 단서 (프롬프트·스키마·채점·협찬 판정)
│   └── providers/   # LLM 제공자 어댑터 (현재 Gemini)
└── fixtures/     # Phase 0 고정 데이터 로더 (테스트·평가 전용)
scripts/          # eval-clues.ts
fixtures/phase0/  # 정답 데이터 (samples.json) + private/ (git 제외)
e2e/              # Playwright
docs/             # 설계(superpowers/), 평가 기준(evals.md), AI 로그, ADR
```

- 컴포넌트 이름(SourceNormalizer 등)과 장 번호는 `docs/superpowers/specs/2026-10-13-moumm-mvp-design.md` 기준이다. 새 모듈을 만들기 전에 설계 문서의 해당 장을 읽는다.
- `lib/fixtures/**`는 앱 코드(`app/**`)에서 import하지 않는다.

## 4. 품질 게이트

작업 완료로 보고하기 전 모두 통과해야 한다.

```bash
pnpm lint
pnpm typecheck
pnpm test
```

- 화면을 바꿨으면 `pnpm test:e2e`도 통과시킨다.
- `lib/clues/prompt.ts`나 `lib/clues/schema.ts`를 바꿨으면 `pnpm eval:clues`를 돌리고, 이전 결과(`fixtures/phase0/private/eval/`의 최근 파일)와 비교한 점수 변화를 보고한다. 점수가 떨어지면 그대로 두지 말고 알린다.

## 5. 코딩 스타일 및 명명 규칙

- import는 `@/` 별칭을 쓴다 (`@/lib/...`).
- 파일 첫 줄 주석에 역할과 설계 문서 장 번호를 적는 기존 패턴을 따른다.
- 주석·테스트 이름·사용자 메시지는 한국어로 쓴다.
- LLM 응답은 반드시 `lib/clues/schema.ts`의 zod 스키마로 검증한다. zod 스키마와 JSON 스키마를 함께 바꾼다.
- 프롬프트를 바꾸면 `PROMPT_VERSION`을 `YYYY-MM-DD.N` 형식으로 올린다.
- LLM 호출은 `lib/clues/providers/types.ts`의 `ClueProvider`를 거친다. 특정 SDK를 도메인 로직에 직접 넣지 않는다.
- 커밋 메시지는 `feat:`, `fix:`, `chore:`, `docs:`, `test:` 접두사를 쓴다.

## 6. 테스트 지침

- 단위 테스트는 대상 옆에 `lib/**/*.test.ts`로 둔다 (Vitest, node 환경).
- 네트워크·LLM 호출은 단위 테스트에서 가짜 `ClueProvider`나 고정 HTML로 대체한다.
- 비공개 캡션이 필요한 테스트는 `it.skipIf(!hasPrivateCaptions)`로 감싼다. 새로 clone한 환경에서도 `pnpm test`가 통과해야 한다.
- 채점 로직(`lib/clues/score.ts`)을 바꾸면 기대값을 손으로 계산한 테스트를 함께 추가한다.

## 7. 보안 / 위험 작업 금지

**절대 금지**
- API 키를 코드·로그·테스트·커밋에 넣는 것. 키는 `.env.local`에서만 읽는다.
- `.env*`(`.env.example` 제외), `.vercel/`, `fixtures/**/private/` 커밋
- 캡션 원문·OCR 원문·이미지 원본을 영구 저장하거나 배포물에 포함하는 것 (설계 문서 9장)
- 임의 URL을 서버가 대신 요청하게 만드는 것. `lib/meta/fetch.ts`는 정규화된 인스타그램 주소만 요청한다.
- `main` 브랜치에 직접 커밋·push (예외 없음, 사람이 요청해도 하지 않고 브랜치를 제안한다). 작업은 `feat/`, `fix/`, `chore/`, `docs/` 브랜치에서 하고 `main`에는 머지로만 반영한다.
- `git push --force`, 히스토리 재작성

**추가 확인 필요 (변경 전 사람에게 알린다)**
- `lib/meta/fetch.ts` — 외부 요청과 User-Agent 정책
- `lib/clues/sponsorship.ts` — 협찬 판정은 사용자 판단에 직접 영향
- 유료 API를 호출하는 코드나 기본 모델 변경 — 현재 원칙은 Gemini 무료 등급

## 8. 작업 방식

1. **브랜치 확인.** 작업 전에 현재 브랜치를 확인하고, `main`이면 새 브랜치를 만든 뒤 시작한다.
2. **계획 먼저.** 수정할 파일 목록과 확인 방법을 먼저 말하고 최소 범위로 바꾼다.
3. **추측 금지.** Next.js 16 API는 `node_modules/next/dist/docs/`에서 확인한다. 모르는 요구사항은 설계 문서를 읽고, 없으면 묻는다.
4. **기존 패턴 우선.** 새 라이브러리나 구조보다 `lib/**`의 기존 방식을 따른다.
5. **테스트와 함께.** 새 기능에는 테스트, 버그 수정에는 회귀 테스트를 붙인다.
6. **AI 작업 기록.** 큰 작업이 끝나면 `docs/ai-log.md`에 넣을 한 줄(맡은 일, 검증 방법, 틀렸던 것)을 제안한다.
