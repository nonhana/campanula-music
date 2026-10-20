import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { queryKey } from '#lib/server/mock/query-key.js'
import { buildIndex } from '../scripts/fixture-index.mts'

// 录制索引是 mock 按模块 + 查询匹配的来源。索引和录制文件必须一一对应，每份录制都要过 SDK 结构定义校验
// （SDK 还没导出结构的模块记 validated: false，mock 不拿它当可用录制）。
const ROOT = join(import.meta.dirname, '..')
const INDEX = join(ROOT, 'tests/fixtures/netease/index.json')

describe('录制索引', () => {
  it('和录制文件一一对应，重新生成结果一致', async () => {
    const stored = JSON.parse(await readFile(INDEX, 'utf8')) as Awaited<ReturnType<typeof buildIndex>>
    const rebuilt = await buildIndex()
    expect(rebuilt).toEqual(stored)
    expect(stored.entries.length).toBe(stored.recordings)
    expect(stored.entries.some(entry => entry.path === 'index.json')).toBe(false)
    for (const entry of stored.entries)
      expect(entry.path.endsWith('.json') || entry.path.endsWith('.json.gz')).toBe(true)
  }, 30_000)

  it('覆盖了 mock 需要的库、播放、搜索和登录模块', async () => {
    const index = JSON.parse(await readFile(INDEX, 'utf8')) as Awaited<ReturnType<typeof buildIndex>>
    for (const module of ['user_account', 'user_playlist', 'playlist_detail', 'song_detail', 'likelist', 'album_sublist', 'artist_sublist', 'song_url_v1', 'cloudsearch', 'search_suggest', 'login_cellphone', 'login_qr_check', 'playlist_tracks', 'like'])
      expect(index.modules[module]?.count, module).toBeGreaterThan(0)
  })

  it('查询键：参数顺序不影响，长列表只留摘要', () => {
    expect(queryKey({ id: 1, level: 'exhigh' })).toBe(queryKey({ level: 'exhigh', id: 1 }))
    const long = '1,'.repeat(200)
    expect(queryKey({ ids: long })).toContain('#sha256:')
    expect(queryKey({ ids: long })).not.toContain(long)
  })
})
