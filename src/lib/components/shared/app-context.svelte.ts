import { createContext } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';

import type { App, AppState } from '#lib/app/app.ts';

export interface AppView {
  readonly app: App;
  readonly state: AppState;
  readonly demo?: boolean;
}

export const viewOf = (app: App): AppView => {
  const subscribe = createSubscriber((update) => app.subscribe(update));
  return {
    app,
    get state() {
      subscribe();
      return app.state;
    },
  };
};

export const [getAppView, setAppView] = createContext<AppView>();
