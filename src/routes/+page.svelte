<script lang='ts'>
  import type { LogEntry } from '$lib/gate/client'
  import { call, dropSlot, gateLog, ping, rttTest, sessions } from '$lib/gate/client'
  import { onMount } from 'svelte'

  let phase = $state<'loading' | 'locked' | 'ready'>('loading')
  let passcode = $state('')
  let passError = $state('')
  let slots = $state<any[]>([])
  let recent = $state<LogEntry[]>([])

  // 扫码
  let qrImg = $state('')
  let qrStatus = $state('')
  let qrActive = false
  let verify = $state<{ img: string, qrCode: string, status: string } | null>(null)
  let qrKey = ''
  let verifyActive = false

  // 短信
  let phone = $state('')
  let captcha = $state('')
  let smsStatus = $state('')

  // 往返时间
  let rtt = $state<Awaited<ReturnType<typeof rttTest>> | null>(null)
  let rttBusy = $state(false)

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  function syncRecent() {
    recent = gateLog.slice(-15).reverse()
  }

  async function loadSessions() {
    const result = await sessions()
    if (result.httpStatus === 401) {
      phase = 'locked'
      return
    }
    slots = result.slots
    phase = 'ready'
  }

  async function submitPass(event: SubmitEvent) {
    event.preventDefault()
    passError = ''
    const response = await fetch('/api/pass', { method: 'POST', body: JSON.stringify({ passcode }) })
    passcode = ''
    if (!response.ok) {
      passError = '口令不对'
      return
    }
    await loadSessions()
  }

  async function startQr() {
    qrActive = false
    await sleep(50)
    verify = null
    qrImg = ''
    qrStatus = '正在取二维码…'
    const key = await call('login_qr_key', {}, { tag: 'qr' })
    syncRecent()
    qrKey = key.res.body?.data?.unikey ?? ''
    if (!qrKey) {
      qrStatus = `取二维码失败：${key.res.code} ${key.res.body?.msg ?? key.res.body?.message ?? ''}`
      return
    }
    const created = await call('login_qr_create', { key: qrKey, qrimg: true }, { tag: 'qr' })
    syncRecent()
    qrImg = created.res.body?.data?.qrimg ?? ''
    await pollQr()
  }

  async function pollQr() {
    qrActive = true
    const deadline = Date.now() + 5 * 60_000
    while (qrActive && Date.now() < deadline) {
      const result = await call('login_qr_check', { key: qrKey }, { save: 'qr', tag: 'qr' })
      syncRecent()
      const { code } = result.res
      qrStatus = `${code} ${result.res.body?.message ?? ''}`
      if (code === 803) {
        qrStatus = `803 登录成功${result.res.saved ? '，凭据已存进 qr 槽' : '，但没拿到 MUSIC_U'}`
        qrActive = false
        await loadSessions()
        return
      }
      if (code === 800) {
        qrActive = false
        return
      }
      if (code === 8821) {
        qrActive = false
        await startVerify(result.res.body)
        return
      }
      await sleep(3000)
    }
  }

  /** 在返回体里按名字找行为验证要的几个参数（8821 的结构没见过，先宽松地找）。 */
  function pick(value: any, names: string[]): string | undefined {
    if (!value || typeof value !== 'object')
      return undefined
    for (const [key, item] of Object.entries(value)) {
      if (names.includes(key) && (typeof item === 'string' || typeof item === 'number'))
        return String(item)
    }
    for (const item of Object.values(value)) {
      const found = pick(item, names)
      if (found !== undefined)
        return found
    }
    return undefined
  }

  async function startVerify(body: unknown) {
    const query = {
      vid: pick(body, ['vid', 'verifyId', 'verifyConfigId']),
      type: pick(body, ['type', 'verifyType']),
      token: pick(body, ['token', 'verifyToken']),
      evid: pick(body, ['evid', 'eventId', 'event_id']),
      sign: pick(body, ['sign']),
    }
    qrStatus = '8821：需要行为验证，正在取验证二维码…'
    const result = await call('verify_getQr', Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)), { tag: 'qr-verify' })
    syncRecent()
    const data = result.res.body?.data
    if (!data?.qrimg) {
      qrStatus = `verify_getQr 失败：${result.res.code} ${JSON.stringify(result.res.body).slice(0, 200)}`
      return
    }
    verify = { img: data.qrimg, qrCode: data.qrCode, status: '用网易云 App 扫这个验证码' }
    verifyActive = true
    const deadline = Date.now() + 5 * 60_000
    // eslint-disable-next-line no-unmodified-loop-condition -- resumeQr() 在别处把它置为 false
    while (verifyActive && Date.now() < deadline) {
      await sleep(3000)
      const status = await call('verify_qrcodestatus', { qr: data.qrCode }, { tag: 'qr-verify' })
      syncRecent()
      if (verify)
        verify.status = `${status.res.code} ${JSON.stringify(status.res.body?.data ?? status.res.body).slice(0, 160)}`
    }
  }

  async function resumeQr() {
    verifyActive = false
    verify = null
    await pollQr()
  }

  async function sendSms() {
    smsStatus = '正在发送…'
    const result = await call('captcha_sent', { phone, ctcode: '86' }, { redact: ['phone'], tag: 'sms' })
    syncRecent()
    smsStatus = `发送验证码：${result.res.code} ${result.res.body?.message ?? result.res.body?.msg ?? ''}`
  }

  async function loginSms() {
    smsStatus = '正在登录…'
    const result = await call('login_cellphone', { phone, captcha, countrycode: '86' }, { save: 'sms', redact: ['phone', 'captcha'], tag: 'sms' })
    syncRecent()
    captcha = ''
    smsStatus = `短信登录：${result.res.code} ${result.res.body?.message ?? result.res.body?.msg ?? ''}${result.res.saved ? '，凭据已存进 sms 槽' : ''}`
    if (result.res.saved)
      phone = ''
    await loadSessions()
  }

  async function runRtt() {
    rttBusy = true
    try {
      rtt = await rttTest(20)
    }
    finally {
      rttBusy = false
    }
  }

  async function drop(slot: string) {
    await dropSlot(slot)
    await loadSessions()
  }

  onMount(() => {
    Object.assign(window, { gate: { call, ping, rttTest, sessions, dropSlot, log: gateLog } })
    syncRecent()
    loadSessions()
  })
</script>

<main>
  <h1>Campanula 验证关卡①</h1>

  {#if phase === 'loading'}
    <p>加载中…</p>
  {:else if phase === 'locked'}
    <form onsubmit={submitPass}>
      <label>访问口令 <input type='password' bind:value={passcode} autocomplete='current-password' /></label>
      <button type='submit'>进入</button>
      {#if passError}<p class='error'>{passError}</p>{/if}
    </form>
  {:else}
    <section>
      <h2>登录槽</h2>
      {#if slots.length === 0}<p>还没有登录。</p>{/if}
      <ul>
        {#each slots as slot (slot.slot)}
          <li>
            <strong>{slot.slot}</strong>
            · {slot.method} · 登录于 {new Date(slot.loginAt).toLocaleString()}
            {#if slot.refreshedAt}· 续期于 {new Date(slot.refreshedAt).toLocaleString()}{/if}
            · MUSIC_U 指纹 {slot.fp}
            <button type='button' onclick={() => drop(slot.slot)}>删掉这个槽</button>
            <details>
              <summary>Set-Cookie 属性（无值）</summary>
              <pre>{JSON.stringify(slot.setCookie, null, 2)}</pre>
            </details>
          </li>
        {/each}
      </ul>
      <button type='button' onclick={loadSessions}>刷新</button>
    </section>

    <section>
      <h2>扫码登录</h2>
      <button type='button' onclick={startQr}>取二维码</button>
      {#if qrImg}<img src={qrImg} alt='登录二维码' width='200' height='200' />{/if}
      <p>{qrStatus}</p>
      {#if verify}
        <p>行为验证：{verify.status}</p>
        <img src={verify.img} alt='行为验证二维码' width='200' height='200' />
        <button type='button' onclick={resumeQr}>已完成验证，继续查扫码状态</button>
      {/if}
    </section>

    <section>
      <h2>短信登录</h2>
      <label>手机号 <input type='tel' bind:value={phone} autocomplete='off' /></label>
      <button type='button' onclick={sendSms} disabled={!phone}>发送验证码</button>
      <label>验证码 <input inputmode='numeric' bind:value={captcha} autocomplete='one-time-code' /></label>
      <button type='button' onclick={loginSms} disabled={!phone || !captcha}>登录</button>
      <p>{smsStatus}</p>
    </section>

    <section>
      <h2>往返时间</h2>
      <button type='button' onclick={runRtt} disabled={rttBusy}>{rttBusy ? '测量中…' : '连续测 20 次'}</button>
      {#if rtt}
        <p>第一次 {rtt.first} ms · 最小 {rtt.min} · 中位 {rtt.p50} · P90 {rtt.p90} · 最大 {rtt.max} ms</p>
        <p>实例：{rtt.instances.join('、')}</p>
      {/if}
    </section>

    <section>
      <h2>最近的调用（共 {gateLog.length} 条，只在这个标签页里）</h2>
      <table>
        <thead><tr><th>时间</th><th>模块</th><th>槽</th><th>IP</th><th>code</th><th>耗时</th><th>往返</th></tr></thead>
        <tbody>
          {#each recent as entry (entry.at + entry.module)}
            <tr>
              <td>{entry.at.slice(11, 19)}</td>
              <td>{entry.module}</td>
              <td>{entry.options.slot ?? 'none'}</td>
              <td>{entry.options.ip ?? 'default'}</td>
              <td>{entry.res.code ?? entry.httpStatus}</td>
              <td>{entry.res.durationMs ?? '-'} ms</td>
              <td>{entry.rttMs} ms</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 760px;
    margin: 0 auto;
    padding: 16px;
    font: 14px/1.6 system-ui, sans-serif;
  }
  section {
    margin: 20px 0;
    padding-top: 12px;
    border-top: 1px solid #ddd;
  }
  label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    margin: 4px 8px 4px 0;
  }
  button {
    padding: 4px 10px;
    margin: 4px 0;
  }
  img {
    display: block;
    margin: 8px 0;
  }
  pre {
    font-size: 12px;
    overflow: auto;
  }
  table {
    border-collapse: collapse;
    font-size: 12px;
  }
  td, th {
    padding: 2px 8px;
    text-align: left;
  }
  .error {
    color: #b00020;
  }
</style>
