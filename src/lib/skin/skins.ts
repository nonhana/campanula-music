/**
 * 皮肤注册表。
 *
 * 每套皮肤是一组 `[data-skin='...']` 作用域下的令牌 CSS（见 skins.css）；
 * 运行时切换 html 的 data-skin 属性即切换令牌组，即时生效。
 */
export type SkinId = 'campanula'

export interface Skin {
  /** 与 [data-skin='...'] 令牌组对应的标识 */
  id: SkinId
  /** 选择器中展示的名称 */
  label: string
}

/** 默认皮肤：薄荷绿/蜜桃粉浅色方案 */
export const DEFAULT_SKIN_ID: SkinId = 'campanula'

/** 切肤偏好的 localStorage 键 */
export const SKIN_STORAGE_KEY = 'campanula.skin'

export const SKINS: readonly Skin[] = [
  {
    id: 'campanula',
    label: '风铃草 · 薄荷蜜桃',
  },
]

export function isSkinId(value: unknown): value is SkinId {
  return SKINS.some(skin => skin.id === value)
}
