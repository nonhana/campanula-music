/* eslint-disable style/max-statements-per-line, node/prefer-global/buffer -- 原样保留 2026-10-08 实际跑过的一次性探针脚本 */
// 验证关卡①：估算加密 Cookie 的大小（把 27 条 Set-Cookie 属性也存进去时约 6.9 KB，超过浏览器 4 KB 上限）。
// 用法：node scripts/gate/probe-cookie-size.mjs
const m = await import('hana-music-api')
let r; for (let i = 0; i < 5; i++) {
  r = await m.invokeModule('register_anonimous', {}, {}).catch(e => e); if (r.body?.code === 200)
    break
}
const lines = r.cookie
const parsed = lines.map((line) => {
  const [pair, ...attrs] = line.split(';'); const eq = pair.indexOf('='); const name = pair.slice(0, eq).trim(); const value = pair.slice(eq + 1).trim(); const meta = { name, empty: value === '' }; for (const a of attrs) {
    const at = a.indexOf('='); const k = (at < 0 ? a : a.slice(0, at)).trim().toLowerCase(); const v = at < 0 ? '' : a.slice(at + 1).trim(); if (k === 'max-age')
      meta.maxAge = Number(v); else if (k === 'expires')
      meta.expires = v; else if (k === 'path')
      meta.path = v
  } return { name, value, meta }
})
const cookie = {}; for (const p of parsed) {
  if (p.value)
    cookie[p.name] = p.value
}
cookie.MUSIC_U = 'X'.repeat(420) // 登录后会多一个 MUSIC_U，长度按常见值估
const session = { method: 'qr', cookie, deviceId: 'A'.repeat(52), loginAt: Date.now(), setCookie: parsed.map(p => p.meta), fp: 'abcdef12' }
const json = JSON.stringify(session)
const sealed = Math.ceil((12 + Buffer.byteLength(json) + 16) * 4 / 3)
const slim = JSON.stringify({ ...session, setCookie: undefined })
console.log(JSON.stringify({ setCookieLines: lines.length, distinctNames: Object.keys(cookie).length, jsonBytes: Buffer.byteLength(json), sealedChars: sealed, slimSealedChars: Math.ceil((12 + Buffer.byteLength(slim) + 16) * 4 / 3) }))
