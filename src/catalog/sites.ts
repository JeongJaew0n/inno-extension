import type { FeatureDescriptor, FeatureId, SiteDescriptor, SiteId } from './types';

export const SITES = [
  {
    id: 'amaranth',
    name: '아마란스',
    hostLabel: 'gw.innogrid.com',
    origin: 'https://gw.innogrid.com',
    contentMatches: ['https://gw.innogrid.com/*'],
    color: '#00b978',
    features: [
      {
        id: 'attendanceHeader',
        name: '헤더 출퇴근 버튼',
        description: '출퇴근 버튼을 헤더에서 사용하고 현재 시각의 출근 인사말을 복사합니다.',
        routeSummary: 'gw.innogrid.com 전체 화면',
        defaultEnabled: true,
        hasDetails: true,
      },
      {
        id: 'titleAutofill',
        name: '신청서 제목 자동채움',
        description: '근태신청서의 제목을 미리 저장한 문구로 한 번에 입력합니다.',
        routeSummary: '아마란스 근태신청서 작성 화면',
        defaultEnabled: true,
        hasDetails: true,
      },
      {
        id: 'notificationTools',
        name: '통합알림 새로고침·인증번호 복사',
        description: '통합알림을 바로 갱신하고 메일의 인증번호를 한 번에 복사합니다.',
        routeSummary: '아마란스 통합알림 전체 탭',
        defaultEnabled: true,
        hasDetails: true,
      },
    ],
  },
  {
    id: 'jira',
    name: 'Jira',
    hostLabel: 'pms-innogrid.atlassian.net',
    origin: 'https://pms-innogrid.atlassian.net',
    contentMatches: [
      'https://pms-innogrid.atlassian.net/jira/*',
      'https://pms-innogrid.atlassian.net/browse/*',
      'https://pms-innogrid.atlassian.net/issues/*',
    ],
    color: '#6554c0',
    features: [
      {
        id: 'issueLinkCopy',
        name: '업무 링크 복사',
        description: '선택한 Jira 업무 링크를 제목 포함 여부에 따라 복사합니다.',
        routeSummary: '모든 Jira 보드의 선택 이슈',
        defaultEnabled: true,
        hasDetails: true,
      },
    ],
  },
  {
    id: 'confluence',
    name: 'Confluence',
    hostLabel: 'pms-innogrid.atlassian.net/wiki',
    origin: 'https://pms-innogrid.atlassian.net/wiki',
    contentMatches: ['https://pms-innogrid.atlassian.net/wiki/*'],
    color: '#1868db',
    features: [
      {
        id: 'pageMarkdownCopy',
        name: '본문 Markdown 복사',
        description: '현재 Confluence 문서의 본문을 Markdown 형식으로 복사합니다.',
        routeSummary: 'Confluence 문서 조회 화면',
        defaultEnabled: true,
        hasDetails: true,
      },
      {
        id: 'pageMarkdownAppend',
        name: 'Markdown -> ADF 변환',
        description: 'Markdown과 Mermaid 코드블럭을 ADF로 변환하고 코드블럭 서식을 벗깁니다.',
        routeSummary: 'Extension Popup 및 Confluence 문서 편집 화면',
        defaultEnabled: false,
        hasDetails: true,
      },
    ],
  },
  {
    id: 'githubEnterprise',
    name: 'GitHub Enterprise',
    hostLabel: 'github.nhnent.com',
    origin: 'https://github.nhnent.com',
    contentMatches: ['https://github.nhnent.com/*'],
    color: '#1f2328',
    features: [
      {
        id: 'pullRequestTitleCopy',
        name: 'PR 제목 링크 복사',
        description: 'PR 제목을 Markdown 링크 형식으로 복사합니다.',
        routeSummary: '저장소 PR 목록과 PR 상세 화면',
        defaultEnabled: true,
        hasDetails: true,
      },
    ],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    hostLabel: 'rnd-app.innogrid.com',
    origin: 'https://rnd-app.innogrid.com',
    contentMatches: ['https://rnd-app.innogrid.com/*'],
    color: '#fc6d26',
    features: [
      {
        id: 'commitShaCopy',
        name: '커밋 번호 복사',
        description: 'Merge Request 개요 화면의 커밋 번호를 전체 SHA로 복사합니다.',
        routeSummary: 'Merge Request 개요 탭의 커밋 목록',
        defaultEnabled: true,
        hasDetails: true,
      },
    ],
  },
] as const satisfies readonly SiteDescriptor[];

export function findSiteDescriptor(siteId: SiteId): SiteDescriptor {
  const site = SITES.find((candidate) => candidate.id === siteId);
  if (!site) throw new Error(`등록되지 않은 사이트입니다: ${siteId}`);
  return site;
}

export function findFeatureDescriptor(siteId: SiteId, featureId: FeatureId): FeatureDescriptor {
  const feature = findSiteDescriptor(siteId).features.find((candidate) => candidate.id === featureId);
  if (!feature) throw new Error(`등록되지 않은 기능입니다: ${siteId}.${featureId}`);
  return feature;
}
