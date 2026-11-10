import { tick, untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';

import {
  flightArc,
  reducedMotion,
  REVEAL_GROUP,
  unseen,
} from '../shared/motion';
import {
  cssEasing,
  DURATIONS,
  FLOAT_DISTANCE,
  OPENING,
} from '../shared/motion-tokens';

// 盖在顶栏（40）上面，播放提示、播放页（50）之下
const PLANE_LAYER = '45';

let plane: {
  element: SVGSVGElement;
  animation: Animation;
  landing: SVGSVGElement;
} | null = null;

export const arrival: Attachment<HTMLElement> = (screen) => {
  untrack(() => void arrive(screen));
};

const arrive = async (screen: HTMLElement): Promise<void> => {
  ground();
  const departure = document.querySelector<SVGSVGElement>('[data-opening] svg');
  if (!departure || screen.contains(departure) || reducedMotion() || unseen())
    return;
  departure.closest('[data-opening]')!.removeAttribute('data-opening');
  // 等新的一屏挂好、旧的一屏让出高度后再量位置
  await tick();
  const brand = screen.querySelector('[data-brand]');
  const landing = brand?.querySelector('svg');
  const end = landing?.getBoundingClientRect();
  const start = departure.getBoundingClientRect();
  const main = screen.querySelector('main');
  if (main) ripple(main, centerOf(end ?? start), brand);
  if (!brand || !landing || !end) {
    departure.animate(
      [{ translate: '0 0' }, { translate: `0 ${-FLOAT_DISTANCE.out}px` }],
      {
        duration: DURATIONS['panel-out'],
        easing: cssEasing('in-soft'),
        fill: 'forwards',
      },
    );
    return;
  }
  const element = departure.cloneNode(true) as SVGSVGElement;
  element.setAttribute('width', `${end.width}`);
  element.setAttribute('height', `${end.height}`);
  Object.assign(element.style, {
    position: 'fixed',
    left: `${end.x}px`,
    top: `${end.y}px`,
    transformOrigin: '0 0',
    zIndex: PLANE_LAYER,
    pointerEvents: 'none',
  });
  document.body.append(element);
  departure.style.visibility = 'hidden';
  landing.style.visibility = 'hidden';
  const animation = element.animate(flightArc(start, end), {
    duration: DURATIONS.focal,
    easing: cssEasing('out-soft'),
    fill: 'forwards',
  });
  plane = { element, animation, landing };
  brand.querySelector('[data-brand-name]')!.animate(
    [
      {
        opacity: 0,
        translate: `${-FLOAT_DISTANCE.in}px 0`,
        filter: `blur(${OPENING.blur}px)`,
      },
      { opacity: 1, translate: '0 0', filter: 'blur(0)' },
    ],
    {
      duration: DURATIONS.state,
      delay: DURATIONS.focal - DURATIONS.state,
      easing: cssEasing('out-soft'),
      fill: 'backwards',
    },
  );
  if (
    (await animation.finished.then(
      () => true,
      () => false,
    )) &&
    plane?.element === element
  )
    ground();
};

interface Point {
  x: number;
  y: number;
}

const centerOf = (rect: DOMRect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

const ripple = (main: Element, origin: Point, brand: Element | null): void => {
  const pieces = piecesOf(main, brand).map((element) => {
    const rect = element.getBoundingClientRect();
    const center = centerOf(rect);
    const dx = center.x - origin.x;
    const dy = center.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    const nearX = Math.min(Math.max(origin.x, rect.left), rect.right);
    const nearY = Math.min(Math.max(origin.y, rect.top), rect.bottom);
    return {
      element,
      reach: Math.hypot(nearX - origin.x, nearY - origin.y),
      x: dx / length,
      y: dy / length,
    };
  });
  const nearest = Math.min(...pieces.map((piece) => piece.reach));
  const farthest = Math.max(...pieces.map((piece) => piece.reach));
  for (const { element, reach, x, y } of pieces) {
    element.animate(
      [
        {
          offset: 0,
          opacity: 0,
          translate: `${-x * FLOAT_DISTANCE.in}px ${-y * FLOAT_DISTANCE.in}px`,
          filter: `blur(${OPENING.blur}px)`,
        },
      ],
      {
        duration: DURATIONS.panel,
        delay:
          OPENING.delay +
          (farthest > nearest ? (reach - nearest) / (farthest - nearest) : 0) *
            OPENING.spread,
        easing: cssEasing('out-soft'),
        fill: 'backwards',
      },
    );
  }
};

const piecesOf = (node: Element, brand: Element | null): Element[] =>
  [...node.children].flatMap((child) => {
    if (child === brand) return [];
    const rect = child.getBoundingClientRect();
    const empty = rect.width === 0 || rect.height === 0;
    if (
      !empty &&
      (rect.bottom <= 0 ||
        rect.top >= innerHeight ||
        rect.right <= 0 ||
        rect.left >= innerWidth)
    )
      return [];
    return empty ||
      child.matches(REVEAL_GROUP) ||
      child.querySelector(REVEAL_GROUP) ||
      (brand && child.contains(brand))
      ? piecesOf(child, brand)
      : [child];
  });

const ground = (): void => {
  if (!plane) return;
  plane.animation.cancel();
  plane.element.remove();
  plane.landing.style.visibility = '';
  plane = null;
};
