// 截状态图用的请求拦截：sweep.py 把这个文件的内容作为 navigate_page 的 initScript，在页面脚本之前装上。
// 规则放在 localStorage 的 campanula-intercept（JSON），没有这一项就什么都不做：
// { "rules": [{ "path": "正则", "after": 0, "reply": "hold" | { "status": 502, "body": {...} } }] }
// - path：匹配请求地址（不含域名），例如 "^/api/playlists/\\d+/track-ids$"
// - after：前几个匹配的请求照常放行，之后的才拦（例如让我喜欢的音乐先同步 1 页）
// - reply："hold" 一直不回（看加载中）；对象就回这个状态码和 JSON（看出错、空）
(() => {
  const config = JSON.parse(localStorage.getItem('campanula-intercept') || 'null')
  if (!config)
    return
  const rules = config.rules.map(rule => ({ ...rule, pattern: new RegExp(rule.path), seen: 0 }))
  window.__campanulaIntercept = true
  const original = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href)
    const rule = rules.find(item => item.pattern.test(url.pathname))
    if (!rule || ++rule.seen <= (rule.after ?? 0))
      return original(input, init)
    if (rule.reply === 'hold')
      return new Promise(() => {})
    return Promise.resolve(new Response(JSON.stringify(rule.reply.body ?? {}), {
      status: rule.reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    }))
  }
})()
