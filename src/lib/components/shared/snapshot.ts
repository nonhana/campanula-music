import { snapshot } from '$app/navigation';
import type { RouteId } from '$app/types';

import { atOnce } from './motion';

// SvelteKit 先滚到记下的位置再恢复 snapshot，状态让页面变高变矮时滚动锚定会挪走位置，所以要恢复状态后再滚一次
export const scrollSnapshot = <T>(
  id: RouteId,
  read: () => T,
  write: (value: T) => void,
): void => {
  snapshot({
    id,
    capture: () => ({
      value: read(),
      scrollY: window.scrollY,
    }),
    restore: ({ value, scrollY }) => {
      atOnce(() => write(value));
      window.scrollTo(0, scrollY);
    },
  });
};
