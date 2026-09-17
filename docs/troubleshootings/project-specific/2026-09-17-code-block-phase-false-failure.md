# 코드블럭 벗기기가 성공해도 `변환 실패 · 되돌리기 실패`로 끝난다

- 발생일: 2026-09-17
- 영향: Confluence·Jira `Markdown 변환` 1단계
- 상태: **원인 확정 · 수정함**

## 증상

Markdown 원문을 코드블럭 하나에 넣고 `Markdown 변환`을 누르면

- 버튼 라벨: `변환 실패 · 되돌리기 실패`
- 콘솔: `코드블럭 -> ADF 결과가 올바르지 않고 자동 되돌리기도 실패했습니다. Jira 실행 취소를 한 번 눌러주세요.`
- **그런데 코드블럭은 실제로 벗겨져 있다.** 변환은 됐는데 실패라고 말한다.
- Confluence에서는 여기서 멈추므로 뒤따르는 **Mermaid 단계가 아예 돌지 않는다.**

작은 문서로는 재현되지 않는다. 코드블럭 하나짜리 짧은 Markdown은 정상 동작한다.

## 원인 1 — 교체 검증이 `isConnected` 하나에 기대고 있었다

`replaceCodeBlockWithAdf()`의 성공 판정이 이랬다.

```ts
() => !codeBlock.isConnected
```

**ProseMirror는 DOM 노드를 재사용한다.** 변환 결과물 안에 코드블럭이 들어 있으면, 원본 코드블럭의
DOM 엘리먼트가 **결과물의 새 코드블럭으로 넘어간다.** 그래서 교체가 끝났는데도 `isConnected`가
계속 `true`다.

Jira 설명 편집기 실측(코드블럭 8개를 만드는 문서):

```
isConnectedTrace : 250:true 500:true 750:true ... 3000:true 3250:true
htmlChanged      : true          ← 교체는 됐다
nodeCount        : 42
codeBlocks       : 8
cb.textContent   : "912a: 1b: 2"  ← 원본 엘리먼트가 새 yaml 코드블럭이 되어 있다
```

3초 타임아웃이 지나 실패로 판정하고 되돌리기로 넘어간다.

> 같은 함정을 Mermaid 단계에서 이미 겪었다.
> [docs/issue/2026-09-04-mermaid-phase-verification-node-reuse.md](../../issue/2026-09-04-mermaid-phase-verification-node-reuse.md)
> 그때는 Mermaid 쪽만 고치고 **1단계는 그대로 뒀다.**

## 원인 2 — 되돌리기 판정이 `innerHTML` 완전 일치였다

`rollbackEditorChange()`는 실행 취소를 누른 뒤 `editor.innerHTML === beforeHtml`을 기다렸다.

실측에서 실행 취소는 **정상 동작한다.** 내용이 완전히 복원된다(노드 3개/코드블럭 1개, 길이도
5645자로 동일). 그런데 문자열은 영영 일치하지 않는다.

```
lenBefore 5645 · lenAfter 5645 · firstDiffIndex 469

before : <div class="cm-editor ͼ1 ͼ2 ͼ1r code-block ak-editor-selected-node ...
after  : <div class="cm-editor ͼ1 ͼ2 ͼ27 code-block ak-editor-selected-node ...
```

**CodeMirror가 자동 생성하는 스타일 스코프 클래스명**(`ͼ1r` → `ͼ27`)이 다시 렌더될 때마다
바뀐다. 코드블럭이 있는 문서에서는 `innerHTML` 완전 일치가 성립할 수 없다.

## 고친 방법

**원인 1** — 세 신호 중 하나라도 서면 교체된 것으로 본다.

| 신호 | 왜 |
| --- | --- |
| 노드가 사라짐 | 재사용되지 않은 보통의 경우 |
| **문서의 ProseMirror 노드 수가 달라짐** | 코드블럭 하나가 여러 노드로 풀린다. 재사용과 무관하다 |
| 코드블럭 DOM 원문이 달라짐 | 재사용된 엘리먼트가 다른 내용을 담게 됐다 |

`innerHTML` 변화는 신호로 쓰지 않는다. 원인 2와 같은 이유로 붙여넣기와 무관하게 달라진다.
데코레이션(`ProseMirror-widget`)은 `data-prosemirror-node-name`이 없어 노드 수에 세어지지 않으므로,
편집기가 장식을 붙였다 뗐다 해도 값이 흔들리지 않는다.

> **원문은 노드를 선택하기 전에 읽는다.** 선택 직후에는 CodeMirror가 내용을 다시 그려서 빈
> 문자열이 읽히는 것을 실측으로 확인했다. 선택 후에 읽으면 세 번째 신호가 죽는다.

**원인 2** — `innerHTML` 완전 일치에 더해 **`textContent` 일치**도 성공으로 본다. 생성 클래스명
변화에 영향받지 않는다.

원인 1을 고치면 이 상황에서 되돌리기 자체가 돌지 않는다. 원인 2는 그래도 남겨둔다 — 진짜 실패로
되돌려야 할 때 같은 이유로 또 걸린다.

## 수정 확인

같은 시나리오(코드블럭 8개를 만드는 문서)를 Jira 설명 편집기에서 다시 돌렸다.

```
oldPredicate_isConnectedOnly : false   ← 예전 판정. 3초를 기다려도 서지 않는다
newPredicate                 : true
settledAfterMs               : 979
beforeNodeCount 123 → afterNodeCount 242
```

## 교훈

**ProseMirror 편집기에서 노드 동일성(`isConnected`, 엘리먼트 참조)으로 교체 여부를 판정하지
않는다.** 내용으로 판정한다. 이 저장소에서 같은 함정에 두 번 빠졌다.

**렌더링 라이브러리가 만든 DOM을 `innerHTML` 문자열로 비교하지 않는다.** 내용이 같아도 문자열은
다를 수 있다.
