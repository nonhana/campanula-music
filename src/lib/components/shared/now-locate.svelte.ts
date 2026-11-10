import { createContext } from 'svelte';

import { clamp } from './clamp';
import { scrollBehavior } from './motion';

export interface NowRow {
  top: number;
  height: number;
  first: boolean;
}

export interface NowList {
  row: () => NowRow | null;
  focus: () => void;
}

export const focusNowRow = (root: ParentNode | undefined): void => {
  root
    ?.querySelector<HTMLElement>('[data-play-target][aria-current="true"]')
    ?.focus({ preventScroll: true });
};

export interface NowRegion {
  scroller: () => HTMLElement | null;
  // 视口坐标；被顶栏、播放条、面板边挡住的不算
  band: () => { top: number; bottom: number };
}

export interface NowLocate {
  readonly away: boolean;
  register: (list: NowList) => () => void;
  go: () => void;
}

const FAR_SCREENS = 3;
const SLACK = 1;
const SCROLL_QUIET_MS = 120;

const afterScroll = (
  target: Window | HTMLElement,
  done: () => void,
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(timer);
    target.removeEventListener('scroll', wait);
    target.removeEventListener('scrollend', finish);
  };
  const finish = () => {
    stop();
    done();
  };
  const wait = () => {
    clearTimeout(timer);
    timer = setTimeout(finish, SCROLL_QUIET_MS);
  };
  target.addEventListener('scroll', wait, { passive: true });
  target.addEventListener('scrollend', finish);
  wait();
  return stop;
};

// 组件初始化时调用（里面有 $effect）
export const createNowLocate = (region: NowRegion): NowLocate => {
  let list = $state<NowList | null>(null);
  let away = $state(false);
  let stopFocus: (() => void) | null = null;

  const judge = (): void => {
    const row = list?.row() ?? null;
    if (!row) {
      away = false;
      return;
    }
    const band = region.band();
    away =
      row.top < band.top - SLACK || row.top + row.height > band.bottom + SLACK;
  };

  $effect(judge);

  $effect(() => {
    const el = region.scroller();
    const source = el ?? window;
    const sizes = new ResizeObserver(judge);
    sizes.observe(el ?? document.body);
    source.addEventListener('scroll', judge, { passive: true });
    window.addEventListener('resize', judge);
    return () => {
      sizes.disconnect();
      source.removeEventListener('scroll', judge);
      window.removeEventListener('resize', judge);
      stopFocus?.();
    };
  });

  return {
    get away() {
      return away;
    },
    register(next) {
      list = next;
      return () => {
        if (list === next) list = null;
      };
    },
    go() {
      const row = list?.row();
      if (!row) return;
      const el = region.scroller();
      const band = region.band();
      const from = el ? el.scrollTop : window.scrollY;
      const end = el
        ? el.scrollHeight - el.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const to = clamp(
        from + row.top - band.top - (row.first ? 0 : row.height),
        0,
        Math.max(0, end),
      );
      const target = el ?? window;
      const smooth = scrollBehavior() === 'smooth';
      const screen = band.bottom - band.top;
      if (smooth && Math.abs(to - from) > FAR_SCREENS * screen)
        target.scrollTo({
          top: to - Math.sign(to - from) * screen,
          behavior: 'instant',
        });
      target.scrollTo({
        top: to,
        behavior: smooth ? 'smooth' : 'instant',
      });
      stopFocus?.();
      stopFocus = afterScroll(target, () => {
        stopFocus = null;
        list?.focus();
      });
    },
  };
};

export const [getNowLocate, setNowLocate, hasNowLocate] =
  createContext<NowLocate>();
