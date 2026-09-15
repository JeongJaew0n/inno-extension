# Jira 업무 모달 전체 폭 — 배경과 실측

## 요청

보드에서 업무를 열면 뜨는 상세 모달을 **브라우저 화면 전체 폭**으로 보고 싶다. 모달 우상단
버튼 그룹에는 눈 모양·공유·`...`·화살표·`x`뿐이고 전체 화면 버튼이 없다.

- Jira가 기본으로 제공하는 기능이 있는지
- 없다면 구현 방법

## 측정 환경

| 항목 | 값 |
| --- | --- |
| 측정일 | 2026-09-15 |
| 대상 | `NPT` 보드 2145, 업무 `NPT-480` |
| 뷰포트 | 1920 × 929 |

## 1. 모달의 DOM 구조

```text
DIV  role="presentation"                                    1920px   오버레이
└ DIV                                          max-width:1800px      바깥 컨테이너
  └ SECTION role="dialog"                      width:1280px          ← 모달 본체
      data-testid="issue.views.issue-details.issue-modal.modal-dialog"
      max-width:1800px
    └ DIV  data-testid="issue.views.issue-details.issue-layout..."   1280px
      ├ ...left-most-column                                          928px
      └ ...issue-view-layout (우측 필드)                              270px
```

**모달은 `width: 1280px`로 고정돼 있다.** `max-width`가 `1800px`이므로 여유가 있는데도 쓰지
않는다. 바깥 컨테이너가 1800px에서 다시 한 번 막는다.

뷰포트 1920 기준으로 좌우 320px씩 남는다.

### 선택자 안정성

| 선택자 | 안정성 |
| --- | --- |
| `[data-testid*="issue-modal.modal-dialog"]` | **쓸 수 있다.** 다만 같은 testid가 **3개** 붙어 있다(오버레이·컨테이너·dialog). `role="dialog"`로 좁혀야 한다 |
| `[data-testid*="issue.views.issue-details.issue-layout"]` | 쓸 수 있다 |
| `._1bsb1osq` 같은 원자 클래스 | **쓰면 안 된다.** Atlassian 컴파일 CSS의 해시 클래스라 빌드마다 바뀐다 |

## 2. 우상단 버튼 그룹의 정체

| 순서 | 라벨 | `data-testid` |
| --- | --- | --- |
| 1 | 관찰 옵션 (눈) | `issue.watchers.action-button.root` |
| 2 | Share | `share-dialog.ui.share-button` |
| 3 | 작업 (`...`) | `issue-meatball-menu.ui.dropdown-trigger.button` |
| 4 | **사이드바로 전환** | `issue-view-fou…` |
| 5 | 닫기 | — |

사용자가 "화면줄이기(화살표)"로 본 것은 **`사이드바로 전환`**이다. 모달을 더 **좁은** 사이드바로
바꾸는 버튼이지 전체 화면 토글이 아니다.

## 3. `작업(...)` 메뉴 전수

```text
작업 로그 · 명령 팔레트 열기 · 사이드바에서 업무 항목 열기 · 플래그 추가 · 투표 추가 ·
커버 선택 · 하위 작업으로 전환 · 복제 · 이동 · 보관 · 삭제 · Easy Clone ·
Connect Slack channel · 인쇄 · Excel 내보내기 · Word 내보내기 · XML 내보내기
```

**전체 화면·확대·최대화에 해당하는 항목이 없다.**

## 4. Jira가 제공하는 대안과 그 한계

| 방식 | 레이아웃 폭 | 본문 컬럼 | 우측 필드 | 보드 유지 |
| --- | --- | --- | --- | --- |
| **모달 (현재)** | 1280 | 928 | 270 | 예 |
| 사이드바로 전환 | 더 좁음 | — | — | 예 |
| **전체 페이지** `/browse/NPT-480` | **1680** | **1041** | **553** | **아니오** |

전체 페이지 뷰가 가장 넓지만 **보드를 벗어나고, 그래도 뷰포트 전체(1920)는 아니다.** 240px이
남는다.

**결론: Jira에 모달을 전체 폭으로 넓히는 기능은 없다.**

## 5. CSS 덮어쓰기 실측

두 규칙을 주입하고 되돌리는 실험을 했다.

```css
[data-testid*="issue-modal.modal-dialog"] { width: 100vw !important; max-width: 100vw !important; }
section[role="dialog"][data-testid*="issue-modal.modal-dialog"] { width: 100vw !important; max-width: 100vw !important; }
```

| 요소 | 적용 전 | 적용 후 | 되돌린 뒤 |
| --- | --- | --- | --- |
| dialog | 1280 | **1920** | 1280 |
| 바깥 컨테이너 | 1800 | 1920 | 1800 |
| 레이아웃 | 1280 | **1920** | 1280 |
| 본문 좌측 컬럼 | 928 | **1568** | — |
| 우측 필드 컬럼 | 270 | **270** | — |

**동작하고, 깔끔하게 되돌아간다.** JavaScript 없이 CSS만으로 폭이 바뀐다.

### 주의: 우측 필드 컬럼은 안 늘어난다

모달을 1920으로 넓혀도 우측 필드 컬럼은 **270px 그대로**다. 남는 폭을 본문이 전부 가져간다.
전체 페이지 뷰의 553px와 비교하면 좁다. 필드 값이 길면 줄바꿈이 심해질 수 있다.

## 6. 확인하지 못한 것

- 우측 필드 컬럼을 함께 넓혔을 때의 레이아웃 붕괴 여부. 폭만 쟀고 시각적으로 검토하지 않았다.
- 다른 뷰포트 폭(노트북 1440 등)에서 모달 폭이 어떻게 계산되는지. 1920에서만 측정했다.
- 백로그 화면·사이드 패널 등 보드 외 진입 경로에서도 같은 구조인지.

## 7. 관련 자료

- `docs/jira-board-2146-chrome-extension-analysis.md` — 같은 Jira의 보드 DOM 분석 선례
- `docs/jira-preview-panel-button-mount-analysis.md` — 사이드 패널 진입 경로 분석
- `src/sites/jira/` — 현재 Jira 기능 구현
