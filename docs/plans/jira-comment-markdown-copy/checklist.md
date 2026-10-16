# Jira 댓글 Markdown 복사 — 체크리스트

## 1. 측정

- [x] 댓글 루트 · 본문 · 동작 줄 구조 (NPT-630, 2026-10-16)

## 2. 구현

- [ ] 렌더러 → Markdown(+이미지) 공용으로 빼기
- [ ] 카탈로그 · 설정 기본값
- [ ] 댓글 런타임
- [ ] CLAUDE.md 네트워크 예외 범위

## 3. 테스트

- [ ] 단위 테스트
- [ ] e2e: 댓글마다 버튼 하나, 복사 결과, 편집 중인 댓글엔 없음
- [ ] `npm run check` · `npm run test:e2e`

## 4. 실사용

- [ ] 실제 Jira 댓글 복사

## 5. 문서

- [ ] spec/features · README · spec/README
