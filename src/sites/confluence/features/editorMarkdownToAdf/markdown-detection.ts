/**
 * 코드블럭 원문이 "Markdown 문서"인지 판정한다.
 *
 * `코드블럭 -> ADF` 벗기기는 대상 코드블럭을 Markdown으로 해석해 산문·제목·표로 풀어버린다.
 * 실제 소스 코드에 실행하면 코드가 사라진다. 그래서 벗기기를 실행할지 결정하는 게이트가 필요하다.
 *
 * 특징 1종만으로는 오탐이 크다. YAML에는 `- item`이 있고 셸 스크립트에는 `# 주석`이 있다.
 * **2종 이상**을 요구하면 실제 코드가 걸릴 확률이 크게 떨어진다.
 *
 * docs/plans/confluence-magic-button/spec.md
 */

const MARKDOWN_FEATURES: ReadonlyArray<{ name: string; match: RegExp }> = [
  // ATX 제목. `#!/bin/sh` 셰뱅과 주석을 거르려고 `#` 뒤 공백을 요구한다.
  { name: 'heading', match: /^#{1,6}[ \t]+\S/m },
  // 표 구분선. `|---|---|`, `| :--- | ---: |` 형태.
  { name: 'table', match: /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*\|/m },
  // 코드 펜스.
  { name: 'fence', match: /^[ \t]*(```|~~~)/m },
  // 목록.
  { name: 'list', match: /^[ \t]*([-*+]|\d+\.)[ \t]+\S/m },
  // 인용.
  { name: 'blockquote', match: /^[ \t]*>[ \t]+\S/m },
];

/** 판정에 필요한 최소 특징 수. */
export const MARKDOWN_FEATURE_THRESHOLD = 2;

/** 원문에서 발견한 Markdown 특징 이름을 돌려준다. 판정 근거를 사용자에게 알릴 때 쓴다. */
export function findMarkdownFeatures(source: string): string[] {
  if (!source.trim()) return [];
  return MARKDOWN_FEATURES.filter(({ match }) => match.test(source)).map(({ name }) => name);
}

/**
 * 원문을 Markdown 문서로 볼 수 있으면 `true`.
 *
 * 빈 문자열은 판정 불가이므로 `false`다. 읽지 못한 코드블럭을 Markdown으로 단정해 벗기면
 * 내용을 잃기 때문에, 확신이 없을 때는 벗기지 않는 쪽을 택한다.
 */
export function looksLikeMarkdownDocument(source: string): boolean {
  return findMarkdownFeatures(source).length >= MARKDOWN_FEATURE_THRESHOLD;
}
