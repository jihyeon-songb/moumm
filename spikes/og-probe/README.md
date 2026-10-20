# og-probe — 서버 IP에서 인스타 메타데이터를 받을 수 있는지 확인

Phase 0 스파이크용 임시 코드입니다. MVP 앱 코드가 아닙니다.

브라우저(가정용 IP)에서는 로그인 없이도 `og:description`에 캡션 전체가 들어 있었습니다.
실제 서비스는 서버(데이터센터 IP)에서 요청하므로, 같은 결과가 나오는지 확인합니다.

## 확인하는 것

링크마다 User-Agent 두 가지로 요청합니다.

| agent | 의미 |
| --- | --- |
| `browser` | 모바일 Safari처럼 요청 |
| `crawler` | 페이스북 링크 미리보기 크롤러처럼 요청 (인스타가 미리보기용 메타를 주는 경우가 있음) |

결과로 HTTP 상태, 로그인 페이지로 넘어갔는지, 캡션이 있는지, 캡션 앞 100자를 기록합니다.

## 1. 테스트

```bash
cd spikes/og-probe
npm test
```

## 2. 배포 (Vercel)

```bash
npm i -g vercel
vercel login
vercel deploy --prod
```

- 함수 지역은 `vercel.json`에서 서울(`icn1`)로 지정했습니다. 실제 서비스 조건과 같게 하려는 것입니다.
- 엔드포인트를 아무나 쓰지 못하게 하려면 Vercel 프로젝트 환경 변수에 `PROBE_TOKEN`을 넣고 다시 배포하세요.
  (인스타그램 주소만 요청하도록 막혀 있어서 토큰이 없어도 다른 사이트를 대신 요청하는 용도로는 쓸 수 없습니다.)

브라우저에서 바로 확인:

```
https://<배포 주소>/api/probe?url=https://www.instagram.com/p/DebSBlTkkvr/&token=<PROBE_TOKEN>
```

## 3. 샘플 13개 한 번에 실행

```bash
# 서버(데이터센터 IP)
node run.js --remote https://<배포 주소> --token <PROBE_TOKEN>

# 비교용: 이 컴퓨터(가정용 IP)
node run.js --local
```

- 링크 사이에 2초씩 쉽니다 (`--delay 2000`). 차단을 피하려는 것이니 줄이지 마세요.
- 결과는 `results/probe-server-<시각>.csv`, `results/probe-local-<시각>.csv`로 저장됩니다 (엑셀에서 한글이 깨지지 않게 저장).
- 링크를 바꾸려면 `urls.txt`를 수정하세요.

## 결과 읽는 법

| 결과 | 의미 | 다음 행동 |
| --- | --- | --- |
| 서버에서도 캡션 대부분 Y | 링크 경로 유지 가능 | 측정 시트 "og 메타 수집" 열을 Y로 채움 |
| `crawler`만 Y | 미리보기 크롤러 UA로만 열림 | 이 방식이 막힐 위험을 설계 문서에 기록 |
| 둘 다 N, `loginWall` true 또는 status 429/403 | 서버 IP 차단 | 캡션 붙여넣기·공식 oEmbed API를 기본 경로로 재설계 |

같은 결과가 반복되는지 보려면 시간을 두고 2~3번 실행해 보세요. 처음엔 되다가 반복 요청에서 막히는 경우가 있습니다.
