# Jira 설명 Markdown 복사 — 구현 체크리스트

## 1. 공용화 (동작 불변)

- [x] `markdown.ts` → `platform/editor/renderer-to-markdown.ts`
- [x] `MARKDOWN_IGNORED_ELEMENTS` → `platform/editor/selectors.ts`
- [x] `convertConfluenceBodyToMarkdown` → `convertRendererToMarkdown`
- [ ] Confluence 기능이 그대로 동작하는지 (테스트 통과 + 화면 확인)

## 2. Jira 배선

- [x] `FEATURE_IDS` · 카탈로그에 기능 등록 (기본 ON)
- [x] `defaults.ts` 기본값
- [x] `src/sites/jira/selectors.ts` 에 설명 필드·라벨 선택자
- [x] 런타임 구현. 설명 필드 **안에서만** 렌더러를 찾는다
- [x] content entry 에 연결

## 3. 테스트

- [x] 변환기 테스트가 새 경로에서 그대로 통과
- [x] 댓글 렌더러를 잡지 않는다는 회귀 테스트
- [x] `npm run check`

## 4. 실사용 확인

- [ ] 표·링크·목록이 든 설명이 Markdown 으로 복사되는지
- [ ] 편집기를 열면 버튼이 사라지는지
- [ ] 댓글이 달린 이슈에서 댓글 본문이 섞이지 않는지
- [ ] Confluence 본문 Markdown 복사가 여전히 동작하는지

## 5. 문서

- [x] `spec/features/` 기능 문서
- [x] `spec/product-overview.md` 변경 이력
- [x] `README.md`
