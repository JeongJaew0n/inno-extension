/**
 * 주입 UI 공용 디자인 토큰.
 *
 * **손으로 쓰지 않는다. `design/generate-tokens.py` 가 만든다.**
 *
 *     python3 design/generate-tokens.py --ts > src/platform/design/tokens.ts
 *
 * 값의 뜻과 배정 규칙은 `design/tokens.css` 와 `design/README.md` 에 있다.
 * 이 파일은 그것을 런타임이 쓸 수 있는 형태로 옮긴 것뿐이다.
 *
 * ## 왜 문자열 하나인가
 *
 * 각 기능의 `<style>` 에 그대로 끼워 넣는다. 토큰을 선언하는 자리가 여기 하나뿐이라
 * 색 하나를 바꿔도 13개 파일을 돌아다닐 일이 없다.
 *
 * 호스트 요소에 `setProperty` 로 얹는 방법도 되지만 **더 느리다.** 실측에서 토큰
 * 145개 · shadow root 13개 기준으로 CSS 파싱은 0.53ms, `setProperty` 는 3.33ms 였다.
 * JS 호출이 CSS 파서보다 비싸다.
 *
 * ## `:root` 가 아니라 `:host` 인 이유
 *
 * shadow root 는 `:root` 에 걸리지 않는다. `:host` 가 shadow 의 최상위다.
 *
 * ## 주의
 *
 * 우리가 토큰을 선언하지 않으면 **페이지의 같은 이름 변수가 그 자리를 차지한다.**
 * 커스텀 속성은 shadow 경계를 넘어 상속되고 `all: initial` 도 그것을 막지 못한다
 * (Chrome 실측). `--inno-` 접두사와 이 선언이 함께 있어야 막힌다.
 */

/** 토큰 145개의 선언만. 선택자가 없으므로 그대로 쓰지 말고 아래 둘 중 하나를 쓴다. */
const DECLARATIONS = '--inno-primary-0:#000001;--inno-primary-10:#000965;--inno-primary-20:#00149e;--inno-primary-30:#2e28c7;--inno-primary-40:#5540e4;--inno-primary-50:#775aff;--inno-primary-60:#9a7aff;--inno-primary-70:#b79bff;--inno-primary-80:#d1bcff;--inno-primary-90:#e9ddff;--inno-primary-95:#f4eeff;--inno-primary-100:#ffffff;--inno-secondary-0:#000001;--inno-secondary-10:#1e182d;--inno-secondary-20:#342d44;--inno-secondary-30:#4b435b;--inno-secondary-40:#635a74;--inno-secondary-50:#7c738d;--inno-secondary-60:#968ca8;--inno-secondary-70:#b0a7c3;--inno-secondary-80:#ccc2df;--inno-secondary-90:#e8defc;--inno-secondary-95:#f4eeff;--inno-secondary-100:#ffffff;--inno-tertiary-0:#000000;--inno-tertiary-10:#380a1a;--inno-tertiary-20:#50212f;--inno-tertiary-30:#6a3745;--inno-tertiary-40:#844f5c;--inno-tertiary-50:#9e6875;--inno-tertiary-60:#ba818e;--inno-tertiary-70:#d69ba9;--inno-tertiary-80:#f3b6c4;--inno-tertiary-90:#ffd9e1;--inno-tertiary-95:#ffecf0;--inno-tertiary-100:#ffffff;--inno-neutral-0:#000001;--inno-neutral-10:#1c1b20;--inno-neutral-20:#312f35;--inno-neutral-30:#48464c;--inno-neutral-40:#605d64;--inno-neutral-50:#78767d;--inno-neutral-60:#929096;--inno-neutral-70:#adaab1;--inno-neutral-80:#c8c5cd;--inno-neutral-90:#e4e1e9;--inno-neutral-95:#f2eff7;--inno-neutral-100:#ffffff;--inno-neutral-variant-0:#000001;--inno-neutral-variant-10:#1d1a24;--inno-neutral-variant-20:#322f3a;--inno-neutral-variant-30:#494551;--inno-neutral-variant-40:#615c69;--inno-neutral-variant-50:#7a7582;--inno-neutral-variant-60:#938e9c;--inno-neutral-variant-70:#aea9b7;--inno-neutral-variant-80:#c9c4d3;--inno-neutral-variant-90:#e5e0ef;--inno-neutral-variant-95:#f4eefd;--inno-neutral-variant-100:#ffffff;--inno-error-0:#000000;--inno-error-10:#3e0400;--inno-error-20:#68000f;--inno-error-30:#91071b;--inno-error-40:#af2d31;--inno-error-50:#ce4a47;--inno-error-60:#ed655f;--inno-error-70:#ff8980;--inno-error-80:#ffb4ab;--inno-error-90:#ffdad6;--inno-error-95:#ffedea;--inno-error-100:#ffffff;--inno-primary:#5540e4;--inno-on-primary:#ffffff;--inno-primary-container:#e9ddff;--inno-on-primary-container:#000965;--inno-secondary:#635a74;--inno-on-secondary:#ffffff;--inno-secondary-container:#e8defc;--inno-on-secondary-container:#1e182d;--inno-tertiary:#844f5c;--inno-on-tertiary:#ffffff;--inno-tertiary-container:#ffd9e1;--inno-on-tertiary-container:#380a1a;--inno-error:#af2d31;--inno-on-error:#ffffff;--inno-error-container:#ffdad6;--inno-on-error-container:#3e0400;--inno-surface:#fbf8ff;--inno-on-surface:#1c1b20;--inno-surface-variant:#e5e0ef;--inno-on-surface-variant:#494551;--inno-surface-container-lowest:#ffffff;--inno-surface-container-low:#f5f2fa;--inno-surface-container:#efedf4;--inno-surface-container-high:#eae7ee;--inno-surface-container-highest:#e4e1e9;--inno-outline:#7a7582;--inno-outline-variant:#c9c4d3;--inno-state-hover:0.08;--inno-state-focus:0.10;--inno-state-pressed:0.12;--inno-font:-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif;--inno-font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--inno-label-sm:11px;--inno-label-sm-lh:16px;--inno-label-sm-weight:500;--inno-label-md:12px;--inno-label-md-lh:16px;--inno-label-md-weight:500;--inno-label-lg:13px;--inno-label-lg-lh:20px;--inno-label-lg-weight:600;--inno-body-sm:11px;--inno-body-sm-lh:16px;--inno-body-md:12px;--inno-body-md-lh:18px;--inno-body-lg:13px;--inno-body-lg-lh:20px;--inno-title-sm:13px;--inno-title-sm-lh:20px;--inno-title-sm-weight:600;--inno-title-md:15px;--inno-title-md-lh:22px;--inno-title-md-weight:600;--inno-shape-none:0;--inno-shape-xs:4px;--inno-shape-sm:6px;--inno-shape-md:10px;--inno-shape-lg:14px;--inno-shape-full:999px;--inno-space-1:4px;--inno-space-2:8px;--inno-space-3:12px;--inno-space-4:16px;--inno-space-5:20px;--inno-space-6:24px;--inno-elevation-0:var(--inno-surface);--inno-elevation-1:var(--inno-surface-container-low);--inno-elevation-2:var(--inno-surface-container);--inno-elevation-3:var(--inno-surface-container-high);--inno-shadow-1:0 1px 2px rgba(0,0,0,0.12);--inno-shadow-3:0 8px 20px rgba(0,0,0,0.16);--inno-control-sm:24px;--inno-control-md:32px;';

/**
 * Shadow DOM 용. `<style>` 맨 앞에 넣는다.
 *
 * ```ts
 * shadow.innerHTML = `<style>${DESIGN_TOKENS}${BUTTON_CSS}</style>…`;
 * ```
 */
export const DESIGN_TOKENS = `:host{${DECLARATIONS}}`;

/**
 * 페이지에 직접 넣는 `<style>` 용.
 *
 * 아마란스처럼 Shadow DOM 을 쓰지 않고 주입 루트 id 로 범위를 잡는 기능이 있다.
 * 거기서는 `:host` 가 걸리지 않으므로 그 루트 선택자로 선언한다.
 *
 * ```ts
 * const css = `${designTokensFor(`#${INJECTED_ID}`)} …`;
 * ```
 *
 * **`:root` 에 넣지 않는다.** 남의 페이지 전역에 우리 변수를 뿌리게 된다.
 */
export function designTokensFor(selector: string): string {
  return `${selector}{${DECLARATIONS}}`;
}
