import type { App, AppState } from '$lib/app/app'
import { createContext } from 'svelte'
import { createSubscriber } from 'svelte/reactivity'

/** 界面用的 App：读 state 时订阅 App，状态一变界面跟着更新 */
export interface AppView {
  readonly app: App
  readonly state: AppState
}

export function viewOf(app: App): AppView {
  const subscribe = createSubscriber(update => app.subscribe(update))
  return {
    app,
    get state() {
      subscribe()
      return app.state
    },
  }
}

/** 根布局创建 App 后放进上下文，页面和组件从这里拿 */
export const [getAppView, setAppView] = createContext<AppView>()
