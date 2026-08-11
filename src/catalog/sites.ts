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
        description: '출근과 퇴근 버튼을 화면 상단 헤더에서 바로 사용할 수 있습니다.',
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
    ],
  },
  {
    id: 'jira',
    name: 'Jira',
    hostLabel: 'pms-innogrid.atlassian.net',
    origin: 'https://pms-innogrid.atlassian.net',
    contentMatches: ['https://pms-innogrid.atlassian.net/jira/*'],
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
      {
        id: 'boardInspector',
        name: 'NPT 보드 정보 패널',
        description: '현재 보드와 화면에 표시된 이슈 정보를 작은 패널로 보여줍니다.',
        routeSummary: '설정한 Jira 프로젝트와 보드',
        defaultEnabled: false,
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
