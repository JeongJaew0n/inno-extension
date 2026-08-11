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
  isSameConfluencePage,
  parseConfluencePageId,
  parseConfluencePageUrl,
} from '../src/sites/confluence/routes';
import {
  fetchConfluencePageAdf,
  updateConfluencePageAdf,
} from '../src/sites/confluence/api/client';
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
    content_scripts: Array<{ matches: string[] }>;
    host_permissions?: string[];
    permissions?: string[];
  };
  const manifestOrigins = manifest.content_scripts
    .flatMap((entry) => entry.matches)
    .sort();
  const catalogMatches = SITES.flatMap((site) => site.contentMatches).sort();
  assert.deepEqual(manifestOrigins, catalogMatches);
  assert.deepEqual(manifest.host_permissions, ['https://pms-innogrid.atlassian.net/*']);
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
  assert.equal(settings.sites.confluence.features.pageMarkdownExport?.enabled, false);
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

test('Confluence 조회·편집·초안 URL에서 page ID를 추출한다', () => {
  assert.equal(parseConfluencePageId('2166423922'), '2166423922');
  assert.equal(
    parseConfluencePageId('https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/2166423922/title'),
    '2166423922',
  );
  assert.equal(
    parseConfluencePageId('https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/edit-v2/2166423922'),
    '2166423922',
  );
  assert.equal(
    parseConfluencePageId('https://pms-innogrid.atlassian.net/wiki/pages/resumedraft.action?fromPageId=2166423922'),
    '2166423922',
  );
  assert.equal(parseConfluencePageId('not-a-page'), null);
  assert.equal(parseConfluencePageId('https://example.com/wiki/spaces/X/pages/2166423922/title'), null);
});

test('Confluence 쓰기 대상 URL과 page ID가 일치해야 한다', () => {
  const pageUrl = 'https://pms-innogrid.atlassian.net/wiki/spaces/PAAS/pages/2166423922/title';
  assert.equal(isSameConfluencePage(pageUrl, '2166423922'), true);
  assert.equal(isSameConfluencePage(pageUrl, '999'), false);
  assert.equal(
    isSameConfluencePage(pageUrl, 'https://example.com/wiki/spaces/X/pages/2166423922/title'),
    false,
  );
});

test('Confluence ADF 조회는 current 404 후 draft로 재시도한다', async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    if (!url.includes('status=draft')) return new Response('', { status: 404 });
    return new Response(JSON.stringify({
      id: '2166423922',
      title: '초안 문서',
      status: 'draft',
      spaceId: '1',
      version: { number: 3 },
      body: { atlas_doc_format: { value: JSON.stringify({ type: 'doc', version: 1, content: [] }) } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const page = await fetchConfluencePageAdf(
      { email: 'user@example.com', apiToken: 'placeholder' },
      '2166423922',
    );
    assert.equal(page.status, 'draft');
    assert.equal(urls.length, 2);
    assert.match(urls[1], /status=draft/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Confluence ADF 쓰기는 current와 draft version 규칙을 구분한다', async () => {
  const originalFetch = globalThis.fetch;
  const requestBodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({ id: '2166423922', _links: { webui: '/wiki/spaces/PAAS/pages/2166423922' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const base = {
    pageId: '2166423922',
    title: '문서',
    currentVersion: 7,
    adf: { type: 'doc', version: 1 as const, content: [] },
  };
  try {
    await updateConfluencePageAdf(
      { email: 'user@example.com', apiToken: 'placeholder' },
      { ...base, status: 'current' },
    );
    await updateConfluencePageAdf(
      { email: 'user@example.com', apiToken: 'placeholder' },
      { ...base, status: 'draft' },
    );
    assert.deepEqual(requestBodies.map((body) => body.version), [{ number: 8 }, { number: 7 }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Confluence API 오류와 잘못된 ADF 응답을 구분한다', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async () => new Response('', { status: 401 })) as typeof fetch;
    await assert.rejects(
      fetchConfluencePageAdf(
        { email: 'user@example.com', apiToken: 'placeholder' },
        '2166423922',
      ),
      (error: unknown) => (error as { code?: string }).code === 'unauthorized',
    );

    globalThis.fetch = (async () => new Response('', { status: 409 })) as typeof fetch;
    await assert.rejects(
      updateConfluencePageAdf(
        { email: 'user@example.com', apiToken: 'placeholder' },
        {
          pageId: '2166423922',
          title: '문서',
          status: 'current',
          currentVersion: 7,
          adf: { type: 'doc', version: 1, content: [] },
        },
      ),
      (error: unknown) => (error as { code?: string }).code === 'conflict',
    );

    globalThis.fetch = (async () => new Response(JSON.stringify({
      id: '2166423922',
      title: '깨진 문서',
      version: { number: 1 },
      body: { atlas_doc_format: { value: 'not-json' } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    await assert.rejects(
      fetchConfluencePageAdf(
        { email: 'user@example.com', apiToken: 'placeholder' },
        '2166423922',
      ),
      /ADF 형식이 올바르지 않습니다/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
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
