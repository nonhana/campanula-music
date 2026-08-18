import { lyric as sdkLyric } from 'hana-music-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mapLyricBody, ncmLyric, parseLrc } from './lyric'

vi.mock('hana-music-api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('hana-music-api')>()
  return { ...mod, lyric: vi.fn() }
})

const mockedLyric = vi.mocked(sdkLyric)

/** 与 hana-music-api 的 lyric 返回体一致的最小夹具 */
function sdkBody(overrides: Record<string, unknown> = {}) {
  return { code: 200, lrc: { version: 22, lyric: '' }, tlyric: { version: 22, lyric: '' }, ...overrides }
}

beforeEach(() => {
  mockedLyric.mockReset()
})

describe('parseLrc', () => {
  it('解析 mm:ss 与 mm:ss.xx 时间戳为毫秒并保留文本', () => {
    const items = parseLrc('[00:12.34]第一句\n[01:05.00]第二句')

    expect(items).toEqual([
      { time: 12340, text: '第一句', translate: null },
      { time: 65000, text: '第二句', translate: null },
    ])
  })

  it('三位小数按毫秒、一位小数按十分之一秒换算', () => {
    const items = parseLrc('[00:00.5]五百毫秒\n[00:01.050]一零五零毫秒')

    expect(items).toEqual([
      { time: 500, text: '五百毫秒', translate: null },
      { time: 1050, text: '一零五零毫秒', translate: null },
    ])
  })

  it('同一行多个时间戳展开为多条歌词', () => {
    const items = parseLrc('[00:10.00][01:20.00]副歌')

    expect(items).toEqual([
      { time: 10000, text: '副歌', translate: null },
      { time: 80000, text: '副歌', translate: null },
    ])
  })

  it('冒号分隔的百分位（mm:ss:xx）同样解析', () => {
    const items = parseLrc('[00:01:50]百分位')

    expect(items).toEqual([{ time: 1500, text: '百分位', translate: null }])
  })

  it('乱序输入按时间升序输出（供播放进度对齐查找）', () => {
    const items = parseLrc('[01:00.00]后句\n[00:30.00]前句')

    expect(items.map(item => item.time)).toEqual([30000, 60000])
  })

  it('无时间戳的元数据行（ti/ar/by）跳过，空内容行跳过', () => {
    const items = parseLrc('[ti:歌名]\n[ar:歌手]\n[by:某人]\n\n[00:01.00]有字')

    expect(items).toEqual([{ time: 1000, text: '有字', translate: null }])
  })

  it('非 LRC 文本返回空数组', () => {
    expect(parseLrc('完全没有时间戳')).toEqual([])
  })
})

describe('mapLyricBody', () => {
  const lrcBody = sdkBody({
    lrc: { version: 22, lyric: '[00:01.00]第一句\n[00:03.50]第二句' },
    tlyric: { version: 22, lyric: '[00:03.50]Second line' },
  })

  it('lrc 解析为歌词，时间戳对齐的 tlyric 行为翻译', () => {
    expect(mapLyricBody(lrcBody)).toEqual([
      { time: 1000, text: '第一句', translate: null },
      { time: 3500, text: '第二句', translate: 'Second line' },
    ])
  })

  it('tlyric 缺时间戳对应行时翻译为 null', () => {
    const body = sdkBody({
      lrc: { lyric: '[00:01.00]第一句\n[00:03.50]第二句' },
      tlyric: { lyric: '[00:09.00]其他地方' },
    })

    expect(mapLyricBody(body)).toEqual([
      { time: 1000, text: '第一句', translate: null },
      { time: 3500, text: '第二句', translate: null },
    ])
  })

  it('同一时间戳多条翻译取首条', () => {
    const body = sdkBody({
      lrc: { lyric: '[00:01.00]一句' },
      tlyric: { lyric: '[00:01.00]翻译一\n[00:01.00]翻译二' },
    })

    expect(mapLyricBody(body)).toEqual([
      { time: 1000, text: '一句', translate: '翻译一' },
    ])
  })

  it('纯音乐（nolyric）如实返回空数组', () => {
    expect(mapLyricBody(sdkBody({ nolyric: true }))).toEqual([])
  })

  it('歌词未收录（uncollected）如实返回空数组', () => {
    expect(mapLyricBody(sdkBody({ uncollected: true }))).toEqual([])
  })

  it('lrc 为空或缺失返回空数组', () => {
    expect(mapLyricBody(sdkBody({ lrc: { lyric: '' } }))).toEqual([])
    expect(mapLyricBody(sdkBody({}))).toEqual([])
  })

  it('非对象返回体视为无歌词', () => {
    expect(mapLyricBody(null)).toEqual([])
  })
})

describe('ncmLyric', () => {
  it('按 id 调用 SDK 并返回解析后的歌词', async () => {
    mockedLyric.mockResolvedValue({
      body: sdkBody({ lrc: { lyric: '[00:01.00]第一句' } }),
      cookie: [],
      status: 200,
    } as never)

    const items = await ncmLyric({ cookie: '' }, 186016)

    expect(mockedLyric).toHaveBeenCalledWith({ id: 186016 }, undefined)
    expect(items).toEqual([{ time: 1000, text: '第一句', translate: null }])
  })

  it('携带绑定凭据', async () => {
    mockedLyric.mockResolvedValue({ body: sdkBody(), cookie: [], status: 200 } as never)

    await ncmLyric({ cookie: 'MUSIC_U=abc' }, 1)

    expect(mockedLyric).toHaveBeenCalledWith({ id: 1 }, { cookie: 'MUSIC_U=abc' })
  })

  it('无歌词（uncollected）如实返回空数组而非报错', async () => {
    mockedLyric.mockResolvedValue({ body: sdkBody({ uncollected: true }), cookie: [], status: 200 } as never)

    await expect(ncmLyric({ cookie: '' }, 6452)).resolves.toEqual([])
  })

  it('hTTP 200 但业务码 -110（无版权）映射为 RESOURCE_UNAVAILABLE', async () => {
    mockedLyric.mockResolvedValue({
      body: { code: -110, msg: '亲爱的,暂无版权' },
      cookie: [],
      status: 200,
    } as never)

    await expect(ncmLyric({ cookie: '' }, 6452)).rejects.toMatchObject(
      { name: 'NcmError', code: 'RESOURCE_UNAVAILABLE' },
    )
  })

  it('sDK 失败映射为领域错误', async () => {
    mockedLyric.mockRejectedValue({ status: 429, body: { code: -460, msg: '操作太频繁' } })

    await expect(ncmLyric({ cookie: '' }, 1)).rejects.toMatchObject(
      { name: 'NcmError', code: 'RATE_LIMITED' },
    )
  })
})
