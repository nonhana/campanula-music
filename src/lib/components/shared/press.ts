import type { Attachment } from 'svelte/attachments';

const MENU_GRACE_MS = 300;
const CLICK_GRACE_MS = 80;
// 手指挪过这么多（px）才决定接不接：要比浏览器自己开始滚的距离（Android 上约 8px）短
const CLAIM_SLOP = 6;

// Mac 上 Chrome 用真实键位填 buttons，快速松手时 pointerup 前会先来一次 buttons 为 0 的移动，主键那一位不作数
export const rightButtonDown = (buttons: number): boolean =>
  (buttons & 2) !== 0;

const watchPress = (abandon: () => void): (() => void) => {
  let ended = false;
  const oncontextmenu = (event: Event) => {
    event.preventDefault();
    if (
      !ended &&
      !(event instanceof PointerEvent && event.pointerType === 'touch')
    )
      abandon();
  };
  const onvisibilitychange = () => {
    if (document.visibilityState === 'hidden') abandon();
  };
  window.addEventListener('contextmenu', oncontextmenu, true);
  window.addEventListener('blur', abandon);
  document.addEventListener('visibilitychange', onvisibilitychange);
  return () => {
    ended = true;
    window.removeEventListener('blur', abandon);
    document.removeEventListener('visibilitychange', onvisibilitychange);
    setTimeout(
      () => window.removeEventListener('contextmenu', oncontextmenu, true),
      MENU_GRACE_MS,
    );
  };
};

export interface PointerSample {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  button: number;
  buttons: number;
  x: number;
  y: number;
  target?: EventTarget | null;
  time: number;
}

export interface Grip {
  readonly holding: boolean;
  press: (sample: PointerSample) => boolean;
  move: (sample: PointerSample) => void;
  release: (sample: PointerSample) => void;
  abandon: (pointerId?: number) => void;
  click: (detail: number) => boolean;
}

export const createPageHold = (): ((hold: boolean) => void) => {
  let held = false;
  return (hold) => {
    if (hold === held) return;
    held = hold;
    const { style } = document.documentElement;
    style.cursor = hold ? 'grabbing' : '';
    style.userSelect = hold ? 'none' : '';
  };
};

export const attachGrip =
  (
    grip: Grip,
    { touchAction = true }: { touchAction?: boolean } = {},
  ): Attachment<HTMLElement> =>
  (element) => {
    let unwatch: (() => void) | null = null;
    const settleWatch = () => {
      if (grip.holding) return;
      unwatch?.();
      unwatch = null;
    };
    const abandonPress = () => {
      grip.abandon();
      settleWatch();
    };
    const sample = (event: PointerEvent): PointerSample => ({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
      button: event.button,
      buttons: event.buttons,
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      target: event.target,
    });
    const listeners = {
      pointerdown(event: PointerEvent) {
        if (!grip.press(sample(event))) return;
        unwatch?.();
        unwatch = watchPress(abandonPress);
        element.setPointerCapture(event.pointerId);
      },
      pointermove(event: PointerEvent) {
        grip.move(sample(event));
        settleWatch();
      },
      pointerup(event: PointerEvent) {
        grip.release(sample(event));
        settleWatch();
      },
      pointercancel(event: PointerEvent) {
        grip.abandon(event.pointerId);
        settleWatch();
      },
      // Chromium 发现键已松开就收回捕获（Mac 快速松手时常在 pointerup 之前）：这时已经松手，照常提交
      lostpointercapture(event: PointerEvent) {
        grip.release(sample(event));
        settleWatch();
      },
      click: (event: MouseEvent) => {
        if (!grip.click(event.detail)) return;
        event.preventDefault();
        event.stopPropagation();
      },
      dragstart(event: DragEvent) {
        if (grip.holding) event.preventDefault();
      },
    };
    if (touchAction) element.style.touchAction = 'none';
    for (const [type, listener] of Object.entries(listeners))
      element.addEventListener(type, listener as EventListener);
    return () => {
      for (const [type, listener] of Object.entries(listeners))
        element.removeEventListener(type, listener as EventListener);
      abandonPress();
    };
  };

export const attachWindowGrip =
  (
    grip: Grip,
    { touchAction = true }: { touchAction?: boolean } = {},
  ): Attachment<HTMLElement> =>
  (element) => {
    let stop: (() => void) | null = null;
    let activePointer: number | null = null;
    let swallowClick = false;
    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    const sample = (event: PointerEvent): PointerSample => ({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
      button: event.button,
      buttons: event.buttons,
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      target: event.target,
    });
    const onClick = (event: MouseEvent) => {
      if (!swallowClick || event.detail === 0) return;
      swallowClick = false;
      clearTimeout(clickTimer);
      window.removeEventListener('click', onClick, true);
      if (!grip.click(event.detail)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const pointerdown = (event: PointerEvent) => {
      const accepted = sample(event);
      if (!grip.press(accepted)) return;
      activePointer = event.pointerId;
      clearTimeout(clickTimer);
      let end: () => void = () => {};
      const move = (e: PointerEvent) => {
        if (e.pointerId !== activePointer) return;
        if (rightButtonDown(e.buttons)) {
          grip.abandon(activePointer);
          end();
          return;
        }
        grip.move(sample(e));
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId !== activePointer) return;
        if (e.button !== 0) {
          grip.abandon(activePointer);
          end();
          return;
        }
        grip.release(sample(e));
        end();
      };
      const cancel = (e: PointerEvent) => {
        if (e.pointerId !== activePointer) return;
        grip.abandon(activePointer);
        end();
      };
      const unwatch = watchPress(() => {
        grip.abandon();
        end();
      });
      end = () => {
        if (!stop) return;
        stop = null;
        activePointer = null;
        unwatch();
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', cancel, true);
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          swallowClick = false;
          window.removeEventListener('click', onClick, true);
        }, CLICK_GRACE_MS);
      };
      stop = end;
      swallowClick = true;
      window.addEventListener('click', onClick, true);
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', cancel, true);
    };
    const ondragstart = (event: DragEvent) => {
      if (grip.holding) event.preventDefault();
    };
    element.addEventListener('pointerdown', pointerdown);
    element.addEventListener('dragstart', ondragstart);
    if (touchAction) element.style.touchAction = 'none';
    return () => {
      element.removeEventListener('pointerdown', pointerdown);
      element.removeEventListener('dragstart', ondragstart);
    };
  };

export type TouchClaim = 'wait' | 'claim' | 'pass';

export const touchClaim = (
  from: { x: number; y: number },
  at: { x: number; y: number },
  cancelable: boolean,
): TouchClaim => {
  const dx = at.x - from.x;
  const dy = at.y - from.y;
  if (Math.hypot(dx, dy) < CLAIM_SLOP) return 'wait';
  return cancelable && Math.abs(dy) > Math.abs(dx) ? 'claim' : 'pass';
};

export const attachTouchClaim =
  (grip: Grip): Attachment<HTMLElement> =>
  (element) => {
    let pending: { from: PointerSample; id: number } | null = null;
    let release: (() => void) | null = null;
    let swallowClick = false;
    let clickTimer: ReturnType<typeof setTimeout> | undefined;

    const sample = (touch: Touch, time: number): PointerSample => ({
      pointerId: touch.identifier,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      buttons: 1,
      x: touch.clientX,
      y: touch.clientY,
      time,
      target: element,
    });
    const end = () => {
      release?.();
      release = null;
      swallowClick = true;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => (swallowClick = false), CLICK_GRACE_MS);
    };

    const claim = (target: EventTarget, id: number) => {
      const mine = (event: Event): Touch | undefined =>
        [...(event as TouchEvent).changedTouches].find(
          (touch) => touch.identifier === id,
        );
      const onmove = (event: Event) => {
        const touch = mine(event);
        if (!touch) return;
        if (event.cancelable) event.preventDefault();
        grip.move(sample(touch, event.timeStamp));
      };
      const onend = (event: Event) => {
        const touch = mine(event);
        if (!touch) return;
        grip.release(sample(touch, event.timeStamp));
        end();
      };
      const oncancel = (event: Event) => {
        if (!mine(event)) return;
        grip.abandon();
        end();
      };
      target.addEventListener('touchmove', onmove, { passive: false });
      target.addEventListener('touchend', onend);
      target.addEventListener('touchcancel', oncancel);
      const unwatch = watchPress(() => {
        grip.abandon();
        end();
      });
      release = () => {
        target.removeEventListener('touchmove', onmove);
        target.removeEventListener('touchend', onend);
        target.removeEventListener('touchcancel', oncancel);
        unwatch();
      };
    };

    const ontouchstart = (event: TouchEvent) => {
      pending = null;
      const touch = event.changedTouches[0];
      if (release !== null || event.touches.length !== 1 || !touch) return;
      element.style.pointerEvents = 'auto';
      const top = document.elementFromPoint(touch.clientX, touch.clientY);
      element.style.pointerEvents = '';
      if (top === element) {
        pending = {
          from: sample(touch, event.timeStamp),
          id: touch.identifier,
        };
      }
    };
    const ontouchmove = (event: TouchEvent) => {
      if (!pending) return;
      const { from, id } = pending;
      const touch = [...event.touches].find((item) => item.identifier === id);
      if (!touch) return;
      const decision = touchClaim(
        from,
        { x: touch.clientX, y: touch.clientY },
        event.cancelable,
      );
      if (decision === 'wait') return;
      pending = null;
      if (decision === 'pass' || !grip.press(from)) return;
      event.preventDefault();
      claim(touch.target, id);
      grip.move(sample(touch, event.timeStamp));
    };
    const onclick = (event: MouseEvent) => {
      if (!swallowClick || event.detail === 0) return;
      swallowClick = false;
      clearTimeout(clickTimer);
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('touchstart', ontouchstart, {
      capture: true,
      passive: true,
    });
    window.addEventListener('touchmove', ontouchmove, {
      capture: true,
      passive: false,
    });
    window.addEventListener('click', onclick, true);
    return () => {
      window.removeEventListener('touchstart', ontouchstart, true);
      window.removeEventListener('touchmove', ontouchmove, true);
      window.removeEventListener('click', onclick, true);
      clearTimeout(clickTimer);
      if (release !== null) {
        grip.abandon();
        release();
        release = null;
      }
    };
  };
