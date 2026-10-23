/** 把 value 夹在 low 和 high 之间（拖动排序、边缘滚动、取景框、滑块共用） */
export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}
