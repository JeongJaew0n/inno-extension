/**
 * 주입 UI 공용 컴포넌트 CSS.
 *
 * **손으로 쓰지 않는다. `design/generate-parts.py` 가 만든다.**
 *
 *     npm run design:sync
 *
 * 정본은 `design/components.css` 다. 눈으로 보려면 `design/index.html` 을 연다.
 *
 * ## 쓰는 법
 *
 * 필요한 조각만 골라 `<style>` 에 이어 붙인다. 토큰이 먼저 와야 한다.
 *
 * ```ts
 * shadow.innerHTML = `<style>${DESIGN_TOKENS}${BUTTON_CSS}</style>…`;
 * ```
 *
 * **하나씩 따로 내보낸다.** 객체 하나에 담으면 Rollup 이 속성 단위로 지우지 못해
 * 조각 하나를 쓰려고 전부를 지고 가게 된다.
 */

/** 599자 */
export const STATE_LAYER_CSS = `.inno-state-layer{position:relative;isolation:isolate;--inno-state-on:var(--inno-on-surface);}
.inno-state-layer::after{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--inno-state-on);opacity:0;transition:opacity 0.12s ease;pointer-events:none;}
.inno-state-layer:hover::after{opacity:var(--inno-state-hover);}
.inno-state-layer:focus-visible::after{opacity:var(--inno-state-focus);}
.inno-state-layer:active::after{opacity:var(--inno-state-pressed);}
.inno-state-layer:disabled::after{opacity:0;}
/* ============================================================`;

/** 1,896자 */
export const BUTTON_CSS = `.inno-btn{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;gap:var(--inno-space-1);box-sizing:border-box;min-height:var(--inno-control-sm);padding:0 var(--inno-space-2);border:1px solid transparent;border-radius:var(--inno-shape-xs);background:transparent;color:var(--inno-on-surface-variant);font-family:var(--inno-font);font-size:var(--inno-label-md);font-weight:var(--inno-label-md-weight);line-height:var(--inno-control-sm);white-space:nowrap;cursor:pointer;--inno-state-on:var(--inno-on-surface);}
.inno-btn::after{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--inno-state-on);opacity:0;transition:opacity 0.12s ease;pointer-events:none;}
.inno-btn:hover::after{opacity:var(--inno-state-hover);}
.inno-btn:active::after{opacity:var(--inno-state-pressed);}
.inno-btn:focus-visible{outline:2px solid var(--inno-primary);outline-offset:2px;}
.inno-btn:disabled{cursor:default;opacity:0.38;}
.inno-btn:disabled::after{opacity:0;}
.inno-btn svg{width:14px;height:14px;flex:0 0 auto;}
.inno-btn--md{min-height:var(--inno-control-md);padding:0 var(--inno-space-3);font-size:var(--inno-label-lg);font-weight:var(--inno-label-lg-weight);line-height:var(--inno-control-md);}
.inno-btn--md svg{width:16px;height:16px;}
.inno-btn--icon{width:var(--inno-control-sm);min-height:var(--inno-control-sm);padding:0;}
.inno-btn--icon.inno-btn--md{width:var(--inno-control-md);}
.inno-btn--ok{color:var(--inno-primary);}
.inno-btn--fail{color:var(--inno-error);}
.inno-btn--filled{background:var(--inno-primary);color:var(--inno-on-primary);font-weight:600;--inno-state-on:var(--inno-on-primary);}
.inno-btn--outlined{border-color:var(--inno-outline);color:var(--inno-on-surface);}
.inno-btn--error{color:var(--inno-error);--inno-state-on:var(--inno-error);}
/* ============================================================`;

/** 575자 */
export const CHIP_CSS = `.inno-chip{display:inline-flex;align-items:center;gap:var(--inno-space-1);box-sizing:border-box;min-width:0;max-width:320px;min-height:var(--inno-control-sm);padding:0 var(--inno-space-2);border-radius:var(--inno-shape-xs);background:var(--inno-surface-container);color:var(--inno-on-surface-variant);font-size:var(--inno-label-md);line-height:var(--inno-control-sm);}
.inno-chip svg{width:14px;height:14px;flex:0 0 auto;}
.inno-chip__text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
/* ============================================================`;

/** 752자 */
export const BADGE_CSS = `.inno-badge{display:inline-flex;align-items:center;padding:1px var(--inno-space-1);border-radius:var(--inno-shape-full);background:var(--inno-surface-container-highest);color:var(--inno-on-surface-variant);font-size:var(--inno-label-sm);font-weight:700;white-space:nowrap;}
.inno-badge--primary{background:var(--inno-primary-container);color:var(--inno-on-primary-container);}
.inno-badge--secondary{background:var(--inno-secondary-container);color:var(--inno-on-secondary-container);}
.inno-badge--tertiary{background:var(--inno-tertiary-container);color:var(--inno-on-tertiary-container);}
.inno-badge--error{background:var(--inno-error-container);color:var(--inno-on-error-container);}
/* ============================================================`;

/** 2,490자 */
export const DROPDOWN_CSS = `.inno-dropdown{position:relative;display:inline-flex;}
.inno-dropdown__trigger{position:relative;isolation:isolate;display:inline-flex;align-items:center;gap:var(--inno-space-1);box-sizing:border-box;min-width:0;max-width:240px;min-height:var(--inno-control-sm);padding:0 var(--inno-space-2);border:1px solid var(--inno-outline);border-radius:var(--inno-shape-xs);background:var(--inno-surface-container-lowest);color:var(--inno-on-surface);font-family:var(--inno-font);font-size:var(--inno-label-md);cursor:pointer;--inno-state-on:var(--inno-on-surface);}
.inno-dropdown__trigger::after{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--inno-state-on);opacity:0;transition:opacity 0.12s ease;pointer-events:none;}
.inno-dropdown__trigger:hover::after{opacity:var(--inno-state-hover);}
.inno-dropdown__trigger:focus-visible{outline:2px solid var(--inno-primary);outline-offset:2px;}
.inno-dropdown__trigger>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.inno-dropdown__caret{color:var(--inno-on-surface-variant);}
.inno-menu{position:absolute;top:calc(100% + var(--inno-space-1));left:0;z-index:30;box-sizing:border-box;min-width:300px;max-height:320px;overflow-y:auto;padding:var(--inno-space-1);border-radius:var(--inno-shape-sm);background:var(--inno-elevation-3);box-shadow:var(--inno-shadow-3);}
.inno-menu__row{position:relative;isolation:isolate;display:flex;align-items:center;gap:var(--inno-space-3);width:100%;padding:var(--inno-space-1) var(--inno-space-2);border:0;border-radius:var(--inno-shape-xs);background:transparent;color:var(--inno-on-surface);font-family:var(--inno-font);font-size:var(--inno-label-md);text-align:left;cursor:pointer;--inno-state-on:var(--inno-on-surface);}
.inno-menu__row::after{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--inno-state-on);opacity:0;transition:opacity 0.12s ease;pointer-events:none;}
.inno-menu__row:hover::after{opacity:var(--inno-state-hover);}
.inno-menu__name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.inno-menu__meta{flex:0 0 auto;color:var(--inno-on-surface-variant);font-size:var(--inno-label-sm);}
.inno-menu__divider{height:1px;margin:var(--inno-space-1) 0;background:var(--inno-outline-variant);}
.inno-menu__empty{padding:var(--inno-space-2);color:var(--inno-on-surface-variant);font-size:var(--inno-body-md);}
/* ============================================================`;

/** 792자 */
export const PANEL_CSS = `.inno-panel{display:flex;flex-direction:column;box-sizing:border-box;height:100%;border-radius:var(--inno-shape-sm);background:var(--inno-surface);box-shadow:var(--inno-shadow-3);overflow:hidden;}
.inno-panel__header{display:flex;align-items:center;gap:var(--inno-space-2);padding:var(--inno-space-2) var(--inno-space-3);background:var(--inno-elevation-2);color:var(--inno-on-surface);font-size:var(--inno-body-lg);}
.inno-panel__title{font-size:var(--inno-title-md);font-weight:var(--inno-title-md-weight);line-height:var(--inno-title-md-lh);}
.inno-panel__sub{color:var(--inno-on-surface-variant);font-size:var(--inno-body-md);}
.inno-panel__spacer{flex:1;}
.inno-panel__body{flex:1;overflow:auto;padding:var(--inno-space-3);}
/* ============================================================`;

/** 1,812자 */
export const BOARD_CSS = `.inno-columns{display:flex;gap:var(--inno-space-3);align-items:flex-start;min-width:min-content;}
.inno-column{flex:0 0 260px;box-sizing:border-box;padding:var(--inno-space-2);border-radius:var(--inno-shape-sm);background:var(--inno-surface-container-low);}
.inno-column__title{display:flex;align-items:center;gap:var(--inno-space-1);margin:0 0 var(--inno-space-2);color:var(--inno-on-surface-variant);font-size:var(--inno-label-sm);font-weight:700;letter-spacing:0.04em;text-transform:uppercase;}
.inno-column__count{color:var(--inno-outline);font-weight:400;}
.inno-card{position:relative;isolation:isolate;display:block;width:100%;box-sizing:border-box;margin-bottom:var(--inno-space-2);padding:var(--inno-space-2);border:0;border-radius:var(--inno-shape-xs);background:var(--inno-surface-container-lowest);box-shadow:var(--inno-shadow-1);color:var(--inno-on-surface);font-family:var(--inno-font);font-size:var(--inno-body-lg);line-height:var(--inno-body-lg-lh);text-align:left;cursor:pointer;--inno-state-on:var(--inno-on-surface);}
.inno-card::after{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--inno-state-on);opacity:0;transition:opacity 0.12s ease;pointer-events:none;}
.inno-card:hover::after{opacity:var(--inno-state-hover);}
.inno-card:focus-visible{outline:2px solid var(--inno-primary);outline-offset:2px;}
.inno-card__parent{color:var(--inno-on-surface-variant);font-size:var(--inno-body-sm);}
.inno-card__meta{display:flex;align-items:center;gap:var(--inno-space-1);margin-top:var(--inno-space-2);color:var(--inno-on-surface-variant);font-size:var(--inno-label-sm);}
.inno-card__meta img{width:16px;height:16px;border-radius:50%;}
.inno-card__key{font-weight:600;}
.inno-card__spacer{flex:1;}
/* ============================================================`;

/** 1,131자 */
export const MENU_CSS = `.inno-listbox{margin:0;padding:var(--inno-space-1);list-style:none;border-radius:var(--inno-shape-sm);background:var(--inno-elevation-3);box-shadow:var(--inno-shadow-3);max-height:240px;overflow-y:auto;}
.inno-listbox__item{padding:var(--inno-space-1) var(--inno-space-2);border-radius:var(--inno-shape-xs);color:var(--inno-on-surface);font-size:var(--inno-body-lg);white-space:nowrap;cursor:pointer;}
.inno-listbox__item:hover{background:var(--inno-surface-container-highest);}
.inno-listbox__item[aria-selected="true"]{background:var(--inno-secondary-container);color:var(--inno-on-secondary-container);font-weight:600;}
.inno-listbox__footer{display:block;width:100%;margin-top:var(--inno-space-1);padding:var(--inno-space-1) var(--inno-space-2);border:0;border-top:1px solid var(--inno-outline-variant);background:transparent;color:var(--inno-on-surface-variant);font-family:var(--inno-font);font-size:var(--inno-label-md);text-align:left;cursor:pointer;}
.inno-listbox__footer:hover{background:var(--inno-surface-container-highest);color:var(--inno-on-surface);}
/* ============================================================`;

/** 235자 */
export const STATUS_TEXT_CSS = `.inno-state{padding:var(--inno-space-6);color:var(--inno-on-surface-variant);font-size:var(--inno-body-lg);text-align:center;}
.inno-state--error{color:var(--inno-error);}
/* ============================================================`;

/** 671자 */
export const TABLE_CSS = `.inno-table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--inno-outline-variant);border-radius:var(--inno-shape-sm);overflow:hidden;table-layout:fixed;}
.inno-table th{padding:var(--inno-space-1) var(--inno-space-2);background:var(--inno-surface-container);color:var(--inno-on-surface-variant);font-size:var(--inno-label-sm);font-weight:700;text-align:left;}
.inno-table td{padding:var(--inno-space-1) var(--inno-space-2);border-top:1px solid var(--inno-outline-variant);font-size:var(--inno-body-md);vertical-align:middle;}
.inno-table tr.is-muted td:first-child{opacity:0.38;}
/* ============================================================`;

/** 883자 */
export const TOGGLE_CSS = `.inno-switch{position:relative;display:inline-flex;width:36px;height:20px;flex:0 0 auto;cursor:pointer;}
.inno-switch input{position:absolute;width:1px;height:1px;opacity:0;}
.inno-switch__track{width:36px;height:20px;border-radius:var(--inno-shape-full);background:var(--inno-outline);transition:background 0.15s;}
.inno-switch__track::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--inno-surface-container-lowest);box-shadow:var(--inno-shadow-1);transition:transform 0.15s;}
.inno-switch input:checked + .inno-switch__track{background:var(--inno-primary);}
.inno-switch input:checked + .inno-switch__track::after{transform:translateX(16px);}
.inno-switch input:focus-visible + .inno-switch__track{outline:2px solid var(--inno-primary);outline-offset:2px;}
/* ============================================================`;

/** 759자 */
export const INPUT_CSS = `.inno-field{display:grid;gap:var(--inno-space-1);}
.inno-field__label{color:var(--inno-on-surface-variant);font-size:var(--inno-label-sm);font-weight:700;}
.inno-input{box-sizing:border-box;width:100%;min-height:var(--inno-control-md);padding:0 var(--inno-space-2);border:1px solid var(--inno-outline);border-radius:var(--inno-shape-xs);background:var(--inno-surface-container-lowest);color:var(--inno-on-surface);font-family:var(--inno-font);font-size:var(--inno-body-md);}
.inno-input:focus-visible{outline:2px solid var(--inno-primary);outline-offset:0;border-color:var(--inno-primary);}
.inno-input--mono{font-family:var(--inno-font-mono);}
.inno-help{color:var(--inno-on-surface-variant);font-size:var(--inno-body-sm);line-height:var(--inno-body-sm-lh);}`;

// 조각 12개 · CSS 합계 12,595자
