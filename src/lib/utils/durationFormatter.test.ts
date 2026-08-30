import { describe, expect, it } from 'vitest'
import { durationFormatter } from './durationFormatter'

describe('durationFormatter', () => {
  it('1 小时内保持 m:ss', () => {
    expect(durationFormatter(0)).toBe('0:00')
    expect(durationFormatter(269_000)).toBe('4:29')
  })
  it('59:59 为无小时进位的上边界', () => {
    expect(durationFormatter(59 * 60_000 + 59_000)).toBe('59:59')
  })

  it('整 1 小时进位为 h:mm:ss', () => {
    expect(durationFormatter(3_600_000)).toBe('1:00:00')
  })

  it('125:30 进位为 2:05:30', () => {
    expect(durationFormatter(125 * 60_000 + 30_000)).toBe('2:05:30')
  })
})
