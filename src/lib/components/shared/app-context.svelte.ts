import { createContext } from 'svelte'
import { createSubscriber } from 'svelte/reactivity'

import type { App, AppState } from '#lib/app/app.js'

/** 读 state 时订阅 App，状态一变界面跟着更新 */
export interface AppView {
  readonly app: App
  readonly state: AppState
}

export const viewOf = (app: App): AppView => {
  const subscribe = createSubscriber(update => app.subscribe(update))
  return {
    app,
    get state() {
      subscribe()
      return app.state
    },
  }
}

export const [getAppView, setAppView] = createContext<AppView>()
