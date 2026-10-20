# Moumm

인스타그램에서 발견한 맛집·카페 링크를 붙여넣으면, 게시물의 추천 정보와 장소 정보를 한 화면에 모아 방문 여부를 판단하도록 돕는 모바일 웹.

- 설계: `docs/superpowers/specs/2026-10-13-moumm-mvp-design.md`
- 현재 단계 계획: `docs/superpowers/plans/2026-10-15-moumm-mvp-step-1-1.md`
- Phase 0 측정: `docs/phase0/`, `spikes/og-probe/`

## 시작하기

```bash
corepack enable pnpm
pnpm install
cp .env.example .env.local   # 키 입력
pnpm dev
```

## 명령어

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | 타입 검사 |
| `pnpm test` | 단위 테스트 (Vitest) |
| `pnpm test:e2e` | E2E 테스트 (Playwright, 최초 1회 `pnpm exec playwright install chromium`) |

패키지는 배포된 지 7일이 지난 버전만 설치된다 (`pnpm-workspace.yaml`의 `minimumReleaseAge`).
