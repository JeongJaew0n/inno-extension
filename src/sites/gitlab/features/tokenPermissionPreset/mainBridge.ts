/**
 * MAIN world 에서 GitLab 권한 선택기(Vue 2)를 조작한다.
 *
 * `__vue__` 는 페이지 world 가 DOM 노드에 붙인 속성이라 content script(ISOLATED)에서는 보이지
 * 않는다. 그래서 여기서 받는다. 요청·응답은 `CustomEvent` 로 주고받는다.
 *
 * **선택만 한다.** 폼을 제출하지 않고 `Generate token` 을 누르지 않는다. 네트워크 요청도 없다 —
 * 권한 목록은 화면이 이미 불러와 둔 것을 쓴다.
 *
 * **GitLab 내부에 기댄다.** 컴포넌트 이름 `PersonalAccessTokenPermissionsSelector` 와 그 메서드
 * `emitInput` · `syncSelectedResources`, 데이터 `permissionsByBoundary`. 버전이 바뀌어 못 찾으면
 * 아무것도 바꾸지 않고 실패로 답한다.
 *
 * docs/plans/gitlab-token-permission-preset/context.md
 */

import {
  ACCESS_SCOPE_LABEL,
  TOKEN_PRESET_REQUEST_EVENT,
  TOKEN_PRESET_RESPONSE_EVENT,
  failedResult,
  hasLoadedPermissions,
  isTokenCreateRoute,
  selectPresetPermissions,
  type PermissionsByBoundary,
  type TokenPresetResult,
} from './contracts';

const BRIDGE_FLAG = '__innoExtensionGitlabTokenPresetBridgeInstalled';
const SELECTOR_NAME = 'PersonalAccessTokenPermissionsSelector';

interface VueInstance {
  $options?: { name?: string };
  $parent?: VueInstance | null;
  $children?: VueInstance[];
  permissionsByBoundary?: PermissionsByBoundary;
  emitInput?: (value: unknown) => void;
  syncSelectedResources?: () => void;
}

type VueElement = Element & { __vue__?: VueInstance };

interface BridgeWindow extends Window {
  [BRIDGE_FLAG]?: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

function vueOf(node: Element | null): VueInstance | null {
  for (let element = node as VueElement | null; element; element = element.parentElement as VueElement | null) {
    if (element.__vue__) return element.__vue__;
  }
  return null;
}

/**
 * 선택기 인스턴스를 찾는다.
 *
 * 실측: Vue 루트가 여럿이라 `main` 에서 아래로만 훑으면 못 찾는다. 선택기 안의 체크박스에서
 * `$parent` 로 올라가는 쪽이 확실하다. 체크박스가 아직 없으면 아래로 훑는 쪽을 보조로 쓴다.
 */
function findSelector(): VueInstance | null {
  const start = document.querySelector('main input[type=checkbox]') ?? document.querySelector('main');
  for (let vm = vueOf(start); vm; vm = vm.$parent ?? null) {
    if (vm.$options?.name === SELECTOR_NAME) return vm;
  }
  const walk = (vm: VueInstance | null | undefined): VueInstance | null => {
    if (!vm) return null;
    if (vm.$options?.name === SELECTOR_NAME) return vm;
    for (const child of vm.$children ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  return walk(vueOf(document.querySelector('main')));
}

function labelOf(input: HTMLInputElement): string {
  const label = input.closest('label')
    ?? (input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null);
  return label instanceof HTMLElement ? label.innerText.trim() : '';
}

async function applyPreset(): Promise<TokenPresetResult> {
  if (!isTokenCreateRoute(new URL(location.href))) return failedResult('토큰 생성 화면이 아닙니다.');

  let selector: VueInstance | null = null;
  for (let attempt = 0; attempt < 20 && !(selector = findSelector()); attempt += 1) await sleep(150);
  if (!selector || typeof selector.emitInput !== 'function') {
    return failedResult('권한 선택기를 찾지 못했습니다. GitLab 버전이 바뀌었을 수 있습니다.');
  }

  for (let attempt = 0; attempt < 20 && !hasLoadedPermissions(selector.permissionsByBoundary); attempt += 1) {
    await sleep(150);
  }
  const permissions = selector.permissionsByBoundary;
  if (!permissions || !hasLoadedPermissions(permissions)) return failedResult('권한 목록이 아직 없습니다.');

  const radio = [...document.querySelectorAll<HTMLInputElement>('main input[type=radio]')]
    .find((input) => ACCESS_SCOPE_LABEL.test(labelOf(input)));
  if (radio && !radio.checked) {
    radio.click();
    await sleep(200);
  }

  const selection = selectPresetPermissions(permissions);
  selector.emitInput(selection.value);
  await sleep(100);
  selector.syncSelectedResources?.();
  // 리소스 패널이 다시 그려질 때까지 기다린다. 북마클릿이 실측으로 쓰던 값이다.
  await sleep(1500);

  const unsetResources = [...document.querySelectorAll<HTMLElement>('main button[aria-haspopup]')]
    .filter((button) => button.innerText.trim() === 'Select permissions').length;

  return {
    ok: true,
    stats: selection.stats,
    missing: selection.missing,
    scopeSelected: !!radio,
    unsetResources,
  };
}

export function installTokenPresetBridge(): void {
  const bridgeWindow = window as BridgeWindow;
  if (bridgeWindow[BRIDGE_FLAG]) return;
  bridgeWindow[BRIDGE_FLAG] = true;

  let running = false;

  document.addEventListener(TOKEN_PRESET_REQUEST_EVENT, (event) => {
    let requestId = '';
    if (event instanceof CustomEvent && typeof event.detail === 'string') {
      try {
        const detail = JSON.parse(event.detail) as { requestId?: unknown };
        requestId = typeof detail.requestId === 'string' ? detail.requestId : '';
      } catch {
        return;
      }
    }
    if (!requestId) return;

    const respond = (result: TokenPresetResult): void => {
      document.dispatchEvent(new CustomEvent(TOKEN_PRESET_RESPONSE_EVENT, {
        detail: JSON.stringify({ requestId, ...result }),
      }));
    };

    // 버튼을 연달아 눌러도 한 번만 돈다
    if (running) {
      respond(failedResult('이미 적용 중입니다.'));
      return;
    }
    running = true;
    applyPreset()
      .catch((error: unknown) => failedResult(error instanceof Error ? error.message : '권한을 선택하지 못했습니다.'))
      .then(respond)
      .finally(() => { running = false; });
  });
}
