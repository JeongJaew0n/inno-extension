import assert from 'node:assert/strict';
import test from 'node:test';
import {
  confluenceAdfToMarkdown,
  markdownToConfluenceAdf,
  type AdfDocument,
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

test('mermaid fence는 expand/codeBlock으로 보존하고 다시 mermaid fence로 복원한다', () => {
  const markdown = '```mermaid\ngraph TD;\nA-->B;\n```';
  const adf = markdownToConfluenceAdf(markdown);

  assert.equal(adf.mermaidCount, 1);
  assert.deepEqual(adf.doc.content[0], {
    type: 'expand',
    attrs: { title: 'Mermaid 코드 보기' },
    content: [{
      type: 'codeBlock',
      attrs: { language: 'mermaid' },
      content: [{ type: 'text', text: 'graph TD;\nA-->B;' }],
    }],
  });

  const roundTrip = confluenceAdfToMarkdown(adf.doc);
  assert.equal(roundTrip.markdown, '```mermaid\ngraph TD;\nA-->B;\n```\n');
  assert.deepEqual(roundTrip.warnings, []);
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

test('ADF 확장/미디어 노드는 warnings와 함께 생략한다', () => {
  const doc: AdfDocument = {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '앞 문단' }],
      },
      {
        type: 'extension',
        attrs: { extensionKey: 'sample' },
      },
      {
        type: 'mediaSingle',
        content: [{
          type: 'media',
          attrs: { type: 'file', id: '1', collection: 'c' },
        }],
      },
    ],
  };

  const result = confluenceAdfToMarkdown(doc);
  assert.equal(result.markdown, '앞 문단\n');
  assert.deepEqual(result.warnings, [
    'ADF extension 노드는 Markdown으로 안전하게 변환할 수 없어 생략했습니다.',
    '업로드된 ADF media는 파일을 포함할 수 없어 Markdown에서 생략했습니다.',
  ]);
});

test('외부 HTTP 이미지는 ADF와 Markdown 사이에서 참조를 보존한다', () => {
  const converted = markdownToConfluenceAdf('![구성도](https://example.com/diagram.png)');
  assert.deepEqual(converted.warnings, []);
  assert.equal(converted.doc.content[0]?.type, 'mediaSingle');

  const roundTrip = confluenceAdfToMarkdown(converted.doc);
  assert.equal(roundTrip.markdown, '![구성도](https://example.com/diagram.png)\n');
  assert.deepEqual(roundTrip.warnings, []);
});

test('알 수 없는 ADF node는 내부 텍스트와 손실 경고를 함께 남긴다', () => {
  const doc: AdfDocument = {
    type: 'doc',
    version: 1,
    content: [{
      type: 'customPanel',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: '보존할 내용' }],
      }],
    }],
  };

  const result = confluenceAdfToMarkdown(doc);
  assert.equal(result.markdown, '보존할 내용\n');
  assert.deepEqual(result.warnings, [
    '지원하지 않는 ADF node(customPanel)는 내부 텍스트만 보존했습니다.',
  ]);
});
