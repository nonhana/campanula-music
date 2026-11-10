import type { MenuAnchor } from '../overlay/overlay-requests';
import { desktopLayout } from '../shared/layout';

const BUTTON_GAP = 4;

export const anchorBelow = (event: MouseEvent): MenuAnchor | null => {
  const pointer = event instanceof PointerEvent ? event.pointerType : '';
  if (
    pointer === 'touch' ||
    pointer === 'pen' ||
    (pointer === '' && !desktopLayout.current)
  )
    return null;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return {
    x: rect.right,
    y: rect.bottom + BUTTON_GAP,
    top: rect.top - BUTTON_GAP,
    end: true,
  };
};
