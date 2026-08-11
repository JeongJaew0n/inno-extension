export const CONFLUENCE_ORIGIN = 'https://pms-innogrid.atlassian.net';

export interface ConfluencePageRoute {
  spaceKey: string;
  pageId: string;
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
