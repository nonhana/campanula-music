// 验证关卡②：算一次“整张歌单的新顺序”和“一批加歌”发到网易云的请求体有多大。不连网络：
// 自定义 fetcher 只记下 SDK 要发的请求体，然后回一个假的 200，不发出去。
// 用法：node scripts/gate/probe-request-size.mjs <歌曲编号文件：JSON 数组>
// 编号文件只放在本机 .scratch/（是作者“我喜欢的音乐”里的歌），不进 git。
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { invokeModule } from 'hana-music-api'

const ids = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const sent = []
async function fetcher(input, init) {
  const url = typeof input === 'string' ? input : input.url
  sent.push({ path: new URL(url).pathname, bytes: Buffer.byteLength(init?.body ?? '') })
  return new Response(JSON.stringify({ code: 200 }), { status: 200, headers: { 'content-type': 'application/json' } })
}
// 带一个假的 MUSIC_U，SDK 就不做匿名注册，只发这一个请求
const config = { cookie: { MUSIC_U: 'probe' }, fetcher }

const order = JSON.stringify(ids)
await invokeModule('song_order_update', { pid: 900000001, ids: order }, config)
const orderUpstream = sent.at(-1)
// Campanula 自己的接口收到 { pid, ids } 时的请求体（和 gate2-snippets.js 的 reorder() 算法一样）
const campanulaBody = JSON.stringify({ pid: 900000001, ids: order })

const batch = ids.slice(0, 1000).join(',')
await invokeModule('playlist_tracks', { op: 'add', pid: 900000001, tracks: batch }, config)
const addUpstream = sent.at(-1)

console.log(JSON.stringify({
  songs: ids.length,
  orderIdsBytes: Buffer.byteLength(order),
  campanulaOrderBodyBytes: Buffer.byteLength(campanulaBody),
  orderUpstream,
  add1000Upstream: addUpstream,
}, null, 2))
