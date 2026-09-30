# 체크리스트 — GitLab 토큰 권한 프리셋

- [x] 카탈로그 · 설정 기본값
- [x] `contracts.ts` — 경로 판정, 프리셋, 권한 고르기, 결과 문구
- [x] MAIN world 브리지 (`src/sites/gitlab/main.ts`, manifest 등록)
- [x] `runtime.ts` — 버튼 · 결과 표시 · 브리지 호출
- [x] 단위 테스트
- [x] e2e — 가짜 토큰 화면
- [x] `npm run check` · `npm run test:e2e`
- [x] spec · README
- [x] 실제 GitLab — 버튼 표시 확인 (누르기는 사용자)
      2026-09-30 사용자가 실제 화면에서 눌러 동작을 확인했다
      사전 확인(2026-09-30, 읽기만): 화면 경로 · 선택기 컴포넌트 · `emitInput` · `syncSelectedResources` ·
      프리셋 카테고리 전부 존재. 확장을 다시 로드해야 버튼이 뜬다.

## 결과 (2026-09-30)

- 단위 180/180, e2e 101/101 (토큰 프리셋 7건 포함), 오류 0건
