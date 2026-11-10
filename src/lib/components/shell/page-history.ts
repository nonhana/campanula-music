import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { on } from 'svelte/events';
import { createSubscriber } from 'svelte/reactivity';

const supported = 'navigation' in window;

const pageStep = (direction: -1 | 1): number | null => {
  if (!supported) return null;
  const current = navigation.currentEntry!;
  const entries = navigation.entries();
  for (let index = current.index + direction; ; index += direction) {
    const entry = entries[index];
    // 刷新前的记录属于上一个文档：走过去整页重载、打断播放，地址也读不到
    if (!entry?.sameDocument) return null;
    if (entry.url !== current.url) return index - current.index;
  }
};

const subscribe = createSubscriber((update) =>
  supported ? on(navigation, 'currententrychange', update) : undefined,
);

export const pageHistory = {
  get canBack() {
    subscribe();
    return pageStep(-1) !== null;
  },
  get canForward() {
    subscribe();
    return pageStep(1) !== null;
  },
};

export const backPage = (): void => {
  const step = pageStep(-1);
  if (step === null) void goto(resolve('/'), { replace: true });
  else history.go(step);
};

export const forwardPage = (): void => {
  const step = pageStep(1);
  if (step !== null) history.go(step);
};
