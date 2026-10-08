// 验证关卡① 实际在测试页里跑过的脚本（2026-10-08，通过浏览器自动化注入到已登录的测试页执行）。
// 都只调测试版的 /api/call：凭据在加密的 httpOnly Cookie 里，脚本本身拿不到。
// window.gate 由 src/routes/+page.svelte 挂上：gate.call(module, query, { slot, ip, save, summary })。

/* global window, performance */

// 测试项 1：同一批歌在三种 IP 下的权限和播放地址；部署到 hkg1、iad1 各跑一遍。
// sample 是“我喜欢的音乐”里均匀抽的 300 首；songs 从中挑会员歌 5 首、免费歌 3 首、无版权 3 首。
export async function regionMatrix(sample, songs) {
  const modes = ['default', 'real', 'none']
  const privileges = {}
  for (const ip of modes) {
    const entry = await window.gate.call('song_detail', { ids: sample.join(',') }, { slot: 'qr', ip })
    privileges[ip] = Object.fromEntries((entry.res.body?.privileges ?? []).map(p => [p.id, { st: p.st, pl: p.pl, dl: p.dl, fee: p.fee, maxbr: p.maxbr, cp: p.cp, payed: p.payed }]))
  }
  const rows = []
  for (const [kind, list] of Object.entries(songs)) {
    for (const id of list) {
      const row = { kind, id }
      for (const ip of modes) {
        const entry = await window.gate.call('song_url_v1', { id, level: 'lossless' }, { slot: 'qr', ip })
        const item = entry.res.body?.data?.[0] ?? {}
        row[ip] = `${item.code}|${item.url ? 'url' : 'null'}|${item.br}|${item.level}|${item.freeTrialInfo ? 'trial' : 'full'}`
        row.region = entry.res.instance.region
      }
      rows.push(row)
    }
  }
  const misc = {}
  for (const ip of modes) {
    const search = await window.gate.call('cloudsearch', { keywords: '孤勇者', type: 1, limit: 5 }, { slot: 'qr', ip, summary: true })
    const lyric = await window.gate.call('lyric_new', { id: 1901371647 }, { slot: 'qr', ip })
    misc[ip] = { search: search.res.code, lyric: lyric.res.code, yrc: Boolean(lyric.res.body?.yrc?.lyric) }
  }
  return { privileges, rows, misc }
}

// 测试项 4：续期，并立刻用新旧 Cookie 各查一次账号。
export async function refreshBoth() {
  const out = {}
  for (const slot of ['sms', 'qr']) {
    const refresh = await window.gate.call('login_refresh', {}, { slot, save: 'refresh' })
    const fresh = await window.gate.call('user_account', {}, { slot })
    const stale = refresh.res.saved ? await window.gate.call('user_account', {}, { slot: `${slot}_prev` }) : null
    out[slot] = { refresh: refresh.res.code, newFp: refresh.res.saved?.fp, oldFp: refresh.res.sessionFp, fresh: fresh.res.body?.account?.id, stale: stale?.res.body?.account?.id }
  }
  return out
}

// 测试项 4：隔一段时间看四份 Cookie 是否还有效。recommend_songs 未登录也回 200，不能当判断依据；以 user_account 能否拿到账号为准。
export async function checkSlots(uid) {
  const row = { at: new Date().toISOString() }
  for (const slot of ['sms', 'qr', 'sms_prev', 'qr_prev']) {
    const account = await window.gate.call('user_account', {}, { slot })
    row[slot] = account.res.body?.account?.id === uid ? 'valid' : 'not-logged-in'
  }
  return row
}

// 测试项 5：打卡前后看本周排行里这首歌的次数和累计听歌数。
export async function checkScrobble(uid, songId) {
  const week = await window.gate.call('user_record', { uid, type: 1 }, { slot: 'qr' })
  const detail = await window.gate.call('user_detail', { uid }, { slot: 'qr' })
  const data = week.res.body?.weekData ?? []
  const index = data.findIndex(item => item.song?.id === songId)
  return { at: new Date().toISOString(), rank: index + 1, playCount: data[index]?.playCount, score: data[index]?.score, listenSongs: detail.res.body?.listenSongs }
}

// 测试项 8：按 Campanula 的方式首次同步整个曲库。每张歌单两次请求：
// 先 playlist_detail 拿全部曲目编号，再按 1,000 首一页 song_detail（只回大小，不回内容）。
// concurrency 是后台同时在路上的请求数；遇到 429 / 405 / -460 按 retryAfter（没有就 30 秒）暂停并记下完整返回。
export async function runSync(concurrency, playlists) {
  const state = { concurrency, startedAt: Date.now(), events: [], limited: [], errors: [] }
  const queue = playlists.map(p => ({ kind: 'detail', pid: p.id }))
  let active = 0
  let pausedUntil = 0
  const post = async (module, query, summary) => {
    const started = performance.now()
    const response = await fetch('/api/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ module, query, slot: 'qr', summary }) })
    const text = await response.text()
    let res
    try {
      res = JSON.parse(text)
    }
    catch {
      res = { code: response.status, raw: text.slice(0, 500) }
    }
    return { http: response.status, rtt: Math.round(performance.now() - started), res }
  }
  const work = async (task) => {
    const t = Date.now() - state.startedAt
    let out
    if (task.kind === 'detail') {
      out = await post('playlist_detail', { id: task.pid }, false)
      const ids = out.res.body?.playlist?.trackIds?.map(item => item.id) ?? []
      for (let i = 0; i < ids.length; i += 1000)
        queue.push({ kind: 'songs', pid: task.pid, ids: ids.slice(i, i + 1000) })
      task.n = ids.length
    }
    else {
      out = await post('song_detail', { ids: task.ids.join(',') }, true)
      task.n = task.ids.length
    }
    const event = { kind: task.kind, pid: task.pid, n: task.n, http: out.http, code: out.res.code, ms: out.res.durationMs, rtt: out.rtt, bytes: out.res.bytes, inst: out.res.instance?.id, t }
    state.events.push(event)
    if (out.http !== 200 || out.res.code !== 200) {
      const full = { ...event, body: out.res.body ?? out.res.raw, status: out.res.status, events: out.res.events }
      if ([429, 405, -460].includes(out.res.code) || out.http === 429) {
        state.limited.push(full)
        pausedUntil = Date.now() + (Number(out.res.body?.retryAfter) || 30) * 1000
        queue.unshift(task)
      }
      else {
        state.errors.push(full)
      }
    }
  }
  await new Promise((resolve) => {
    const pump = () => {
      if (queue.length === 0 && active === 0)
        return resolve()
      while (active < concurrency && queue.length > 0) {
        if (Date.now() < pausedUntil) {
          setTimeout(pump, pausedUntil - Date.now())
          return
        }
        const task = queue.shift()
        active += 1
        work(task).catch(error => state.errors.push({ kind: task.kind, pid: task.pid, error: String(error) })).finally(() => {
          active -= 1
          pump()
        })
      }
    }
    pump()
  })
  state.totalMs = Date.now() - state.startedAt
  return state
}
