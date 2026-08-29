<script lang='ts'>
  import type { BindingStatusResponse, QrPollResponse } from '$lib/ncm/binding'
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { clearBindingInvalid } from '$lib/binding'
  import Logo from '$lib/components/svg/Logo.svelte'
  import { BINDING_ERROR_TEXT, BindingClientError, fetchBindingStatus, fetchQrStatus, QR_POLL_INTERVAL, startQrLogin } from '$lib/ncm/binding'
  import { Loader, RefreshCw } from '@lucide/svelte'
  import { onMount } from 'svelte'

  /** 绑定页承载两种态：尚未绑定（首次）与绑定失效（重绑） */
  type Mode = 'first' | 'invalid'

  /** 二维码登录状态机：获取 key → 生成二维码 → 带间隔轮询扫码状态 → 确认写入凭据 */
  type Phase = 'checking' | 'creating' | 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'error'

  let mode = $state<Mode>('first')
  let phase = $state<Phase>('checking')
  let errorMessage = $state<string | null>(null)
  let qr = $state<{ key: string, qrUrl: string, qrimg: string } | null>(null)

  let controller: AbortController | null = null
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  /** 会话号：刷新二维码/卸载时自增，作废在途轮询结果，防迟到覆盖 */
  let session = 0

  onMount(() => {
    controller = new AbortController()
    void init()
    return () => {
      controller?.abort()
      session += 1
      if (pollTimer)
        clearTimeout(pollTimer)
    }
  })

  async function init() {
    phase = 'checking'
    let status: BindingStatusResponse
    try {
      status = await fetchBindingStatus(controller?.signal)
    }
    catch {
      phase = 'error'
      errorMessage = BINDING_ERROR_TEXT.UNKNOWN
      return
    }
    if (status.status === 'valid') {
      // 已绑定：无需再绑（正常应被心跳引导离开，兜底防误入重复绑定）
      await goto(resolve('/'))
      return
    }
    mode = status.status === 'invalid' ? 'invalid' : 'first'
    await start()
  }

  function presentError(err: unknown) {
    phase = 'error'
    errorMessage = err instanceof BindingClientError
      ? (err.message || BINDING_ERROR_TEXT[err.code])
      : BINDING_ERROR_TEXT.UNKNOWN
  }

  /** 开始/刷新二维码：获取 key 与二维码后进入轮询 */
  async function start() {
    session += 1
    const current = session
    phase = 'creating'
    errorMessage = null
    try {
      qr = await startQrLogin(controller?.signal)
      if (current !== session)
        return
      phase = 'waiting'
      await pollOnce(current)
    }
    catch (err) {
      if (current !== session)
        return
      presentError(err)
    }
  }

  function schedulePoll(current: number) {
    if (pollTimer)
      clearTimeout(pollTimer)
    pollTimer = setTimeout(() => {
      void pollOnce(current)
    }, QR_POLL_INTERVAL)
  }

  /** 轮询扫码状态：确认即进入应用；过期停止并引导刷新；其余状态续拍直到终止 */
  async function pollOnce(current: number) {
    if (!qr)
      return
    let result: QrPollResponse
    try {
      result = await fetchQrStatus(qr.key, controller?.signal)
    }
    catch (err) {
      if (current !== session)
        return
      presentError(err)
      return
    }
    if (current !== session)
      return
    if (result.status === 'confirmed') {
      phase = 'confirmed'
      clearBindingInvalid()
      await goto(resolve('/'))
      return
    }
    if (result.status === 'expired') {
      phase = 'expired'
      return
    }
    phase = result.status === 'scanned' ? 'scanned' : 'waiting'
    schedulePoll(current)
  }
</script>

<svelte:head>
  <title>绑定网易云账号 | Campanula Music</title>
</svelte:head>

<main class='flex flex-col items-center justify-center gap-10 bg-app-bg px-6 py-12 text-app-text min-h-dvh'>
  <header class='flex flex-col items-center gap-3 text-center'>
    <span class='flex items-center gap-2'>
      <Logo />
      <span class='text-lg font-semibold'>Campanula Music</span>
    </span>
    <h1 class='text-2xl font-semibold'>
      {mode === 'invalid' ? '绑定已失效' : '绑定网易云账号'}
    </h1>
    <p class='max-w-sm text-sm text-app-text-muted'>
      {mode === 'invalid' ? '账号许可已失效' : '用网易云 App 扫码绑定'}
    </p>
  </header>

  <section aria-label='扫码绑定操作区' class='max-w-80 w-full flex flex-col items-center gap-4 border border-app-border rounded-2xl bg-app-surface p-6'>
    {#if qr}
      <img src={qr.qrimg} alt='绑定二维码' class='size-56 rounded-lg' />
    {:else}
      <div class='size-56 flex items-center justify-center rounded-lg bg-app-surface-hover text-app-text-muted'>
        <Loader class='size-8 animate-spin' />
      </div>
    {/if}

    <div class='min-h-12 flex flex-col items-center gap-2 text-center'>
      {#if phase === 'checking' || phase === 'creating'}
        <p class='text-sm text-app-text-muted'>正在准备绑定，请稍候…</p>
      {:else if phase === 'waiting'}
        <p class='text-sm text-app-text-muted'>打开网易云 App 扫一扫</p>
      {:else if phase === 'scanned'}
        <p class='text-sm text-app-text'>扫码成功，请在手机上确认登录</p>
      {:else if phase === 'confirmed'}
        <p class='text-sm text-app-text'>绑定成功，正在进入应用…</p>
      {:else if phase === 'expired'}
        <p class='text-sm text-app-text-muted'>二维码已过期</p>
      {:else if phase === 'error'}
        <p role='alert' class='text-sm text-error-700'>{errorMessage}</p>
      {/if}

      {#if phase === 'expired' || phase === 'error'}
        <button
          onclick={() => void start()}
          class='mt-1 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-50 font-medium transition-colors hover:bg-primary-600'
        >
          <RefreshCw class='size-4' />
          {phase === 'expired' ? '刷新二维码' : '重试'}
        </button>
      {/if}
    </div>
  </section>

</main>
