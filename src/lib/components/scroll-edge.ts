// 拖动排序时拖到列表上下边缘的自动滚动（#36 歌曲列表、#37 曲库歌单列表共用）：
// 越靠边越快（平方），停在边缘越久越快（3 秒内最多加速到 8 倍）；边缘区从顶栏、播放条的上沿算起。

/** 拖到边缘多深开始自动滚动（px） */
const EDGE = 72
/** 自动滚动最快多少 px/秒 */
const MAX_SPEED = 1600
/** 停在边缘 3 秒内最多加速到几倍 */
const ACCEL = 8
const ACCEL_TIME = 3000

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/**
 * 这一帧要滚多少（px，正数往下）、接下来记着的停在边缘多久（秒）。
 * dt 是这一帧的秒数，pointerY 是指针的视口纵坐标，top / bottom 是能拖动的区域。
 */
export function edgeScroll(dt: number, pointerY: number, top: number, bottom: number, hold: number): { amount: number, hold: number } {
  let direction = 0
  let depth = 0
  if (pointerY < top + EDGE) {
    direction = -1
    depth = clamp((top + EDGE - pointerY) / EDGE, 0, 1)
  }
  else if (pointerY > bottom - EDGE) {
    direction = 1
    depth = clamp((pointerY - (bottom - EDGE)) / EDGE, 0, 1)
  }
  if (direction === 0)
    return { amount: 0, hold: 0 }
  const nextHold = hold + dt
  // 越深越快（平方），停在边缘越久越快（按深度加权，轻轻碰到边缘时不会突然飞起来）
  const ramp = 1 + (ACCEL - 1) * clamp(nextHold / (ACCEL_TIME / 1000), 0, 1) * depth
  return { amount: direction * MAX_SPEED * depth * depth * ramp * dt, hold: nextHold }
}
