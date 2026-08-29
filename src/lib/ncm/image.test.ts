import { describe, expect, it } from 'vitest'
import { ncmImageSrc } from './image'

describe('ncmImageSrc', () => {
  it('网易云图按档位追加缩放参数', () => {
    const url = 'https://p2.music.126.net/abc==/123.jpg'
    expect(ncmImageSrc(url, 'xs')).toBe(`${url}?param=120y120`)
    expect(ncmImageSrc(url, 's')).toBe(`${url}?param=400y400`)
    expect(ncmImageSrc(url, 'l')).toBe(`${url}?param=1024y1024`)
  })

  it('空串与非网易云地址（data URL 等）原样返回', () => {
    expect(ncmImageSrc('', 'xs')).toBe('')
    expect(ncmImageSrc('data:image/png;base64,xxx', 'xs')).toBe('data:image/png;base64,xxx')
    expect(ncmImageSrc('https://example.com/cover.jpg', 'xs')).toBe('https://example.com/cover.jpg')
  })

  it('已带查询串的地址用 & 连接', () => {
    const url = 'https://p1.music.126.net/abc==/123.jpg?x=1'
    expect(ncmImageSrc(url, 'xs')).toBe(`${url}&param=120y120`)
  })
})
