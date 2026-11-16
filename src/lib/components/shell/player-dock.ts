export const PHONE_DOCK_HEIGHT = 64;
export const DESKTOP_DOCK_HEIGHT = 80;

export interface DockBottom {
  desktop: boolean;
  present: boolean;
  withoutBar: string;
  height?: number;
}

export const playerDockBottom = ({
  desktop,
  present,
  withoutBar,
  height = PHONE_DOCK_HEIGHT,
}: DockBottom): string => {
  if (!present) return withoutBar;
  return desktop
    ? `${Math.max(DESKTOP_DOCK_HEIGHT, height)}px`
    : `calc(${height + 8}px + env(safe-area-inset-bottom))`;
};

export const playerDockTop = (): number =>
  document.querySelector('[data-player-bar]')?.getBoundingClientRect().top ??
  window.innerHeight;
