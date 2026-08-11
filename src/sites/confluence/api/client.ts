import type { ConfluenceCredentials } from '../../../platform/credentials/confluence';
import type {
  ConfluenceErrorCode,
  ConfluenceErrorPayload,
  ConfluencePageAdfDocument,
  ConfluenceUpdatedPage,
} from '../../../platform/messages/confluence';
import { CONFLUENCE_ORIGIN, parseConfluencePageId } from '../routes';

const CONFLUENCE_V2_API_BASE = `${CONFLUENCE_ORIGIN}/wiki/api/v2`;

interface ConfluenceErrorBody {
  message?: string;
  errors?: Array<{ title?: string; detail?: string }>;
}

interface ConfluencePageResponse {
  id: string;
  title: string;
  status?: string;
  spaceId?: string;
  version?: { number: number };
  body?: { atlas_doc_format?: { value: string } };
}

interface ConfluenceUpdateResponse {
  id: string;
  _links?: { webui?: string };
}

class ConfluenceApiError extends Error {
  readonly code: ConfluenceErrorCode;
  readonly status?: number;

  constructor(code: ConfluenceErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ConfluenceApiError';
    this.code = code;
    this.status = status;
  }
}

function createAuthHeader(credentials: ConfluenceCredentials): string {
  return `Basic ${btoa(`${credentials.email}:${credentials.apiToken}`)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAdfDocument(value: unknown): value is Record<string, unknown> & { content: unknown[] } {
  return isRecord(value)
    && value.type === 'doc'
    && value.version === 1
    && Array.isArray(value.content);
}

function parseAdfValue(raw: string): unknown {
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ConfluenceErrorBody;
    if (body.message) return body.message;
    if (body.errors?.length) {
      return body.errors.map((entry) => entry.detail ?? entry.title).filter(Boolean).join('; ');
    }
  } catch {
    // Fall back to the HTTP status text.
  }

  if (response.status === 401 || response.status === 403) {
    return 'Confluence 인증에 실패했습니다. 이메일과 API 토큰을 확인하세요.';
  }

  return response.statusText || `HTTP ${response.status}`;
}

async function assertOk(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) return;

  const message = await parseErrorMessage(response);
  if (response.status === 401) {
    throw new ConfluenceApiError('unauthorized', message, response.status);
  }
  if (response.status === 403) {
    throw new ConfluenceApiError('forbidden', message, response.status);
  }
  if (response.status === 404) {
    throw new ConfluenceApiError('not_found', message, response.status);
  }
  if (response.status === 409 || /conflict|version/i.test(message)) {
    throw new ConfluenceApiError('conflict', message, response.status);
  }
  if (response.status >= 400 && response.status < 500) {
    throw new ConfluenceApiError('bad_request', message || fallbackMessage, response.status);
  }

  throw new ConfluenceApiError('unknown', message || fallbackMessage, response.status);
}

function buildRequestInit(
  credentials: ConfluenceCredentials,
  init?: Omit<RequestInit, 'headers'> & { headers?: HeadersInit },
): RequestInit {
  return {
    ...init,
    headers: {
      Authorization: createAuthHeader(credentials),
      Accept: 'application/json',
      ...init?.headers,
    },
  };
}

async function fetchPageByStatus(
  credentials: ConfluenceCredentials,
  pageId: string,
  status?: string,
): Promise<Response> {
  const query = new URLSearchParams({ 'body-format': 'atlas_doc_format' });
  if (status) query.set('status', status);

  return fetch(
    `${CONFLUENCE_V2_API_BASE}/pages/${pageId}?${query.toString()}`,
    buildRequestInit(credentials),
  );
}

function assertPageUpdatePayload(payload: {
  pageId: string;
  title: string;
  status: string;
  currentVersion: number;
  adf: unknown;
}): void {
  if (!/^\d+$/.test(payload.pageId)) {
    throw new ConfluenceApiError('bad_request', '유효한 페이지 ID가 필요합니다.');
  }
  if (payload.title.trim().length === 0) {
    throw new ConfluenceApiError('bad_request', '페이지 제목이 비어 있습니다.');
  }
  if (payload.status.trim().length === 0) {
    throw new ConfluenceApiError('bad_request', '페이지 상태가 비어 있습니다.');
  }
  if (payload.status !== 'current' && payload.status !== 'draft') {
    throw new ConfluenceApiError('bad_request', '현재 문서 또는 초안만 업데이트할 수 있습니다.');
  }
  if (!Number.isInteger(payload.currentVersion) || payload.currentVersion < 1) {
    throw new ConfluenceApiError('bad_request', '페이지 버전이 올바르지 않습니다.');
  }
  if (!isAdfDocument(payload.adf)) {
    throw new ConfluenceApiError('bad_request', '업데이트할 ADF 문서 형식이 올바르지 않습니다.');
  }
}

export async function fetchConfluencePageAdf(
  credentials: ConfluenceCredentials,
  pageIdOrUrl: string,
): Promise<ConfluencePageAdfDocument> {
  const pageId = parseConfluencePageId(pageIdOrUrl);
  if (!pageId) {
    throw new ConfluenceApiError('bad_request', '페이지 URL 또는 ID를 인식할 수 없습니다.');
  }

  let response = await fetchPageByStatus(credentials, pageId);
  if (response.status === 404) {
    response = await fetchPageByStatus(credentials, pageId, 'draft');
  }

  await assertOk(response, 'Confluence 페이지를 조회하지 못했습니다.');

  const body = (await response.json()) as ConfluencePageResponse;
  const adf = parseAdfValue(body.body?.atlas_doc_format?.value ?? '');
  const version = body.version?.number;
  if (typeof body.id !== 'string'
    || typeof body.title !== 'string'
    || !Number.isInteger(version)
    || (version ?? 0) < 1
    || !isAdfDocument(adf)) {
    throw new ConfluenceApiError('unknown', 'Confluence 페이지 응답의 ADF 형식이 올바르지 않습니다.');
  }
  return {
    id: body.id,
    title: body.title,
    status: body.status ?? 'current',
    spaceId: body.spaceId ?? '',
    version: version as number,
    adf,
  };
}

export async function updateConfluencePageAdf(
  credentials: ConfluenceCredentials,
  payload: {
    pageId: string;
    title: string;
    status: string;
    currentVersion: number;
    adf: unknown;
  },
): Promise<ConfluenceUpdatedPage> {
  assertPageUpdatePayload(payload);

  const response = await fetch(
    `${CONFLUENCE_V2_API_BASE}/pages/${payload.pageId}`,
    buildRequestInit(credentials, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: payload.pageId,
        status: payload.status,
        title: payload.title.trim(),
        body: {
          representation: 'atlas_doc_format',
          value: JSON.stringify(payload.adf),
        },
        version: {
          number: payload.status === 'draft' ? payload.currentVersion : payload.currentVersion + 1,
        },
      }),
    }),
  );

  await assertOk(response, 'Confluence 페이지를 업데이트하지 못했습니다.');

  const body = (await response.json()) as ConfluenceUpdateResponse;
  return {
    id: body.id,
    url: body._links?.webui
      ? `${CONFLUENCE_ORIGIN}${body._links.webui}`
      : `${CONFLUENCE_ORIGIN}/wiki/pages/${payload.pageId}`,
  };
}

export function toConfluenceErrorPayload(error: unknown): ConfluenceErrorPayload {
  if (error instanceof ConfluenceApiError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
    };
  }

  if (error instanceof TypeError) {
    return {
      code: 'network',
      message: 'Confluence 요청 중 네트워크 오류가 발생했습니다.',
    };
  }

  if (error instanceof Error) {
    return {
      code: 'unknown',
      message: error.message,
    };
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return {
      code: 'unknown',
      message: error.message,
    };
  }

  return {
    code: 'unknown',
    message: '알 수 없는 오류가 발생했습니다.',
  };
}
