// 验证关卡① 录制文件是怎么来的（2026-10-08）。录下的原始文件只放在本机 .scratch/gate-raw/rec/（不进 git，
// 里面有真实 uid、昵称、手机号），再用 scripts/gate/sanitize.mjs 脱敏后提交到 rewrite/v1 的 tests/fixtures/netease/。
//
// 录制文件格式（每个文件一次调用，name 形如 <领域>.<模块>[.<变体>]，决定输出路径）：
// { name, module, query, options: { slot, ip, save, summary }, recordedAt, via, viewer, note?, res }
// res 就是测试版 /api/call 的返回：{ module, ip, instance, durationMs, threw, status, code, bytes, body, setCookie, events, ... }
// 其中 body 已经由服务器去掉凭据（src/lib/server/netease.ts 的 scrub），setCookie 只有名字和属性。
//
// 三个来源：
// 1. via: 'curl-anon'      未登录的录制：在本机用 curl 带口令 Cookie 调 /api/call，原样存 res。
// 2. via: 'browser'        登录后的录制：在已登录的测试页里调 recordInBrowser。
// 3. via: 'browser-user-tab' 作者自己操作扫码、短信的那个标签页，导出 window.gate.log 后用 fromGateLog 转换。

/* global window */

// 2. 在测试页里录一次：返回的对象由自动化脚本写成 <name>.json
export async function recordInBrowser(name, module, query = {}, options = {}, extra = {}) {
  const entry = await window.gate.call(module, query, options)
  return {
    name,
    module,
    query: entry.query,
    options: entry.options,
    recordedAt: entry.at,
    via: 'browser',
    viewer: extra.viewer ?? (options.slot && options.slot !== 'none' ? `vip-${options.slot}` : 'anonymous'),
    note: extra.note,
    res: entry.res,
  }
}

// 3. 把测试页导出的日志条目（src/lib/gate/client.ts 的 LogEntry）转成录制文件。
// 手机号、验证码在 LogEntry.query 里已经是 <phone>、<captcha> 占位。
export function fromGateLog(logEntry, name, viewer, note) {
  return {
    name,
    module: logEntry.module,
    query: logEntry.query,
    options: logEntry.options,
    recordedAt: logEntry.at,
    via: 'browser-user-tab',
    viewer,
    ...(note ? { note } : {}),
    res: logEntry.res,
  }
}
