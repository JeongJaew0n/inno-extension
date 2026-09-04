# 매직버튼 — 구현 체크리스트

구현 전 [spec.md](./spec.md) 9절의 결정 사항을 확정한다. 확정 전에는 착수하지 않는다.

## 0. 선결

- [ ] Q1 버튼 이름 확정
- [ ] Q2 벗기기 범위(A / B / C) 확정
- [ ] Q3 Markdown 판정 임계값 확정
- [ ] Q4 1단계 단독 실행 경로 유지 여부 확정

## 1. 판정 로직

- [ ] `isTopLevelCodeBlock()` — `findEditorTopLevelNode()`를 재사용하고 `.fabric-editor-breakout-mark` 래퍼를 통과한다
- [ ] `resolveMermaidReplacementTarget()`의 "래퍼 안에 콘텐츠 노드가 하나뿐" 판정을 공용 함수로 추출한다
- [ ] `looksLikeMarkdownDocument()` — 제목·표 구분선·펜스·목록·인용 중 2종 이상
- [ ] DOM 원문으로 1차 후보를 좁히고 브리지 원문으로 확정한다 (30줄 잘림 대응)

## 2. 핸들러 재구성

- [ ] 기존 `코드블럭 -> ADF` 본문을 `runCodeBlockPhase()`로 추출
- [ ] 기존 `Mermaid -> ADF` 본문을 `runMermaidPhase()`로 추출
- [ ] 단일 핸들러에서 순차 호출. 1단계 후 편집 본문을 **다시 조회**
- [ ] `codeBlockIndex`를 2단계 시작 시점에 다시 계산 (매크로 `guestParams.index` 근거)
- [ ] B안 채택 시 짝 없는 Mermaid 컴포넌트 가드를 **1단계 이전**에 확인
- [ ] 1단계를 건너뛰면 `loadCodeBlockConverter()`를 호출하지 않는다

## 3. UI

- [ ] 버튼 2개 + divider를 버튼 1개로 교체
- [ ] 아이콘 선정 (두 동작을 아우르는 형태)
- [ ] 라벨에 단계·진행 표시: `벗기는 중` → `Mermaid 3/7` → 결과
- [ ] 부분 실패를 라벨과 hover에 나눠 표기
- [ ] 대상이 없으면 오류가 아니라 `변환할 내용이 없습니다`

## 4. 테스트

- [ ] `looksLikeMarkdownDocument()` — Markdown 문서 통과 / Kotlin·YAML·JSON·셸 차단
- [ ] 특징 1종만 있는 입력이 차단되는지 (YAML의 `- item`, 셸의 `# 주석`)
- [ ] 최상위 판정 — 래퍼 안 코드블럭은 참, 목록·인용 안 코드블럭은 거짓
- [ ] 단계 순서 — 1단계 후 2단계가 새 DOM을 조회하는지
- [ ] 기존 87개 테스트 무회귀

## 5. 실제 tenant 검증

- [ ] Markdown 한 덩이를 코드블럭으로 붙여넣고 한 번에 변환
- [ ] 실제 코드블럭(Kotlin·YAML)이 섞인 문서에서 **코드가 풀리지 않는지**
- [ ] 30줄 넘는 Mermaid 블록이 변환되는지
- [ ] 재실행 시 멱등한지 (`변환할 내용이 없습니다`)
- [ ] 문서를 원상 복구하고 **발행하지 않는다**

## 6. 문서

- [ ] `spec/features/confluence-adf-markdown-tools.md` 편집기 절 재작성
- [ ] 같은 파일 **변경 이력 섹션 안**에 항목 추가 (파일 끝에 붙이지 않는다)
- [ ] `spec/product-overview.md` 변경 이력 추가
- [ ] README에 기능 설명이 있으면 갱신
- [ ] 이 계획 문서의 상태를 갱신

## 7. 릴리즈

- [ ] 버튼 구성이 바뀌므로 `0.x.x` 정책상 **MINOR** (기능·동작 변경)
- [ ] 릴리즈 노트에 "버튼 2개가 1개로 합쳐짐"과 "실제 코드는 더 이상 변환되지 않음"을 명시
