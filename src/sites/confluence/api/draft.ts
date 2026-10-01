/**
 * Confluence 초안 읽기 클라이언트.
 *
 * Mermaid 매크로는 원문을 자기 안에 갖지 않고 **서버에 저장된 초안**의 N번째 코드블럭을 읽는다.
 * 서버 초안은 편집 후 약 10초 늦게 반영된다(실측 2026-10-01). 그래서 매크로를 넣기 전에 초안이
 * 따라잡았는지 이것으로 확인한다.
 *
 * 지켜야 할 것 — CLAUDE.md '네트워크는 예외다'
 *
 * | 규칙 | 여기서 |
 * | --- | --- |
 * | 읽기만 | `GET` 외에는 만들지 않는다 |
 * | 시점 | 호출부가 `Markdown 변환` 클릭에서만 부른다. 이 모듈은 스스로 호출하지 않는다 |
 * | 오리진 | 상대 경로만 쓴다. 다른 호스트로 나갈 수 없다 |
 * | 인증 | 브라우저 세션 쿠키. **토큰을 저장하지 않는다** |
 *
 * docs/plans/confluence-mermaid-wait-for-draft/spec.md
 */

interface AdfNode {
  type?: unknown;
  text?: unknown;
  content?: unknown;
}

/**
 * 초안 ADF 에서 코드블럭 원문을 **문서 순서대로** 모은다.
 *
 * 목록·표·접힌 영역 안의 코드블럭도 센다. 매크로가 그렇게 센다(실측: 접힌 `Mermaid 원본` 안의
 * 블록이 순번에 들어갔다).
 */
export function collectCodeBlockTexts(adf: unknown): string[] {
  const texts: string[] = [];
  const walk = (node: AdfNode | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    const children = Array.isArray(node.content) ? node.content as AdfNode[] : [];
    if (node.type === 'codeBlock') {
      texts.push(children.map((child) => (typeof child.text === 'string' ? child.text : '')).join(''));
      return;
    }
    children.forEach(walk);
  };
  walk(adf as AdfNode);
  return texts;
}

/** 초안의 코드블럭 원문 목록. 읽지 못하면 `null` — 호출부는 기다리지 않고 진행한다 */
export async function readDraftCodeBlockTexts(pageId: string): Promise<string[] | null> {
  if (!/^\d+$/.test(pageId)) return null;
  try {
    const response = await fetch(
      `/wiki/rest/api/content/${pageId}?status=draft&expand=body.atlas_doc_format`,
      { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return null;
    const body = await response.json() as { body?: { atlas_doc_format?: { value?: unknown } } };
    const value = body.body?.atlas_doc_format?.value;
    if (typeof value !== 'string') return null;
    return collectCodeBlockTexts(JSON.parse(value));
  } catch {
    return null;
  }
}
