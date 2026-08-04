import { FEATURE_IDS, SITE_IDS, type FeatureId, type SiteId } from '../catalog/types';

export type PopupRoute =
  | { page: 'sites' }
  | { page: 'settings' }
  | { page: 'site'; siteId: SiteId }
  | { page: 'feature'; siteId: SiteId; featureId: FeatureId };

function isSiteId(value: string): value is SiteId {
  return SITE_IDS.some((siteId) => siteId === value);
}

function isFeatureId(value: string): value is FeatureId {
  return FEATURE_IDS.some((featureId) => featureId === value);
}

export function parsePopupRoute(hash: string): PopupRoute {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/settings') return { page: 'settings' };

  const featureMatch = path.match(/^\/sites\/([^/]+)\/features\/([^/]+)$/);
  if (featureMatch && isSiteId(featureMatch[1]) && isFeatureId(featureMatch[2])) {
    return { page: 'feature', siteId: featureMatch[1], featureId: featureMatch[2] };
  }

  const siteMatch = path.match(/^\/sites\/([^/]+)$/);
  if (siteMatch && isSiteId(siteMatch[1])) return { page: 'site', siteId: siteMatch[1] };
  return { page: 'sites' };
}

export function siteRoute(siteId: SiteId): string {
  return `#/sites/${siteId}`;
}

export function featureRoute(siteId: SiteId, featureId: FeatureId): string {
  return `#/sites/${siteId}/features/${featureId}`;
}
