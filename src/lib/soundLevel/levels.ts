import type { NcmSoundLevel } from '$lib/types'

/**
 * 音质档位注册表。
 *
 * 档位与网易云 song/url/v1 的 level 参数一一对应（见门面 NcmSoundLevel）；
 * 选中档位用于播放地址获取，命中账号不支持/试听片段限制时由数据面如实呈现。
 */
export interface SoundLevelOption {
  /** 与网易云播放地址接口 level 参数对应的档位 */
  id: NcmSoundLevel
  /** 选择器中展示的名称 */
  label: string
}

/** 缺省音质档位：未在设置页选择任何档位时的播放获取档位 */
export const DEFAULT_SOUND_LEVEL: NcmSoundLevel = 'standard'

/** 音质档位偏好的 localStorage 键 */
export const SOUND_LEVEL_STORAGE_KEY = 'campanula.soundLevel'

/** 全部可用音质档位（按码率从低到高） */
export const SOUND_LEVELS: readonly SoundLevelOption[] = [
  { id: 'standard', label: '标准' },
  { id: 'higher', label: '较高' },
  { id: 'exhigh', label: '极高' },
  { id: 'lossless', label: '无损' },
  { id: 'hires', label: '高解析度' },
]

export function isSoundLevel(value: unknown): value is NcmSoundLevel {
  return SOUND_LEVELS.some(level => level.id === value)
}
