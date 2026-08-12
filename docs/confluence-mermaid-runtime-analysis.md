# Confluence Mermaid 동작 방식 분석

- 분석 대상: <https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/2177630217/DevOpsit+CCP>
- 분석 일자: 2026-08-11, 실패 재검증 2026-08-12 (Asia/Seoul)
- 분석 범위: 대상 페이지의 Mermaid 매크로 저장 구조, 편집 UX, 조회 화면 렌더링 방식, 오류 처리
- 분석 방법: 로그인된 Chrome에서 조회·편집 화면과 Forge iframe을 관찰하고, 동일 페이지의 ADF를 교차 확인했다.

## 1. 결론

대상 Confluence 환경의 Mermaid는 Confluence 기본 코드 블록이 직접 다이어그램을 그리는 방식이 아니다. `Mermaid diagram`이라는 별도 Forge 매크로가 같은 페이지에 있는 코드 블록 하나를 선택하고, 선택한 코드 블록의 텍스트를 Mermaid 라이브러리로 변환해 SVG로 표시한다.

핵심 구조는 다음과 같다.

```text
ADF codeBlock 목록
  └─ codeBlock[n]의 일반 텍스트
       ↓ guestParams.index = n
ADF extension 노드: Mermaid diagram
       ↓ Confluence Forge 런타임
Atlassian CDN의 Custom UI iframe
       ↓ Mermaid 11.15.0
인라인 SVG 또는 문법 오류 화면
```

따라서 Markdown의 `mermaid` fence를 ADF `codeBlock` 하나로 변환하는 것만으로는 이 페이지에서 본 것과 같은 다이어그램이 되지 않는다. 코드 블록과 별도로 Forge 매크로 `extension` 노드가 필요하다.

## 2. 구성 요소

### 2.1 원본: 일반 ADF 코드 블록

Mermaid 매크로가 렌더링할 원문은 별도의 ADF `codeBlock`에 있다. 대상 페이지에는 총 11개의 코드 블록이 있고 언어는 대부분 `plaintext`, 하나는 `shell`로 저장되어 있었다.

중요한 점은 Mermaid 소스가 매크로의 ADF 노드 안에 중복 저장되지 않는다는 것이다. 매크로는 코드 블록의 텍스트를 직접 가지지 않고 코드 블록 목록의 순번만 가진다.

### 2.2 렌더러: Forge extension 노드

대상 페이지에는 아래 식별자를 사용하는 `extension` 노드가 두 개 있다.

| 항목 | 확인값 |
| --- | --- |
| ADF node type | `extension` |
| extension type | `com.atlassian.ecosystem` |
| extension title | `Mermaid diagram` |
| Forge 환경 | `PRODUCTION` |
| Forge app ID | `23392b90-4271-4239-98ca-a3e96c663cbb` |
| module ID | `63d4d207-ac2f-4273-865c-0240d37f044a` |
| extension module | `static/mermaid-diagram` |

저장 형태를 필요한 필드만 남겨 단순화하면 다음과 같다.

```json
{
  "type": "extension",
  "attrs": {
    "layout": "default",
    "extensionType": "com.atlassian.ecosystem",
    "extensionKey": "23392b90-4271-4239-98ca-a3e96c663cbb/63d4d207-ac2f-4273-865c-0240d37f044a/static/mermaid-diagram",
    "text": "Mermaid diagram",
    "parameters": {
      "guestParams": {
        "index": 8
      },
      "forgeEnvironment": "PRODUCTION",
      "extensionTitle": "Mermaid diagram"
    },
    "localId": "63f13912-e5c4-47ce-9c47-bb485fab29c1"
  }
}
```

실제 ADF에는 Confluence 페이지·스페이스·Forge 실행 문맥도 포함되지만 위 구조가 Mermaid 선택과 렌더링을 설명하는 핵심이다.

### 2.3 코드 블록 연결 방식

`parameters.guestParams.index`는 페이지 안 코드 블록 목록의 0부터 시작하는 순번이다.

| Mermaid 매크로 | `guestParams.index` | 편집 화면 표시 | 실제 참조 대상 |
| --- | ---: | --- | --- |
| 첫 번째 | `8` | `9. git init ...` | 아홉 번째 `shell` 코드 블록 |
| 두 번째 | `9` | `10. SVC ...` | 열 번째 `plaintext` 코드 블록 |

ADF의 index와 편집 화면의 번호·원문이 정확히 일치하므로 0-based index임을 확인할 수 있다. 코드 블록 `localId`를 참조하는 방식은 아니다.

이 방식은 코드 블록을 매크로보다 앞쪽에 추가하거나 순서를 변경했을 때 기존 index가 다른 블록을 가리킬 가능성이 있다. 실제 재정렬 후 보정 여부는 이번 조사에서 변경 테스트를 하지 않았으므로 별도 검증이 필요하다.

## 3. 편집 화면 동작

Confluence 편집기에서는 매크로가 `Mermaid diagram`이라는 extension 노드로 표시된다. 매크로를 선택하면 다음 플로팅 도구가 나타난다.

- 편집
- 정렬
- 복사
- 제거

`편집`을 누르면 같은 Forge 앱의 Custom UI iframe이 열리고 다음 설정을 제공한다.

- `Select codeblock with mermaid diagram to render` 선택 상자
- `Auto detect`
- 현재 페이지의 모든 코드 블록 목록
- `Submit`
- `Cancel`

설정 화면에는 다음 안내가 표시된다.

- Auto detect는 가장 가까운 다이어그램을 기본 선택한다.
- Mermaid 다이어그램으로 인식되지 않는 항목은 흐리게 표시한다.

대상 페이지에서는 첫 번째 매크로가 아홉 번째 코드 블록을 명시적으로 선택하고 있었다. 즉, 매크로 편집기는 페이지의 코드 블록을 수집하고 사용자가 고른 순번을 `guestParams.index`로 저장한다.

## 4. 조회 화면 렌더링

조회 화면에서 Confluence ADF renderer는 `extension` 노드를 일반 본문 HTML로 직접 그리지 않는다. 다음 구조로 Forge 앱을 호스팅한다.

```text
.ak-renderer-extension
  └─ [data-testid="ForgeExtensionContainer"]
       └─ [data-testid="hosted-resources-iframe"]
            └─ Mermaid Custom UI
```

확인된 iframe 특성은 다음과 같다.

- `data-forge-iframe="true"`
- Atlassian 개발 CDN의 `custom-ui` 리소스를 로드
- 앱 식별자는 ADF의 Forge app ID와 동일
- `global-bridge.js`를 로드해 Forge host와 통신
- `iframeResizer.contentWindow.min.js`로 내용 높이를 맞춤
- 앱 전용 JavaScript와 Atlaskit token stylesheet를 로드
- iframe 안에서 결과 SVG를 생성

iframe은 `allow-scripts`, `allow-same-origin`, `allow-forms`, `allow-downloads` 등이 포함된 sandbox로 분리되어 있다. 따라서 Mermaid 실행 주체는 Confluence 본문 renderer가 아니라 Forge iframe 안의 앱이다.

## 5. Mermaid 렌더링과 오류 처리

iframe 안에서 확인된 Mermaid 버전은 `11.15.0`이다. 정상 소스라면 앱이 Mermaid 결과를 인라인 SVG로 만든다.

대상 페이지의 두 매크로는 모두 현재 오류 상태다.

| 매크로 | 선택된 텍스트 | 결과 |
| --- | --- | --- |
| 첫 번째 | Git 초기화 shell 명령 | Mermaid diagram type을 찾지 못함 |
| 두 번째 | `SVC`, `PROJECT`로 시작하는 ASCII 트리 | Mermaid diagram type을 찾지 못함 |

화면에는 `Error while loading diagram`, `No diagram type detected...`, `Syntax error in text`, `mermaid version 11.15.0`이 표시된다.

이는 Forge iframe 자체가 로드되지 않은 오류가 아니다. 앱과 Mermaid 런타임은 정상 로드됐지만, 선택된 코드 블록이 `flowchart`, `sequenceDiagram` 등 Mermaid가 인식할 수 있는 diagram 선언으로 시작하지 않아 파싱에 실패한 상태다.

## 6. 전체 처리 흐름

### 6.1 작성·저장

```text
사용자가 페이지에 코드 블록 작성
  → Mermaid diagram 매크로 삽입
  → 매크로 편집기에서 코드 블록 선택 또는 Auto detect
  → 선택 결과를 codeBlock 순번으로 저장
  → Confluence ADF에 codeBlock과 extension을 각각 저장
```

### 6.2 조회

```text
Confluence가 페이지 ADF 조회
  → extension node를 Forge 앱으로 해석
  → guestParams.index로 대상 codeBlock 결정
  → Forge Custom UI iframe 실행
  → 코드 블록 텍스트를 Mermaid 11.15.0에 전달
  → 성공하면 SVG, 실패하면 오류 UI 표시
```

## 7. Inno Extension에 미치는 영향

### 7.1 Markdown -> ADF 변환

Markdown 입력에 다음 fence가 있다고 가정한다.

````markdown
```mermaid
flowchart LR
  A --> B
```
````

이를 ADF `codeBlock`으로만 변환하면 Confluence에는 코드가 보이지만 대상 환경의 Mermaid 앱이 자동으로 생성되지는 않는다. 같은 결과를 만들려면 최소한 다음 두 노드가 필요하다.

1. Mermaid 원문을 담은 ADF `codeBlock`
2. 해당 코드 블록의 최종 순번을 `guestParams.index`로 가진 Mermaid `extension`

다만 Forge app ID와 module ID를 하드코딩해 외부 앱 macro를 직접 생성하는 방식은 다음 위험이 있다.

- 해당 Confluence 사이트에 앱이 설치되어 있어야 한다.
- extension key와 매크로 parameter 계약은 앱 버전에 따라 바뀔 수 있다.
- 코드 블록 순번은 문서 병합 과정에서 다시 계산해야 한다.
- Confluence가 생성하는 embedded macro context를 임의로 구성하는 것은 공개 계약인지 확인되지 않았다.
- 앱이 없는 사이트에서는 알 수 없는 extension으로 남거나 렌더링에 실패할 수 있다.

따라서 Popup의 범용 Markdown 변환은 Mermaid fence를 손실 없이 코드 블록으로 보존한다. 현재 사내 tenant의 편집 화면에는 별도 명시적 버튼이 있지만 앱 매크로 생성은 실패한다. source가 손실되지 않도록 코드 블록은 유지한다.

### 7.2 Confluence -> Markdown 내보내기

내보내기에서는 Mermaid extension을 일반 알 수 없는 앱 노드로 버리지 않고 다음 방식으로 해석할 수 있다.

1. extension key가 조사된 Mermaid macro인지 확인한다.
2. `guestParams.index`를 읽는다.
3. 같은 문서의 해당 codeBlock을 찾는다.
4. 코드 블록 내용을 `mermaid` fence로 내보낸다.
5. 참조된 원본 codeBlock을 다시 일반 코드 블록으로 출력하지 않아 중복을 피한다.

index가 범위를 벗어나거나 대상 codeBlock이 Mermaid 문법이 아니면 원문 코드 블록은 보존하고 경고를 남기는 편이 안전하다.

## 8. 확인된 사실과 추론의 경계

### 확인된 사실

- Mermaid는 ADF `extension` 노드와 Forge Custom UI iframe으로 동작한다.
- 원문은 별도 ADF `codeBlock`에 있다.
- 매크로는 `guestParams.index`로 코드 블록을 참조한다.
- index는 0부터 시작한다.
- 편집 UI는 Auto detect와 전체 코드 블록 선택을 제공한다.
- 조회 iframe은 Mermaid `11.15.0`으로 SVG 또는 오류 SVG를 만든다.
- 대상 페이지의 두 매크로는 Mermaid 문법이 아닌 코드 블록을 가리켜 오류가 발생한다.

### 추가 검증이 필요한 부분

- Auto detect가 거리 외에 어떤 기준으로 Mermaid 문법을 판별하는지
- 코드 블록 삽입·삭제·재정렬 시 저장된 index를 앱이 자동 보정하는지
- REST API로 외부 앱 extension을 새로 작성하는 방식이 공식 지원 계약인지
- 앱 업데이트 시 extension key, parameter, Mermaid 버전의 호환성

## 9. 구현 판단

현재 기준으로는 Mermaid를 Confluence의 기본 ADF 기능으로 취급하면 안 된다. 이 사이트에 설치된 특정 Forge 앱의 macro 계약으로 취급해야 한다.

Inno Extension의 현재 구현 상태는 다음과 같다.

1. Markdown import 시 Mermaid 원문을 코드 블록으로 보존한다.
2. 편집기에서는 Mermaid 선언이 확인된 기존 codeBlock만 변환 후보로 판정한다.
3. 현재 페이지 전체 codeBlock 순번을 계산해 `guestParams.index`를 만들고 source의 top-level 위치 바로 앞에 extension을 삽입한다.
4. source를 잃지 않도록 codeBlock은 접힌 `Mermaid 원본` 영역 안에 보존한다.

### 9.1 2026-08-11 편집 화면 재검토

로그인된 `edit-v2` 화면에서 현재 본문을 다시 확인한 결과, 편집기에는 13개의 `codeBlock` node가 있었고 그중 `flowchart LR`로 시작하는 Mermaid source 후보가 2개 있었다. 후보 탐지는 코드 블록 원문의 첫 유효 줄로 안정적으로 수행할 수 있다.

편집 DOM에는 이 두 source와 연결된 Mermaid `extension` node가 없었고, 페이지의 Forge iframe은 외부 앱 origin에서 실행됐다. Chrome extension content script가 그 iframe 내부의 선택 UI와 `Submit`을 직접 조작할 수 없다는 점은 그대로다.

추가로 Atlassian의 `@atlaskit/adf-schema` 56.7.2를 확인한 결과, extension node의 DOM parser는 `data-node-type="extension"` 요소에서 `data-extension-type`, `data-extension-key`, `data-text`, `data-parameters`, `data-layout`, `data-local-id`를 읽는다. 실제 tenant의 기존 Mermaid node가 가진 extension type/key와도 일치했다.

이 `parseDOM` 규칙은 공개적으로 보장된 Confluence clipboard API는 아니지만, 2026-08-12 저장된 페이지 ADF를 재조회한 결과 현재 tenant의 편집기는 이 HTML paste를 실제 Forge `extension`으로 수용했다. 다만 반영이 비동기이며 외부 editor 구현에 종속된다.

구현 범위는 다음처럼 제한한다.

- Mermaid 선언으로 시작하는 codeBlock만 후보로 판정한다.
- 원본 위치의 top-level editor wrapper 바로 앞에 실제 ADF extension을 삽입한다.
- `guestParams.index`는 삽입 전 전체 codeBlock의 0-based 순번을 사용한다.
- 바로 앞 node가 동일 Mermaid extension이면 중복 삽입하지 않는다.
- raw codeBlock은 `Mermaid 원본` 접힌 영역으로 바꿔 화면에서 숨기되 참조 source로는 보존한다.
- extension key가 바뀌거나 앱이 제거된 경우에도 원본 codeBlock은 그대로 남는다.
- 확장은 페이지 저장을 실행하지 않으므로 사용자가 결과를 확인하고 실행 취소하거나 업데이트한다.

## 10. 2026-08-12 실제 저장 결과 재검증과 위치 오류 분석

### 10.1 최초 관찰의 오판

버튼 실행 직후 100ms 시점에는 `extension` node가 0개였고 본문 `textContent`가 `Mermaid diagram` 길이만큼 증가했다. 이 상태만 보고 HTML이 폐기되고 plain text만 삽입됐다고 판단했지만, 이는 너무 이른 관찰이었다.

저장된 페이지 version 4의 ADF를 다시 조회하자 실제 Mermaid extension 6개가 존재했다. 모두 문서 최상위 index 0~5에 있었고 `guestParams.index`는 원본 후보인 8과 10을 참조했다. 즉 `Mermaid diagram` 15자는 plain text가 아니라 비동기로 생성 중이던 macro node의 표시 text였을 가능성이 높다.

정정된 결론은 다음과 같다.

- extension paste는 성공한다.
- Confluence가 macro node view를 완성하는 데 시간이 걸린다.
- 구현은 `dispatchEvent` 직후 동기적으로 extension 개수를 확인해 성공한 작업을 실패로 오판했다.
- 사용자가 실패 메시지를 보고 다시 누를 때마다 macro가 추가돼 중복 6개가 저장됐다.

### 10.2 위치가 문서 맨 앞으로 이동한 이유

Mermaid 원본 codeBlock은 ADF상 top-level node지만 편집 DOM에서는 다음 wrapper 안에 있다.

```text
.ProseMirror
  └─ .fabric-editor-breakout-mark
       └─ .fabric-editor-breakout-mark-dom
            └─ [data-prosemirror-node-name="codeBlock"]
```

기존 구현은 가장 안쪽의 CodeMirror codeBlock node에 `Range.setStartAfter()`를 적용했다. 그러나 Forge extension은 해당 wrapper 내부에 들어갈 수 있는 node가 아니며, 이 DOM 위치는 ProseMirror의 top-level insertion position과 일치하지 않는다. Confluence가 유효한 위치로 정규화하는 과정에서 macro가 문서 맨 앞으로 이동했다.

실제 후보의 editor top-level 위치는 각각 79와 88이었지만 저장된 macro는 top-level 0~5에 배치됐다. 따라서 원본 codeBlock을 포함하는 `.fabric-editor-breakout-mark`까지 올라간 뒤 그 wrapper 바로 앞에 selection을 만들어야 한다.

### 10.3 원본 codeBlock을 완전히 삭제할 수 없는 이유

현재 Forge Mermaid 앱은 source를 macro 내부에 저장하지 않고 `guestParams.index`로 페이지의 codeBlock을 참조한다. 따라서 raw codeBlock node를 문서에서 실제로 삭제하면 Mermaid renderer가 읽을 source도 사라진다.

요구한 화면을 만들려면 다음 구조가 필요하다.

```text
원래 Mermaid codeBlock 위치
  ├─ Mermaid diagram extension
  └─ 접힌 `Mermaid 원본` expand
       └─ renderer가 참조하는 codeBlock
```

사용자 화면에서는 raw codeBlock이 사라지고 component가 해당 위치에 보인다. source는 접힌 영역 안에 남아 renderer 계약을 유지한다. 기존 페이지에서 관찰된 정상 Mermaid 작성 사례도 macro와 접힌 codeBlock을 함께 사용한다.

### 10.4 원인 순위

| 순위 | 설명 | 확신도 | 근거 |
| ---: | --- | --- | --- |
| 1 | 비동기 macro 생성을 동기적으로 검사해 성공을 실패로 오판했다. | 높음 | 저장된 ADF에 실제 extension 6개가 존재하며 반복 클릭 결과와 일치한다. |
| 2 | 내부 CodeMirror node를 삽입 기준으로 사용해 top-level macro 위치가 문서 맨 앞으로 정규화됐다. | 높음 | 후보 DOM은 breakout wrapper 안에 있고 저장 ADF의 macro는 모두 top-level 0~5로 이동했다. |
| 3 | 중복 검사가 source 바로 뒤 extension만 찾도록 되어 잘못 배치된 기존 macro를 인식하지 못했다. | 높음 | macro는 문서 앞, source는 index 8·10 위치에 있어 매 클릭마다 후보로 다시 판정됐다. |
| 4 | CSP font와 iframe resize 경고가 macro 위치를 바꿨다. | 낮음 | 경고는 Forge iframe의 font 표시·deprecated option에 관한 것이며 ADF node 위치 결정과 무관하다. |

### 10.5 수정 계약

수정 구현은 다음 계약을 따른다.

1. codeBlock 내부 node가 아니라 이를 포함하는 editor top-level wrapper 바로 앞에 macro를 삽입한다.
2. 생성한 `localId`를 가진 extension node가 나타날 때까지 최대 3초 기다린다.
3. macro가 생성된 후 raw source를 `Mermaid 원본` expand로 바꾼다.
4. source 바로 앞의 Mermaid extension을 정상 pair로 간주한다.
5. 정상 pair가 아닌 기존 Mermaid extension이 하나라도 있으면 추가 생성을 중단해 중복을 막는다.
6. 실제 Forge ADF와 맞추기 위해 `parameters.layout`, `parameters.localId`, `parameters.extensionId`도 함께 전달한다.

현재 대상 페이지에는 이전 동작으로 생성된 unpaired Mermaid component 6개가 이미 저장돼 있다. 수정본은 이를 자동 삭제하거나 임의로 재배치하지 않는다. 기존 component를 정리한 뒤 다시 실행해야 새 위치 계약을 적용할 수 있다.

### 10.6 함께 관찰된 콘솔 경고

- `data:font/woff2` CSP 차단은 Forge iframe의 폰트 fallback 문제다.
- `csp-report ... ERR_BLOCKED_BY_CLIENT`는 CSP 진단 보고 전송이 브라우저 측에서 차단된 것이다.
- `iFrameSizer initCallback deprecated`는 Atlassian host library의 폐기 예정 API 경고다.

세 메시지는 macro iframe이 실행되고 있음을 보여주지만, extension의 ADF 위치나 source 참조 index를 바꾸는 원인은 아니다.

## 참고 자료

- [Atlassian Forge macro module](https://developer.atlassian.com/platform/forge/manifest-reference/modules/macro/)
- [Forge Confluence bridge `getMacroContent`](https://developer.atlassian.com/platform/forge/apis-reference/confluence-api-bridge/getMacroContent/)
- [Atlassian Document Format](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/)
