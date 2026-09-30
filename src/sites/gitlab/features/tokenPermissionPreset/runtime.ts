import type { FeatureRuntime, PageContext } from '../../../../platform/runtime/types';
import { FEATURE_ROOT_ATTRIBUTE } from '../../../../platform/runtime/featureRoot';
import { DESIGN_TOKENS } from '../../../../platform/design/tokens';
import { BUTTON_CSS } from '../../../../platform/design/parts';
import { TOKEN_PAGE_HEADING, TOKEN_PERMISSION_PRESET_ROOT } from '../../selectors';
import { describeResult, isTokenCreateRoute } from './contracts';
import { requestTokenPreset } from './client';

/**
 * 토큰 생성 화면의 **권한 프리셋 적용** 버튼.
 *
 * 누르면 MAIN world 브리지가 권한을 고른다. 이 런타임은 버튼과 결과 문구만 맡는다.
 * `Generate token` 은 누르지 않는다.
 *
 * docs/plans/gitlab-token-permission-preset/spec.md
 */

const HOST_SELECTOR = `[${FEATURE_ROOT_ATTRIBUTE}="${TOKEN_PERMISSION_PRESET_ROOT}"]`;

/** 이 런타임이 만들어 리스너가 살아 있는 host. 다시 그려진 복제본과 구분한다 */
const liveHosts = new WeakSet<Element>();

const STYLE = `
:host{display:block;margin:var(--inno-space-3) 0}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--inno-space-2);font-family:var(--inno-font)}
.hint{color:var(--inno-on-surface-variant);font-size:var(--inno-label-md)}
.result{margin:var(--inno-space-1) 0 0;padding:0;list-style:none;font-family:var(--inno-font);font-size:var(--inno-label-md);line-height:1.5}
.result[hidden]{display:none}
.result[data-tone="ok"]{color:var(--inno-primary)}
.result[data-tone="warn"]{color:var(--inno-tertiary)}
.result[data-tone="fail"]{color:var(--inno-error)}
`;

function createHost(document: Document): HTMLDivElement {
  const host = document.createElement('div');
  host.setAttribute(FEATURE_ROOT_ATTRIBUTE, TOKEN_PERMISSION_PRESET_ROOT);

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${DESIGN_TOKENS}${BUTTON_CSS}${STYLE}</style>
    <div class="row">
      <button type="button" class="inno-btn inno-btn--outlined inno-btn--md" data-action="apply">권한 프리셋 적용</button>
      <span class="hint">개발·배포 권한을 한 번에 선택합니다. 생성은 직접 누르세요.</span>
    </div>
    <ul class="result" hidden></ul>
  `;

  const button = shadow.querySelector<HTMLButtonElement>('[data-action="apply"]');
  const result = shadow.querySelector<HTMLUListElement>('.result');
  if (button && result) {
    button.addEventListener('click', async (event) => {
      // 폼 안에 있지 않지만, 혹시 감싸여도 제출로 번지지 않게 한다
      event.preventDefault();
      event.stopPropagation();

      button.disabled = true;
      button.textContent = '적용 중…';
      result.hidden = true;

      const outcome = describeResult(await requestTokenPreset(document));

      result.replaceChildren(...outcome.lines.map((line) => {
        const item = document.createElement('li');
        item.textContent = line;
        return item;
      }));
      result.dataset.tone = outcome.tone;
      result.hidden = false;
      button.textContent = '권한 프리셋 적용';
      button.disabled = false;
    });
  }

  liveHosts.add(host);
  return host;
}

export function createTokenPermissionPresetRuntime(): FeatureRuntime {
  return {
    id: 'tokenPermissionPreset',

    reconcile(context: PageContext) {
      const existing = [...context.document.querySelectorAll(HOST_SELECTOR)];

      const heading = isTokenCreateRoute(context.url)
        ? context.document.querySelector(TOKEN_PAGE_HEADING)
        : null;
      if (!heading) {
        existing.forEach((host) => host.remove());
        return;
      }

      const current = heading.nextElementSibling;
      const keep = current && current.matches(HOST_SELECTOR) && liveHosts.has(current) ? current : null;
      existing.filter((host) => host !== keep).forEach((host) => host.remove());
      if (!keep) heading.insertAdjacentElement('afterend', createHost(context.document));
    },

    dispose() {
      document.querySelectorAll(HOST_SELECTOR).forEach((host) => host.remove());
    },
  };
}
