/**
 * 只读冒烟脚本：按序请求各 API 门面路由，断言封套级不变量，任一失败退出码非 0。
 *
 * 用法：先启动 dev server（pnpm dev），再 `pnpm smoke`。
 * 环境变量：SMOKE_BASE_URL（默认 http://localhost:5173）。
 * 严格只读：只访问 GET 端点，不写真实账号（不点红心、不触发扫码）。
 */
import process from 'node:process'

const BASE_URL = process.env.SMOKE_BASE_URL?.trim() || 'http://localhost:5173'

/** 步骤失败：打印详情并以非零码退出 */
function fail(step: string, detail: unknown): never {
  console.error(`✗ ${step}`)
  console.error(`  ${JSON.stringify(detail)}`)
  process.exit(1)
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`)
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok)
    fail(`GET ${path}`, { status: res.status, body })
  return body
}

/** /api/playlists 歌单条目的最小形状守卫（id/name/trackCount），不匹配返回 null */
function asPlaylistEntry(value: unknown): { id: number, name: string, trackCount: number } | null {
  if (typeof value !== 'object' || value === null || !('id' in value) || !('name' in value) || !('trackCount' in value))
    return null
  if (typeof value.id !== 'number' || typeof value.name !== 'string' || typeof value.trackCount !== 'number')
    return null
  return value
}

// 跨步骤共享的取样结果（步骤按序执行，先到的步骤负责赋值）
let firstPlaylistId = 0
let firstSearchSongId = 0

const steps: Array<{ name: string, run: () => Promise<void> }> = [
  {
    name: '/api/binding/status → 绑定有效（冒烟依赖真实账号）',
    run: async () => {
      const body = await getJson('/api/binding/status')
      if (typeof body !== 'object' || body === null || !('status' in body) || body.status !== 'valid')
        fail('binding/status', { hint: '需要先绑定账号（.data/credential.json）', body })
      // 路由返回 BindingStatus 合同，valid 分支携带 user
      const status = body as { status: 'valid', user: { uid: number, nickname: string } }
      console.log(`✓ binding/status valid: uid=${status.user.uid} ${status.user.nickname}`)
    },
  },
  {
    name: '/api/playlists → 两组歌单均非空',
    run: async () => {
      const body = await getJson('/api/playlists')
      if (typeof body !== 'object' || body === null || !('created' in body) || !('collected' in body))
        fail('playlists', { body })
      // 两组字段存在，逐组校验数组形状
      const groups = body as { created: unknown[], collected: unknown[] }
      if (!Array.isArray(groups.created) || groups.created.length === 0)
        fail('playlists', { hint: 'created 为空：user_playlist 封套解包可能回归', created: groups.created })
      if (!Array.isArray(groups.collected) || groups.collected.length === 0)
        fail('playlists', { hint: 'collected 为空：user_playlist 封套解包可能回归', collected: groups.collected })
      const firstCreated = groups.created.map(asPlaylistEntry).find(p => p !== null)
      if (!firstCreated)
        fail('playlists', { hint: 'created 中无带数字 id 的歌单条目', created: groups.created })
      // 详情步骤优先取收藏组（第三方歌单 trackCount 精确）；创建组首条是「我喜欢的音乐」，
      // 该特殊歌单上游 trackCount 惰性更新、与 trackIds 数量存在漂移，不作精确断言
      const collectedNonEmpty = groups.collected.map(asPlaylistEntry).find(p => p !== null && p.trackCount > 0)
      firstPlaylistId = collectedNonEmpty?.id ?? firstCreated.id
      console.log(`✓ playlists created=${groups.created.length} collected=${groups.collected.length}`)
    },
  },
  {
    name: '/api/search → 歌曲搜索 total>0 且有结果',
    run: async () => {
      const body = await getJson('/api/search?keywords=Lemon&type=song')
      if (typeof body !== 'object' || body === null || !('songs' in body) || !('total' in body))
        fail('search', { body })
      const page = body as { songs: unknown[], total: number }
      if (!Array.isArray(page.songs) || page.songs.length === 0 || typeof page.total !== 'number' || page.total <= 0)
        fail('search', { body })
      const first = page.songs[0]
      if (typeof first !== 'object' || first === null || !('id' in first) || typeof first.id !== 'number')
        fail('search', { hint: 'songs[0] 缺少数字 id', first })
      firstSearchSongId = first.id
      console.log(`✓ search songs=${page.songs.length} total=${page.total}`)
    },
  },
  {
    name: `/api/playlist/{收藏歌单 ${firstPlaylistId}} → songs.length === trackCount`,
    run: async () => {
      const body = await getJson(`/api/playlist/${firstPlaylistId}`)
      if (typeof body !== 'object' || body === null || !('songs' in body) || !('trackCount' in body))
        fail('playlist', { body })
      const detail = body as { trackCount: number, songs: unknown[] }
      if (!Array.isArray(detail.songs) || detail.songs.length !== detail.trackCount)
        fail('playlist', { hint: '歌曲补全数量与 trackCount 不一致', trackCount: detail.trackCount, actual: Array.isArray(detail.songs) ? detail.songs.length : null })
      console.log(`✓ playlist ${firstPlaylistId} songs=${detail.songs.length}`)
    },
  },
  {
    name: '/api/songs/liked → 红心列表非空',
    run: async () => {
      const body = await getJson('/api/songs/liked')
      if (!Array.isArray(body) || body.length === 0)
        fail('songs/liked', { body })
      console.log(`✓ songs/liked count=${body.length}`)
    },
  },
  {
    name: '/api/songs/lyric → 歌词数组可解析',
    run: async () => {
      const body = await getJson(`/api/songs/lyric?id=${firstSearchSongId}`)
      if (!Array.isArray(body))
        fail('songs/lyric', { body })
      console.log(`✓ songs/lyric lines=${body.length}`)
    },
  },
  {
    name: '/api/songs/url → 播放地址可用（playable/trial）',
    run: async () => {
      const body = await getJson(`/api/songs/url?ids=${firstSearchSongId}`)
      if (!Array.isArray(body) || body.length !== 1)
        fail('songs/url', { body })
      const source = body[0]
      if (typeof source !== 'object' || source === null || !('status' in source) || !('url' in source))
        fail('songs/url', { source })
      // NcmSongSource 合同：playable/trial 携带 url，unavailable 视为许可/版权失败
      const cast = source as { status: 'playable' | 'trial' | 'unavailable', url: string | null }
      if (cast.status === 'unavailable' || typeof cast.url !== 'string')
        fail('songs/url', { hint: '播放地址不可用（账号许可或版权）', source })
      console.log(`✓ songs/url status=${cast.status}`)
    },
  },
]

for (const step of steps) {
  try {
    await step.run()
  }
  catch (err) {
    fail(step.name, err)
  }
}

console.log(`\nsmoke passed: ${steps.length} steps against ${BASE_URL}`)
