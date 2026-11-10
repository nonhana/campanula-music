<script lang="ts">
  import { untrack } from 'svelte';
  import type { ClassValue } from 'svelte/elements';

  import type { Song } from '#lib/api/library.js';

  import { fadeMs, moveMs, reducedMotion, unseen } from '../shared/motion';
  import { cssEasing, DURATIONS, WHEEL } from '../shared/motion-tokens';
  import Cover, { coverLoaded, preloadCover } from '../ui/Cover.svelte';
  import type { Turn } from './view';
  import { SMALL_COVER } from './view';

  interface Props {
    song: Song;
    turn: Turn | null;
    duration: number;
    size: number;
    fluid?: boolean;
    eager?: boolean;
    class?: ClassValue;
    drag?: number | null;
    previous?: Song | null;
    next?: Song | null;
  }

  const {
    song,
    turn,
    duration,
    size,
    fluid = false,
    eager = false,
    class: klass,
    drag = null,
    previous = null,
    next = null,
  }: Props = $props();

  interface Disc {
    key: number;
    song: Song;
    sharp: boolean;
  }

  interface Pose {
    angle: number;
    opacity: number;
  }

  const REST: Pose = { angle: 0, opacity: 1 };

  const sharpNow = (s: Song) =>
    size <= SMALL_COVER ||
    s.album.coverUrl === null ||
    coverLoaded(s.album.coverUrl, size);

  let discs = $state.raw<Disc[]>([
    {
      key: 0,
      song: untrack(() => song),
      sharp: true,
    },
  ]);
  let frontReady = $state(false);
  let front = $state(0);
  let keys = 1;
  /* eslint-disable svelte/prefer-svelte-reactivity -- 下面几个只给动画、拖动用，不驱动界面更新 */
  const elements = new Map<number, HTMLElement>();
  const running = new Map<
    number,
    { animation: Animation; from: Pose; to: Pose }
  >();
  const entering = new Map<number, { from: Pose; ms: number }>();
  const posed = new Map<number, number>();
  /* eslint-enable svelte/prefer-svelte-reactivity */
  let held: {
    front: number;
    base: number;
    sides: (readonly [key: number, side: -1 | 1])[];
  } | null = null;

  const dragged = (angle: number): Pose => ({
    angle,
    opacity: Math.max(0, 1 - Math.abs(angle) / WHEEL.pitch),
  });

  const poseOf = (key: number): Pose => {
    const angle = posed.get(key);
    if (angle !== undefined) return dragged(angle);
    const motion = running.get(key);
    if (!motion) return entering.get(key)?.from ?? REST;
    const progress =
      motion.animation.effect?.getComputedTiming().progress ??
      (motion.animation.playState === 'finished' ? 1 : 0);
    const { from, to } = motion;
    return {
      angle: from.angle + (to.angle - from.angle) * progress,
      opacity: from.opacity + (to.opacity - from.opacity) * progress,
    };
  };

  const setStyle = (element: HTMLElement, pose: Pose | null): void => {
    element.style.transform = pose ? `rotate(${pose.angle}deg)` : '';
    element.style.opacity = pose ? String(pose.opacity) : '';
  };

  const stop = (key: number): void => {
    running.get(key)?.animation.cancel();
    running.delete(key);
  };

  const move = (
    key: number,
    from: Pose,
    to: Pose,
    ms: number,
    easing: string,
    leaving: boolean,
  ): void => {
    const element = elements.get(key);
    if (!element) {
      if (leaving) {
        entering.delete(key);
        discs = discs.filter((disc) => disc.key !== key);
      }
      return;
    }
    running.get(key)?.animation.cancel();
    const turning = from.angle !== 0 || to.angle !== 0;
    const keyframe = ({ angle, opacity }: Pose): Keyframe =>
      turning ? { transform: `rotate(${angle}deg)`, opacity } : { opacity };
    const animation = element.animate([keyframe(from), keyframe(to)], {
      duration: ms,
      easing,
      fill: leaving ? 'forwards' : 'none',
    });
    running.set(key, { animation, from, to });
    animation.onfinish = () => {
      if (running.get(key)?.animation !== animation) return;
      running.delete(key);
      if (leaving) discs = discs.filter((disc) => disc.key !== key);
      else if (key === front && !held) sharpen();
    };
  };

  const sharpen = (): void => {
    const shown = discs.find((disc) => disc.key === front)!;
    if (!shown.sharp) {
      discs = discs.map((disc) =>
        disc === shown ? { ...disc, sharp: true } : disc,
      );
    }
    const key = front;
    const url = shown.song.album.coverUrl;
    void (url === null ? Promise.resolve() : preloadCover(url, size)).then(
      () => {
        if (key === front && !held) frontReady = true;
      },
    );
  };

  const settle = (incoming: Song): void => {
    for (const { animation } of running.values()) animation.cancel();
    running.clear();
    entering.clear();
    const key = keys++;
    discs = [{ key, song: incoming, sharp: true }];
    front = key;
    sharpen();
  };

  const change = (incoming: Song): void => {
    const shown = discs.find((disc) => disc.key === front)!;
    if (shown.song.id === incoming.id) {
      if (shown.song !== incoming) {
        discs = discs.map((disc) =>
          disc === shown ? { ...disc, song: incoming } : disc,
        );
      }
      return;
    }
    if (turn === null || turn === 'land' || unseen()) return settle(incoming);
    const fading = reducedMotion();
    const calm = held === null && running.size === 0 && entering.size === 0;
    frontReady = false;
    const side = turn === 'right' ? -1 : 1;
    const poses = new Map(discs.map((disc) => [disc.key, poseOf(disc.key)]));
    const back = fading
      ? undefined
      : discs.find(
          (disc) =>
            disc.song.id === incoming.id &&
            poses.get(disc.key)!.angle * side >= 0,
        );
    const from = back
      ? poses.get(back.key)!
      : {
          angle: fading ? 0 : WHEEL.pitch * side,
          opacity: 0,
        };
    const delta = fading ? 0 : -from.angle;
    const ms = fading ? fadeMs(duration) : duration;
    for (const disc of discs) {
      if (disc === back) continue;
      const pose = poses.get(disc.key)!;
      if (pose.opacity < 0.01) {
        stop(disc.key);
        discs = discs.filter((other) => other.key !== disc.key);
        continue;
      }
      move(
        disc.key,
        pose,
        { angle: pose.angle + delta, opacity: 0 },
        ms,
        cssEasing(fading ? 'in-soft' : 'out-soft'),
        true,
      );
    }
    if (back) {
      front = back.key;
      if (!back.sharp && sharpNow(back.song)) {
        discs = discs.map((disc) =>
          disc === back ? { ...disc, sharp: true } : disc,
        );
      }
      move(back.key, from, REST, ms, cssEasing('out-soft'), false);
    } else {
      const key = keys++;
      entering.set(key, { from, ms });
      discs = [
        ...discs,
        { key, song: incoming, sharp: calm || sharpNow(incoming) },
      ];
      front = key;
    }
    if (discs.find((disc) => disc.key === front)!.sharp) sharpen();
  };

  const hold = (): NonNullable<typeof held> => {
    const base = poseOf(front).angle / WHEEL.pitch;
    frontReady = false;
    stop(front);
    entering.delete(front);
    const sides: (readonly [key: number, side: -1 | 1])[] = [];
    for (const [neighbor, side] of [
      [previous, -1],
      [next, 1],
    ] as const) {
      if (!neighbor) continue;
      const leaving = discs.find(
        (disc) =>
          disc.key !== front &&
          sides.every(([key]) => key !== disc.key) &&
          disc.song.id === neighbor.id &&
          poseOf(disc.key).angle * side > 0,
      );
      if (leaving) {
        stop(leaving.key);
        sides.push([leaving.key, side]);
        continue;
      }
      const key = keys++;
      discs = [
        ...discs,
        {
          key,
          song: neighbor,
          sharp: sharpNow(neighbor),
        },
      ];
      sides.push([key, side]);
    }
    return { front, base, sides };
  };

  const place = (key: number, angle: number): void => {
    posed.set(key, angle);
    const element = elements.get(key);
    if (element) setStyle(element, dragged(angle));
  };

  const follow = (turned: number): void => {
    held ??= hold();
    if (held.front !== front) return;
    const at = Math.max(-1, Math.min(1, held.base + turned));
    place(held.front, at * WHEEL.pitch);
    for (const [key, side] of held.sides) place(key, (at + side) * WHEEL.pitch);
  };

  const letGo = (): void => {
    const { front: grabbed, sides } = held!;
    held = null;
    if (grabbed === front) {
      const ms = moveMs(DURATIONS['wheel-return']);
      const easing = cssEasing('out-soft');
      move(front, poseOf(front), REST, ms, easing, false);
      for (const [key, side] of sides)
        move(
          key,
          poseOf(key),
          { angle: side * WHEEL.pitch, opacity: 0 },
          ms,
          easing,
          true,
        );
    }
    for (const key of posed.keys()) {
      const element = elements.get(key);
      if (element) setStyle(element, null);
    }
    posed.clear();
  };

  // 先换歌再拖动：反过来会先跳回正中
  $effect(() => {
    const current = song;
    const turned = drag;
    untrack(() => {
      change(current);
      if (turned !== null) follow(turned);
      else if (held) letGo();
    });
  });

  sharpen();

  $effect(() => {
    const ready = frontReady;
    for (const neighbor of [previous, next]) {
      if (!neighbor || neighbor.album.coverUrl === null) continue;
      void preloadCover(neighbor.album.coverUrl, SMALL_COVER);
      if (ready) void preloadCover(neighbor.album.coverUrl, size);
    }
  });

  const mount = (key: number) => (element: HTMLElement) => {
    elements.set(key, element);
    const angle = posed.get(key);
    const start = entering.get(key);
    if (angle !== undefined) {
      setStyle(element, dragged(angle));
    } else if (start) {
      entering.delete(key);
      move(key, start.from, REST, start.ms, cssEasing('out-soft'), false);
    }
    return () => {
      running.get(key)?.animation.cancel();
      running.delete(key);
      elements.delete(key);
    };
  };
</script>

<span class="wheel" style:--pivot="{50 + WHEEL.pivot * 100}%">
  {#each discs as disc (disc.key)}
    <!-- 只看不变的 key：不然会重挂、停掉正在走的动画 -->
    {@const key = disc.key}
    <span
      class={['disc', key === front && 'front']}
      aria-hidden={key !== front}
      {@attach mount(key)}
    >
      <Cover
        url={disc.song.album.coverUrl}
        {size}
        {fluid}
        {eager}
        class={klass}
        placeholder={SMALL_COVER}
        load={disc.sharp}
      />
    </span>
  {/each}
</span>

<style>
  .wheel {
    display: grid;
    isolation: isolate;
  }

  .disc {
    grid-area: 1 / 1;
    transform-origin: 50% var(--pivot);
    pointer-events: none;
  }

  .disc.front {
    z-index: 1;
    pointer-events: auto;
  }
</style>
