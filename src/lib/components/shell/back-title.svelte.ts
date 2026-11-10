import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';

class BackTitle {
  heading = $state<HTMLElement | null>(null);
  text = $state('');
  shown = $state(false);
  bar: HTMLElement | null = null;

  // 读状态用 untrack：算作依赖的话，h1 一换 attachment 就重挂、再换，停不下来
  measure = (): void =>
    untrack(() => {
      this.shown =
        this.heading !== null &&
        this.bar !== null &&
        this.heading.getBoundingClientRect().bottom <=
          this.bar.getBoundingClientRect().bottom;
    });
}

export const backTitle = new BackTitle();

export const pageHeading =
  (text: string): Attachment<HTMLElement> =>
  (element) => {
    backTitle.heading = element;
    backTitle.text = text;
    backTitle.measure();
    return () =>
      untrack(() => {
        if (backTitle.heading !== element) return;
        backTitle.heading = null;
        backTitle.shown = false;
      });
  };

export const backBar: Attachment<HTMLElement> = (element) => {
  backTitle.bar = element.closest<HTMLElement>('[data-page-top]');
  backTitle.measure();
  return () => {
    backTitle.bar = null;
  };
};
