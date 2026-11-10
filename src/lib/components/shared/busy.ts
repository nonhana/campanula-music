import type { HTMLButtonAttributes } from 'svelte/elements';

type Click = HTMLButtonAttributes['onclick'];

export const busyClick =
  (busy: () => boolean, onclick: Click): Click =>
  (event) => {
    if (busy()) {
      event.preventDefault();
      return;
    }
    onclick?.(event);
  };
