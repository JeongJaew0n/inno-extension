import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { findFeatureDescriptor, SITES } from '../src/catalog/sites';
import { createDefaultSettings } from '../src/platform/settings/defaults';
import { isFeatureEffectivelyEnabled, normalizeSettings } from '../src/platform/settings/schema';
import {
  isTitleAutofillRoute,
  normalizeTitleAutofillText,
  TITLE_AUTOFILL_MAX_LENGTH,
} from '../src/sites/amaranth/features/titleAutofill/contracts';
import { formatCheckinGreeting } from '../src/sites/amaranth/features/attendanceHeader/greeting';
import {
  extractVerificationCode,
  findVerificationCodeInNotification,
} from '../src/sites/amaranth/features/notificationTools/contracts';
import {
  escapeMarkdownText,
  isRedundantHeaderOnlyTable,
} from '../src/sites/confluence/features/pageMarkdownCopy/markdown';
import {
  parseConfluenceEditPageUrl,
  parseConfluencePageUrl,
} from '../src/sites/confluence/routes';
import { adfDocumentToEditorHtml } from '../src/sites/confluence/features/editorMarkdownToAdf/adf-to-editor-html';
import { codeBlockMarkdownToAdfPayload } from '../src/sites/confluence/features/editorMarkdownToAdf/code-block-to-adf';
import {
  buildCollapsedMermaidSourceHtml,
  buildConfluenceMermaidExtensionHtml,
  buildConfluenceMermaidReplacementHtml,
  CONFLUENCE_MERMAID_EXTENSION_KEY,
  isMermaidCodeBlockSource,
} from '../src/sites/confluence/features/editorMarkdownToAdf/mermaid';
import { buildIssueClipboardContent } from '../src/sites/jira/features/issueLinkCopy/clipboard';
import { findBoardIssueScope } from '../src/sites/jira/features/issueLinkCopy/runtime';
import {
  extractIssueKeyFromHref,
  isJiraBoardRoute,
  parseJiraBoardUrl,
  parseJiraIssueUrl,
  uniqueIssueKeys,
} from '../src/sites/jira/routes';
import {
  CURRENT_ISSUE_LINK,
  ISSUE_DIALOG,
  ISSUE_PREVIEW_PANEL,
} from '../src/sites/jira/selectors';
import './confluence-adf.test';

function createFakeIssueLink(href: string): HTMLAnchorElement {
  return {
    getAttribute(name: string) {
      return name === 'href' ? href : null;
    },
  } as HTMLAnchorElement;
}

function createFakeIssueScope(hrefs: string[]): ParentNode {
  const links = hrefs.map(createFakeIssueLink);
  return {
    querySelector(selector: string) {
      return selector === CURRENT_ISSUE_LINK ? (links[0] ?? null) : null;
    },
    querySelectorAll(selector: string) {
      return selector === 'a[href]' ? links : [];
    },
  } as unknown as ParentNode;
}

function createFakeIssueDocument(options: {
  dialog?: ParentNode | null;
  panel?: ParentNode | null;
  dialogs?: ParentNode[];
}): Document {
  return {
    querySelector(selector: string) {
      if (selector === ISSUE_DIALOG) return options.dialog ?? null;
      if (selector === ISSUE_PREVIEW_PANEL) return options.panel ?? null;
      return null;
    },
    querySelectorAll(selector: string) {
      return selector === '[role="dialog"]' ? (options.dialogs ?? []) : [];
    },
  } as unknown as Document;
}

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

test('아마란스 출근 인사말은 클릭 시각의 시와 분을 자연어로 만든다', () => {
  assert.equal(formatCheckinGreeting(new Date(2026, 7, 13, 9, 5)), '9시 5분 출근입니다.');
  assert.equal(formatCheckinGreeting(new Date(2026, 7, 13, 18, 0)), '18시 0분 출근입니다.');
});

test('아마란스 인증번호는 독립된 4~6자리 문자열만 추출한다', () => {
  assert.equal(extractVerificationCode('인증번호 1234'), '1234');
  assert.equal(extractVerificationCode('OTP: 12345'), '12345');
  assert.equal(extractVerificationCode('AuthCode: 039911'), '039911');
  assert.equal(extractVerificationCode('123'), null);
  assert.equal(extractVerificationCode('1234567'), null);
  assert.equal(extractVerificationCode('앞1234567뒤'), null);
});

test('아마란스 메일 알림은 인증 문맥에서 제목 우선으로 번호를 찾는다', () => {
  assert.deepEqual(findVerificationCodeInNotification({
    source: '[메일]',
    title: 'AuthCode: 629528',
    body: 'Your authentication token code is 629528.',
  }), { code: '629528', location: 'title' });

  assert.deepEqual(findVerificationCodeInNotification({
    source: ' [메일] ',
    title: '로그인 확인',
    body: '인증번호는 039911 입니다.',
  }), { code: '039911', location: 'body' });
});

test('아마란스 인증번호 감지는 메일 출처와 인증 문맥을 모두 요구한다', () => {
  assert.equal(findVerificationCodeInNotification({
    source: '[업무보고]',
    title: 'OTP: 123456',
    body: '',
  }), null);

  assert.equal(findVerificationCodeInNotification({
    source: '[메일]',
    title: '[WBlock] 메일 리스트 - 2026/08/12 00:00:00',
    body: '',
  }), null);

  assert.equal(findVerificationCodeInNotification({
    source: '[메일]',
    title: 'AuthCode: 1234567',
    body: '',
  }), null);
});

test('아마란스 통합알림 도구는 기본 활성 기능으로 등록된다', () => {
  const descriptor = findFeatureDescriptor('amaranth', 'notificationTools');
  const settings = createDefaultSettings();

  assert.equal(descriptor.name, '통합알림 새로고침·인증번호 복사');
  assert.equal(descriptor.defaultEnabled, true);
  assert.equal(settings.sites.amaranth.features.notificationTools?.enabled, true);
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

test('Jira 보드 업무 scope는 modal이 없으면 우측 preview panel을 사용한다', () => {
  const panel = createFakeIssueScope(['/browse/NPT-144']);
  const target = findBoardIssueScope(createFakeIssueDocument({ panel }), 'NPT-144');

  assert.equal(target?.scope, panel);
  assert.equal(target?.mountKind, 'board-panel-link');
  assert.equal(target?.issueLink.getAttribute('href'), '/browse/NPT-144');
});

test('Jira 보드 업무 scope는 modal과 panel이 함께 있으면 modal을 우선한다', () => {
  const dialog = createFakeIssueScope(['/browse/NPT-144']);
  const panel = createFakeIssueScope(['/browse/NPT-144']);
  const target = findBoardIssueScope(
    createFakeIssueDocument({ dialog, panel, dialogs: [dialog] }),
    'NPT-144',
  );

  assert.equal(target?.scope, dialog);
  assert.equal(target?.mountKind, 'board-dialog-link');
});

test('Jira 보드 업무 scope는 현재 selectedIssue와 일치하는 link만 선택한다', () => {
  const panel = createFakeIssueScope(['/browse/NPT-29', '/browse/NPT-144']);
  const unrelatedDialog = createFakeIssueScope(['/browse/NPT-999']);
  const target = findBoardIssueScope(
    createFakeIssueDocument({ panel, dialogs: [unrelatedDialog] }),
    'NPT-144',
  );

  assert.equal(target?.scope, panel);
  assert.equal(target?.issueLink.getAttribute('href'), '/browse/NPT-144');
  assert.equal(
    findBoardIssueScope(createFakeIssueDocument({ panel }), 'NPT-999'),
    null,
  );
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

test('Confluence 편집기 toolbar는 코드블럭 -> ADF와 Mermaid 버튼만 제공한다', async () => {
  const runtimeSource = await readFile(
    'src/sites/confluence/features/editorMarkdownToAdf/runtime.ts',
    'utf8',
  );

  assert.match(runtimeSource, /data-action="code-block-adf"/);
  assert.match(runtimeSource, /data-code-block-adf-label>코드블럭 -&gt; ADF/);
  assert.match(runtimeSource, /data-action="mermaid"/);
  assert.ok(
    runtimeSource.indexOf('data-action="mermaid"')
      < runtimeSource.indexOf('data-action="code-block-adf"'),
  );
  assert.doesNotMatch(runtimeSource, /data-action="convert"/);
  assert.doesNotMatch(runtimeSource, /data-action="unwrap"/);
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

test('ADF 코드 언어와 expand를 Confluence schema HTML로 직렬화한다', () => {
  assert.equal(
    adfDocumentToEditorHtml({
      type: 'doc',
      version: 1,
      content: [{
        type: 'expand',
        attrs: { title: 'Mermaid <원본>' },
        content: [{
          type: 'codeBlock',
          attrs: { language: 'mermaid' },
          content: [{ type: 'text', text: 'flowchart LR\nA --> B' }],
        }],
      }],
    }),
    '<div data-node-type="expand" data-title="Mermaid &lt;원본&gt;" data-expanded="false"><pre data-language="mermaid"><code>flowchart LR\nA --&gt; B</code></pre></div>',
  );
});

test('Confluence 코드블럭 Markdown을 ADF paste payload로 만든다', () => {
  const payload = codeBlockMarkdownToAdfPayload([
    '## 제목',
    '',
    '| 항목 | 설명 |',
    '| --- | --- |',
    '| API | 첫째<br>둘째 |',
  ].join('\n'));

  assert.equal(payload.warnings.length, 0);
  assert.match(payload.html, /^<h2>제목<\/h2><table>/);
  assert.match(payload.html, /<td><p>첫째<br>둘째<\/p><\/td>/);
  assert.throws(() => codeBlockMarkdownToAdfPayload(''));
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
