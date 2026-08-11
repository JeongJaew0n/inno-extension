import type { ConfluenceCredentials } from '../credentials/confluence';

export const CONFLUENCE_GET_CREDENTIALS = 'confluence.credentials.get';
export const CONFLUENCE_SAVE_CREDENTIALS = 'confluence.credentials.save';
export const CONFLUENCE_CLEAR_CREDENTIALS = 'confluence.credentials.clear';
export const CONFLUENCE_FETCH_PAGE = 'confluence.page.fetch';
export const CONFLUENCE_UPDATE_PAGE = 'confluence.page.update';

export interface ConfluenceCredentialSummary {
  email: string;
  hasApiToken: boolean;
}

export interface ConfluencePageAdfDocument {
  id: string;
  title: string;
  status: string;
  spaceId: string;
  version: number;
  adf: unknown;
}

export interface ConfluenceUpdatedPage {
  id: string;
  url: string;
}

export type ConfluenceErrorCode =
  | 'bad_request'
  | 'conflict'
  | 'forbidden'
  | 'invalid_origin'
  | 'missing_credentials'
  | 'network'
  | 'not_found'
  | 'unauthorized'
  | 'untrusted_sender'
  | 'unknown';

export interface ConfluenceErrorPayload {
  code: ConfluenceErrorCode;
  message: string;
  status?: number;
}

export class ConfluenceMessageError extends Error {
  readonly code: ConfluenceErrorCode;
  readonly status?: number;

  constructor(error: ConfluenceErrorPayload) {
    super(error.message);
    this.name = 'ConfluenceMessageError';
    this.code = error.code;
    this.status = error.status;
  }
}

export interface GetConfluenceCredentialsRequest {
  type: typeof CONFLUENCE_GET_CREDENTIALS;
}

export interface SaveConfluenceCredentialsRequest {
  type: typeof CONFLUENCE_SAVE_CREDENTIALS;
  payload: ConfluenceCredentials;
}

export interface ClearConfluenceCredentialsRequest {
  type: typeof CONFLUENCE_CLEAR_CREDENTIALS;
}

export interface FetchConfluencePageRequest {
  type: typeof CONFLUENCE_FETCH_PAGE;
  payload: {
    pageIdOrUrl: string;
  };
}

export interface UpdateConfluencePageRequest {
  type: typeof CONFLUENCE_UPDATE_PAGE;
  payload: {
    pageId: string;
    pageUrl: string;
    tabId: number;
    title: string;
    status: string;
    currentVersion: number;
    adf: unknown;
  };
}

export type ConfluenceBackgroundRequest =
  | GetConfluenceCredentialsRequest
  | SaveConfluenceCredentialsRequest
  | ClearConfluenceCredentialsRequest
  | FetchConfluencePageRequest
  | UpdateConfluencePageRequest;

export type ConfluenceBackgroundResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ConfluenceErrorPayload };

async function sendConfluenceMessage<T>(
  message: ConfluenceBackgroundRequest,
): Promise<T> {
  const response =
    (await chrome.runtime.sendMessage(message)) as ConfluenceBackgroundResponse<T> | undefined;

  if (!response) {
    throw new ConfluenceMessageError({
      code: 'unknown',
      message: 'Confluence background 응답이 비어 있습니다.',
    });
  }

  if (!response.ok) {
    throw new ConfluenceMessageError(response.error);
  }

  return response.data;
}

export async function getCredentialStatus(): Promise<ConfluenceCredentialSummary> {
  return sendConfluenceMessage<ConfluenceCredentialSummary>({
    type: CONFLUENCE_GET_CREDENTIALS,
  });
}

export async function saveCredentials(
  email: string,
  apiToken: string,
): Promise<ConfluenceCredentialSummary> {
  return sendConfluenceMessage<ConfluenceCredentialSummary>({
    type: CONFLUENCE_SAVE_CREDENTIALS,
    payload: { email, apiToken },
  });
}

export async function clearCredentials(): Promise<void> {
  await sendConfluenceMessage<{ cleared: true }>({
    type: CONFLUENCE_CLEAR_CREDENTIALS,
  });
}

export async function fetchPageAdf(pageIdOrUrl: string): Promise<ConfluencePageAdfDocument> {
  return sendConfluenceMessage<ConfluencePageAdfDocument>({
    type: CONFLUENCE_FETCH_PAGE,
    payload: { pageIdOrUrl },
  });
}

export async function updatePageAdf(payload: {
  pageId: string;
  pageUrl: string;
  tabId: number;
  title: string;
  status: string;
  currentVersion: number;
  adf: unknown;
}): Promise<ConfluenceUpdatedPage> {
  return sendConfluenceMessage<ConfluenceUpdatedPage>({
    type: CONFLUENCE_UPDATE_PAGE,
    payload,
  });
}
