<div align="center">
  <img src="./public/icons/icon-128.png" width="112" height="112" alt="Inno Extension 아이콘">

  # Inno Extension

  아마란스, Jira, Confluence, GitHub Enterprise, GitLab에서 반복되는 사내 업무를 더 짧게 처리하는 Chrome 확장 프로그램

  [최신 릴리즈](https://github.com/JeongJaew0n/inno-extension/releases/latest) · [제품 Spec](./spec/README.md) · [변경 이력](./spec/product-overview.md#변경-이력)
</div>

## 소개

Inno Extension은 여러 업무 사이트의 편의 기능을 하나의 확장 프로그램과 하나의 설정 화면으로 관리한다. 출퇴근 접근, 신청서 제목 입력, 인증번호 복사, Jira 업무 링크 공유, Confluence 문서 변환, PR·MR의 커밋 번호 복사처럼 자주 반복하지만 사이트마다 흩어져 있는 동작을 현재 화면 가까이에 제공한다.

- 하나의 Popup에서 서비스와 기능별 활성 상태를 관리한다.
- 사용자 클릭이 있어야 복사·변환·원본 버튼 실행이 일어난다.
- 문서와 입력값을 별도 서버로 전송하지 않는다.
- 기능이 실패해도 원본 사이트의 기본 동작은 그대로 사용할 수 있다.

> 현재 지원 범위는 `gw.innogrid.com`, `pms-innogrid.atlassian.net`, `github.nhnent.com`, `rnd-app.innogrid.com`이다. 외부 서비스의 화면 구조가 바뀌면 일부 기능을 다시 맞춰야 할 수 있다.

## 설치

### 릴리즈 ZIP으로 설치

1. [최신 릴리즈](https://github.com/JeongJaew0n/inno-extension/releases/latest)에서 `inno-extension-<version>.zip`을 내려받는다.
2. ZIP 파일을 원하는 위치에 압축 해제한다.
3. Chrome 주소창에서 `chrome://extensions`를 연다.
4. 우측 상단의 **개발자 모드**를 켠다.
5. **압축해제된 확장 프로그램을 로드합니다**를 누르고 압축 해제한 폴더를 선택한다.
6. 기존에 열려 있던 대상 사이트 탭을 새로고침한다.

현재 배포 버전은 [v0.8.0](https://github.com/JeongJaew0n/inno-extension/releases/tag/v0.8.0)이며, 배포 ZIP은 릴리즈 페이지에서 받을 수 있다.

### 업데이트

Chrome 웹 스토어에 올리지 않으므로 새 버전이 나와도 **자동으로 갱신되지 않는다.** 갱신은 [프로젝트 Skill `$update-release`](./.codex/skills/update-release/SKILL.md)를 사용한다. 설치 폴더를 찾아 현재 버전과 최신 릴리즈를 비교하고, ZIP을 내려받아 무결성을 확인한 뒤 백업하고 같은 경로에 덮어쓴다.

수동으로 할 때도 **설치 폴더 경로를 바꾸지 않는다.** `manifest.json`에 `key`가 없어 압축해제 확장의 ID가 폴더 경로에서 파생되므로, 경로가 바뀌면 확장 ID가 바뀌고 `chrome.storage.sync`에 저장한 기능 ON/OFF 설정이 사라진다.

파일을 덮어쓴 뒤에는 두 단계가 더 필요하다.

1. `chrome://extensions`에서 확장 카드의 새로고침을 누른다.
2. 열려 있던 대상 사이트 탭을 새로고침한다.

1번을 건너뛰면 이전 코드가 계속 돌고, 2번을 건너뛰면 기존 탭의 content script가 무효화된 상태로 남아 버튼이 보이지 않는다.

### 소스에서 설치

```bash
npm install
npm run build
```

빌드가 끝나면 `chrome://extensions`에서 이 저장소의 `dist/` 디렉터리를 로드한다. 소스를 수정한 뒤에는 다시 빌드하고 확장 프로그램 카드의 새로고침 버튼과 대상 사이트 새로고침을 순서대로 실행한다.

## 지원 서비스

| 서비스 | 기본 활성 기능 | 기본 비활성 기능 | 적용 사이트 |
| --- | --- | --- | --- |
| 아마란스 | 헤더 출퇴근 버튼, 신청서 제목 자동채움, 통합알림 도구 | 없음 | `gw.innogrid.com` |
| Jira | 업무 링크 복사 | 없음 | `pms-innogrid.atlassian.net`의 Jira 화면 |
| Confluence | 본문 Markdown 복사 | Markdown → ADF 변환 | `pms-innogrid.atlassian.net/wiki` |
| GitHub Enterprise | PR 제목 링크 복사, 커밋 번호 복사 | 없음 | `github.nhnent.com` |
| GitLab | MR 제목 복사, 커밋 번호 복사 | 없음 | `rnd-app.innogrid.com` |

### 아마란스

#### 헤더 출퇴근 버튼

- 원본 출근·퇴근 버튼을 헤더 가까운 위치에서도 사용할 수 있게 한다.
- 원본 버튼의 활성 상태를 확장 버튼에 동기화한다.
- 출근 버튼 아래의 **인사말 복사**를 누르면 근무시간 위젯에 기록된 오늘 출근 시각으로 `n시 n분 출근입니다.` 문구를 복사한다. 출근 기록이 없으면 `출근 기록 없음`을 표시한다.

#### 신청서 제목 자동채움

- 근태신청서 작성 화면의 `제목` 왼쪽에 **자동채움** 버튼을 표시한다.
- Popup에서 저장한 문구를 제목 입력란에 채운다.
- 저장 결과와 기능 비활성 상태를 버튼 피드백과 안내 문구로 확인할 수 있다.

#### 통합알림 새로고침·인증번호 복사

- 통합알림의 `전체` 탭에서 다른 탭을 오가지 않고 목록을 새로고침한다.
- `[메일]` 알림에서 인증 문맥과 함께 나타난 4~6자리 번호를 감지한다.
- 표시된 **복사** 버튼을 누르면 선행 0을 포함한 인증번호 원문을 복사한다.
- 일반 날짜나 업무번호처럼 인증 문맥이 없는 숫자는 대상으로 삼지 않는다.

### Jira

#### 업무 링크 복사

모든 Jira 보드의 선택 업무와 `/browse/업무번호`, `/issues/업무번호` 직접 조회 화면에서 다음 두 형식을 제공한다.

| 버튼 | 복사 결과 예시 |
| --- | --- |
| **업무 링크 복사** | `NPT-38` |
| **업무 링크 복사(제목포함)** | `NPT-38 현재 업무 제목` |

클립보드의 HTML 형식을 지원하는 곳에 붙여넣으면 업무 번호가 해당 Jira 업무로 연결되는 링크를 유지한다.

### Confluence

#### 본문 Markdown 복사

- 문서 조회 화면의 `링크 복사` 옆에 **본문 Markdown 복사** 버튼을 추가한다.
- 제목, 작성자, 댓글을 제외한 본문만 복사한다.
- 제목 계층, 목록, 표, 링크, 인용, 코드 블록과 기본 텍스트 서식을 Markdown으로 변환한다.

#### Markdown → ADF 변환

기본값은 OFF다. Popup에서 기능을 켜면 Confluence `edit-v2` 편집기 toolbar에 **Markdown 변환** 버튼이 나타난다.

버튼 하나가 세 단계를 순서대로 수행한다.

1. **코드블럭 벗기기** — 본문의 코드 블록이 전부 Markdown 문서로 보일 때만 실행한다. 실제 소스 코드는 건드리지 않는다.
2. **문단 Markdown 변환** — 문단으로 남은 Markdown을 평문으로 다시 붙여넣어 Confluence 파서가 제목·표·코드 블록으로 만들게 한다.
3. **Mermaid 변환** — Mermaid 선언 코드 블록을 같은 위치의 Confluence Mermaid component로 바꾸고, 렌더링에 필요한 원본은 접힌 영역에 보존한다.

- 변환은 현재 편집 초안만 변경한다. 확장이 페이지의 **업데이트** 버튼을 누르지 않으므로 결과를 확인한 뒤 사용자가 직접 저장한다.
- 잘못된 변환은 Confluence 실행 취소로 되돌릴 수 있다.

> 1단계는 대상 코드 블록이 모두 Markdown 문서로 보일 때만 실행되지만, 판정이 완벽하지는 않다. 저장 전 결과를 검토해야 한다.

### GitHub Enterprise

#### PR 제목 링크 복사

저장소 PR 목록과 PR 상세 화면에서 제목 옆에 버튼 두 개를 표시한다.

| 버튼 | 복사 결과 |
| --- | --- |
| **PR 제목 Markdown 링크 복사** | `[제목](URL)` |
| **PR 제목만 복사** | `제목` |

- 링크 복사는 제목에 `[CloudStation]` 같은 대괄호가 있어도 구조가 깨지지 않는다.
- 제목만 복사는 화면에 보이는 그대로를 평문으로 복사한다. 이스케이프하지 않는다.
- 주소에서 조회 상태(`?diff=split#r12345`)를 제거한 정규 URL을 사용한다.

#### 커밋 번호 복사

PR **Conversation** 탭 타임라인의 커밋 번호 오른쪽 버튼으로 40자 전체 SHA를 복사한다.

- 화면에는 7자 단축 번호가 보이지만 GitHub 기본 버튼과 같은 전체 SHA를 복사한다.
- Commits 탭에는 GitHub이 제공하는 `Copy full SHA` 버튼이 이미 있으므로 버튼을 추가하지 않는다.

### GitLab

#### MR 제목 복사

Merge Request 목록과 상세 화면에서 제목 옆에 버튼 두 개를 표시한다.

| 버튼 | 복사 결과 |
| --- | --- |
| **MR 제목 Markdown 링크 복사** | `[제목](URL)` |
| **MR 제목만 복사** | `제목` |

- 링크 복사는 제목에 `[CCP-BE]` 같은 대괄호가 있어도 구조가 깨지지 않는다.
- 제목만 복사는 화면에 보이는 그대로를 평문으로 복사한다.
- 주소에서 하위 탭 경로와 조회 상태를 제거한 정규 URL을 사용한다.

#### 커밋 번호 복사

Merge Request **개요** 탭의 `added N commits` 목록에서 커밋 번호 오른쪽 버튼으로 40자 전체 SHA를 복사한다.

- 화면에는 8자 단축 번호가 보이지만 GitLab 기본 버튼과 같은 전체 SHA를 복사한다.
- Commits 탭에는 GitLab이 제공하는 `Copy commit SHA` 버튼이 이미 있으므로 버튼을 추가하지 않는다.
- 사용자 댓글에 언급된 커밋 번호에는 버튼을 붙이지 않는다.

## 설정 방식

Chrome 도구 모음의 Inno Extension 아이콘을 누르면 서비스 목록이 열린다.

1. 서비스 카드의 전체 토글로 해당 서비스 기능을 한 번에 켜거나 끈다.
2. 서비스 카드를 열어 기능별 토글과 적용 범위를 확인한다.
3. 세부 설정이 있는 기능은 상세 화면에서 값을 저장하거나 초기화한다.

서비스 전체 기능을 꺼도 하위 기능별 선택값은 지워지지 않는다. 서비스를 다시 켜면 이전 조합이 복원된다.

```text
실제 실행 상태 = 서비스 전체 기능 ON && 개별 기능 ON
```

설정은 `chrome.storage.sync`에 버전이 있는 스키마로 저장한다.

## 권한과 데이터 처리

Manifest V3의 `storage` 권한만 사용한다. 별도 `host_permissions`, `scripting`, `downloads`, background service worker는 두지 않는다.

- content script는 manifest에 선언된 아마란스, Jira, Confluence, GitHub Enterprise, GitLab 주소에서만 실행된다.
- 사이트의 로그인 쿠키, 인증 토큰, 비밀번호를 읽거나 저장하지 않는다.
- 메일 알림, Confluence 본문, Markdown 입력은 기능 실행 중 현재 브라우저 안에서만 처리한다.
- 클립보드 쓰기는 사용자가 해당 버튼을 직접 누른 경우에만 수행한다.
- Confluence 변환은 API로 문서를 저장하지 않고 현재 편집 초안만 변경한다.

자세한 제품 원칙은 [제품 개요의 보안과 개인정보](./spec/product-overview.md#보안과-개인정보)를 참고한다.

## 문제 해결

### 대상 사이트에 버튼이 보이지 않는다

1. Popup에서 해당 서비스의 전체 기능과 개별 기능이 모두 ON인지 확인한다.
2. 기능 상세의 적용 화면과 현재 URL이 일치하는지 확인한다.
3. `chrome://extensions`에서 Inno Extension을 새로고침한다.
4. 대상 사이트 탭을 새로고침한다.

### 새 빌드가 반영되지 않는다

`npm run build`만 실행하면 열린 Chrome 탭에는 자동 반영되지 않는다. 확장 프로그램을 새로고침한 다음 대상 사이트도 다시 불러와야 한다.

### Confluence 변환 결과가 예상과 다르다

페이지를 저장하기 전에 Confluence 실행 취소로 되돌린다. 편집기나 Mermaid 앱의 DOM 계약이 변경됐을 가능성이 있으므로 브라우저 콘솔의 `[Inno Extension]` 로그와 재현 화면을 함께 확인한다.

## 개발

### 명령어

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | Vite 개발 서버 실행 |
| `npm run typecheck` | TypeScript 정적 검사 |
| `npm test` | 자동화 테스트 실행 |
| `npm run check` | typecheck와 test 순차 실행 |
| `npm run build` | 검사 후 `dist/` 프로덕션 빌드 |
| `npm run package` | 빌드 후 배포 ZIP 생성과 무결성 검사 |

`npm run package`의 결과는 `release/inno-extension-<version>.zip`에 생성된다.

### 구조

```text
src/
├── catalog/          서비스·기능 메타데이터
├── platform/
│   ├── clipboard/    일반 텍스트·리치 클립보드 출력
│   ├── runtime/      서비스 runtime과 기능 lifecycle
│   └── settings/     버전화된 설정 schema와 저장소
├── popup/            서비스 목록·상세·기능 설정 UI
└── sites/
    ├── amaranth/     출퇴근, 제목 자동채움, 통합알림
    ├── jira/         업무 링크 복사
    ├── confluence/   본문 Markdown 복사, ADF 변환
    ├── githubEnterprise/  PR 제목 링크 복사, 커밋 번호 복사
    └── gitlab/       MR 제목 복사, 커밋 번호 복사
```

사이트별 runtime은 하나의 `MutationObserver`로 활성 기능의 `reconcile()`을 호출한다. 서비스나 기능이 꺼지면 각 기능의 `dispose()`가 자신이 만든 DOM, style, timer, listener를 정리한다.

### 기능 추가 순서

1. `src/catalog/sites.ts`에 기능 메타데이터를 등록한다.
2. `src/platform/settings/defaults.ts`에 기본 설정을 추가한다.
3. `src/sites/<service>/features/<feature>/`에 기능 runtime을 구현한다.
4. 해당 서비스의 content entry에 runtime을 연결한다.
5. 필요한 경우 Popup 상세 설정 renderer를 추가한다.
6. catalog, 설정 migration, route, lifecycle 회귀 테스트를 추가한다.
7. 사용자 행동 계약이 바뀌면 같은 변경에서 관련 `spec/features/` 문서를 갱신한다.

## 문서

| 위치 | 역할 |
| --- | --- |
| [`spec/`](./spec/README.md) | 현재 제품 방향과 기능 행동 계약의 정본 |
| [`spec/product-overview.md`](./spec/product-overview.md) | 제품 목표, 범위, 보안, 기술 제약, 변경 이력 |
| [`spec/glossary.md`](./spec/glossary.md) | 서비스·기능·업무 등 기준 용어 |
| [`spec/features/`](./spec/features/) | 기능별 기획, 적용 범위, 실패·복구 계약 |
| [`docs/plans/`](./docs/plans/) | 구현 당시 계획, 조사 맥락, 체크리스트 |
| [`docs/`](./docs/) | Jira·Confluence 동작 분석과 장애 조사 기록 |

문서와 코드의 동작이 다르면 최근 사용자 결정과 변경 이력을 확인해 의도된 변경인지 회귀인지 판단하고, 확정된 결론에 맞춰 spec·코드·테스트를 함께 정렬한다.

## 기술 스택

- Chrome Extension Manifest V3
- TypeScript strict mode
- Vite + CRXJS
- Vanilla TypeScript Popup
- `marked` 기반 Markdown 파싱

## 배포

프로젝트 릴리즈는 [프로젝트 Skill `$extension-release`](./.codex/skills/extension-release/SKILL.md)을 사용한다. 다음 버전은 Semantic Versioning과 초기 개발 `0.x.x` 정책에 따라 결정하며, 이미 공개한 버전의 태그와 결과물은 변경하지 않는다.

1. `package.json`과 `manifest.json`의 버전을 맞춘다.
2. `npm run package`로 검사·빌드·ZIP 무결성 검사를 수행한다.
3. 변경 사항을 커밋하고 버전 태그를 푸시한다.
4. GitHub Release에 `release/inno-extension-<version>.zip`과 변경 내역을 게시한다.

현재 릴리즈: [Inno Extension v0.8.0](https://github.com/JeongJaew0n/inno-extension/releases/tag/v0.8.0)
