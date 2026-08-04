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
        name: '이슈 링크 복사',
        description: '선택한 Jira 이슈 번호를 브라우저 링크 형식으로 복사합니다.',
        routeSummary: 'NPT 보드 2146의 선택 이슈',
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
