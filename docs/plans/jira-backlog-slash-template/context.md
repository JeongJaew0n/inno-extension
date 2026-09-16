# 백로그 슬래시 템플릿 — 배경과 실측

## 요청

Jira 백로그에서 업무를 추가할 때, 입력 중 `/`를 치면 미리 만들어 둔 문구 목록이 뜨고 골라서
넣고 싶다. Claude Code의 슬래시 명령과 비슷한 UX다.

- `/`만 치면 전부 보인다 — `[공통]`, `[DevOpsit][BE]`, `[DevOpsit]`
- `/Dev`까지 치면 `[DevOpsit][BE]`, `[DevOpsit]`만 보인다

## 측정 환경

| 항목 | 값 |
| --- | --- |
| 측정일 | 2026-09-16 |
| 대상 | `NPT` 보드 2145 백로그 |
| 방법 | 인라인 생성 입력창을 열어 값 주입을 시험. **Enter를 누르지 않아 이슈는 만들지 않았다** |

## 1. 입력창의 정체

백로그 하단 `만들기`를 누르면 인라인 입력이 열린다.

| 항목 | 값 |
| --- | --- |
| 요소 | **`<input>`** (평범한 단일 행 입력) |
| `aria-label` | `Work item summary` — **UI가 한글인데 이 값은 영문**이다 |
| `maxlength` | `255` |
| React | `__reactProps`에 `onChange`·`onKeyDown` 보유 = **controlled input** |

**Confluence와 다르다.** 그쪽은 ProseMirror라 MAIN world 브리지가 필요했지만, 여기는 그냥
`<input>`이다. 값 주입 난이도가 훨씬 낮다.

### 조상 `data-testid`

```text
software-backlog.card-list.container.BACKLOG
└ software-backlog.card-list.accordion
  └ onboarding-nudges.ui.scrum-onboarding-tour.backlog-nudge-container...
    └ <input aria-label="Work item summary">
```

입력창 자체에는 `data-testid`가 없다. 앵커는 `aria-label` 또는 조상 컨테이너를 쓴다.

## 2. 값 주입이 된다 — React 상태까지 갱신됨

controlled input은 DOM 값만 바꾸면 다음 렌더에서 되돌아간다. 그래서 **React가 실제로 상태를
받았는지**가 관건이다.

| 시험 | 결과 |
| --- | --- |
| `el.value = ...` + `input` 이벤트 | 값 유지 |
| **native setter + `input` 이벤트** | 값 유지 |
| **React가 인식한 값** (`__reactProps.value`) | **주입값과 일치** |
| blur → focus 후 | **값 유지** |

```js
const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
setter.call(input, '[공통] 확인');
input.dispatchEvent(new Event('input', { bubbles: true }));
// → input.value === '[공통] 확인'
// → reactProps.value === '[공통] 확인'   ← React 상태까지 갱신됨
```

`blur`/`focus`로 리렌더를 유발해도 값이 남았다. **React가 state로 들고 있다는 뜻이다.**
Enter를 누르면 이 값이 그대로 제출된다.

> native setter를 쓰는 이유는 React의 합성 이벤트가 값을 그 setter를 통해 읽기 때문이다.
> 이번 측정에서는 순진한 대입도 통했지만, React 버전·구현에 따라 달라지는 부분이라
> **표준 우회인 native setter를 쓰는 것이 안전하다.**

## 3. `/`는 비어 있다 — Jira가 쓰지 않는다

입력창에 `/`를 넣고 `keydown`까지 보냈다.

| 항목 | 결과 |
| --- | --- |
| Jira 자체 팝업 | **0개** |
| 입력값 | `/` 그대로 유지 |

**Jira는 이 입력창에서 `/`에 아무 동작도 걸어두지 않았다.** 충돌 없이 쓸 수 있다.

Confluence 편집기의 `/` 슬래시 명령과는 다른 화면이다. 그쪽은 ADF 편집기라 자체 슬래시
메뉴가 있지만, 백로그 인라인 생성은 평범한 `<input>`이다.

## 4. 같은 입력창이 여러 곳에 있다

`software-backlog.card-list.container.BACKLOG`처럼 카드 리스트마다 컨테이너가 있다. 스프린트
영역에도 같은 인라인 생성이 있을 것으로 보이나 **확인하지 않았다.**

## 5. 확인하지 못한 것

- **스프린트 영역의 인라인 생성**이 같은 구조인지. 백로그 영역만 측정했다.
- **보드 화면**(`/boards/2145`)에도 같은 입력이 있는지.
- `aria-label`이 사용자 언어 설정에 따라 바뀌는지. 현재 UI는 한글인데 이 값만 영문이라
  locale과 무관해 보이지만 다른 언어 설정에서 확인하지 못했다.
- Enter 제출 경로에서 값이 실제로 그대로 들어가는지. **이슈를 만들지 않으려고 시험하지 않았다.**
- IME(한글 입력) 조합 중 `/` 입력이 어떻게 들어오는지.

## 6. 관련 자료

- `src/sites/jira/` — 현재 Jira 기능
- `docs/plans/confluence-magic-button/context.md` — ProseMirror 입력을 다룬 사례. 이번 건은
  그보다 훨씬 단순하다는 대조군
