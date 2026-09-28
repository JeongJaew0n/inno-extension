# 체크리스트 — Jira 설명 편집 막기

- [x] 카탈로그 · 설정 기본값
- [x] `contracts.ts` — 옵션 정규화, 클릭을 막을지 판단
- [x] `runtime.ts` — 스위치 · 편집 버튼 · capture 리스너
- [x] `Markdown 복사` 왼쪽 배치
- [x] Popup 상세 설정 스위치
- [x] 단위 테스트
- [x] `npm run check`
- [x] spec · README
- [x] 실제 Chrome 대역 검증 (2026-09-28) — 10/10 PASS
      헤드리스 Chrome 을 CDP 로 띄우고, Jira 의 설명 구조(testid)와 **루트 위임 click 핸들러**
      (React 방식)를 흉내 낸 페이지에 **빌드된 런타임**을 올렸다. 클릭은 CDP
      `Input.dispatchMouseEvent` 로 보내 브라우저가 만든 진짜(isTrusted) 클릭이다.
      - 배치 `H2 > 편집 막기 > Markdown 복사`
      - 꺼짐: 편집 버튼 숨김 · 본문 클릭 → 편집 진입
      - 켜짐: 편집 버튼 보임 · 본문 클릭 → 편집 안 됨 · 링크는 통과 · 편집 버튼 → 편집 진입 · 편집 중 버튼 숨김
      - 해제 후: 본문 클릭 → 편집 진입
      - 화면 스위치 → `storage.sync` 에 `locked=true` 저장
- [ ] **실제 Jira 화면 실측** — 브라우저 자동화 연결이 끊겨 못 했다. 위 대역은 Jira 가 `click`
      으로 편집에 들어간다는 전제를 흉내 낸 것이라 그 전제 자체는 검증하지 못한다
