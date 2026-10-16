# Jira 댓글 Markdown 복사 — 체크리스트

## 1. 측정

- [x] 댓글 루트 · 본문 · 동작 줄 구조 (NPT-630, 2026-10-16)

## 2. 구현

- [x] 렌더러 → Markdown(+이미지) 공용으로 빼기 (`src/sites/jira/rendererMarkdown.ts`)
- [x] 카탈로그 · 설정 기본값
- [x] 댓글 런타임
- [x] CLAUDE.md 네트워크 예외 범위

## 3. 테스트

- [x] 단위 테스트
- [x] e2e: 댓글마다 버튼 하나, 복사 결과, 편집 중인 댓글엔 없음
- [x] `npm run check` (216) · `npm run test:e2e` (135/135)

## 4. 실사용

- [ ] 실제 Jira 댓글 복사

## 5. 문서

- [x] spec/features · README · spec/README
