# Jira 새 보드에서 제목 복사·스프린트 버튼이 안 나온다 — 주소와 보드 구조가 바뀌었다

관측: 2026-11-03 · 확장 0.17.1 · 로그인된 Jira(pms-innogrid) · ego-browser 로 DOM 실측

## 증상

사용자 보고(원문):

> 지금 jira가 업데이트 되서 그런지 '활성 스프린트'에서 업무를 클릭했을 때 제목 복사도 안나오고, 스프린트 버튼도 안나오는 것 같아.

- 활성 스프린트 보드에서 업무를 눌러 모달을 열어도 제목·링크 복사 버튼이 없다
- 보드 상단에 지난 스프린트 선택기(`스프린트 ▾`)와 활성 스프린트 정보 칩이 없다
- 기능이 **시작조차 하지 않는다.** 주소가 보드 패턴에 안 맞으면 `reconcile` 첫 줄에서 아무 말 없이 빠진다(코드)

## 원인 `[확정]`

Jira 가 활성 스프린트 보드를 새 구현으로 바꿨다. 기능이 기대던 것 네 가지가 한꺼번에 바뀌었다.

| 기대던 것 | 예전 | 지금(실측) |
| --- | --- | --- |
| 보드 주소 | `/jira/software/c/projects/NPT/boards/2147` | `/jira/software/projects/NPT/boards/2147` — **`c/` 가 없다**. 백로그는 여전히 `c/` 주소 |
| 보드 상단 | `software-board.header.controls-bar` | 없다. 보드 grid(`header` · `content` · `sidebar` 칸)의 header 칸 요소(`display: flex; flex-wrap: wrap`)에 필터가 있다 |
| 보드 본문 | `software-board.board-area` | 없다. `board.content.board-wrapper`(position: relative, 1272×618) |
| 보드 상태 | `window.SPA_STATE.UIF_BOARD` | 없다. Relay(GraphQL) 저장소에 있다 — `page-layout.main` 의 React fiber 에서 142단계 올라간 provider 의 `environment` |

**첫 줄 하나로 보고된 두 증상이 다 설명된다.** `routes.ts` 의 보드 패턴이 `c/` 를 꼭 요구해서
`parseJiraBoardUrl` 이 `null` 을 돌려줬고, 그 결과로 보드에 붙는 기능(업무 링크 복사의 보드 모달 경로,
스프린트 선택기, 스프린트 정보)이 모두 `reconcile` 첫 줄에서 빠져나갔다. 주소만 고쳤다면 나머지
셋 때문에 스프린트 버튼은 여전히 안 나왔을 것이다.

### Relay 저장소에서 읽히는 것

| 레코드 | 필드 | 비고 |
| --- | --- | --- |
| `JiraBoardView` | `board`(→ JiraBoard) · `sprints`(→ 연결 → `edges` → `node`) | Kanban(보드 106)은 `sprints: null` |
| `JiraBoard` | `boardId`(숫자) · `boardType`(`SCRUM` · `KANBAN`) | |
| `JiraSprint` | `id`(ARI, 끝이 스프린트 번호) · `name` | ARI 끝 번호가 REST 의 활성 스프린트 id 와 같았다(보드 2064: 2250) |

`JiraSprint` 의 `startDate` · `endDate` · `goal` · `activeWorkingDaysRemaining` 은 사용자가 Jira 의
`스프린트 세부 정보` 를 연 **뒤에만** 생긴다. 그래서 새 보드에서는 네트워크 없이 기간을 보여줄 수 없다.

### 남은 일수

Agile REST(`/rest/agile/1.0/board/{id}/sprint`)에는 남은 일수가 없다. Jira 가 센 값을 세 군데서 비교했다.

| 스프린트 | `/rest/greenhopper/1.0/gadgets/sprints/remainingdays` | Jira 팝업 | Relay `activeWorkingDaysRemaining` |
| --- | --- | --- | --- |
| 진행 중(보드 2064, 끝 11-09 00:00 KST, 측정 11-03 화 11:34) | `{"days":3}` | `3일 남음` | 3 |
| 끝난 날이 지남(보드 2147) | `{"days":0}` | `0일 남음` | 0 |

화요일 오전에 끝이 다음 월요일 0시면 평일은 화~금 넷인데 Jira 는 3 이다. 오늘을 빼는지, 남은 시간을
내림하는지는 표본 하나로 가릴 수 없다 `[미정]`. 그래서 우리가 세지 않고 Jira 값을 받는다.

## 전수 조사 — Jira 기능 12개

DOM 실측으로 각 기능이 기대는 선택자·구조가 지금도 있는지 봤다. **확장 자체를 실제 Jira 에서 돌려 본
것이 아니다**(ego-browser 에는 확장을 올리지 못했다). 확장 동작은 e2e(가짜 화면)로 확인했다.

| 기능 | 결과 | 원인 · 조치 |
| --- | --- | --- |
| 업무 링크 복사 | **고장** — 보드 모달 | 주소 `c/`. 업무 화면(`/browse/…`) · 백로그 미리보기는 정상 |
| 지난 스프린트 보기 | **고장** | 주소 · 컨트롤 바 · board-area · SPA_STATE. 모달 열기(`selectedIssue` + `popstate`)는 새 보드에서도 동작했다 |
| 활성 스프린트 정보 | **고장** | 위와 같음 + 새 보드는 페이지에 날짜가 없다 |
| 설명 Markdown 복사 · 클릭 편집 방지 · 설명 편집 버튼 | **부분 고장** | `설명` 라벨이 글자뿐인 `h2` 가 됐다. 버튼이 제목 안으로 들어간다(아래) |
| 업무 생성 날짜 단축 | **고장** | 날짜 필드가 pill 버튼이 됐다(아래) |
| 설명·댓글 Markdown 변환 | 정상 · 보드 모달의 업무 키만 주소 영향 | 편집기 · 툴바 선택자 그대로 |
| 댓글 Markdown 복사 | 정상 | 댓글 · 동작 줄 선택자 그대로 |
| 업무 모달 전체 폭 | 정상 | 모달 positioner · 최소화 버튼 그대로 |
| 백로그 prefix 태그 | 정상 | 백로그 인라인 생성 입력창 그대로, 주소도 `c/` 그대로 |
| 업무 생성 템플릿 삽입 | 정상 | 생성 모달 설명 편집기(ProseMirror) 그대로 |

### 설명 라벨

```
예전  div[description.label](block) > div(flex 줄) > h2 "설명"
지금  div[heading-wrapper](flex) > div[heading-with-draft](flex, gap 8px) > h2[description.label] "설명"
```

라벨에 자식이 없으면 라벨 자체를 줄로 쓰는 규칙 때문에 버튼이 `h2` 안에 들어갔다. e2e 에서 새 구조를
흉내 내면 클릭 편집 방지가 `insertBefore` 에서 `HierarchyRequestError` 로 실패했다(실제 Jira 에서
같은 오류가 났는지는 보지 못했다 `[미정]`).

### 업무 생성 모달의 날짜

| | 예전 | 지금 |
| --- | --- | --- |
| 보이기 | `더 보기` → `추가 필드` 를 펼쳐야 마운트 | 처음부터 pill 버튼으로 보인다 |
| 라벨 | `<label>시작 날짜</label>` | 없다. 버튼(`issue-create-commons.ui.pill-date-field.date-trigger`) 글자가 `시작 날짜` |
| 값을 넣은 뒤 | 라벨 그대로 | 버튼 글자가 `2026년 11월 03일` 로 **바뀐다** |
| 달력 | `Next month, 12월 2026` · 날짜 칸 aria-label `3, 화요일 11월 2026` | 같다. 고른 뒤 닫히지만 내용은 DOM 에 남는다 |

예전 코드는 라벨을 못 찾아 `더 보기` 를 누르고, 없는 `추가 필드` 를 4초 기다린 뒤 실패했다.
실제 모달에서 같은 순서(트리거 click → 다음 달 → 날짜 칸 click)로 시작 날짜 · 기한과 두 번째 실행을
확인했다. 모달은 `버리기` 로 닫았다 — 업무는 만들지 않았다.

## 해결

| 커밋 | 무엇을 |
| --- | --- |
| `fix(jira): 새 보드 주소(c/ 없음)도 보드로 알아본다` | 보드 패턴이 `c/` 를 선택으로 받는다 |
| `fix(jira): 새 보드에도 우리 도구 줄과 지난 스프린트 패널 자리를 찾는다` | 도구 줄을 header 칸 맨 끝에 `flex-basis: 100%` 로, 패널은 board-wrapper 위에 |
| `fix(jira): 새 보드는 Relay 저장소에서 스프린트 상태를 읽는다` | 보드 종류(Kanban 판정)와 활성 스프린트 이름 |
| `feat(jira): 활성 스프린트 정보 — 새 보드에서는 칩을 누를 때 읽는다` | 사용자 결정 '칩을 눌렀을 때만 읽기'. Agile REST + Jira 가 센 남은 작업일, GET 2번 |
| `fix(jira): 설명 버튼을 새 제목 줄(heading-with-draft)에 붙인다` | 라벨에 자식이 없고 부모가 flex 면 부모를 줄로 |
| `fix(jira): 업무 생성 모달의 새 날짜 pill 에도 오늘부터 시작을 넣는다` | pill 글자를 라벨로, 못 찾으면 필드 ID 로 |

예전 구조를 받는 길은 지우지 않았다. 둘 다 받는다.

## 재발 방지

- e2e 에 새 구조 픽스처를 넣었다 — 새 보드(스크럼 · Kanban, Relay 저장소 흉내), 새 설명 제목 줄,
  pill 생성 모달. 각 수정을 되돌리면 해당 검사가 실패하는 것을 확인했다.
- 단위 테스트: 두 주소 형태, Relay 읽기, 칩 상태, 스프린트 API 경로와 `GET`.
- **이번에 조용했던 이유**: 주소가 안 맞으면 기능이 아무 말 없이 빠진다. 보드 화면인데 패턴이 안 맞는
  경우를 알릴지는 열어 둔다 `[미정]` — 알림이 많아지면 그것도 소음이다.

## 남은 것

- 확장을 실제 Jira 에서 돌려 확인하는 것 `[미정]` — 빌드 후 `chrome://extensions` 에서 ↻ 하고
  새 보드에서 ① 업무 모달의 제목·링크 복사 ② `스프린트 ▾` 와 패널 ③ `스프린트 정보` 칩 클릭
  ④ 업무 화면의 설명 버튼 자리 ⑤ 생성 모달의 `오늘부터 시작` 을 본다
- 활성 스프린트가 여럿인 보드에서 Relay 연결 모양 `[미정]`
- 남은 일수 API 는 공개 문서에 없다. 사라지면 남은 일수만 빠진다
