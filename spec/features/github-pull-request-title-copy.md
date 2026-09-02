# PR 제목 링크 복사

- 사이트: GitHub Enterprise (`github.nhnent.com`)
- 기능 ID: `pullRequestTitleCopy`
- 기본값: ON

## 목적

PR을 다른 문서나 메신저에서 참조할 때 제목과 주소를 각각 복사해 붙이는 과정을 없앤다. 한 번의 클릭으로 제목과 링크가 함께 담긴 Markdown 링크를 만든다.

## 적용 조건

- GitHub Enterprise 서비스 전체 기능이 ON이다.
- `PR 제목 링크 복사` 기능이 ON이다.
- 대상 origin이 `https://github.nhnent.com`이다.
- 다음 두 화면 중 하나다.

```text
/{owner}/{repo}/pulls              저장소 PR 목록
/{owner}/{repo}/pull/{번호}         PR 상세
/{owner}/{repo}/pull/{번호}/files   PR 상세 하위 탭도 같은 PR로 취급
```

전역 PR 대시보드 `https://github.nhnent.com/pulls`는 목록과 DOM 구조가 같지만 적용 범위에 포함하지 않는다. 저장소 문맥이 없는 화면까지 넓히지 않기 위한 결정이다.

`/issues` 등 PR이 아닌 목록은 대상이 아니다.

## 사용자 경험

제목 옆에 버튼 두 개를 표시한다.

| 버튼 | 아이콘 | 복사 결과 |
| --- | --- | --- |
| PR 제목 Markdown 링크 복사 | clipboard | `[제목](URL)` |
| PR 제목만 복사 | 텍스트 기호 | `제목` |

두 버튼은 각자 피드백 타이머를 갖는다. 한쪽을 눌러 체크 표시가 떠 있는 동안 다른 쪽을 눌러도 서로의 표시를 되돌리지 않는다.

| 화면 | 버튼 위치 |
| --- | --- |
| PR 목록 | 각 행의 제목 링크 오른쪽 |
| PR 상세 | 제목 오른쪽 |

버튼은 clipboard 아이콘만 표시하는 26x26 정사각 버튼이다. 클릭하면 복사 후 1.5초간 체크 아이콘으로 바뀌고 원래 아이콘으로 돌아온다. 복사에 실패하면 X 아이콘을 같은 시간 동안 표시한다.

목록의 버튼은 제목 링크 안쪽 흐름에 놓이므로 클릭 시 PR로 이동하지 않도록 기본 동작과 전파를 모두 막는다.

## 클립보드 계약

### PR 제목만 복사

plain text 한 가지만 기록한다. 화면에 보이는 제목 그대로다.

```text
#II-SL-CloudStation-Veritas-BE/411: [CloudStation] 관리 기능 API 개발
```

- 앞뒤 공백을 제거하고 연속 공백을 하나로 합친다.
- **Markdown 이스케이프를 하지 않는다.** 링크가 아니므로 `[`, `]`를 그대로 둔다. 이것이 링크 복사와의 핵심 차이다.
- 저장소 접두사(`#II-SL-...BE/411:`)도 제목의 일부이므로 떼어내지 않는다.

### PR 제목 Markdown 링크 복사

plain text 한 가지만 기록한다.

```text
[PR 제목](https://github.nhnent.com/{owner}/{repo}/pull/{번호})
```

- 제목의 앞뒤 공백을 제거하고 연속 공백을 하나로 합친다.
- 제목의 `[`, `]`, `\`는 `\`로 이스케이프한다. GitHub PR 제목에는 `[CloudStation]` 같은 대괄호 접두사가 흔해 이스케이프하지 않으면 링크 구조가 깨진다.
- URL에 괄호나 공백이 있으면 `<...>`로 감싼다.
- 목록의 제목 링크는 상대 경로이므로 origin을 붙여 절대 URL로 만든다.
- 쿼리 문자열과 fragment는 제거한다. `?diff=split#r12345` 같은 조회 상태는 공유 대상이 아니다.

Jira `업무 링크 복사`와 달리 `text/html` 리치 링크는 기록하지 않는다. 이 기능의 결과물은 Markdown 문서에 붙여넣는 용도이기 때문이다.

## 기술적 맥락과 제약

### DOM 계약

| 대상 | selector |
| --- | --- |
| 목록 행 | `.js-issue-row` |
| 목록 제목 링크 | `a[data-hovercard-type="pull_request"]` |
| 상세 제목 | `bdi.js-issue-title` |

상세 화면에는 `.js-issue-title`이 두 개 있다. 하나는 본문 제목 `bdi`이고, 다른 하나는 스크롤 시 나타나는 sticky 헤더의 `a`다. `bdi`로 좁혀야 sticky 헤더에 버튼이 중복으로 붙지 않는다.

### Turbo 캐시 복원

GitHub Enterprise는 Turbo를 사용한다. Turbo는 DOM 스냅샷을 캐시했다가 복원하며, 이때 확장이 삽입한 host가 **클릭 리스너 없이 되살아난다**. 복원된 host는 `isConnected`가 `true`이고 속성도 그대로여서 DOM 속성만으로는 정상 host와 구분할 수 없다.

그래서 이 기능은 런타임이 직접 만든 host만 `WeakSet`에 담고, 재조정 시 그 집합에 없는 host는 신뢰하지 않고 제거한 뒤 다시 만든다.

### 스타일

host는 Shadow DOM을 사용하고 `style.all = 'initial'`로 페이지 스타일 상속을 끊는다. CSS 커스텀 속성은 `all: initial`과 shadow 경계를 그대로 통과하므로, GitHub의 Primer 변수(`--fgColor-muted`, `--bgColor-muted`, `--borderColor-default`, `--fgColor-success`)를 그대로 사용해 테마를 따라간다. 변수가 없는 환경을 위해 리터럴 fallback을 함께 둔다.

현재 사내 GHE는 라이트 테마로 고정돼 있어 다크 테마 실측은 하지 못했다.

## 설정과 기본값

| 항목 | 값 |
| --- | --- |
| 서비스 기본값 | ON |
| 기능 기본값 | ON |
| 추가 옵션 | 없음 |

## 실패와 복구

| 상황 | 동작 |
| --- | --- |
| 클립보드 API 거부 | 공용 `writePlainText()`가 textarea 방식으로 대체 시도 |
| 대체까지 실패 | 버튼에 X 아이콘을 1.5초간 표시 |
| 제목이 비어 있음 | 버튼을 만들지 않는다 |
| PR 링크를 정규화하지 못함 | 해당 행을 건너뛴다 |
| 지원 화면이 아님 | 기존 host를 모두 제거한다 |

## 수용 기준

- 저장소 PR 목록의 모든 행에 버튼이 하나씩 표시된다.
- PR 상세에 버튼이 하나만 표시된다. 스크롤로 sticky 헤더가 나타나도 늘어나지 않는다.
- 버튼 클릭이 PR 이동을 유발하지 않는다.
- 복사 결과를 Markdown 편집기에 붙여넣으면 제목이 링크로 표시된다.
- 대괄호가 포함된 제목도 링크 구조가 깨지지 않는다.
- 전역 대시보드 `/pulls`에는 버튼이 표시되지 않는다.

## 검증 기준

- 자동화 테스트가 route 판정, URL 정규화, Markdown 이스케이프를 검증한다.
- 실제 화면에서의 버튼 표시와 복사 동작은 수동 확인이 필요하다.

## 알려진 리스크와 열린 질문

- `.js-issue-row`, `data-hovercard-type`, `bdi.js-issue-title`은 GitHub 내부 마크업이다. GHE 버전이 올라가면 바뀔 수 있다.
- 전역 PR 대시보드를 지원 범위에 넣을지는 사용 관찰 후 결정한다.
- 다크 테마에서의 대비는 실측하지 못했다.
- Turbo 복원 시 버튼이 잠깐 사라졌다 다시 생기는 과정이 눈에 띄는지 확인이 필요하다.

## 변경 이력

- 2026-08-25: `inje-chrome-extension`의 GitHub Enterprise PR 제목 복사 기능을 이관했다. 공용 런타임 계약(`reconcile`/`dispose`), Shadow DOM 격리, 공용 클립보드 헬퍼에 맞춰 재작성했고 PR 상세 화면 지원과 Markdown 이스케이프를 추가했다.
- 2026-09-02: 제목만 평문으로 복사하는 두 번째 버튼을 추가했다. 별도 기능으로 분리하지 않고 같은 host에 버튼을 더했다. 두 기능이 같은 앵커에 각자 host를 붙이면 `findExistingHost()`가 서로의 host 때문에 자기 것을 찾지 못해 매 reconcile마다 재생성되기 때문이다.

## 관련 자료

- [제품 개요](../product-overview.md)
- [용어사전](../glossary.md)
