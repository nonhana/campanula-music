import { flightArc } from '../shared/flight-arc.ts';
import {
  cssEasing,
  DURATIONS,
  FLOAT_DISTANCE,
  OPENING,
} from '../shared/motion-tokens.ts';

const REVEAL_GROUP = '[data-reveal-group]';

export const brandFlight = (departure: SVGSVGElement, brand: Element) => {
  const landing = brand.querySelector('svg')!;
  const end = landing.getBoundingClientRect();
  const element = departure.cloneNode(true) as SVGSVGElement;
  element.setAttribute('width', `${end.width}`);
  element.setAttribute('height', `${end.height}`);
  Object.assign(element.style, {
    position: 'fixed',
    left: `${end.x}px`,
    top: `${end.y}px`,
    transformOrigin: '0 0',
    zIndex: '45',
    pointerEvents: 'none',
  });
  document.body.append(element);
  const animation = element.animate(
    flightArc(departure.getBoundingClientRect(), end),
    {
      duration: DURATIONS.focal,
      easing: cssEasing('out-soft'),
      fill: 'forwards',
    },
  );
  departure.style.visibility = 'hidden';
  landing.style.visibility = 'hidden';
  const name = brand.querySelector('[data-brand-name]')!.animate(
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
  const stop = () => {
    animation.cancel();
    name.cancel();
    element.remove();
    landing.style.visibility = '';
  };
  return {
    element,
    finished: animation.finished.then(
      () => true,
      () => false,
    ),
    stop,
  };
};

interface Point {
  x: number;
  y: number;
}

export const centerOf = (rect: DOMRect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

export const ripple = (
  main: Element,
  origin: Point,
  brand: Element | null,
): Animation[] => {
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
  return pieces.map(({ element, reach, x, y }) =>
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
    ),
  );
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
