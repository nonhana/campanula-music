import { tick, untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';

import type { Song } from '#lib/api/library.js';

import type { AppView } from '../shared/app-context.svelte';
import { fadeMs, flightArc, reducedMotion, unseen } from '../shared/motion';
import { cssEasing, DURATIONS } from '../shared/motion-tokens';
import { coverLoaded, preloadCover } from '../ui/Cover.svelte';
import { currentSong } from './now';
import type { Turn } from './view';
import { turnOf } from './view';

interface Flight {
  song: Song;
  from: Song | null;
}

let flight = $state.raw<Flight | null>(null);
let landed = $state<number | null>(null);
let launches = 0;
let plane: { element: HTMLElement; animation: Animation } | null = null;
let landingSlot: { element: HTMLElement; size: number } | null = null;

const PLANE_LAYER = '45';

export const pick = (
  view: AppView,
  play: () => void,
  cover: HTMLElement | undefined,
): void => {
  const before = currentSong(view.state.player);
  play();
  const after = currentSong(view.state.player);
  if (cover && after && after.id !== before?.id)
    void takeOff(after, flight ? flight.from : before, cover);
};

const takeOff = async (
  song: Song,
  from: Song | null,
  cover: HTMLElement,
): Promise<void> => {
  const mine = ++launches;
  ground();
  const img = [...cover.querySelectorAll('img')].findLast(
    (each) => each.complete && each.naturalWidth > 0,
  );
  const url = song.album.coverUrl;
  if (!img || url === null || reducedMotion() || unseen()) {
    flight = null;
    return;
  }
  const start = img.getBoundingClientRect();
  const radius = getComputedStyle(img.parentElement!).borderRadius;
  flight = { song, from };
  await tick();
  if (mine !== launches) return;
  if (!landingSlot) {
    flight = null;
    return;
  }
  const { size } = landingSlot;
  const end = restingRect(landingSlot.element);
  const ready = preloadCover(url, size);
  const element = document.createElement('img');
  element.src = img.currentSrc;
  element.alt = '';
  Object.assign(element.style, {
    position: 'fixed',
    left: `${end.x}px`,
    top: `${end.y}px`,
    width: `${end.width}px`,
    height: `${end.height}px`,
    objectFit: 'cover',
    borderRadius: radius,
    transformOrigin: '0 0',
    zIndex: PLANE_LAYER,
    pointerEvents: 'none',
  });
  document.body.append(element);
  const animation = element.animate(flightArc(start, end), {
    duration: DURATIONS['focal-bar'],
    easing: cssEasing('out-soft'),
    fill: 'forwards',
  });
  plane = { element, animation };
  // 被拿掉时 finished 会 reject
  if (
    !(await animation.finished.then(
      () => true,
      () => false,
    )) ||
    mine !== launches
  )
    return;
  const cached = coverLoaded(url, size);
  landed = song.id;
  flight = null;
  await tick();
  if (!cached) {
    await ready;
    await new Promise((done) => setTimeout(done, fadeMs(DURATIONS.reveal)));
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (plane?.element === element) ground();
    }),
  );
};

const ground = (): void => {
  if (!plane) return;
  plane.animation.cancel();
  plane.element.remove();
  plane = null;
};

const abort = (): void => {
  launches += 1;
  ground();
  flight = null;
};

const restingRect = (slot: HTMLElement): DOMRect => {
  const rect = slot.getBoundingClientRect();
  const lift = Number.parseFloat(
    getComputedStyle(slot.closest('[data-player-bar]')!).translate.split(
      ' ',
    )[1] ?? '0',
  );
  return new DOMRect(rect.x, rect.y - lift, rect.width, rect.height);
};

export interface Landing {
  readonly song: Song | null;
  readonly turn: Turn | null;
  slot: Attachment<HTMLElement>;
}

export const landingOf = (view: AppView, size: () => number): Landing => {
  const current = $derived(currentSong(view.state.player));

  $effect(() => {
    const id = current?.id;
    untrack(() => {
      if (flight && flight.song.id !== id) abort();
      if (landed !== null && landed !== id) {
        landed = null;
        if (!flight) ground();
      }
    });
  });

  return {
    get song() {
      return flight ? flight.from : current;
    },
    get turn() {
      return landed !== null && landed === current?.id
        ? 'land'
        : turnOf(view.state.player.change);
    },
    slot(element) {
      landingSlot = {
        element,
        size: size(),
      };
      return () => {
        if (landingSlot?.element === element) landingSlot = null;
      };
    },
  };
};
