# Inno Extension Spec

`spec/`는 Inno Extension의 제품 방향과 기능별 행동 계약을 기록하는 기준 문서 공간이다.
기획 의도, 사용자 문제, 범위, 기술 제약, 결정 근거, 고민한 대안, 검증 기준, 변경 이력을 함께 보존한다.

함수·클래스·파일별 코드 해설이나 순서대로 따라 하는 구현 절차는 이곳의 주제가 아니다. 다만 기능의 동작을 이해하고 미래의 변경을 판단하는 데 필요한 아키텍처 경계, 데이터 형식, 외부 시스템 의존성, 보안·권한 제약은 기록한다.

## 문서 체계

| 문서 | 역할 |
| --- | --- |
| [product-overview.md](./product-overview.md) | 제품 전체의 목적, 범위, 공통 원칙, 기능 목록, 기술·운영 제약, 이력 |
| [glossary.md](./glossary.md) | 제품·서비스·기능·사이트 등 기획과 기술 문서에서 사용하는 기준 용어 |
| [features/amaranth-attendance-header.md](./features/amaranth-attendance-header.md) | 아마란스 헤더 출퇴근과 현재 시각 인사말 복사의 행동 계약, 시간 기준, 리스크 |
| [features/amaranth-title-autofill.md](./features/amaranth-title-autofill.md) | 아마란스 신청서 제목 자동채움의 기획, 행동 계약, 설정, 리스크, 변경 이력 |
| [features/amaranth-notification-tools.md](./features/amaranth-notification-tools.md) | 아마란스 통합알림 새로고침과 인증번호 복사의 범위, 판별 계약, 실패·복구 동작 |
| [features/jira-work-link-copy.md](./features/jira-work-link-copy.md) | Jira 업무 링크 복사 기능의 기획과 행동 계약, 결정 사항, 리스크, 변경 이력 |
| [features/confluence-page-markdown-copy.md](./features/confluence-page-markdown-copy.md) | Confluence 문서 본문 Markdown 복사의 범위, 변환 계약, 리스크, 변경 이력 |
| [features/confluence-adf-markdown-tools.md](./features/confluence-adf-markdown-tools.md) | 로컬 Markdown -> ADF 변환기의 입력·출력, 지원 범위, 손실·실패 계약 |
| [features/github-pull-request-title-copy.md](./features/github-pull-request-title-copy.md) | GitHub Enterprise PR 제목 Markdown 링크 복사의 범위, 클립보드 계약, Turbo 대응, 리스크 |
| [features/gitlab-commit-sha-copy.md](./features/gitlab-commit-sha-copy.md) | GitLab MR 개요 탭 커밋 번호 복사의 범위, SHA 계약, 댓글 제외 근거, 리스크 |
| [features/github-pr-commit-sha-copy.md](./features/github-pr-commit-sha-copy.md) | GitHub Enterprise PR Conversation 탭 커밋 번호 복사의 범위, SHA 계약, Commits 탭 배제 근거 |
| [features/gitlab-merge-request-title-copy.md](./features/gitlab-merge-request-title-copy.md) | GitLab MR 제목을 Markdown 링크 또는 평문으로 복사하는 기능의 범위, 클립보드 계약, DOM 계약 |
| [AGENTS.md](./AGENTS.md) | `spec/` 문서를 작성·수정하는 에이전트와 기여자가 따라야 할 규칙 |

새 기능을 추가할 때는 `features/<feature-name>.md`를 만들고 이 목록에 연결한다.

## 정본과 이력 자료

- `spec/`: 현재 제품과 기능이 따라야 하는 정본이다.
- `docs/plans/`: 특정 시점의 구현 계획, 조사 맥락, 체크리스트를 보존하는 이력 자료다.
- `README.md`: 설치, 빌드, 사용법을 빠르게 찾기 위한 진입 문서다.
- 소스 코드와 테스트: 실제 구현과 실행 가능한 검증 근거다.

문서와 코드가 다르면 단순히 코드를 정답으로 간주하지 않는다. 최근 사용자 결정과 변경 이력을 확인해 의도된 변경인지 회귀인지 판별하고, 확정된 결론에 맞춰 spec·코드·테스트를 함께 정렬한다.

## 기능 Spec 기본 구조

기능 문서는 필요에 따라 다음 항목을 포함한다.

1. 문서 상태와 최종 갱신일
2. 한 줄 요약
3. 배경과 사용자 문제
4. 목표와 비목표
5. 대상 사용자·사이트·적용 조건
6. 사용자 경험과 행동 계약
7. 데이터·출력 형식
8. 설정과 기본값
9. 기술적 맥락과 제약
10. 보안·개인정보·권한
11. 결정 사항, 대안, 트레이드오프
12. 실패·복구 동작
13. 수용 기준과 검증 방법
14. 알려진 리스크와 열린 질문
15. 변경 이력

섹션을 억지로 채우기보다 기능 판단에 실제로 필요한 내용을 남긴다. 아직 결정되지 않은 사항은 추측해 확정하지 않고 `열린 질문`에 기록한다.

## 변경 원칙

- 사용자에게 보이는 동작이나 범위가 바뀌면 같은 변경에서 관련 spec을 갱신한다.
- 문서 용어는 [용어사전](./glossary.md)을 따른다.
- 변경 이력은 날짜, 변경 내용, 변경 이유를 함께 남긴다.
- 과거 결정을 삭제하지 않는다. 뒤집힌 결정은 새 결론과 이유를 추가하고 이전 상태는 이력으로 보존한다.
- 구현 세부를 기록해야 한다면 코드 링크보다 안정적인 계약과 제약을 우선 설명한다.
- 임시 경로, 인증 정보, 개인 데이터, 브라우저 세션 정보는 기록하지 않는다.
