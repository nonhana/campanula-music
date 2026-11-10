import { onNavigate } from '$app/navigation';
import type { RouteId } from '$app/types';
import { onMount } from 'svelte';

import type { Toward } from '../shared/motion';
import { reducedMotion } from '../shared/motion';
import { LANDING_WAIT } from '../shared/motion-tokens';

type PageTurn = Toward | 'fade';

const pageTurn = (
  from: RouteId,
  to: RouteId,
  delta: number | undefined,
  tabs: readonly RouteId[],
): PageTurn => {
  const fromTab = tabs.indexOf(from);
  const toTab = tabs.indexOf(to);
  if (fromTab >= 0 && toTab >= 0) {
    return toTab > fromTab ? 'left' : 'right';
  }
  if (from === to) return 'fade';
  if (delta !== undefined) {
    return delta < 0 ? 'down' : 'up';
  }
  return toTab >= 0 ? 'down' : 'up';
};

const COVER = 'cover';

const loaded = (img: HTMLImageElement | null): img is HTMLImageElement =>
  img !== null && img.complete && img.naturalWidth > 0;

const landingReady = async (img: HTMLImageElement): Promise<boolean> => {
  if (!img.complete) {
    await new Promise<void>((done) => {
      const timer = setTimeout(done, LANDING_WAIT);
      const finish = () => {
        clearTimeout(timer);
        done();
      };
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', finish, { once: true });
    });
  }
  return (
    loaded(img) &&
    img.decode().then(
      () => true,
      () => false,
    )
  );
};

// 拍新帧前浏览器的点按测试只认 <html>，所以手工算位置
const exposed = (cover: HTMLElement): boolean => {
  const { left, top, width, height } = cover.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const topBar =
    Number.parseFloat(
      getComputedStyle(document.documentElement).scrollPaddingTop,
    ) || 0;
  if (x < 0 || x > innerWidth || y < topBar || y > innerHeight) return false;
  for (
    let box = cover.parentElement;
    box && box !== document.body;
    box = box.parentElement
  ) {
    if (getComputedStyle(box).overflow === 'visible') continue;
    const clip = box.getBoundingClientRect();
    if (x < clip.left || x > clip.right || y < clip.top || y > clip.bottom)
      return false;
  }
  return true;
};

const coversOf = (page: string): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(
    `[data-flight="${CSS.escape(page)}"]`,
  ),
];

export const pageTransitions = (
  libraryTabs: () => readonly RouteId[],
): void => {
  let running: ViewTransition | null = null;
  let pressed: HTMLAnchorElement | null = null;
  const grids = new Map<string, Set<string>>();
  let named: HTMLElement | null = null;

  const name = (cover: HTMLElement | null) => {
    if (named) named.style.viewTransitionName = '';
    named = cover;
    if (cover) cover.style.viewTransitionName = COVER;
  };

  const takeOff = (
    link: HTMLAnchorElement | null,
    from: URL,
    to: URL,
  ): string | null => {
    const tile =
      link?.querySelector<HTMLElement>(
        `[data-flight="${CSS.escape(to.pathname)}"]`,
      ) ?? null;
    if (tile)
      grids.set(to.href, (grids.get(to.href) ?? new Set()).add(from.href));
    const page = tile
      ? to.pathname
      : grids.get(from.href)?.has(to.href)
        ? from.pathname
        : null;
    const cover = tile ?? (page === null ? null : coversOf(page).find(exposed));
    if (
      page === null ||
      reducedMotion() ||
      !cover ||
      !exposed(cover) ||
      !loaded(cover.querySelector('img'))
    )
      return null;
    name(cover);
    return page;
  };

  const land = async (page: string, current: () => boolean) => {
    const cover = coversOf(page).find(exposed);
    const img = cover?.querySelector('img');
    if (cover && img && (await landingReady(img)) && current()) name(cover);
  };

  onNavigate((navigation) => {
    if (navigation.shallow && navigation.type === 'goto') return;

    running?.skipTransition();
    running = null;
    name(null);
    const link = navigation.type === 'link' ? pressed : null;
    pressed = null;
    const { from, to } = navigation;
    if (
      !document.startViewTransition ||
      !from?.route.id ||
      !to?.route.id ||
      from.url.href === to.url.href
    )
      return;
    if (
      navigation.type === 'popstate' &&
      navigation.event.hasUAVisualTransition
    )
      return;

    const delta = navigation.type === 'popstate' ? navigation.delta : undefined;
    const turn = pageTurn(from.route.id, to.route.id, delta, libraryTabs());
    const flight = takeOff(link, from.url, to.url);

    return new Promise<void>((captured) => {
      const transition = document.startViewTransition({
        types: [turn],
        update: async () => {
          captured();
          const done = await navigation.complete.then(
            () => true,
            () => false,
          );
          if (flight && done) await land(flight, () => running === transition);
        },
      });
      running = transition;
      transition.ready.catch(() => {});
      void transition.finished.then(() => {
        if (running !== transition) return;
        running = null;
        name(null);
      });
    });
  });

  // 过渡中浏览器把点按都交给 <html>：按下先结束过渡，click 再转给下面的元素
  onMount(() => {
    let interrupted = false;
    const press = () => {
      interrupted = running !== null;
      running?.skipTransition();
    };
    const click = (event: MouseEvent) => {
      if (event.target instanceof Element) pressed = event.target.closest('a');
      if (!interrupted || event.target !== document.documentElement) return;
      interrupted = false;
      document
        .elementFromPoint(event.clientX, event.clientY)
        ?.dispatchEvent(new MouseEvent('click', event));
    };
    document.addEventListener('pointerdown', press, true);
    document.addEventListener('click', click, true);
    return () => {
      document.removeEventListener('pointerdown', press, true);
      document.removeEventListener('click', click, true);
    };
  });
};
