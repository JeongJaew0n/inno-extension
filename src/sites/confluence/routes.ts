export const CONFLUENCE_ORIGIN = 'https://pms-innogrid.atlassian.net';

export interface ConfluencePageRoute {
  spaceKey: string;
  pageId: string;
}

export function parseConfluencePageId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      if (new URL(trimmed).origin !== CONFLUENCE_ORIGIN) return null;
    } catch {
      return null;
    }
  }

  const patterns = [
    /\/pages\/edit-v2\/(\d+)/,
    /\/pages\/edit\/(\d+)/,
    /[?&]fromPageId=(\d+)/,
    /\/pages\/(\d+)(?:\/|$)/,
    /[?&]pageId=(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function isSameConfluencePage(left: string, right: string): boolean {
  const leftPageId = parseConfluencePageId(left);
  return leftPageId !== null && leftPageId === parseConfluencePageId(right);
}

export function parseConfluencePageUrl(url: URL): ConfluencePageRoute | null {
  if (url.origin !== CONFLUENCE_ORIGIN) return null;

  const match = url.pathname.match(/^\/wiki\/spaces\/([^/]+)\/pages\/(\d+)(?:\/|$)/);
  if (!match) return null;

  return {
    spaceKey: decodeURIComponent(match[1]),
    pageId: match[2],
  };
}

export function isConfluencePageRoute(url: URL): boolean {
  return parseConfluencePageUrl(url) !== null;
}
