import {
  brandFlight,
  centerOf,
  ripple,
} from '../../src/lib/components/boot/opening-dom.ts';
import {
  cssEasing,
  DURATIONS,
  LOOPS,
} from '../../src/lib/components/shared/motion-tokens.ts';

export const HOME_READY_WAIT = 2000;
const CENTER_SPIN = LOOPS.spin * 0.75;

export const openHome = async () => {
  const root = document.documentElement;
  if (!root.hasAttribute('data-home-opening')) return;
  const main = document.querySelector<HTMLElement>('.homepage')!;
  const finish = () => dispatchEvent(new Event('home-opening-complete'));
  if (root.dataset.homeOpening === 'reduced') {
    await Promise.allSettled(
      main.getAnimations().map((animation) => animation.finished),
    );
    finish();
    return;
  }
  const animations: Animation[] = [];
  let flight: ReturnType<typeof brandFlight> | undefined;
  const events = new AbortController();
  const { signal } = events;
  let timer: number;
  let spinTimer: number;
  const interrupted = new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
  const cleanup = () => {
    events.abort();
    clearTimeout(timer);
    clearTimeout(spinTimer);
    flight?.stop();
    for (const animation of animations) animation.cancel();
  };
  addEventListener('home-opening-cancel', cleanup, { signal });
  try {
    const departure =
      document.querySelector<SVGSVGElement>('#home-opening svg')!;
    const spin = departure
      .getAnimations()
      .find(
        (animation) =>
          animation instanceof CSSAnimation &&
          animation.animationName === 'home-spin',
      );
    const remaining = Math.max(0, CENTER_SPIN - Number(spin?.currentTime ?? 0));
    await Promise.race([
      Promise.all([
        document.fonts.ready,
        new Promise<void>((resolve) => {
          spinTimer = window.setTimeout(resolve, remaining);
        }),
      ]),
      interrupted,
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, HOME_READY_WAIT);
      }),
    ]);
    clearTimeout(timer!);
    if (signal.aborted) return;
    const brand = main.querySelector('.home-brand [data-brand]')!;
    const rotation = Number.parseFloat(getComputedStyle(departure).rotate) || 0;
    departure.style.animation = 'none';
    flight = brandFlight(departure, brand);
    const petals = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    petals.append(...flight.element.childNodes);
    flight.element.append(petals);
    Object.assign(petals.style, {
      transformBox: 'view-box',
      transformOrigin: 'center',
    });
    const turn = petals.animate(
      [{ rotate: `${rotation}deg` }, { rotate: '360deg' }],
      {
        duration: DURATIONS.focal,
        easing: cssEasing('out-soft'),
        fill: 'forwards',
      },
    );
    animations.push(turn);
    root.dataset.homeOpening = 'flying';
    addEventListener('resize', finish, { once: true, signal });
    const [landed] = await Promise.all([
      flight.finished,
      turn.finished.then(
        () => true,
        () => false,
      ),
    ]);
    if (!landed || signal.aborted) return;
    flight.stop();
    flight = undefined;
    animations.push(
      ...ripple(
        main,
        centerOf(brand.querySelector('svg')!.getBoundingClientRect()),
        brand,
      ),
    );
    root.dataset.homeOpening = 'spreading';
    await Promise.allSettled(animations.map((animation) => animation.finished));
  } finally {
    cleanup();
    finish();
  }
};
