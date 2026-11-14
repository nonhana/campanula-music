import { createContext } from 'svelte';

import type { createOverlays } from './overlays.svelte.ts';

export const [getOverlays, setOverlays] =
  createContext<ReturnType<typeof createOverlays>>();
