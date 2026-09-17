# Jira 편집기 Markdown 변환 — 구현 체크리스트

착수 전 [spec.md](./spec.md) 8절의 결정을 확정한다.

## 0. 선결

- [x] Q1 Mermaid 불가 **수용.** 코드블럭으로 남긴다
- [x] Q2 **설명 편집기만.** 댓글은 제외
- [x] Q3 기능 기본값 **ON** (처음엔 OFF 로 정했다가 바꿨다)
- [x] Q4 기능 ID `editorMarkdownToAdf` 동일

## 1. 선행 측정 — 남은 것

- [ ] 전체 화면 업무 보기(`/browse/NPT-xxx`)의 설명 편집기가 같은 구조인지
- [ ] 백로그 상세 패널에서도 설명 편집기가 뜨는지
- [ ] **30줄 넘는 코드블럭**이 Jira에서도 DOM에서 잘리는지

## 2. 공용화 (동작을 바꾸지 않는 리팩터링)

- [x] `markdown-to-adf` · `markdown-detection` · `adf-to-editor-html` · `code-block` 을
      `src/platform/` 으로 옮긴다
- [x] MAIN world 브리지를 공용 모듈로 올리고 사이트별 진입점만 남긴다
- [x] 브리지 주소 지정을 `data-local-id` → **임시 표식 속성**으로 바꾼다
- [x] `mermaid.ts` 는 Confluence에 남긴다
- [x] 런타임을 **단계 목록 주입** 구조로 바꾼다
- [ ] **Confluence 기능 회귀 확인** — 여기서 깨지면 뒤 작업이 전부 무의미하다

## 3. Jira 쪽 배선

- [x] `FEATURE_IDS` · `src/catalog/sites.ts` 의 jira 에 기능 등록
- [x] `defaults.ts` 에 기본값 (ON)
- [x] `manifest.json` 에 Jira MAIN world content script 추가 (`document_start`)
- [x] `src/sites/jira/selectors.ts` 에 편집기·툴바·컨테이너 선택자
- [x] 설명 편집기만 고르는 조건 (`issue.views.field.rich-text.editor-container`)
- [ ] 툴바 ↔ 편집기 짝짓기. 편집기가 여럿인 화면에서 확인

## 4. 동작

- [x] 코드블럭 벗기기 단계
- [x] 문단 Markdown 변환 단계
- [x] Mermaid 단계는 **넣지 않는다**
- [x] Mermaid 미지원을 **기능 설명·README·spec** 에 명시. 실패 라벨에는 넣지 않았다 — Jira 에서는 Mermaid 단계가 아예 돌지 않아 그 분기의 실패 자체가 없다

## 5. 테스트

- [x] 공용 모듈 단위 테스트가 그대로 통과하는지
- [ ] 브리지 주소 방식 변경에 대한 테스트 — **아직 없다.** 표식 부착·제거는 DOM 의존이라 현재 테스트 구조(순수 함수 단위)로 덮지 못했다
- [x] `npm run check`

## 6. 실사용 확인 (브라우저)

- [ ] **초안이 없는 이슈**에서만 확인한다. 끝나면 `취소` 로 되돌린다
- [ ] 코드블럭 하나짜리 문서 변환
- [ ] 표·제목·목록이 섞인 문서 변환
- [ ] Mermaid 코드블럭이 **코드블럭으로 남는지**
- [ ] 댓글 편집기에는 버튼이 붙지 않는지
- [ ] 기능을 끄면 아무것도 주입되지 않는지
- [ ] Confluence 기능이 여전히 동작하는지

## 7. 문서

- [x] `spec/features/` 에 기능 문서
- [x] `spec/product-overview.md` 변경 이력
- [x] `README.md` 사용법
- [x] Confluence 기능 문서에 공용화 사실 반영
