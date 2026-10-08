// 验证关卡② 实际在测试页里跑过的脚本（2026-10-09）。整个文件注入到已登录的测试页执行，挂出 window.gate2；
// 浏览器自动化再一步一步调用里面的函数，每一步看过结果再走下一步（步骤和结果见 #15 的留言）。
// - 网易云调用都走测试版的 /api/call：凭据在加密的 httpOnly Cookie 里，脚本拿不到。
// - 封面直传：浏览器拿上传凭证，直接 POST 到网易云图片存储（nosup-hz1.127.net），不经过测试版。
// - 录制：call() 带名字的调用和 upload() 的直传结果先攒着，drain() 取走后由自动化脚本写成
//   .scratch/gate2-raw/rec/<name>.json（格式同 recorder.js，直传的 module 记成 'nos_upload'），再用 sanitize.mjs 脱敏。

/* global window, OffscreenCanvas, crypto, performance, TextEncoder */
window.gate2 = (() => {
  const SLOT = 'qr'
  const WRITE_TIMEOUT_MS = 50_000
  let recordings = []

  /** 调一次 SDK 模块；name 不为空就记成一份录制。 */
  async function call(name, module, query = {}, { note, ...options } = {}) {
    const entry = await window.gate.call(module, query, { slot: SLOT, ...options })
    if (name)
      recordings.push({ name, module, query: entry.query, options: entry.options, recordedAt: entry.at, via: 'browser', viewer: `vip-${SLOT}`, ...(note ? { note } : {}), res: entry.res })
    return entry.res
  }

  function drain() {
    const out = recordings
    recordings = []
    return out
  }

  const ok = res => res.code === 200
  const brief = res => ({ code: res.code, status: res.status, ms: res.durationMs, msg: res.body?.message ?? res.body?.msg ?? res.error, ...(res.threw ? { threw: true } : {}) })

  // ---- 只读：主账号的原始状态，测前测后各取一次对照 ----

  async function allPages(module) {
    const ids = []
    for (let offset = 0; ;) {
      const res = await call(null, module, { limit: 100, offset })
      if (!ok(res))
        throw new Error(`${module} ${res.code}`)
      const items = res.body?.data ?? []
      ids.push(...items.map(item => item.id))
      offset += items.length
      if (!res.body?.hasMore || items.length === 0)
        return { ids, count: res.body?.count }
    }
  }

  async function playlists(uid, name) {
    const res = await call(name, 'user_playlist', { uid, limit: 1000 })
    if (!ok(res))
      throw new Error(`user_playlist ${res.code}`)
    const mine = playlist => (playlist.creator?.userId ?? playlist.userId) === uid
    return {
      more: res.body.more,
      created: res.body.playlist.filter(mine).map(p => ({ id: p.id, name: p.name, privacy: p.privacy, trackCount: p.trackCount, specialType: p.specialType })),
      subscribed: res.body.playlist.filter(p => !mine(p)).map(p => p.id),
    }
  }

  async function snapshot() {
    const account = await call(null, 'user_account')
    const uid = account.body?.account?.id
    if (!uid)
      throw new Error(`user_account ${account.code}：没拿到账号`)
    const lists = await playlists(uid)
    const likes = await call(null, 'likelist', { uid })
    if (!ok(likes))
      throw new Error(`likelist ${likes.code}`)
    return { at: new Date().toISOString(), uid, ...lists, likeIds: likes.body.ids, albums: await allPages('album_sublist'), artists: await allPages('artist_sublist') }
  }

  function compare(before, after) {
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    return {
      createdOrder: same(before.created.map(p => p.id), after.created.map(p => p.id)),
      createdMeta: same(before.created, after.created),
      subscribed: same(before.subscribed, after.subscribed),
      likeIds: same(before.likeIds, after.likeIds),
      albums: same(before.albums.ids, after.albums.ids),
      artists: same(before.artists.ids, after.artists.ids),
    }
  }

  async function detail(id, name, note) {
    const res = await call(name, 'playlist_detail', { id }, { note })
    const p = res.body?.playlist
    return { code: res.code, ms: res.durationMs, bytes: res.bytes, msg: res.body?.message ?? res.body?.msg, trackCount: p?.trackCount, trackIds: p?.trackIds?.map(track => track.id) ?? [], name: p?.name, description: p?.description, tags: p?.tags, privacy: p?.privacy, coverImgUrl: p?.coverImgUrl, coverImgId: p?.coverImgId_str ?? p?.coverImgId }
  }

  // ---- 往歌单里加歌、排序 ----

  async function addTracks(name, pid, ids, note) {
    const started = performance.now()
    const res = await call(name, 'playlist_tracks', { op: 'add', pid, tracks: ids.join(',') }, { timeoutMs: WRITE_TIMEOUT_MS, note })
    return { n: ids.length, ...brief(res), rtt: Math.round(performance.now() - started), body: res.body, events: res.events }
  }

  /** 每批 batch 首、同时 concurrency 批，往同一张歌单里加（Campanula 的后台节奏是同时 2–3 个）。 */
  async function addInParallel(pid, ids, batch, concurrency) {
    const batches = []
    for (let index = 0; index < ids.length; index += batch)
      batches.push(ids.slice(index, index + batch))
    const results = []
    let next = 0
    const startedAt = performance.now()
    async function worker() {
      while (next < batches.length) {
        const index = next++
        const t = Math.round(performance.now() - startedAt)
        const { body, events, ...rest } = await addTracks(null, pid, batches[index])
        // playlist_tracks 的返回在 SDK 1.4.0 里多包了一层：{ status, body: { code, count, trackIds }, cookie }
        results[index] = { index, t, ...rest, bodyCode: body?.body?.code, bodyCount: body?.body?.count, attempts: events?.length }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker))
    return { batches: batches.length, totalMs: Math.round(performance.now() - startedAt), results }
  }

  /**
   * 整张歌单的新顺序一次提交。campanulaBodyBytes 是 Campanula 自己的接口收到 { pid, ids } 时的请求体大小
   * （页面隐藏时用 keepalive 发，上限 64 KiB），不含测试版 /api/call 的外壳；probe-request-size.mjs 算的是同一个数。
   */
  async function reorder(name, pid, ids, note) {
    const payload = JSON.stringify(ids)
    const campanulaBodyBytes = new TextEncoder().encode(JSON.stringify({ pid, ids: payload })).length
    const res = await call(name, 'song_order_update', { pid, ids: payload }, { timeoutMs: WRITE_TIMEOUT_MS, note })
    return { n: ids.length, idsBytes: payload.length, campanulaBodyBytes, ...brief(res), body: res.body }
  }

  // ---- 封面：画一张 JPEG → 申请上传凭证 → 浏览器直传 → 设为封面 ----

  /** 渐变底加噪点（noise 0–255 控制文件大小），转成 JPEG。 */
  async function jpeg(size, quality, noise) {
    const canvas = new OffscreenCanvas(size, size)
    const context = canvas.getContext('2d')
    const gradient = context.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, '#cfeee0')
    gradient.addColorStop(1, '#f6c9b8')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
    if (noise > 0) {
      const image = context.getImageData(0, 0, size, size)
      let seed = 0x9E3779B9 | 0
      for (let index = 0; index < image.data.length; index += 4) {
        for (let channel = 0; channel < 3; channel += 1) {
          seed ^= seed << 13
          seed ^= seed >>> 17
          seed ^= seed << 5
          image.data[index + channel] += ((seed & 0xFF) - 128) * noise / 128
        }
      }
      context.putImageData(image, 0, 0)
    }
    context.fillStyle = '#1f3d33'
    context.font = `${Math.round(size / 12)}px sans-serif`
    context.fillText('Campanula 测试', size / 16, size / 2)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    const sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    return { blob, size, quality, noise, bytes: blob.size, sha256 }
  }

  /** 申请上传凭证并直传；record 是这次直传要记成的录制名（同时把凭证的返回记成 image_upload_token）。 */
  async function upload(image, record) {
    const tokenRes = await call(record ? 'playlist-edit.image_upload_token' : null, 'image_upload_token')
    if (!ok(tokenRes))
      return { step: 'token', ...brief(tokenRes) }
    const { uploadUrl, token, imgId, url_pre } = tokenRes.body.data
    const started = performance.now()
    let response
    let text
    try {
      response = await fetch(uploadUrl, { method: 'POST', headers: { 'x-nos-token': token, 'Content-Type': 'image/jpeg' }, body: image.blob })
      text = await response.text()
    }
    catch (error) {
      return { step: 'upload', imgId: String(imgId), bytes: image.bytes, error: String(error), ms: Math.round(performance.now() - started) }
    }
    const durationMs = Math.round(performance.now() - started)
    let body
    try {
      body = JSON.parse(text)
    }
    catch {
      body = text.slice(0, 2000)
    }
    const headers = { 'access-control-allow-origin': response.headers.get('access-control-allow-origin'), 'content-type': response.headers.get('content-type') }
    if (record) {
      recordings.push({
        name: record,
        module: 'nos_upload',
        query: { bytes: image.bytes, width: image.size, height: image.size, quality: image.quality, contentType: 'image/jpeg' },
        options: {},
        recordedAt: new Date().toISOString(),
        via: 'browser-direct',
        viewer: `vip-${SLOT}`,
        res: { status: response.status, code: body?.code ?? response.status, body, headers, durationMs },
      })
    }
    return { step: 'done', imgId: String(imgId), url_pre, uploadStatus: response.status, uploadBody: body, headers, ms: durationMs, bytes: image.bytes, sha256: image.sha256 }
  }

  async function setCover(name, id, imgId, note) {
    const res = await call(name, 'playlist_cover_update', { id, imgId }, { note })
    return { ...brief(res), body: res.body }
  }

  return { call, drain, snapshot, playlists, compare, detail, addTracks, addInParallel, reorder, jpeg, upload, setCover }
})()
