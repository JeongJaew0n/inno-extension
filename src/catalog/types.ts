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
  'boardSprintInfo',
  'pastSprintView',
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
  /**
   * 사이트 API 를 부르는 기능인지.
   *
   * **기본은 API 를 쓰지 않는 것이다.** DOM 으로 안 되는 것만 쓰고, 그런 기능은 여기에 표시해
   * 특별 관리한다 — 읽기만, 사용자가 실제로 쓸 때만, 그 사이트 오리진으로만.
   *
   * 표시하지 않은 기능의 파일에서 네트워크 호출이 발견되면 **테스트가 깨진다.**
   *
   * CLAUDE.md '특별 관리란'
   */
  usesNetwork?: boolean;
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
