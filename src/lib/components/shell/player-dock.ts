export interface DockBottom {
  desktop: boolean;
  present: boolean;
  withoutBar: string;
}

export const playerDockBottom = ({
  desktop,
  present,
  withoutBar,
}: DockBottom): string => {
  if (!present) return withoutBar;
  return desktop ? '80px' : 'calc(72px + env(safe-area-inset-bottom))';
};

export const playerDockTop = (): number =>
  document.querySelector('[data-player-bar]')?.getBoundingClientRect().top ??
  window.innerHeight;
