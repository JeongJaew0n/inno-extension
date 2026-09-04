import assert from 'node:assert/strict';
import test from 'node:test';
import {
  markdownToConfluenceAdf,
} from '../src/sites/confluence/adf';

test('markdown를 Confluence ADF로 변환한다', () => {
  const markdown = [
    '# 제목',
    '',
    '일반 문단과 **강조**, *기울임*, ~~취소선~~, [링크](https://example.com), `코드`.',
    '',
    '> 인용문',
    '',
    '- 첫째',
    '- 둘째',
    '',
    '1. 하나',
    '2. 둘',
    '',
    '| 이름 | 값 |',
    '| --- | --- |',
    '| alpha | beta |',
    '',
    '```ts',
    'const value = 1;',
    '```',
    '',
    '<details><summary>접기</summary>',
    '',
    '숨김 내용',
    '',
    '</details>',
  ].join('\n');

  const result = markdownToConfluenceAdf(markdown);

  assert.equal(result.warnings.length, 0);
  assert.equal(result.mermaidCount, 0);
  assert.equal(result.doc.type, 'doc');
  assert.equal(result.doc.version, 1);
  assert.equal(result.doc.content[0]?.type, 'heading');
  assert.equal(result.doc.content[2]?.type, 'blockquote');
  assert.equal(result.doc.content[3]?.type, 'bulletList');
  assert.equal(result.doc.content[4]?.type, 'orderedList');
  assert.equal(result.doc.content[5]?.type, 'table');
  assert.equal(result.doc.content[6]?.type, 'codeBlock');
  assert.deepEqual(result.doc.content[7], {
    type: 'expand',
    attrs: { title: '접기' },
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '숨김 내용' }] }],
  });
});

// 편집기의 `Mermaid -> ADF`가 최상위 코드블럭만 교체할 수 있어 expand로 감싸지 않는다.
// docs/issue/2026-09-02-mermaid-conversion-fails-inside-expand.md
test('mermaid fence는 최상위 codeBlock으로 보존한다', () => {
  const markdown = '```mermaid\ngraph TD;\nA-->B;\n```';
  const adf = markdownToConfluenceAdf(markdown);

  assert.equal(adf.mermaidCount, 1);
  assert.deepEqual(adf.doc.content[0], {
    type: 'codeBlock',
    attrs: { language: 'mermaid' },
    content: [{ type: 'text', text: 'graph TD;\nA-->B;' }],
  });
});

test('mermaid fence를 expand로 감싸지 않는다', () => {
  const adf = markdownToConfluenceAdf('```mermaid\ngraph TD;\nA-->B;\n```');

  assert.equal(
    JSON.stringify(adf.doc).includes('expand'),
    false,
    'Mermaid를 expand로 감싸면 편집기 Mermaid -> ADF 변환이 영구 실패한다',
  );
});

test('지원하지 않는 HTML과 이미지 변환 제외는 warnings에 남긴다', () => {
  const result = markdownToConfluenceAdf([
    '<div>raw html</div>',
    '',
    '텍스트 ![inline](./inline.png) more',
    '',
    '![standalone](./standalone.png)',
  ].join('\n'));

  assert.deepEqual(result.warnings, [
    '원본 HTML 블록은 그대로 옮길 수 없어 생략했습니다.',
    '문단 중간 이미지("./inline.png")는 지원하지 않아 링크 텍스트로 대체했습니다.',
    '이미지("./standalone.png")는 media 변환 범위에서 제외되어 자리표시자 텍스트로 대체했습니다.',
  ]);
});

test('인라인 HTML br은 ADF hardBreak으로 보존한다', () => {
  const result = markdownToConfluenceAdf('첫째<br>둘째<br />셋째');

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.doc.content[0], {
    type: 'paragraph',
    content: [
      { type: 'text', text: '첫째' },
      { type: 'hardBreak' },
      { type: 'text', text: '둘째' },
      { type: 'hardBreak' },
      { type: 'text', text: '셋째' },
    ],
  });
});

test('외부 HTTP 이미지는 ADF external media로 보존한다', () => {
  const converted = markdownToConfluenceAdf('![구성도](https://example.com/diagram.png)');
  assert.deepEqual(converted.warnings, []);
  assert.equal(converted.doc.content[0]?.type, 'mediaSingle');
});
