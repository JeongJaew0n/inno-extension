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

export const ATTENDANCE_KIND = {
  checkin: 'checkin',
  checkout: 'checkout',
} as const;

export type AttendanceKind = (typeof ATTENDANCE_KIND)[keyof typeof ATTENDANCE_KIND];
