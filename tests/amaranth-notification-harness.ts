import { createNotificationToolsRuntime } from '../src/sites/amaranth/features/notificationTools/runtime';

const tabContent = document.querySelector<HTMLElement>('.tabCon');
const status = document.querySelector<HTMLOutputElement>('#harness-status');
const disableFeature = document.querySelector<HTMLButtonElement>('#disable-feature');
const enableFeature = document.querySelector<HTMLButtonElement>('#enable-feature');
if (!tabContent || !status || !disableFeature || !enableFeature) {
  throw new Error('하네스 root를 찾을 수 없습니다.');
}

let copiedText = '';
let mailVisitCount = 0;
let allVisitCount = 0;
let notificationOpenCount = 0;
let runtime = createNotificationToolsRuntime();

Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: async (text: string): Promise<void> => {
      copiedText = text;
    },
  },
});

const categories = ['전체', '메일', '업무보고'];

function notification(source: string, title: string, body: string, time: string): string {
  return `
    <li class="h-box unread">
      <div class="list_con flex-1">
        <div class="topline h-box"><dl class="h-box"><dt>${source}</dt><dd class="name flex-1">${title}</dd></dl></div>
        <div class="botline v-box">
          <div class="h-box"><div class="text flex-1">보낸사람 : test@innogrid.com</div></div>
          <div class="flex-1 v-box"><span class="text">내용 : ${body}</span></div>
        </div>
      </div>
      <div class="time fold">${time}</div>
    </li>
  `;
}

function renderCategory(activeCategory: string): void {
  if (activeCategory === '메일') mailVisitCount += 1;
  if (activeCategory === '전체') allVisitCount += 1;

  const items = activeCategory === '업무보고'
    ? ''
    : [
      notification('[메일]', 'AuthCode: 1234', 'Your authentication token code is 1234.', '17:13'),
      notification('[메일]', '로그인 확인', '인증번호는 12345 입니다.', '17:12'),
      notification('[메일]', 'AuthCode: 039911', 'Your authentication token code is 039911.', '17:11'),
      notification('[메일]', '[WBlock] 메일 리스트 - 2026/08/13', '일반 메일입니다.', '09:01'),
      notification('[업무보고]', 'OTP: 777777', '인증번호 777777', '08:00'),
    ].join('');

  tabContent.innerHTML = `
    <div class="categoryFn h-box">
      ${categories.map((category) => `<div class="item ${category === activeCategory ? 'on' : 'false'}">${category}</div>`).join('')}
    </div>
    ${activeCategory === '업무보고' ? '<p>알림이 없습니다.</p>' : `
      <div class="dayline">08.13 목요일<span class="today">오늘</span></div>
      <ul>${items}</ul>
    `}
  `;

  for (const item of tabContent.querySelectorAll<HTMLElement>('.categoryFn .item')) {
    item.addEventListener('click', () => {
      renderCategory(item.textContent?.trim() ?? '전체');
      runtime.reconcile({ url: new URL(window.location.href), document });
    });
  }
  for (const item of tabContent.querySelectorAll<HTMLElement>('li.h-box')) {
    item.addEventListener('click', () => {
      notificationOpenCount += 1;
    });
  }
}

function updateStatus(): void {
  const refreshButton = document.querySelector<HTMLButtonElement>('#inno-amaranth-notification-refresh');
  const copyButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.inno-amaranth-verification-copy'));
  status.textContent = JSON.stringify({
    activeCategory: document.querySelector('.categoryFn .item.on')?.textContent?.trim() ?? null,
    refreshButton: refreshButton?.textContent ?? null,
    refreshButtons: document.querySelectorAll('#inno-amaranth-notification-refresh').length,
    copyButtons: copyButtons.length,
    codes: copyButtons.map((button) => button.dataset.verificationCode),
    copiedText,
    notificationOpenCount,
    mailVisitCount,
    allVisitCount,
  }, null, 2);
}

renderCategory('전체');
runtime.reconcile({ url: new URL(window.location.href), document });
disableFeature.addEventListener('click', () => runtime.dispose());
enableFeature.addEventListener('click', () => {
  runtime = createNotificationToolsRuntime();
  runtime.reconcile({ url: new URL(window.location.href), document });
});
updateStatus();
window.setInterval(updateStatus, 50);
