export function formatCheckinGreeting(date: Date): string {
  return `${date.getHours()}시 ${date.getMinutes()}분 출근입니다.`;
}
