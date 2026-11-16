import type { Attachment } from 'svelte/attachments';

export const trapFocus: Attachment<HTMLElement> = (node) => {
  const onkeydown = (event: KeyboardEvent) => {
    if (
      event.key !== 'Tab' ||
      event.defaultPrevented ||
      node.closest('[inert]') ||
      !(event.target instanceof Element) ||
      event.target.closest('[role="dialog"][aria-modal="true"]') !== node
    )
      return;
    const stops = [
      ...node.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]',
      ),
    ].filter(
      (element) =>
        element.tabIndex >= 0 &&
        !element.matches(':disabled') &&
        !element.closest('[inert]') &&
        element.checkVisibility({ visibilityProperty: true }),
    );
    const first = stops[0] ?? node;
    const last = stops.at(-1) ?? node;
    if (
      document.activeElement === node ||
      !stops.length ||
      (event.shiftKey
        ? document.activeElement === first
        : document.activeElement === last)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };
  node.addEventListener('keydown', onkeydown);
  return () => node.removeEventListener('keydown', onkeydown);
};
