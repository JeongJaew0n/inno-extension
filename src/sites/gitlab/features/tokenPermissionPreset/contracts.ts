/**
 * GitLab 토큰 권한 프리셋의 순수 로직.
 *
 * 화면·Vue 와 무관한 판정만 모아 테스트한다. 선택기 조작은 MAIN world 브리지가,
 * 버튼은 `runtime.ts` 가 한다.
 *
 * docs/plans/gitlab-token-permission-preset/spec.md
 */

/** fine-grained 토큰 생성 화면. 토큰 목록 화면에서는 돌지 않는다 */
const TOKEN_CREATE_PATH = /^\/-\/user_settings\/personal_access_tokens\/granular\/new\/?$/;

export function isTokenCreateRoute(url: URL): boolean {
  return TOKEN_CREATE_PATH.test(url.pathname);
}

/**
 * 권한 선택기의 경계 이름. GitLab 이 `permissionsByBoundary` 의 키로 쓴다.
 * 화면에는 `Group and project` · `User` · `Global` 로 보인다.
 */
export const BOUNDARIES = ['namespace', 'user', 'instance'] as const;
export type Boundary = (typeof BOUNDARIES)[number];

export const BOUNDARY_LABELS: Record<Boundary, string> = {
  namespace: 'Group and project',
  user: 'User',
  instance: 'Global',
};

/**
 * 프리셋 — 경계별로 통째로 고를 카테고리.
 *
 * 개발·배포에 쓰는 묶음이다. 고른 카테고리 안의 **모든 리소스·모든 동작**이 선택된다.
 * 설정에 저장하지 않는다. 코드에 두면 다음 릴리즈에서 목록을 고쳤을 때 모두가 그대로 받는다.
 *
 * 실측(2026-09-30, rnd-app): 선택되는 권한 383 · 73 · 87, 합 543.
 */
export const PRESET_CATEGORIES: Record<Boundary, readonly string[]> = {
  namespace: [
    'CI/CD', 'Groups', 'Integrations', 'Packages and Registry', 'Project Features',
    'Project Planning', 'Projects', 'Repository', 'System Access', 'System Migration', 'Wiki',
  ],
  user: [
    'CI/CD', 'Groups', 'Packages and Registry', 'Project Features', 'Project Planning',
    'Projects', 'Repository', 'Search', 'System Access', 'System Migration',
  ],
  instance: [
    'CI/CD', 'Groups', 'Organizations', 'Packages and Registry', 'Project Features', 'Projects',
  ],
};

/** 접근 범위 라디오 중 프리셋이 고르는 것 */
export const ACCESS_SCOPE_LABEL = /^All groups and projects/i;

/** GitLab 권한 항목 중 쓰는 필드만 */
export interface PermissionEntry {
  name: string;
  resource: string;
  categoryName: string;
}

export type PermissionsByBoundary = Partial<Record<Boundary, readonly unknown[]>>;

export interface BoundaryStat {
  boundary: Boundary;
  resources: number;
  permissions: number;
}

export interface PresetSelection {
  /** `emitInput` 에 그대로 넘길 값. 경계별 권한 이름 */
  value: Record<Boundary, string[]>;
  stats: BoundaryStat[];
  /** 프리셋에 있는데 화면에 없는 카테고리. `Group and project > Wiki` 모양 */
  missing: string[];
}

function toEntry(raw: unknown): PermissionEntry | null {
  const item = raw as Partial<PermissionEntry> | null;
  if (!item || typeof item.name !== 'string' || typeof item.categoryName !== 'string') return null;
  return {
    name: item.name,
    resource: typeof item.resource === 'string' ? item.resource : '',
    categoryName: item.categoryName,
  };
}

/** 화면이 가진 권한 목록에서 프리셋에 해당하는 것을 고른다 */
export function selectPresetPermissions(
  permissionsByBoundary: PermissionsByBoundary,
  preset: Record<Boundary, readonly string[]> = PRESET_CATEGORIES,
): PresetSelection {
  const value = {} as Record<Boundary, string[]>;
  const stats: BoundaryStat[] = [];
  const missing: string[] = [];

  for (const boundary of BOUNDARIES) {
    const entries = (permissionsByBoundary[boundary] ?? [])
      .map(toEntry)
      .filter((entry): entry is PermissionEntry => entry !== null);
    const wanted = new Set(preset[boundary]);
    const present = new Set(entries.map((entry) => entry.categoryName));
    for (const category of preset[boundary]) {
      if (!present.has(category)) missing.push(`${BOUNDARY_LABELS[boundary]} > ${category}`);
    }

    const picked = entries.filter((entry) => wanted.has(entry.categoryName));
    value[boundary] = [...new Set(picked.map((entry) => entry.name))];
    stats.push({
      boundary,
      resources: new Set(picked.map((entry) => entry.resource)).size,
      permissions: value[boundary].length,
    });
  }

  return { value, stats, missing };
}

/** 선택기가 목록을 다 불러왔는지. 첫 경계가 비어 있으면 아직이다 */
export function hasLoadedPermissions(permissionsByBoundary: PermissionsByBoundary | null | undefined): boolean {
  return Array.isArray(permissionsByBoundary?.namespace) && permissionsByBoundary.namespace.length > 0;
}

// ---------------------------------------------------------------------------- 브리지 계약

export const TOKEN_PRESET_REQUEST_EVENT = 'inno-extension:gitlab:apply-token-preset';
export const TOKEN_PRESET_RESPONSE_EVENT = 'inno-extension:gitlab:apply-token-preset-result';

export interface TokenPresetResult {
  ok: boolean;
  /** 실패 이유. `ok` 면 없다 */
  message?: string;
  stats: BoundaryStat[];
  missing: string[];
  /** 접근 범위 라디오를 찾았는지 */
  scopeSelected: boolean;
  /** 적용 뒤에도 `Select permissions` 로 남은 리소스 수 */
  unsetResources: number;
}

export function failedResult(message: string): TokenPresetResult {
  return { ok: false, message, stats: [], missing: [], scopeSelected: false, unsetResources: 0 };
}

/** 응답을 믿지 않고 모양을 맞춘다. 다른 스크립트가 같은 이벤트를 쏠 수도 있다 */
export function normalizeResult(raw: unknown): TokenPresetResult {
  const source = (raw ?? {}) as Partial<TokenPresetResult>;
  if (source.ok !== true) {
    return failedResult(typeof source.message === 'string' ? source.message : '권한을 선택하지 못했습니다.');
  }
  const stats = Array.isArray(source.stats)
    ? source.stats.filter((stat): stat is BoundaryStat => (
      !!stat && BOUNDARIES.includes(stat.boundary)
      && Number.isFinite(stat.resources) && Number.isFinite(stat.permissions)
    ))
    : [];
  return {
    ok: true,
    stats,
    missing: Array.isArray(source.missing) ? source.missing.filter((item) => typeof item === 'string') : [],
    scopeSelected: source.scopeSelected === true,
    unsetResources: Number.isFinite(source.unsetResources) ? Number(source.unsetResources) : 0,
  };
}

/** 버튼 옆에 적을 결과. 첫 줄이 요약, 나머지가 경고다 */
export function describeResult(result: TokenPresetResult): { tone: 'ok' | 'warn' | 'fail'; lines: string[] } {
  if (!result.ok) return { tone: 'fail', lines: [result.message ?? '권한을 선택하지 못했습니다.'] };

  const total = result.stats.reduce((sum, stat) => sum + stat.permissions, 0);
  const lines = [
    `권한 ${total}개 선택 — `
      + result.stats.map((stat) => `${BOUNDARY_LABELS[stat.boundary]} ${stat.permissions}`).join(' · '),
  ];
  if (!result.scopeSelected) lines.push('접근 범위(All groups and projects)를 직접 고르세요.');
  if (result.unsetResources > 0) lines.push(`권한이 비어 있는 리소스 ${result.unsetResources}개`);
  if (result.missing.length > 0) lines.push(`화면에 없는 카테고리: ${result.missing.join(', ')}`);

  return { tone: lines.length > 1 ? 'warn' : 'ok', lines };
}
