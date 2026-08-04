import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import type { BoardInspectorOptions, FeatureSettings } from '../../../../platform/settings/types';
import {
  BOARD_CARD,
  BOARD_CARD_KEY,
  BOARD_INSPECTOR_ROOT,
} from '../../selectors';
import { parseJiraBoardUrl, uniqueIssueKeys } from '../../routes';

interface BoardSnapshot {
  boardId: string;
  boardName: string | null;
  issueCount: number;
  projectKey: string;
  selectedIssueKey: string | null;
}

function readOptions(settings: FeatureSettings): BoardInspectorOptions {
  const projectKeys = settings.options.supportedProjectKeys;
  const boardIds = settings.options.supportedBoardIds;
  return {
    supportedProjectKeys: Array.isArray(projectKeys)
      ? projectKeys.filter((value): value is string => typeof value === 'string')
      : ['NPT'],
    supportedBoardIds: Array.isArray(boardIds)
      ? boardIds.filter((value): value is string => typeof value === 'string')
      : ['2146'],
  };
}

function findBoardScope(document: Document): Element {
  return document.querySelector('[role="main"]')
    ?? document.querySelector('main')
    ?? document.body;
}

function captureSnapshot(context: PageContext, boardId: string, projectKey: string, selectedIssueKey: string | null): BoardSnapshot {
  const scope = findBoardScope(context.document);
  const hrefs: Array<string | null> = [];
  for (const card of scope.querySelectorAll(BOARD_CARD)) {
    const keyArea = card.querySelector(BOARD_CARD_KEY);
    const issueLink = keyArea?.querySelector<HTMLAnchorElement>('a[href^="/browse/"]')
      ?? card.querySelector<HTMLAnchorElement>('a[href^="/browse/"]');
    if (issueLink) hrefs.push(issueLink.getAttribute('href'));
  }

  if (hrefs.length === 0) {
    for (const card of scope.querySelectorAll('[draggable="true"]')) {
      const issueLink = card.querySelector(BOARD_CARD_KEY)
        ?.querySelector<HTMLAnchorElement>('a[href^="/browse/"]');
      if (issueLink) hrefs.push(issueLink.getAttribute('href'));
    }
  }

  const issueKeys = uniqueIssueKeys(hrefs);
  return {
    boardId,
    boardName: scope.querySelector('h1')?.textContent?.trim() || null,
    issueCount: issueKeys.length,
    projectKey,
    selectedIssueKey,
  };
}

export function createBoardInspectorRuntime(): FeatureRuntime {
  let host: HTMLDivElement | null = null;

  function dispose(): void {
    host?.remove();
    host = null;
  }

  function ensureHost(context: PageContext): HTMLDivElement {
    if (host?.isConnected) return host;
    host = context.document.createElement('div');
    host.setAttribute(FEATURE_ROOT_ATTRIBUTE, BOARD_INSPECTOR_ROOT);
    host.style.all = 'initial';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .panel {
          position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; width: 220px;
          box-sizing: border-box; padding: 14px; border: 1px solid #dfe1e6; border-radius: 12px;
          background: #fff; box-shadow: 0 8px 24px rgba(9, 30, 66, 0.18); color: #172b4d;
        }
        h2 { margin: 0 0 10px; font-size: 14px; line-height: 20px; }
        .row { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; font-size: 12px; line-height: 18px; }
        .label { color: #626f86; }
        .value { overflow: hidden; font-weight: 600; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
      </style>
      <section class="panel" aria-label="Jira 보드 정보 패널">
        <h2>Jira 보드 정보</h2>
        <div class="row"><span class="label">보드</span><span class="value" data-field="board"></span></div>
        <div class="row"><span class="label">화면 이슈</span><span class="value" data-field="issues"></span></div>
        <div class="row"><span class="label">선택 이슈</span><span class="value" data-field="selected"></span></div>
      </section>
    `;
    context.document.documentElement.appendChild(host);
    return host;
  }

  function render(context: PageContext, snapshot: BoardSnapshot): void {
    const shadow = ensureHost(context).shadowRoot;
    if (!shadow) return;
    const boardLabel = snapshot.boardName
      ? `${snapshot.boardName} #${snapshot.boardId}`
      : `${snapshot.projectKey} #${snapshot.boardId}`;
    const values = {
      board: boardLabel,
      issues: String(snapshot.issueCount),
      selected: snapshot.selectedIssueKey ?? '없음',
    };
    for (const [field, value] of Object.entries(values)) {
      const element = shadow.querySelector<HTMLElement>(`[data-field="${field}"]`);
      if (element && element.textContent !== value) element.textContent = value;
    }
  }

  return {
    id: 'boardInspector',

    reconcile(context: PageContext, settings: FeatureSettings): void {
      const route = parseJiraBoardUrl(context.url.href);
      const options = readOptions(settings);
      if (!route
        || route.viewPath !== ''
        || !options.supportedProjectKeys.includes(route.projectKey)
        || !options.supportedBoardIds.includes(route.boardId)) {
        dispose();
        return;
      }
      render(
        context,
        captureSnapshot(context, route.boardId, route.projectKey, route.selectedIssueKey),
      );
    },

    dispose,
  };
}
