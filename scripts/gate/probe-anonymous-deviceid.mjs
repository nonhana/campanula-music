/* eslint-disable style/max-statements-per-line, node/prefer-global/buffer -- 原样保留 2026-10-08 实际跑过的一次性探针脚本 */
// 验证关卡①：匿名注册失败和 deviceId 的关系（2026-10-08 本机跑 40 个随机 deviceId：
// 摘要含 + 或 / 的 21 个全部回 400，其余 19 个全部成功）。用法：node scripts/gate/probe-anonymous-deviceid.mjs
import { createHash } from 'node:crypto'

const m = await import('hana-music-api')
const KEY = '3go8&$8*3*3h0k(2)2'
function uname(d) { let x = ''; for (let i = 0; i < d.length; i++) x += String.fromCharCode(d.charCodeAt(i) ^ KEY.charCodeAt(i % 18)); const dig = createHash('md5').update(x, 'utf8').digest('base64'); return { dig, u: Buffer.from(`${d} ${dig}`, 'utf8').toString('base64') } }
const out = []
for (let i = 0; i < 40; i++) {
  const deviceId = Array.from({ length: 52 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('')
  const r = await m.invokeModule('register_anonimous', {}, { state: { deviceId, cnIp: '', anonymousToken: 'probe' } }).catch(e => e)
  const { dig, u } = uname(deviceId)
  out.push({ ok: r.body?.code === 200, code: r.body?.code, dig, plusU: /\+/.test(u), slashU: /\//.test(u), plusD: /\+/.test(dig), slashD: /\//.test(dig) })
  await new Promise(r => setTimeout(r, 250))
}
console.log(JSON.stringify(out))
