export const NOTI_DETAILS = '.noti-details';
export const CHECKIN_LI = '.worktime ul.btns li:nth-child(1)';
export const CHECKOUT_LI = '.worktime ul.btns li:nth-child(2)';
export const ACTIVE_CLASS = 'active';
export const INJECTED_ID = 'inno-amaranth-attendance-header';
export const STYLE_ID = `${INJECTED_ID}-style`;

export const TITLE_AUTOFILL_BUTTON_ID = 'inno-amaranth-title-autofill';
export const TITLE_AUTOFILL_STYLE_ID = `${TITLE_AUTOFILL_BUTTON_ID}-style`;
export const TITLE_FIELD_ROOT = '#text4[data-orbit-component="OBTTextField"]';
export const TITLE_INPUT = `${TITLE_FIELD_ROOT} input[type="text"]`;
export const TITLE_ROW_HEADER = 'th[scope="row"] > div';

export const INTEGRATED_NOTIFICATION_TRIGGER = '#intergratedNotificationBtn';
export const INTEGRATED_NOTIFICATION_POPUP = `${INTEGRATED_NOTIFICATION_TRIGGER} .commonPopup.integratedNotification`;
export const NOTIFICATION_CATEGORY_ITEM = '.categoryFn .item';
export const NOTIFICATION_ACTIVE_CATEGORY_ITEM = '.categoryFn .item.on';
export const NOTIFICATION_DAYLINE = '.dayline';
export const NOTIFICATION_TODAY = '.today';
export const NOTIFICATION_ITEM = `${NOTIFICATION_DAYLINE} + ul > li`;
export const NOTIFICATION_SOURCE = 'dt';
export const NOTIFICATION_TITLE = 'dd.name';
export const NOTIFICATION_BODY_TEXT = '.botline .text';
export const NOTIFICATION_REFRESH_BUTTON_ID = 'inno-amaranth-notification-refresh';
export const NOTIFICATION_COPY_BUTTON_CLASS = 'inno-amaranth-verification-copy';
export const NOTIFICATION_CODE_ROW_CLASS = 'inno-amaranth-verification-row';
export const NOTIFICATION_TOOLS_STYLE_ID = 'inno-amaranth-notification-tools-style';

export const ATTENDANCE_KIND = {
  checkin: 'checkin',
  checkout: 'checkout',
} as const;

export type AttendanceKind = (typeof ATTENDANCE_KIND)[keyof typeof ATTENDANCE_KIND];
