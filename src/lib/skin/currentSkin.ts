import type { SkinId } from './skins'
import { writable } from 'svelte/store'
import { DEFAULT_SKIN_ID, isSkinId, SKIN_STORAGE_KEY } from './skins'

/** 当前皮肤 id；布局挂载时经 initSkin 与持久化偏好对齐 */
export const currentSkin = writable<SkinId>(DEFAULT_SKIN_ID)

/** 读取持久化的皮肤偏好；无值、非法或存储不可用时返回 null（由调用方回落默认） */
export function readStoredSkin(): SkinId | null {
  try {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY)
    return stored !== null && isSkinId(stored) ? stored : null
  }
  catch {
    // 存储不可用（SSR、隐私模式）时按无偏好处理
    return null
  }
}

/** 切换皮肤并持久化偏好：html[data-skin] 变化即触发令牌组切换，即时生效 */
export function setSkin(id: SkinId) {
  if (typeof document !== 'undefined')
    document.documentElement.dataset.skin = id
  currentSkin.set(id)
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, id)
  }
  catch {
    // localStorage 不可用时（如隐私模式）仅保证本次会话内生效
  }
}

/** 初始化：应用持久化偏好；无偏好时保持默认皮肤（app.html 已兜底 data-skin） */
export function initSkin() {
  setSkin(readStoredSkin() ?? DEFAULT_SKIN_ID)
}
