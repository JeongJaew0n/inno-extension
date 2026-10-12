# Jira 설명 Markdown 복사 — 이미지 포함 · 체크리스트

## 1. 측정 (구현 전)

- [x] Q1 읽기 화면 `<img>` 주소의 오리진 · CORS 응답 헤더 · 같은 오리진 `fetch` 가 되는지
- [x] Q2 편집 중 이미지와 편집기 DOM `<img>` 의 짝
- [x] Q3 크기 — 표본 2장: 화면 크기 약 330KB, 원본 약 670KB
- [x] Q4 VS Code 미리보기의 data URI 표시 — CSP 소스로 확인(1.136.1), 화면 확인은 실사용 때
- [x] Q1 이 다른 오리진(media-cdn) → 사용자 결정: 예외 허용, 화면 크기

## 2. 구현

- [x] `src/sites/jira/api/` 에 이미지 GET (누를 때만, GET 만)
- [x] 카탈로그 `usesNetwork: true` · Popup 배지
- [x] 변환기: 이미지 자리 표식 → data URI 치환. 실패·상한 초과는 `(이미지 첨부)`
- [x] 라벨 `복사됨 · 이미지 n` / `n/m`

## 3. 테스트

- [x] 단위: data URI 만들기 · 치환 · 상한 · 실패 대체
- [x] 네트워크 허용 자리 테스트 통과
- [x] e2e: 대역 이미지(다른 오리진 + CORS) 복사 결과에 data URI — 123/123
- [x] 실사용(2026-10-12, NPT-670, 진짜 클릭): 읽기·편집 둘 다 라벨 `복사됨 · 이미지 2/2`, 클립보드에 PNG 2장
      (1024×564 · 1024×553, 서명 정상), `media-cdn` 주소·토큰 0, 편집은 취소(업무 수정 시각 변화 없음)
- [ ] VS Code 미리보기에서 눈으로 확인 — 사용자

## 4. 문서

- [x] spec/features/jira-description-markdown-copy.md · README
