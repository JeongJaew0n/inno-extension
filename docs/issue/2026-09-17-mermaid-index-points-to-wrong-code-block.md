# Mermaid 매크로가 엉뚱한 코드블럭을 가리킨다

- 발생일: 2026-09-17
- 상태: **원인 미확정.** 유력 가설 1개 + 이를 가르는 측정 1건이 남음
- 영향: Confluence Mermaid 변환

## 증상

```
Error while loading diagram
No diagram type detected matching given configuration for text:
2. https://0c3bb825-...:6443 → kube-system uid = A
3. https://kubernetes.default.svc → kube-system uid = B ...
```

Mermaid 매크로가 **플로차트가 아닌 다른 코드블럭의 내용**을 다이어그램으로 읽으려다 실패했다.

## 확정된 사실

### 1. 매크로는 순번으로 원본을 참조한다

`guestParams.index` = **페이지 코드블럭 목록의 0-based 순번**이다. 매크로 안에 원문을 담지 않고
그 순번의 코드블럭을 읽는다. ([조사 기록](../confluence-mermaid-runtime-analysis.md))

### 2. 문서의 코드블럭 배치 (변환기 실제 출력)

```
index 0  lang=yaml     depth=0  spec:
index 1  lang=jsonc    depth=2  {                    ← 목록 항목 안에 들어 있다
index 2  lang=yaml     depth=0  app:
index 3  lang=mermaid  depth=0  flowchart TD
index 4  lang=none     depth=0  2. https://0c3bb825-...:6443 → kube-syst
index 5  lang=none     depth=0  [SE 에서 클러스터 등록 시 1회]
index 6  lang=mermaid  depth=0  sequenceDiagram
```

**오류 메시지의 본문은 정확히 index 4다.** 플로차트(index 3)를 가리켜야 할 매크로가 4를 읽었다.
**+1 만큼 어긋났다.**

### 3. 우리 코드의 순번 계산

`runMermaidPhase()`는 단계 시작 시점에 `editor.querySelectorAll('[data-prosemirror-node-name="codeBlock"]')`
로 순번을 매기고, **뒤에서 앞으로** 교체한다. 교체는 코드블럭 하나를 `extension + 접힌 원본`으로
바꾸므로 **개수와 앞쪽 순번이 보존된다.** 코드만 읽어서는 어긋날 지점을 찾지 못했다.

## 유력 가설 — 매크로는 목록 안의 코드블럭을 세지 않는다

이 문서가 이전에 성공하던 문서들과 다른 점은 하나다. **index 1 의 `jsonc` 블록이 목록 항목 안에
중첩돼 있다(depth 2).**

매크로가 중첩 블록을 빼고 세면 매크로 기준 순번은 이렇게 된다.

| 우리 순번 | 매크로 순번(가설) | 내용 |
| --- | --- | --- |
| 0 | 0 | yaml `spec:` |
| **1** | **(세지 않음)** | jsonc — 목록 안 |
| 2 | 1 | yaml `app:` |
| **3** | **2** | **flowchart** |
| 4 | **3** | `2. https://0c3bb825-...` |

우리가 넘긴 `3`을 매크로가 자기 기준 `3`으로 읽으면 **`2. https://0c3bb825-...`** 가 나온다.
**오류 메시지와 정확히 일치한다.**

### 이 가설의 약점

변환이 끝나면 원본 코드블럭은 **접힌 `expand` 안**으로 들어간다. 그것도 중첩이다. 매크로가
중첩을 전혀 세지 않는다면 이 기능은 **한 번도 동작하지 못했어야 한다.** 그런데 실제로는 잘
동작해 왔다.

따라서 규칙이 "중첩 제외"는 아니고, **목록 안만 제외**하거나 다른 기준일 수 있다. 확정하려면
측정이 필요하다.

## 이를 가르는 측정

**목록 안의 `jsonc` 블록을 목록 밖으로 빼서(들여쓰기 제거) 같은 문서를 다시 변환한다.**

| 결과 | 뜻 |
| --- | --- |
| 정상 동작 | 가설이 맞다. 중첩 코드블럭이 순번을 어긋나게 한다 |
| 같은 오류 | 가설이 틀렸다. 다른 원인을 찾아야 한다 |

그 다음으로 확인할 것 — 변환 직후 문서의 Mermaid extension `data-parameters` 를 읽어 **우리가
실제로 넣은 `index` 값**을 본다. 3이 아니라 4가 들어가 있다면 원인은 우리 코드다.

## 임시 대응

원인이 확정되기 전까지는 **코드블럭을 목록 항목 안에 넣지 않는 것**으로 피할 수 있다.
