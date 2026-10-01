# 체크리스트 — Mermaid 서버 초안 대기

- [x] `src/sites/confluence/api/draft.ts` — 초안 GET, 코드블럭 원문 뽑기
- [x] Mermaid 단계 — 넣기 전 대기, 진행 라벨, 시간 초과·실패 시 그대로 진행
- [x] 카탈로그 `usesNetwork` · 테스트 ALLOWED
- [x] 단위 테스트
- [~] e2e — 대역 화면에 진짜 편집기(ProseMirror)가 없어 변환 자체를 못 돌린다. 대기 로직은 단위 테스트(읽기 함수 주입)로 대신했다. 실제 확인은 실험 페이지에서 한다
- [x] `npm run check` · `npm run test:e2e`
- [ ] 실험 페이지 실측
- [x] spec · README · troubleshooting
