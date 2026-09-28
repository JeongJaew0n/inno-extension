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
const DECLARATIONS = '--inno-primary-0:#000000;--inno-primary-10:#001f29;--inno-primary-20:#003544;--inno-primary-30:#084d61;--inno-primary-40:#2b6579;--inno-primary-50:#477e93;--inno-primary-60:#6298ae;--inno-primary-70:#7cb3c9;--inno-primary-80:#98cee5;--inno-primary-90:#b9eaff;--inno-primary-95:#ddf4ff;--inno-primary-100:#ffffff;--inno-secondary-0:#000000;--inno-secondary-10:#0d1e24;--inno-secondary-20:#22333a;--inno-secondary-30:#384951;--inno-secondary-40:#506169;--inno-secondary-50:#687a82;--inno-secondary-60:#81949c;--inno-secondary-70:#9caeb7;--inno-secondary-80:#b7cad2;--inno-secondary-90:#d2e6ee;--inno-secondary-95:#e0f4fd;--inno-secondary-100:#ffffff;--inno-tertiary-0:#000000;--inno-tertiary-10:#301400;--inno-tertiary-20:#522209;--inno-tertiary-30:#6d391f;--inno-tertiary-40:#885035;--inno-tertiary-50:#a4694c;--inno-tertiary-60:#c08264;--inno-tertiary-70:#dd9c7d;--inno-tertiary-80:#fbb797;--inno-tertiary-90:#ffdbcb;--inno-tertiary-95:#ffede5;--inno-tertiary-100:#ffffff;--inno-neutral-0:#000000;--inno-neutral-10:#1e1b19;--inno-neutral-20:#33302e;--inno-neutral-30:#4a4644;--inno-neutral-40:#615e5c;--inno-neutral-50:#7a7674;--inno-neutral-60:#94908e;--inno-neutral-70:#afaaa8;--inno-neutral-80:#cac6c3;--inno-neutral-90:#e6e2df;--inno-neutral-95:#f4f0ed;--inno-neutral-100:#ffffff;--inno-neutral-variant-0:#000000;--inno-neutral-variant-10:#191c1b;--inno-neutral-variant-20:#2e312f;--inno-neutral-variant-30:#444846;--inno-neutral-variant-40:#5b5f5d;--inno-neutral-variant-50:#747876;--inno-neutral-variant-60:#8d9290;--inno-neutral-variant-70:#a8acaa;--inno-neutral-variant-80:#c3c7c5;--inno-neutral-variant-90:#dfe3e1;--inno-neutral-variant-95:#edf2ef;--inno-neutral-variant-100:#ffffff;--inno-error-0:#000000;--inno-error-10:#40000b;--inno-error-20:#67001c;--inno-error-30:#91002b;--inno-error-40:#b22640;--inno-error-50:#d14457;--inno-error-60:#f06070;--inno-error-70:#ff888f;--inno-error-80:#ffb3b5;--inno-error-90:#ffdada;--inno-error-95:#ffecec;--inno-error-100:#ffffff;--inno-primary:#245f73;--inno-on-primary:#ffffff;--inno-primary-container:#b9eaff;--inno-on-primary-container:#001f29;--inno-secondary:#506169;--inno-on-secondary:#ffffff;--inno-secondary-container:#d2e6ee;--inno-on-secondary-container:#0d1e24;--inno-tertiary:#733e24;--inno-on-tertiary:#ffffff;--inno-tertiary-container:#ffc9b0;--inno-on-tertiary-container:#301400;--inno-error:#b22640;--inno-on-error:#ffffff;--inno-error-container:#ffdada;--inno-on-error-container:#40000b;--inno-surface:#fdf8f6;--inno-on-surface:#1e1b19;--inno-surface-variant:#dfe3e1;--inno-on-surface-variant:#444846;--inno-surface-container-lowest:#ffffff;--inno-surface-container-low:#f7f3f0;--inno-surface-container:#f1edeb;--inno-surface-container-high:#ece7e5;--inno-surface-container-highest:#e6e2df;--inno-outline:#747876;--inno-outline-variant:#c3c7c5;--inno-state-hover:0.08;--inno-state-focus:0.10;--inno-state-pressed:0.12;--inno-font:-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif;--inno-font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--inno-label-sm:11px;--inno-label-sm-lh:16px;--inno-label-sm-weight:500;--inno-label-md:12px;--inno-label-md-lh:16px;--inno-label-md-weight:500;--inno-label-lg:13px;--inno-label-lg-lh:20px;--inno-label-lg-weight:600;--inno-body-sm:11px;--inno-body-sm-lh:16px;--inno-body-md:12px;--inno-body-md-lh:18px;--inno-body-lg:13px;--inno-body-lg-lh:20px;--inno-title-sm:13px;--inno-title-sm-lh:20px;--inno-title-sm-weight:600;--inno-title-md:15px;--inno-title-md-lh:22px;--inno-title-md-weight:600;--inno-shape-none:0;--inno-shape-xs:4px;--inno-shape-sm:6px;--inno-shape-md:10px;--inno-shape-lg:14px;--inno-shape-full:999px;--inno-space-1:4px;--inno-space-2:8px;--inno-space-3:12px;--inno-space-4:16px;--inno-space-5:20px;--inno-space-6:24px;--inno-elevation-0:var(--inno-surface);--inno-elevation-1:var(--inno-surface-container-low);--inno-elevation-2:var(--inno-surface-container);--inno-elevation-3:var(--inno-surface-container-high);--inno-shadow-1:0 1px 2px rgba(0,0,0,0.12);--inno-shadow-3:0 8px 20px rgba(0,0,0,0.16);--inno-control-sm:24px;--inno-control-md:32px;';

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
