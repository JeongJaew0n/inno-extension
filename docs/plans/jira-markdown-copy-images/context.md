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

## 측정

아직 없다. 2026-10-12 세션에 Chrome 도구 연결이 끊겨 재지 못했다. spec.md 4절의 Q1~Q4 를 잰다.
