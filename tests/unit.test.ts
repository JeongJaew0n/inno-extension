import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SITES } from '../src/catalog/sites';
import { createDefaultSettings } from '../src/platform/settings/defaults';
import { isFeatureEffectivelyEnabled, normalizeSettings } from '../src/platform/settings/schema';
import {
  isTitleAutofillRoute,
  normalizeTitleAutofillText,
  TITLE_AUTOFILL_MAX_LENGTH,
} from '../src/sites/amaranth/features/titleAutofill/contracts';
import {
  escapeMarkdownText,
  isRedundantHeaderOnlyTable,
} from '../src/sites/confluence/features/pageMarkdownCopy/markdown';
import {
  parseConfluenceEditPageUrl,
  parseConfluencePageUrl,
} from '../src/sites/confluence/routes';
import { adfDocumentToEditorHtml } from '../src/sites/confluence/features/editorMarkdownToAdf/adf-to-editor-html';
import { codeBlockTextToEditorHtml } from '../src/sites/confluence/features/editorMarkdownToAdf/code-block';
import {
  buildCollapsedMermaidSourceHtml,
  buildConfluenceMermaidExtensionHtml,
  buildConfluenceMermaidReplacementHtml,
  CONFLUENCE_MERMAID_EXTENSION_KEY,
  isMermaidCodeBlockSource,
} from '../src/sites/confluence/features/editorMarkdownToAdf/mermaid';
import { buildIssueClipboardContent } from '../src/sites/jira/features/issueLinkCopy/clipboard';
import {
  extractIssueKeyFromHref,
  isJiraBoardRoute,
  parseJiraBoardUrl,
  parseJiraIssueUrl,
  uniqueIssueKeys,
} from '../src/sites/jira/routes';
import './confluence-adf.test';

test('catalog의 사이트와 기능 ID는 중복되지 않고 기본 설정이 존재한다', () => {
  const defaults = createDefaultSettings();
  assert.equal(new Set(SITES.map((site) => site.id)).size, SITES.length);

  for (const site of SITES) {
    assert.ok(defaults.sites[site.id]);
    assert.equal(new Set(site.features.map((feature) => feature.id)).size, site.features.length);
    for (const feature of site.features) {
      assert.equal(
        defaults.sites[site.id].features[feature.id]?.enabled,
        feature.defaultEnabled,
      );
    }
  }
});

test('Manifest origin과 catalog origin이 일치한다', async () => {
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8')) as {
    content_scripts: Array<{ matches: string[]; world?: string; js?: string[] }>;
    host_permissions?: string[];
    permissions?: string[];
    background?: unknown;
  };
  const manifestOrigins = Array.from(new Set(
    manifest.content_scripts.flatMap((entry) => entry.matches),
  )).sort();
  const catalogMatches = SITES.flatMap((site) => site.contentMatches).sort();
  assert.deepEqual(manifestOrigins, catalogMatches);
  assert.equal(
    manifest.content_scripts.some((entry) => (
      entry.world === 'MAIN'
      && entry.js?.includes('src/sites/confluence/main.ts')
      && entry.matches.includes('https://pms-innogrid.atlassian.net/wiki/*')
    )),
    true,
  );
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.permissions?.includes('scripting'), false);
  assert.equal(manifest.permissions?.includes('downloads'), false);
});

test('서비스 아이콘 asset은 정사각형 PNG이며 표시 크기 이상의 해상도를 가진다', async () => {
  for (const [assetPath, minimumSize] of [
    ['src/popup/assets/amaranth-favicon.png', 256],
    ['src/popup/assets/jira-favicon.png', 32],
    ['src/popup/assets/confluence-favicon.png', 128],
  ] as const) {
    const image = await readFile(assetPath);
    const width = image.readUInt32BE(16);
    const height = image.readUInt32BE(20);

    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(width, height);
    assert.ok(width >= minimumSize);
  }
});

test('사이트 마스터 토글은 하위 기능 값을 보존하면서 실행 여부만 차단한다', () => {
  const settings = createDefaultSettings();
  settings.sites.jira.enabled = false;

  assert.equal(settings.sites.jira.features.issueLinkCopy?.enabled, true);
  assert.equal(isFeatureEffectivelyEnabled(settings, 'jira', 'issueLinkCopy'), false);

  settings.sites.jira.enabled = true;
  assert.equal(isFeatureEffectivelyEnabled(settings, 'jira', 'issueLinkCopy'), true);
});

test('부분 설정을 기본값과 병합하고 알 수 없는 값을 무시한다', () => {
  const settings = normalizeSettings({
    schemaVersion: 1,
    sites: {
      jira: {
        enabled: false,
        features: {
          issueLinkCopy: { enabled: false, options: { ignored: true } },
        },
      },
    },
  });

  assert.equal(settings.sites.jira.enabled, false);
  assert.equal(settings.sites.jira.features.issueLinkCopy?.enabled, false);
  assert.deepEqual(settings.sites.jira.features.boardInspector?.options, {
    supportedProjectKeys: ['NPT'],
    supportedBoardIds: ['2146'],
  });
  assert.equal(settings.sites.amaranth.features.attendanceHeader?.enabled, true);
  assert.equal(settings.sites.confluence.features.pageMarkdownCopy?.enabled, true);
  assert.equal(settings.sites.confluence.features.pageMarkdownAppend?.enabled, false);
});

test('과거 overlayEnabled 설정을 boardInspector로 이관한다', () => {
  const settings = normalizeSettings(undefined, true);
  assert.equal(settings.sites.jira.features.boardInspector?.enabled, true);
});

test('아마란스 신청서 제목 자동채움은 대상 화면과 입력 길이를 제한한다', () => {
  const targetUrl = new URL(
    'https://gw.innogrid.com/#/HP/HPD0110/HPD0110?MicroModuleCode=eap&formId=36',
  );
  assert.equal(isTitleAutofillRoute(targetUrl), true);
  assert.equal(
    isTitleAutofillRoute(new URL('https://gw.innogrid.com/#/UD/UDA/UDA0000')),
    false,
  );
  assert.equal(normalizeTitleAutofillText('  연차휴가 신청  '), '연차휴가 신청');
  assert.equal(
    normalizeTitleAutofillText('가'.repeat(TITLE_AUTOFILL_MAX_LENGTH + 10)).length,
    TITLE_AUTOFILL_MAX_LENGTH,
  );
  assert.equal(normalizeTitleAutofillText(null), '');
});

test('Jira board URL과 selectedIssue를 파싱한다', () => {
  const nptBoard = parseJiraBoardUrl(
    'https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2147?selectedIssue=npt-38',
  );
  assert.deepEqual(nptBoard, {
    boardId: '2147',
    projectKey: 'NPT',
    selectedIssueKey: 'NPT-38',
    viewPath: '',
    url: 'https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2147?selectedIssue=npt-38',
  });
  assert.equal(isJiraBoardRoute(nptBoard), true);

  const otherProjectBoard = parseJiraBoardUrl(
    'https://pms-innogrid.atlassian.net/jira/software/c/projects/OTHER/boards/999?selectedIssue=other-1',
  );
  assert.equal(isJiraBoardRoute(otherProjectBoard), true);
  assert.equal(
    isJiraBoardRoute(parseJiraBoardUrl(
      'https://pms-innogrid.atlassian.net/jira/software/c/projects/NPT/boards/2147/backlog?selectedIssue=NPT-38',
    )),
    false,
  );
  assert.equal(parseJiraBoardUrl('https://example.com/jira/software/c/projects/NPT/boards/2146'), null);
});

test('Jira issue 링크 추출과 정렬을 유지한다', () => {
  assert.equal(extractIssueKeyFromHref('/browse/NPT-25'), 'NPT-25');
  assert.equal(extractIssueKeyFromHref('https://example.com/browse/NPT-25'), null);
  assert.deepEqual(
    uniqueIssueKeys(['/browse/NPT-25', '/browse/NPT-2', '/browse/NPT-25', '/browse/NPT-8']),
    ['NPT-2', 'NPT-8', 'NPT-25'],
  );
});

test('Jira 직접 업무 조회 URL을 파싱한다', () => {
  assert.deepEqual(
    parseJiraIssueUrl('https://pms-innogrid.atlassian.net/browse/NPT-123'),
    {
      issueKey: 'NPT-123',
      url: 'https://pms-innogrid.atlassian.net/browse/NPT-123',
    },
  );
  assert.deepEqual(
    parseJiraIssueUrl('https://pms-innogrid.atlassian.net/issues/NPT-123'),
    {
      issueKey: 'NPT-123',
      url: 'https://pms-innogrid.atlassian.net/issues/NPT-123',
    },
  );
  assert.equal(extractIssueKeyFromHref('/issues/NPT-123'), 'NPT-123');
  assert.equal(parseJiraIssueUrl('https://example.com/browse/NPT-123'), null);
});

test('Jira 업무 링크 복사는 제목 포함 여부에 따라 브라우저 링크 payload를 만든다', () => {
  assert.deepEqual(buildIssueClipboardContent('npt-4'), {
    plainText: 'NPT-4',
    htmlText: '<a href="https://pms-innogrid.atlassian.net/browse/NPT-4">NPT-4</a>',
    issueUrl: 'https://pms-innogrid.atlassian.net/browse/NPT-4',
  });
  assert.deepEqual(buildIssueClipboardContent('npt-4', '  [CCP-BE] <개선> & 확인  '), {
    plainText: 'NPT-4 [CCP-BE] <개선> & 확인',
    htmlText: '<a href="https://pms-innogrid.atlassian.net/browse/NPT-4">NPT-4</a> [CCP-BE] &lt;개선&gt; &amp; 확인',
    issueUrl: 'https://pms-innogrid.atlassian.net/browse/NPT-4',
  });
  assert.equal(buildIssueClipboardContent('invalid'), null);
});

test('Confluence 문서 조회 URL만 Markdown 복사 대상으로 판별한다', () => {
  assert.deepEqual(
    parseConfluencePageUrl(new URL(
      'https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/2166423922/20260806+-+example',
    )),
    { spaceKey: 'PAAS', pageId: '2166423922' },
  );
  assert.equal(
    parseConfluencePageUrl(new URL('https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/overview')),
    null,
  );
  assert.equal(
    parseConfluencePageUrl(new URL(
      'https://example.com/wiki/spaces/PAAS/pages/2166423922/example',
    )),
    null,
  );
});

test('Confluence edit-v2 URL만 편집기 변환 대상으로 판별한다', () => {
  assert.deepEqual(
    parseConfluenceEditPageUrl(new URL(
      'https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/edit-v2/2177630217',
    )),
    { spaceKey: 'PAAS', pageId: '2177630217', mode: 'edit' },
  );
  assert.equal(
    parseConfluenceEditPageUrl(new URL(
      'https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/2177630217/title',
    )),
    null,
  );
  assert.equal(
    parseConfluenceEditPageUrl(new URL(
      'https://example.com/wiki/spaces/PAAS/pages/edit-v2/2177630217',
    )),
    null,
  );
});

test('ADF를 Confluence 편집기 paste용 안전한 HTML로 직렬화한다', () => {
  assert.equal(
    adfDocumentToEditorHtml({
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '배포 <계획>' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '강조', marks: [{ type: 'strong' }] },
            { type: 'text', text: ' 링크', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
            { type: 'text', text: ' 차단', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
          ],
        },
        {
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '항목' }] }],
          }],
        },
      ],
    }),
    '<h2>배포 &lt;계획&gt;</h2><p><strong>강조</strong><a href="https://example.com"> 링크</a> 차단</p><ul><li><p>항목</p></li></ul>',
  );
});

test('Confluence 코드블럭 원문을 서식 없는 편집기 문단 HTML로 바꾼다', () => {
  assert.equal(
    codeBlockTextToEditorHtml('flowchart LR\n  A --> B\n\n<script>alert(1)</script>'),
    '<p>flowchart LR<br>  A --&gt; B</p><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
  );
  assert.equal(codeBlockTextToEditorHtml(''), '<p><br></p>');
});

test('Mermaid 선언으로 시작하는 코드블럭만 변환 대상으로 판별한다', () => {
  assert.equal(isMermaidCodeBlockSource('flowchart LR\n  A --> B'), true);
  assert.equal(isMermaidCodeBlockSource('\n%% 초기화\n%%{init: {"theme": "dark"}}%%\nsequenceDiagram\nA->>B: ping'), true);
  assert.equal(isMermaidCodeBlockSource('stateDiagram-v2\n  [*] --> Ready'), true);
  assert.equal(isMermaidCodeBlockSource('const flowchart = "LR";'), false);
  assert.equal(isMermaidCodeBlockSource('graph data without direction'), false);
  assert.equal(isMermaidCodeBlockSource(''), false);
});

test('Mermaid 코드블럭 순번을 참조하는 Confluence extension paste HTML을 만든다', () => {
  const html = buildConfluenceMermaidExtensionHtml(8, 'local-id-&-1');

  assert.match(html, /data-node-type="extension"/);
  assert.match(html, new RegExp(`data-extension-key="${CONFLUENCE_MERMAID_EXTENSION_KEY}"`));
  assert.match(html, /data-extension-type="com\.atlassian\.ecosystem"/);
  assert.match(html, /data-local-id="local-id-&amp;-1"/);
  assert.match(html, /&quot;guestParams&quot;:\{&quot;index&quot;:8\}/);
  assert.match(html, /&quot;forgeEnvironment&quot;:&quot;PRODUCTION&quot;/);
  assert.match(html, /&quot;layout&quot;:&quot;extension&quot;/);
  assert.match(html, /&quot;localId&quot;:&quot;local-id-&amp;-1&quot;/);
  assert.match(html, /&quot;extensionId&quot;:&quot;ari:cloud:ecosystem::extension\//);
  assert.throws(() => buildConfluenceMermaidExtensionHtml(-1, 'invalid'));
});

test('Mermaid 원본 코드블럭을 접힌 Confluence source HTML로 만든다', () => {
  assert.equal(
    buildCollapsedMermaidSourceHtml('flowchart LR\r\n  A --> B\n<script>'),
    '<div data-node-type="expand" data-title="Mermaid 원본" data-expanded="false"><pre><code>flowchart LR\n  A --&gt; B\n&lt;script&gt;</code></pre></div>',
  );
});

test('Mermaid 컴포넌트와 접힌 원본을 한 번의 치환용 HTML로 만든다', () => {
  const html = buildConfluenceMermaidReplacementHtml(10, 'replacement-id', 'flowchart LR\n  A --> B');

  assert.match(html, /^<div data-node-type="extension"/);
  assert.match(html, /&quot;guestParams&quot;:\{&quot;index&quot;:10\}/);
  assert.match(html, /data-local-id="replacement-id"><\/div><div data-node-type="expand"/);
  assert.match(html, /data-title="Mermaid 원본" data-expanded="false">/);
  assert.match(html, /<pre><code>flowchart LR\n  A --&gt; B<\/code><\/pre><\/div>$/);
});

test('Confluence 본문의 Markdown 제어 문자를 이스케이프한다', () => {
  assert.equal(
    escapeMarkdownText('배포 *상태*와 [링크], `코드`, file_name'),
    '배포 \\*상태\\*와 \\[링크\\], \\`코드\\`, file\\_name',
  );
});

test('Confluence 고정 헤더용 단일행 표만 실제 표 앞에서 중복으로 판별한다', () => {
  assert.equal(
    isRedundantHeaderOnlyTable(
      [[' 프로파일 ', '핵심 특징']],
      [['프로파일', '핵심 특징'], ['공통', '기본 설정'], ['local', '로컬 설정']],
    ),
    true,
  );
  assert.equal(
    isRedundantHeaderOnlyTable(
      [['프로파일', '핵심 특징']],
      [['환경', '설명'], ['local', '로컬 설정']],
    ),
    false,
  );
  assert.equal(
    isRedundantHeaderOnlyTable(
      [['프로파일', '핵심 특징']],
      [['프로파일', '핵심 특징']],
    ),
    false,
  );
});
