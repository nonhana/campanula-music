// 下载面板、已下载页的速率（#38）：组件每 500ms 采一次当前这首已收到的字节，这里只算，不碰时间。

/** 速率看最近多久的样本（毫秒）：换歌、暂停后重新采 */
export const SPEED_WINDOW_MS = 3000

export interface SpeedSample {
  /** 采样的时钟（毫秒，同 Date.now） */
  at: number
  received: number
}

/** 最近 windowMs 里的样本算出每秒多少字节：不够两个样本、时间没走、倒着来的都是 0 */
export const bytesPerSecond = (samples: readonly SpeedSample[], now: number, windowMs = SPEED_WINDOW_MS): number => {
  const recent = samples.filter(sample => now - sample.at <= windowMs)
  if (recent.length < 2)
    return 0
  const first = recent[0]
  const last = recent[recent.length - 1]
  const seconds = (last.at - first.at) / 1000
  return seconds <= 0
    ? 0
    : Math.max(0, (last.received - first.received) / seconds)
}

/** 写成 KB/s、MB/s：小数最多一位，整数不带 .0 */
export const formatSpeed = (bytes: number): string => {
  if (bytes < 1024)
    return `${Math.round(bytes)} B/s`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB/s`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB/s`
}
