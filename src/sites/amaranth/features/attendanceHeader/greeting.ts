import type { CheckinTime } from './checkinTime';

export function formatCheckinGreeting(time: CheckinTime): string {
  return `${time.hours}시 ${time.minutes}분 출근입니다.`;
}
