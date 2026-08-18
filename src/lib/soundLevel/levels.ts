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
  /** 一句话描述 */
  description: string
}

/** 缺省音质档位：未在设置页选择任何档位时的播放获取档位 */
export const DEFAULT_SOUND_LEVEL: NcmSoundLevel = 'standard'

/** 音质档位偏好的 localStorage 键 */
export const SOUND_LEVEL_STORAGE_KEY = 'campanula.soundLevel'

/** 全部可用音质档位（按码率从低到高） */
export const SOUND_LEVELS: readonly SoundLevelOption[] = [
  { id: 'standard', label: '标准', description: '默认档位，码率与流量消耗均衡' },
  { id: 'higher', label: '较高', description: '提高码率，听感更细腻' },
  { id: 'exhigh', label: '极高', description: '接近无损的高码率' },
  { id: 'lossless', label: '无损', description: '无损音质，流量消耗较大' },
  { id: 'hires', label: '高解析度', description: '高解析度音质，流量消耗最大' },
]

export function isSoundLevel(value: unknown): value is NcmSoundLevel {
  return SOUND_LEVELS.some(level => level.id === value)
}
