import { createContext } from 'svelte'

import type { createOverlays } from './overlays.svelte'

/** context 与登记表、被挂载的组件之间没有运行时依赖。 */
export const [getOverlays, setOverlays] = createContext<ReturnType<typeof createOverlays>>()
