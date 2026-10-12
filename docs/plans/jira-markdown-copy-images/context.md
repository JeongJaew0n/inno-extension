# Jira 설명 Markdown 복사 — 이미지 포함 · 배경

## 지금 동작 (코드 기준, 2026-10-12)

| 경로 | 이미지 처리 | 코드 |
| --- | --- | --- |
| 읽기 화면 | `<img>` 를 `![alt](src)` 로. `src` 는 화면에 그려진 주소 그대로 | `src/platform/editor/renderer-to-markdown.ts` `renderImage` |
| 편집 중(ADF) | 첨부는 `(이미지 첨부)`, external 만 `![](url)` | `src/platform/adf/adf-to-markdown.ts` `renderMedia` |

spec 에도 "로그인 권한이 필요한 이미지 URL은 다른 환경에서 표시되지 않을 수 있다"고 적혀 있다.

## Chrome '이미지 복사' 와의 차이

Chrome 은 이미 받아 그려 둔 이미지의 **데이터**를 OS 클립보드에 넣는다. 붙여넣는 앱은 원래 주소에
다시 접속하지 않으므로 권한이 필요 없다. Markdown 복사는 **주소**만 넣어 붙여넣는 쪽이 다시 접속한다.

확장은 Chrome 캐시를 꺼낼 수 없다. 같은 효과를 내려면 이미지를 다시 받아 데이터로 넣어야 한다.
다른 오리진 이미지를 canvas 로 뽑으면 CORS 없이 canvas 가 오염돼 픽셀을 못 꺼낸다.

## 측정 (2026-10-12)

### Q1 — 읽기 화면 이미지 주소 · CORS

`/browse/NPT-670` 설명의 이미지 2개를 읽었다(`[data-testid="ImageRendererWrapper"]` 안의 `<img>`).

| 항목 | 값 |
| --- | --- |
| 오리진 | **`https://media-cdn.atlassian.com`** — Jira 와 다른 오리진 |
| 경로 | `/file/<uuid>/image/cdn` |
| 쿼리 | `allowAnimated` · `client` · `collection` · `height` · `max-age` · `mode` · `source` · **`token`** · `width` |
| `crossorigin` 속성 | 없음 |
| 그려진 크기 | 720×396, 720×389 (`alt` 는 첨부 파일 이름) |

페이지에서 같은 주소를 `fetch` 했다.

| 요청 | 결과 |
| --- | --- |
| `mode: 'cors'`, `credentials: 'omit'` | **200, `type: cors`, `image/png`, 332,624 B** |
| `mode: 'cors'`, `credentials: 'include'` | `Failed to fetch` — CORS 가 와일드카드라 쿠키 동반 요청을 막는 것으로 보인다 |
| `width` · `height` · `mode` 를 뺀 주소, `omit` | 200, `image/png`, **668,425 B** (원본) |

**인증은 쿠키가 아니라 주소의 `token` 이다.** 쿠키 없이 CORS 로 읽힌다. `host_permissions` 가 필요 없다.
다만 Jira 오리진 밖으로 나가는 요청이라 CLAUDE.md '네트워크는 예외다' 의 "그 사이트 오리진만" 규칙
밖이다 — 사용자 결정이 필요하다.

### Q4 — VS Code 미리보기

설치된 VS Code 1.136.1 의 `markdown-language-features` 미리보기 CSP 를 읽었다. 보안 수준마다
`img-src 'self' … https: data:` 처럼 **`data:` 를 허용**한다. 화면으로 띄워 확인하지는 않았다.

### 아직

- Q2 편집 중 이미지(편집기 DOM 의 `<img>` 짝)
- Q3 크기 — 표본 2장: 화면 크기 약 330KB, 원본 약 670KB. base64 는 약 1.33배가 된다

### 확장 코드로 다시 잰 결과 (2026-10-12)

새 빌드로 NPT-670 설명의 `Markdown 복사` 를 **진짜 클릭**으로 눌렀다(JS `click()` 은 사용자 동작 권한이 없어 클립보드
판정이 다르다). Mac 클립보드(`pbpaste`)를 읽어 구조만 확인했다.

| 상태 | 라벨 | 클립보드 |
| --- | --- | --- |
| 읽기 | `복사됨 · 이미지 2/2` | 약 62.5만 자. data URI PNG 2장(1024×564 · 1024×553, 서명 정상). `media-cdn`·`token=` 0, `(이미지 첨부)` 0 |
| 편집 중 | `복사됨 · 이미지 2/2` | 같다 |

- 이미지를 받은 **뒤** 클립보드에 쓰는데도 거부되지 않았다(받는 데 1~2초).
- 들어간 크기는 1024px 폭이다. 화면에 그려진 크기(720px)와 다르다 — `<img>` 의 `src` 속성 주소가 1024 폭이고
  화면은 그보다 작게 그린 것으로 보인다. 원본(약 670KB)보다는 작다.
- 편집은 취소로 닫았고 업무의 수정 시각은 바뀌지 않았다.

