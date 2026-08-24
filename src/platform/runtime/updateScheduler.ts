export interface UpdateSchedulerOptions {
  debounceMs: number;
  maxWaitMs: number;
  run(): void;
  now?: () => number;
  setTimer?: (handler: () => void, delayMs: number) => number;
  clearTimer?: (handle: number) => void;
}

export interface UpdateScheduler {
  schedule(): void;
  runNow(): void;
  cancel(): void;
  isPending(): boolean;
}

/**
 * trailing debounce에 maxWait를 더한 scheduler.
 *
 * DOM mutation이 debounce보다 짧은 간격으로 계속 발생하면 trailing debounce만으로는
 * 실행이 무한히 밀린다. 첫 예약 이후 maxWait가 지나면 더 이상 timer를 다시 만들지 않아
 * 이미 예약된 실행이 반드시 일어나게 한다.
 */
export function createUpdateScheduler(options: UpdateSchedulerOptions): UpdateScheduler {
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((handler, delayMs) => window.setTimeout(handler, delayMs));
  const clearTimer = options.clearTimer ?? ((handle) => window.clearTimeout(handle));

  let handle: number | null = null;
  let pendingSince: number | null = null;

  function cancel(): void {
    if (handle !== null) clearTimer(handle);
    handle = null;
    pendingSince = null;
  }

  return {
    schedule(): void {
      const startedAt = now();
      if (pendingSince === null) pendingSince = startedAt;

      if (handle !== null) {
        if (startedAt - pendingSince >= options.maxWaitMs) return;
        clearTimer(handle);
      }

      handle = setTimer(() => {
        handle = null;
        pendingSince = null;
        options.run();
      }, options.debounceMs);
    },

    runNow(): void {
      cancel();
      options.run();
    },

    cancel,

    isPending(): boolean {
      return handle !== null;
    },
  };
}
