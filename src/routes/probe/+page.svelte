<script lang='ts'>
  import { install } from '$lib/probe/install.svelte'
  import { errorText, listLog, logPage } from '$lib/probe/log'
  import LogView from '$lib/probe/LogView.svelte'
  import { onMount } from 'svelte'

  interface Env {
    displayMode: string
    orientation: string
    viewport: string
    userAgent: string
    uaData?: Record<string, unknown>
    serviceWorker: string
    backgroundFetch: boolean
    mediaSession: boolean
    navigationApi: boolean
    closeWatcher: boolean
    storage?: string
    persisted?: boolean
  }

  let env = $state<Env | null>(null)
  let installResult = $state('')
  let exported = $state('')

  function displayMode(): string {
    const modes = ['fullscreen', 'standalone', 'minimal-ui', 'browser']
    return modes.find(mode => matchMedia(`(display-mode: ${mode})`).matches) ?? '未知'
  }

  async function readEnv(): Promise<Env> {
    const registration = await navigator.serviceWorker?.getRegistration()
    const estimate = await navigator.storage?.estimate?.()
    return {
      displayMode: displayMode(),
      orientation: `${screen.orientation?.type ?? '?'}（${screen.orientation?.angle ?? '?'}°）`,
      viewport: `${innerWidth}×${innerHeight} @${devicePixelRatio}x`,
      userAgent: navigator.userAgent,
      uaData: await navigator.userAgentData?.getHighEntropyValues(['model', 'platformVersion', 'fullVersionList']).catch(() => undefined),
      serviceWorker: registration?.active ? `已激活（${registration.active.scriptURL}）` : registration ? '已注册，未激活' : '没有',
      backgroundFetch: Boolean(registration?.backgroundFetch),
      mediaSession: 'mediaSession' in navigator,
      navigationApi: 'navigation' in window,
      closeWatcher: 'CloseWatcher' in window,
      storage: estimate ? `已用 ${((estimate.usage ?? 0) / 1048576).toFixed(1)} MB / 配额 ${((estimate.quota ?? 0) / 1048576).toFixed(0)} MB` : undefined,
      persisted: await navigator.storage?.persisted?.(),
    }
  }

  async function refresh() {
    env = await readEnv()
  }

  async function promptInstall() {
    if (!install.prompt)
      return
    const event = install.prompt
    install.prompt = null
    try {
      await event.prompt()
      const choice = await event.userChoice
      installResult = `安装提示：${choice.outcome}（${choice.platform}）`
      await logPage('install', '安装提示的结果', choice)
    }
    catch (error) {
      installResult = errorText(error)
    }
  }

  async function persist() {
    const granted = await navigator.storage.persist()
    await logPage('install', '申请持久存储', { granted })
    await refresh()
  }

  /** 每次打开都记一笔当时的显示方式和屏幕方向：装好后从桌面图标打开，这里会是 standalone + portrait。 */
  async function recordOpen() {
    const current = await readEnv()
    env = current
    await logPage('install', '打开探针', { displayMode: current.displayMode, orientation: current.orientation, viewport: current.viewport })
  }

  async function exportAll() {
    const all = await listLog()
    exported = JSON.stringify({ env, log: all }, null, 2)
    await navigator.clipboard?.writeText(exported).catch(() => undefined)
  }

  onMount(() => {
    recordOpen()
    const onChange = () => {
      refresh()
      logPage('install', '屏幕方向变了', { orientation: `${screen.orientation?.type}（${screen.orientation?.angle}°）`, displayMode: displayMode() })
    }
    screen.orientation?.addEventListener('change', onChange)
    return () => screen.orientation?.removeEventListener('change', onChange)
  })
</script>

<h1>安装成独立应用、锁定竖屏</h1>

<section>
  <p>做法：在 Chrome 里点“安装”（或右上角菜单 → 添加到主屏幕 → 安装），装好后从桌面图标打开探针，转动手机，看下面“显示方式”和“屏幕方向”。</p>
  {#if install.installed}
    <p>已安装（收到 appinstalled）。</p>
  {:else if install.prompt}
    <button type='button' onclick={promptInstall}>安装</button>
  {:else}
    <p class='muted'>Chrome 还没给安装提示（已经装过、在独立窗口里打开，或者条件不满足时都不会给）。</p>
  {/if}
  {#if installResult}<p>{installResult}</p>{/if}
</section>

<section>
  <h2>这台设备</h2>
  {#if env}
    <dl>
      <dt>显示方式</dt><dd>{env.displayMode}</dd>
      <dt>屏幕方向</dt><dd>{env.orientation}</dd>
      <dt>视口</dt><dd>{env.viewport}</dd>
      <dt>Service Worker</dt><dd>{env.serviceWorker}</dd>
      <dt>Background Fetch</dt><dd>{env.backgroundFetch ? '有' : '没有'}</dd>
      <dt>Media Session</dt><dd>{env.mediaSession ? '有' : '没有'}</dd>
      <dt>Navigation API</dt><dd>{env.navigationApi ? '有' : '没有'}</dd>
      <dt>CloseWatcher</dt><dd>{env.closeWatcher ? '有' : '没有'}</dd>
      <dt>存储</dt><dd>{env.storage ?? '-'}；持久存储：{env.persisted ? '已获准' : '没有'}</dd>
      <dt>浏览器</dt><dd><code>{env.userAgent}</code></dd>
      {#if env.uaData}<dt>型号和版本</dt><dd><code>{JSON.stringify(env.uaData)}</code></dd>{/if}
    </dl>
    <button type='button' onclick={refresh}>刷新</button>
    <button type='button' onclick={persist} disabled={env.persisted}>申请持久存储</button>
  {/if}
</section>

<section>
  <h2>导出全部记录</h2>
  <p class='muted'>把五项的记录和这台设备的信息合成一份 JSON，复制到剪贴板。</p>
  <button type='button' onclick={exportAll}>导出</button>
  {#if exported}<textarea readonly rows='8'>{exported}</textarea>{/if}
</section>

<LogView topic='install' />

<style>
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 12px;
    margin: 8px 0;
  }
  dt {
    color: #4b5563;
  }
  dd {
    margin: 0;
    word-break: break-all;
  }
  code {
    font-size: 12px;
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    font: 12px/1.4 ui-monospace, monospace;
  }
  .muted {
    color: #4b5563;
  }
</style>
