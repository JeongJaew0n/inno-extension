export const SITE_IDS = ['amaranth', 'jira', 'confluence'] as const;
export type SiteId = (typeof SITE_IDS)[number];

export const FEATURE_IDS = [
  'attendanceHeader',
  'titleAutofill',
  'notificationTools',
  'issueLinkCopy',
  'boardInspector',
  'pageMarkdownCopy',
  'pageMarkdownAppend',
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

export interface FeatureDescriptor {
  id: FeatureId;
  name: string;
  description: string;
  routeSummary: string;
  defaultEnabled: boolean;
  hasDetails: boolean;
}

export interface SiteDescriptor {
  id: SiteId;
  name: string;
  hostLabel: string;
  origin: string;
  contentMatches: readonly string[];
  color: string;
  features: readonly FeatureDescriptor[];
}
