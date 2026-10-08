/* eslint-disable style/max-statements-per-line, node/prefer-global/process -- 原样保留 2026-10-08 实际跑过的一次性探针脚本 */
// 验证关卡①：给 SDK 调用配置传顶层 deviceId，隐式匿名注册就用它（干净的 4/4 成功，不干净的 2/2 失败）。
// 用法：node scripts/gate/probe-deviceid-config.mjs clean|bad
import { createHash } from 'node:crypto'

const m = await import('hana-music-api')
const KEY = '3go8&$8*3*3h0k(2)2'
function clean(d) { let x = ''; for (let i = 0; i < d.length; i++) x += String.fromCharCode(d.charCodeAt(i) ^ KEY.charCodeAt(i % 18)); return !/[+/]/.test(createHash('md5').update(x, 'utf8').digest('base64')) }
const mode = process.argv[2]
let d; do d = Array.from({ length: 52 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join(''); while (mode === 'clean' ? !clean(d) : clean(d))
const regs = []
async function fetcher(input, init) {
  const url = typeof input === 'string' ? input : input.url; const res = await fetch(input, init); if (url.includes('register/anonimous'))
    regs.push((new Headers(init?.headers).get('cookie') || '').match(/deviceId=([^;]+)/)?.[1]?.slice(0, 6)); return res
}
const r = await m.invokeModule('cloudsearch', { keywords: 'x', limit: 1 }, { deviceId: d, state: { deviceId: d }, fetcher }).catch(e => e)
console.log(JSON.stringify({ mode, dev: d.slice(0, 6), code: r.body?.code, regs }))
