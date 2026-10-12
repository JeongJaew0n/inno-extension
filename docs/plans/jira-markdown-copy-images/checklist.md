# Jira 설명 Markdown 복사 — 이미지 포함 · 체크리스트

## 1. 측정 (구현 전)

- [ ] Q1 읽기 화면 `<img>` 주소의 오리진 · CORS 응답 헤더 · 같은 오리진 `fetch` 가 되는지
- [ ] Q2 편집 중 이미지와 편집기 DOM `<img>` 의 짝
- [ ] Q3 실제 설명 이미지 크기
- [ ] Q4 VS Code 미리보기의 data URI 표시
- [ ] Q1 이 다른 오리진이면 → 사용자 결정(권한 · 네트워크 규칙 예외)

## 2. 구현

- [ ] `src/sites/jira/api/` 에 이미지 GET (누를 때만, GET 만)
- [ ] 카탈로그 `usesNetwork: true` · Popup 배지
- [ ] 변환기: 이미지 자리 표식 → data URI 치환. 실패·상한 초과는 `(이미지 첨부)`
- [ ] 라벨 `복사됨 · 이미지 n` / `n/m`

## 3. 테스트

- [ ] 단위: data URI 만들기 · 치환 · 상한 · 실패 대체
- [ ] 네트워크 허용 자리 테스트 통과
- [ ] e2e: 대역 이미지(같은 오리진) 복사 결과에 data URI
- [ ] 실사용: 이미지 있는 설명 → VS Code 붙여넣기

## 4. 문서

- [ ] spec/features/jira-description-markdown-copy.md · README
