import { MediaQuery } from 'svelte/reactivity';

import { OFFLINE_BAR_HEIGHT } from '../notice/OfflineBar.svelte';

export const desktopLayout = new MediaQuery('min-width: 768px');

export const desktopPanelTop = (online: boolean): number =>
  64 + (online ? 0 : OFFLINE_BAR_HEIGHT) + 16;
