import type { NcmSoundLevel } from '$lib/types'
import { writable } from 'svelte/store'
import { DEFAULT_SOUND_LEVEL, isSoundLevel, SOUND_LEVEL_STORAGE_KEY } from './levels'

/** 当前音质档位；布局挂载时经 initSoundLevel 与持久化偏好对齐 */
export const currentSoundLevel = writable<NcmSoundLevel>(DEFAULT_SOUND_LEVEL)

/** 读取持久化的音质档位偏好；无值、非法或存储不可用时返回 null（由调用方回落默认） */
export function readStoredSoundLevel(): NcmSoundLevel | null {
  try {
    const stored = localStorage.getItem(SOUND_LEVEL_STORAGE_KEY)
    return stored !== null && isSoundLevel(stored) ? stored : null
  }
  catch {
    // 存储不可用（SSR、隐私模式）时按无偏好处理
    return null
  }
}

/** 切换音质档位并持久化偏好；播放编排读取该值获取播放地址 */
export function setSoundLevel(id: NcmSoundLevel) {
  currentSoundLevel.set(id)
  try {
    localStorage.setItem(SOUND_LEVEL_STORAGE_KEY, id)
  }
  catch {
    // localStorage 不可用时（如隐私模式）仅保证本次会话内生效
  }
}

/** 初始化：应用持久化偏好；无偏好时保持默认档位 */
export function initSoundLevel() {
  currentSoundLevel.set(readStoredSoundLevel() ?? DEFAULT_SOUND_LEVEL)
}
