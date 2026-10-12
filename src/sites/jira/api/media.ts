/**
 * Jira 첨부 이미지를 받아 `data:` URI 로 바꾼다.
 *
 * 설명 Markdown 복사에 이미지를 함께 넣으려고 쓴다. 첨부 이미지 주소는 `token` 이 붙어 금방 만료되고
 * 다른 곳에서는 열리지 않는다. 그래서 주소 대신 **이미지 데이터**를 Markdown 에 넣는다.
 *
 * **Jira 오리진 밖으로 나가는 유일한 요청이다.** 이미지는 `https://media-cdn.atlassian.com` 에서 온다.
 * CLAUDE.md '네트워크는 예외다' 의 "그 사이트 오리진만" 규칙에 대해 사용자가 예외를 허용했다(2026-10-12).
 *
 * | 규칙 | 여기서 |
 * | --- | --- |
 * | 읽기만 | `GET` 외에는 만들지 않는다 |
 * | 시점 | 호출부가 `Markdown 복사` 클릭에서만 부른다. 이 모듈은 스스로 호출하지 않는다 |
 * | 대상 | `media-cdn.atlassian.com/file/…` 만. 화면에 이미 그려진 주소를 그대로 쓴다 |
 * | 인증 | 주소의 `token`. **쿠키를 보내지 않는다**(`credentials: 'omit'`). 토큰을 저장하지 않는다 |
 *
 * 실측(2026-10-12, NPT-670): 쿠키 없이 CORS 로 200 이 오고, 쿠키를 붙이면 CORS 가 막는다.
 *
 * docs/plans/jira-markdown-copy-images/context.md
 */

export const MEDIA_ORIGIN = 'https://media-cdn.atlassian.com';

/** 한 장 상한. 화면 크기 표본은 330KB 안팎이었다 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** 한 번 복사의 합계 상한. 넘으면 남은 이미지는 받지 않는다 */
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

/** 받아도 되는 주소인가. 화면의 첨부 이미지 주소만 허용한다 */
export function isMediaImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.origin === MEDIA_ORIGIN && url.pathname.startsWith('/file/');
}

/** 바이트를 base64 로. 큰 배열에서 호출 스택이 넘치지 않게 조각으로 나눈다 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function toDataUri(mimeType: string, bytes: Uint8Array): string {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

export interface MediaImageResult {
  /** 받은 주소 → `data:` URI. 못 받은 주소는 없다 */
  dataUris: Map<string, string>;
  /** 받으려 한 이미지 수(중복 제외) */
  total: number;
}

/**
 * 첨부 이미지들을 받아 `data:` URI 로 바꾼다.
 *
 * 하나가 실패해도 나머지는 계속한다. 실패한 주소는 결과에 없고 호출부가 `(이미지 첨부)` 로 남긴다.
 */
export async function fetchMediaImagesAsDataUris(urls: readonly string[]): Promise<MediaImageResult> {
  const unique = [...new Set(urls.filter(isMediaImageUrl))];
  const dataUris = new Map<string, string>();
  let totalBytes = 0;

  // 차례로 받는다. 합계 상한을 앞에서부터 확실히 지키고, 미디어 서버에 요청을 몰지 않는다.
  for (const url of unique) {
    try {
      const response = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim();
      if (!mimeType.startsWith('image/')) throw new Error(`이미지가 아닙니다: ${mimeType || '알 수 없음'}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`이미지가 너무 큽니다: ${bytes.length}B`);
      if (totalBytes + bytes.length > MAX_TOTAL_BYTES) throw new Error('이미지 합계 상한을 넘었습니다');
      totalBytes += bytes.length;
      dataUris.set(url, toDataUri(mimeType, bytes));
    } catch (error) {
      console.warn('[Inno Extension] Jira 첨부 이미지를 받지 못했습니다', error);
    }
  }

  return { dataUris, total: unique.length };
}
