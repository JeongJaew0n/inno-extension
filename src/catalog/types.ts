export const SITE_IDS = ['amaranth', 'jira', 'confluence', 'githubEnterprise', 'gitlab'] as const;
export type SiteId = (typeof SITE_IDS)[number];

export const FEATURE_IDS = [
  'attendanceHeader',
  'titleAutofill',
  'notificationTools',
  'issueLinkCopy',
  'issueModalWidth',
  'backlogSlashTemplate',
  'pageMarkdownCopy',
  // Confluence 편집기의 Markdown 변환. 이름이 실제 동작과 어긋나지만 그대로 둔다.
  // 바꾸면 `chrome.storage.sync` 의 키가 달라져 이미 켜둔 사용자의 설정이 사라진다.
  'pageMarkdownAppend',
  'editorMarkdownToAdf',
  'descriptionMarkdownCopy',
  'descriptionEditActions',
  'pullRequestTitleCopy',
  'commitShaCopy',
  'githubCommitShaCopy',
  'mergeRequestTitleCopy',
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
