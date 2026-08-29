<script lang='ts'>
  import { Download, X } from 'lucide-svelte'
  import { onMount } from 'svelte'

  /** beforeinstallprompt 事件（非标准，仅 Chromium 系/Android 触发） */
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  /** iOS 手动添加主屏的提示只展示一次（记录在案的平台限制） */
  const INSTALL_HINT_KEY = 'campanula.installHint'

  let deferredPrompt: BeforeInstallPromptEvent | null = $state(null)
  let showIosHint = $state(false)

  onMount(() => {
    // 捕获安装事件：阻止浏览器默认迷你安装条，改由本组件呈现安装入口
    const onPrompt = (event: Event) => {
      event.preventDefault()
      deferredPrompt = event as BeforeInstallPromptEvent
    }
    const onInstalled = () => {
      deferredPrompt = null
    }
    // iOS Safari 无 beforeinstallprompt 支持：提示手动操作，后台播放受系统限制（记录在案）
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      && !('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone)
    if (isIos && !localStorage.getItem(INSTALL_HINT_KEY)) {
      showIosHint = true
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  })

  async function install() {
    if (!deferredPrompt)
      return
    await deferredPrompt.prompt()
    deferredPrompt = null
  }

  function dismissIosHint() {
    showIosHint = false
    try {
      localStorage.setItem(INSTALL_HINT_KEY, '1')
    }
    catch {
    // 存储不可用时仅本次会话内隐藏
    }
  }
</script>

{#if deferredPrompt}
  <div
    role='region'
    aria-label='安装提示'
    class='fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6'
  >
    <div class='max-w-md w-full flex items-center gap-3 border border-app-border rounded-xl bg-app-surface p-4 shadow-lg'>
      <Download class='size-5 shrink-0 text-primary-700' />
      <div class='min-w-0 flex-1'>
        <p class='text-sm text-app-text font-medium'>把风铃草安装到主屏</p>
      </div>
      <button
        type='button'
        class='rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-primary-700'
        onclick={install}
      >
        安装
      </button>
      <button
        type='button'
        class='text-app-text-muted transition-colors hover:text-app-text'
        aria-label='关闭安装提示'
        onclick={() => (deferredPrompt = null)}
      >
        <X class='size-4' />
      </button>
    </div>
  </div>
{/if}

{#if showIosHint}
  <div
    role='region'
    aria-label='iOS 安装提示'
    class='fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4'
  >
    <div class='max-w-md w-full flex items-center gap-3 border border-app-border rounded-xl bg-app-surface p-4 shadow-lg'>
      <p class='min-w-0 flex-1 text-sm text-app-text-muted'>
        请在 Safari 中选「分享 → 添加到主屏幕」
      </p>
      <button
        type='button'
        class='shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-primary-700'
        onclick={dismissIosHint}
      >
        知道了
      </button>
    </div>
  </div>
{/if}
