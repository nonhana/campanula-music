import { tick, untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';

import {
  cssEasing,
  DURATIONS,
  FLOAT_DISTANCE,
} from '../shared/motion-tokens.ts';
import { reducedMotion, unseen } from '../shared/motion.ts';
import { brandFlight, centerOf, ripple } from './opening-dom.ts';

let plane: ReturnType<typeof brandFlight> | null = null;

export const arrival: Attachment<HTMLElement> = (screen) => {
  const controller = new AbortController();
  untrack(() => void arrive(screen, controller.signal));
  return () => controller.abort();
};

const arrive = async (
  screen: HTMLElement,
  signal: AbortSignal,
): Promise<void> => {
  ground();
  const departure = document.querySelector<SVGSVGElement>('[data-opening] svg');
  if (!departure || screen.contains(departure) || reducedMotion() || unseen())
    return;
  departure.closest('[data-opening]')!.removeAttribute('data-opening');
  // 等新的一屏挂好、旧的一屏让出高度后再量位置
  await tick();
  if (signal.aborted) return;
  const brand = screen.querySelector('[data-brand]');
  const landing = brand?.querySelector('svg');
  const end = landing?.getBoundingClientRect();
  const start = departure.getBoundingClientRect();
  const main = screen.querySelector('main');
  const animations = main ? ripple(main, centerOf(end ?? start), brand) : [];
  const cancel = () => {
    for (const animation of animations) animation.cancel();
  };
  signal.addEventListener('abort', cancel, { once: true });
  if (!brand || !landing || !end) {
    animations.push(
      departure.animate(
        [{ translate: '0 0' }, { translate: `0 ${-FLOAT_DISTANCE.out}px` }],
        {
          duration: DURATIONS['panel-out'],
          easing: cssEasing('in-soft'),
          fill: 'forwards',
        },
      ),
    );
    void Promise.allSettled(
      animations.map((animation) => animation.finished),
    ).then(() => signal.removeEventListener('abort', cancel));
    return;
  }
  const flight = brandFlight(departure, brand);
  plane = flight;
  const stopFlight = () => {
    if (plane === flight) ground();
  };
  signal.addEventListener('abort', stopFlight, { once: true });
  if ((await flight.finished) && plane === flight) ground();
  signal.removeEventListener('abort', stopFlight);
  await Promise.allSettled(animations.map((animation) => animation.finished));
  signal.removeEventListener('abort', cancel);
};

const ground = (): void => {
  plane?.stop();
  plane = null;
};
