/**
 * NCM 图片展示档位：按显示尺寸 × DPR(2) 归一到网易云 CDN 缩放预设（?param=WxH）。
 *
 * 服务端出口（asImageUrl）只保证 https 与主机归一，返回原始分辨率地址；
 * 缩放档位由展示点声明——同一原始图在不同档位是不同的 URL（各自缓存一份），
 * 展示点必须选所属档位，避免一张图被多档位重复下载。
 */
export type NcmImageTier = 'xs' | 's' | 'l'

const TIER_PARAMS = {
  /** 行封面/头像：显示 ≤48px（120 = 48×2.5） */
  xs: '120y120',
  /** 卡片/头图：显示 ≤280px（400 ≈ 200×2） */
  s: '400y400',
  /** 播放页大图等大幅展示（1024 覆盖 432px@2.3x 与系统媒体面板） */
  l: '1024y1024',
} as const satisfies Record<NcmImageTier, string>

/** 展示前按档位取缩放地址；空串/非网易云图（如绑定二维码 data URL）原样返回 */
export function ncmImageSrc(url: string, tier: NcmImageTier): string {
  if (!url || !/^https:\/\/p\d\.music\.126\.net\//.test(url))
    return url
  const joiner = url.includes('?') ? '&' : '?'
  return `${url}${joiner}param=${TIER_PARAMS[tier]}`
}
