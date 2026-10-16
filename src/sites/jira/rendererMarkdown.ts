/**
 * Jira 읽기 화면 본문(`.ak-renderer-document`)을 Markdown 으로 옮긴다. 설명과 댓글이 함께 쓴다.
 *
 * **첨부 이미지는 데이터로 넣는다.** 화면에 그려진 이미지 주소로 다시 받아 `data:` URI 로 바꾼다.
 * 주소만 넣으면 토큰이 만료되거나 로그인이 없는 곳(VS Code)에서 깨진다. 못 받은 이미지는
 * `(이미지 첨부)` 로 남는다.
 *
 * docs/plans/jira-markdown-copy-images/spec.md
 */

import { convertRendererToMarkdown } from '../../platform/editor/renderer-to-markdown';
import { fetchMediaImagesAsDataUris, isMediaImageUrl } from './api/media';

export interface CopiedMarkdown {
  markdown: string;
  /** 첨부 이미지 중 데이터로 넣은 수 / 넣으려 한 수 */
  images: { embedded: number; total: number };
}

/** 본문을 옮긴다. 비어 있으면 `markdown` 이 빈 문자열이다 — 무엇이 비었는지는 호출부가 말한다 */
export async function rendererToMarkdownWithImages(body: HTMLElement): Promise<CopiedMarkdown> {
  const sources = Array.from(body.querySelectorAll<HTMLImageElement>('img'), (image) => image.src);
  const { dataUris, total } = await fetchMediaImagesAsDataUris(sources);
  const markdown = convertRendererToMarkdown(body, {
    // 첨부 이미지만 바꾼다. 못 받았으면 밖에서 열리지 않는 주소 대신 `(이미지 첨부)` 를 넣는다.
    resolveImage: (src) => (isMediaImageUrl(src) ? dataUris.get(src) ?? null : undefined),
  });
  return { markdown, images: { embedded: dataUris.size, total } };
}

/** 복사 결과 라벨. 이미지가 있으면 몇 장을 넣었는지 붙인다 */
export function describeCopyResult(images: { embedded: number; total: number }): string {
  return images.total > 0 ? `복사됨 · 이미지 ${images.embedded}/${images.total}` : '복사됨';
}
