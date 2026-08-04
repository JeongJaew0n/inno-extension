export const NOTI_DETAILS = '.noti-details';
export const CHECKIN_LI = '.worktime ul.btns li:nth-child(1)';
export const CHECKOUT_LI = '.worktime ul.btns li:nth-child(2)';
export const ACTIVE_CLASS = 'active';
export const INJECTED_ID = 'inno-amaranth-attendance-header';
export const STYLE_ID = `${INJECTED_ID}-style`;

export const ATTENDANCE_KIND = {
  checkin: 'checkin',
  checkout: 'checkout',
} as const;

export type AttendanceKind = (typeof ATTENDANCE_KIND)[keyof typeof ATTENDANCE_KIND];
