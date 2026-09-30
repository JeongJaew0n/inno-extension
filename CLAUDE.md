# Inno Extension — 작업 지침

사내 업무 사이트 다섯 곳(아마란스 · Jira · Confluence · GitHub Enterprise · GitLab)에 버튼을 붙이는
Chrome MV3 확장이다. 사용자용 설명은 `README.md`, 기능별 행동 계약은 `spec/` 에 있다.
이 파일은 **이 저장소에서 일할 때 지킬 것**만 적는다.

## 가장 먼저 알아둘 것

1. **이 저장소는 공개다.** 사번·부서 코드·사내 API 응답 본문·개인 이메일을 코드, 문서, 커밋 어디에도 남기지 않는다.
2. **모든 기능이 남의 사이트 DOM 에 기댄다.** "이렇게 될 것"은 자주 틀린다. `docs/` 에도 추측을 실측으로 뒤집은 기록이 여러 건 있다. 동작을 주장하려면 브라우저에서 재 본다. 못 쟀으면 못 쟀다고 쓴다.
3. **확장은 저장·제출을 하지 않는다.** 편집 초안을 바꾸거나 폼을 채우는 데까지만 한다. 저장, 생성, 발행, 출퇴근 기록은 사용자가 누른다.

## 스택

| 항목 | 값 |
| --- | --- |
| 언어 | TypeScript strict |
| 번들 | Vite + `@crxjs/vite-plugin` (`build.modulePreload: false` — 켜면 content script 가 사이트 주소로 `/assets` 를 요청한다) |
| 런타임 의존성 | `marked` 하나 |
| 테스트 | `npm test` (Vite SSR 번들 → `node --test`), `npm run test:e2e` (헤드리스 Chrome + 가짜 사이트) |
| 배포 | 웹 스토어 없음. 릴리즈 ZIP 을 압축해제 확장으로 설치 |

## 코드 구조

| 경로 | 책임 |
| --- | --- |
| `src/catalog/` | 사이트·기능 목록의 정본. 여기 없으면 Popup 에 안 나온다 |
| `src/platform/` | 사이트와 무관한 공용 부품 — 런타임 루프, 설정, 클립보드, 메시징, 편집기 브리지, 디자인 CSS |
| `src/sites/<siteId>/features/<featureId>/` | 기능 구현. 진입점은 `runtime.ts`. DOM 과 무관한 판정은 따로 빼서(`contracts.ts` 등) 단위 테스트한다 |
| `src/popup/` | 설정 화면 |
| `src/background/` | service worker. 설정 창을 여는 일만 한다 |
| `design/` | 디자인 시스템 정본. 확장 빌드·tsconfig·패키징과 **분리돼 있다** |
| `spec/` · `docs/` · `tests/` | 명세 · 계획과 기록 · 테스트 |
| `.codex/skills/` | 저장소 전용 절차 — `extension-release`, `update-release` |

### 런타임 계약

- 사이트마다 `createSiteRuntime` 하나, `MutationObserver` 하나. 변화를 디바운스해 각 기능의 `reconcile(context)` 를 부른다.
- `reconcile` 은 **멱등**이다. "지금 무엇이 있어야 하나"만 보고 있으면 두고 없으면 만든다.
- 꺼지면 `dispose()` 가 만든 것을 전부 치운다.
- 주입 UI 는 Shadow DOM 안에 둔다. 스타일은 `src/platform/design/` 의 토큰과 조각 CSS 를 쓴다. 직접 쓰지 말고 `design/` 을 고친 뒤 `npm run design:sync` 로 뽑는다.
- 사이트 선택자는 `data-testid`, `aria-*`, `role` 같은 **의미 있는 속성**으로 잡는다. 빌드마다 바뀌는 해시 클래스는 쓰지 않는다.
- 페이지 내부 객체(ProseMirror, Vue 인스턴스 등)는 content script 에서 보이지 않는다. MAIN world 스크립트와 `src/platform/editor/` 의 브리지 방식을 따른다.

## 네트워크는 예외다

기본은 **이미 그려진 화면만 읽고 쓰는 것**이다. API 는 DOM 으로 안 될 때만 쓰고, 그런 기능은 특별 관리한다.

| 규칙 | 내용 |
| --- | --- |
| 표시 | 카탈로그 `usesNetwork: true`. Popup 에 배지가 뜬다 |
| 범위 | GET 만. 쓰기가 필요해지면 그때 따로 결정한다 |
| 시점 | 사용자가 그 기능을 실제로 쓸 때만. 화면을 연 것만으로는 요청하지 않는다 |
| 대상 | 그 사이트 오리진의 상대 경로(`/rest/…`)만. 세션 쿠키를 쓰고 토큰을 저장하지 않는다 |
| 문서 | `spec/features/` 에 어떤 요청을 언제 보내는지 적는다 |

테스트가 이 규칙을 지킨다. 네트워크 호출은 `src/sites/jira/api/` 밖에 두면 `tests/unit.test.ts` 가 깨진다. 자리를 늘리려면 테스트의 `ALLOWED` 와 카탈로그 표시를 함께 고친다.

## 새 기능을 넣는 순서

1. 기존 사이트에 넣을지, 새 사이트를 만들지 정한다. 묶음 단위는 **사이트**다(`SiteId`, `SiteDescriptor`).
2. 여러 단계짜리면 코드보다 먼저 `docs/plans/<slug>/` 에 `spec.md` · `context.md` · `checklist.md` 를 쓴다.
3. **카탈로그 → 설정 기본값 → 사이트 런타임 → spec → README** 순서로 넣는다.
4. 새 용어를 만들거나 이름을 바꾸면 `docs/glossary/README.md` 를 먼저 고치고 코드를 맞춘다.
5. 기능 이름을 바꿔도 **기능 ID 는 저장 키라 유지한다**(예: '클릭 편집 방지'의 ID 는 `descriptionEditLock`).

## 검증

- 완료를 말하기 전에 `npm run check` 를 돌리고 결과를 함께 보인다. 사이트 동작이 바뀌었으면 `npm run test:e2e` 도 돌린다.
- e2e 는 가짜 화면이다. 실제 사이트에서 확인한 것과 섞어 보고하지 않는다.
- **실제 사이트를 확인하는 도중에는 `dist/` 를 다시 빌드하지 않는다.** 청크 해시가 바뀌어 로드된 확장이 깨진다. 빌드했으면 사용자가 `chrome://extensions` 에서 ↻ 해야 한다.
- 실측할 때 금지하는 것: 아마란스·Jira 출퇴근 버튼 클릭, Confluence 발행, Jira 업무 실제 생성(모달은 버리기로 닫는다). 조사하다 바꾼 초안은 원래대로 되돌린다.
- 원인 찾는 데 시간이 걸린 오류는 `docs/troubleshootings/` 에 남긴다. 원인이 라이브러리·런타임·OS 에 있으면 `reusable/`, 이 저장소의 코드·설정에 있으면 `project-specific/`. 조사 기록(고장 난 것이 없는 분석)은 `docs/` 바로 밑에 둔다.

## Git

| 항목 | 규칙 |
| --- | --- |
| 작성자 | `정재원/AI BE개발 챕터/II <JeongJaew0n@users.noreply.github.com>` (`git config --local`). 커밋 전 `git config user.email` 로 확인한다 |
| 브랜치 | `develop` 에서 작업한다. `main` 에 직접 커밋하지 않고, 릴리즈 때만 fast-forward 로 올린다 |
| 커밋 | 작업 단위가 끝나면 **자동으로 커밋**한다. 한 커밋에 한 가지 일만 넣는다 |
| 푸시 | **사용자 확인을 받는다** |
| 예외 | 코드 리뷰, 리뷰 문서, 리뷰에서 나온 수정은 자동 커밋하지 않는다. 사람이 읽고 판단한 뒤 커밋한다 |

## 버전과 릴리즈

- `0.x.x` 에 머문다. `1.0.0` 은 올리지 않는다.
- 기능 추가나 호환이 깨지는 변경은 MINOR(`0.13.0 → 0.14.0`), 버그 수정과 내부 정리는 PATCH(`0.14.0 → 0.14.1`).
- 정본은 `package.json` 의 `version` 이다. `package-lock.json` 과 `manifest.json` 은 릴리즈 절차가 맞춘다. **릴리즈 밖에서 이 세 파일의 버전을 손대지 않는다.**
- 릴리즈는 `.codex/skills/extension-release/` 절차를 따른다. 버전 결정, 패키징, 태그, GitHub Release 발행까지 포함한다. 공개한 태그와 ZIP 은 고치지 않는다.
