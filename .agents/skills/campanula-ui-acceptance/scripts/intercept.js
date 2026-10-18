// 截图、检查用的请求拦截：sweep.py 把这个文件的内容作为 navigate_page 的 initScript，在页面脚本之前装上。
// 先按规则拦，没命中的 /api/ GET 再按重放回，都不是才真的发出去。
//
// 规则放在 localStorage 的 campanula-intercept（JSON），没有这一项就不拦：
// { "rules": [{ "path": "正则", "after": 0, "reply": "hold" | { "status": 502, "body": {...} } }] }
// - path：匹配请求地址（不含域名），例如 "^/api/playlists/\\d+/track-ids$"
// - after：前几个匹配的请求照常放行（交给重放或真的发出去），之后的才拦（例如让我喜欢的音乐先同步 1 页）
// - reply："hold" 一直不回（看加载中）；对象就回这个状态码和 JSON（看出错、空）
// 重放：sweep.py 在这段之前放好 window.__campanulaReplay = { delay, max, store, recorded }。
// store 里有这个地址（路径加查询）的回答就晚 delay 毫秒回它；没有就真的发出去，成功的 JSON 回答（不超过 max 个字符）
// 记进 recorded，sweep.py 读走存进这张票的重放文件。
// window.__campanulaFetching：还没回来的 /api/ 请求有几个（“一直不回”的也算），sweep.py 等页面停下来时看它
(() => {
  const config = JSON.parse(localStorage.getItem('campanula-intercept') || 'null')
  const replay = window.__campanulaReplay
  if (!config && !replay)
    return
  const rules = (config?.rules ?? []).map(rule => ({ ...rule, pattern: new RegExp(rule.path), seen: 0 }))
  window.__campanulaIntercept = Boolean(config)
  window.__campanulaFetching = 0
  const original = window.fetch.bind(window)
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  const answer = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href)
    const rule = rules.find(item => item.pattern.test(url.pathname))
    if (rule && ++rule.seen > (rule.after ?? 0)) {
      if (rule.reply === 'hold')
        return new Promise(() => {})
      return json(rule.reply.body ?? {}, rule.reply.status ?? 200)
    }
    const method = (init?.method ?? (typeof input === 'string' ? 'GET' : input.method)).toUpperCase()
    if (!replay || method !== 'GET' || !url.pathname.startsWith('/api/'))
      return original(input, init)
    const key = url.pathname + url.search
    if (Object.hasOwn(replay.store, key)) {
      await new Promise(resolve => setTimeout(resolve, replay.delay))
      return json(replay.store[key])
    }
    const response = await original(input, init)
    if (response.ok && (response.headers.get('content-type') ?? '').includes('application/json')) {
      const text = await response.clone().text()
      if (text.length <= replay.max)
        replay.recorded[key] = JSON.parse(text)
    }
    return response
  }
  window.fetch = async (input, init) => {
    if (!new URL(typeof input === 'string' ? input : input.url, location.href).pathname.startsWith('/api/'))
      return answer(input, init)
    window.__campanulaFetching += 1
    try {
      return await answer(input, init)
    }
    finally {
      window.__campanulaFetching -= 1
    }
  }
})()
